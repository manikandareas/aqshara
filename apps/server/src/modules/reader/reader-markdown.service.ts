import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { StorageService } from '../../infrastructure/storage/storage.service';

type RewriteWarning = {
  code: string;
  message: string;
};

const IMAGE_MIME_TO_EXTENSION: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

@Injectable()
export class ReaderMarkdownService {
  private readonly maxImageBytes = 8 * 1024 * 1024;

  constructor(private readonly storageService: StorageService) {}

  async rewriteMarkdownAssets(input: {
    documentId: string;
    paragraphId: string;
    markdown: string;
    pageImages: Record<string, string>;
  }): Promise<{ markdown: string; warnings: RewriteWarning[] }> {
    const warnings: RewriteWarning[] = [];
    const uploadCache = new Map<string, string>();
    const pattern = /(!?)\[([^\]]*?)\]\(([^)\n]+)\)/g;

    const chunks: string[] = [];
    let cursor = 0;

    for (const match of input.markdown.matchAll(pattern)) {
      const [raw, bang, label, rawTarget] = match;
      const start = match.index ?? 0;
      chunks.push(input.markdown.slice(cursor, start));
      cursor = start + raw.length;

      const target = this.extractTarget(rawTarget);
      const isImage = bang === '!';

      if (this.isAllowedExternalUrl(target)) {
        chunks.push(raw);
        continue;
      }

      const resolved = await this.resolveTargetUrl({
        documentId: input.documentId,
        paragraphId: input.paragraphId,
        target,
        pageImages: input.pageImages,
        uploadCache,
      });

      if (!resolved.url) {
        warnings.push({
          code: isImage ? 'ocr_image_reference_invalid' : 'ocr_link_reference_invalid',
          message: `Neutralized unsupported markdown target: ${target}`,
        });
        chunks.push(`${bang}[${label}](#)`);
        continue;
      }

      chunks.push(`${bang}[${label}](${resolved.url})`);
    }

    chunks.push(input.markdown.slice(cursor));

    return {
      markdown: chunks.join(''),
      warnings,
    };
  }

  stripMarkdown(markdown: string): string {
    return markdown
      .replace(/!\[[^\]]*?\]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
      .replace(/[*_~>#-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractTarget(rawTarget: string): string {
    const trimmed = rawTarget.trim();
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return trimmed.slice(1, -1).trim();
    }

    const quotedIndex = trimmed.search(/\s+"/);
    if (quotedIndex >= 0) {
      return trimmed.slice(0, quotedIndex).trim();
    }

    return trimmed;
  }

  private isAllowedExternalUrl(target: string): boolean {
    return /^https:\/\//i.test(target);
  }

  private async resolveTargetUrl(input: {
    documentId: string;
    paragraphId: string;
    target: string;
    pageImages: Record<string, string>;
    uploadCache: Map<string, string>;
  }): Promise<{ url: string | null }> {
    const cached = input.uploadCache.get(input.target);
    if (cached) {
      return { url: cached };
    }

    const payload =
      this.extractInlineDataUri(input.target) ??
      this.lookupImagePayload(input.target, input.pageImages);

    if (!payload) {
      return { url: null };
    }

    const decoded = this.decodeImagePayload(payload, input.target);
    if (!decoded) {
      return { url: null };
    }

    const shortHash = createHash('sha256')
      .update(decoded.bytes)
      .digest('hex')
      .slice(0, 12);
    const key = this.storageService.createDocumentAssetKey(
      input.documentId,
      input.paragraphId,
      shortHash,
      decoded.extension,
    );

    await this.storageService.uploadObject(key, decoded.bytes, decoded.contentType);
    const url = this.storageService.createObjectUrl(key);
    input.uploadCache.set(input.target, url);
    return { url };
  }

  private extractInlineDataUri(target: string): string | null {
    return target.startsWith('data:image/') ? target : null;
  }

  private lookupImagePayload(
    target: string,
    pageImages: Record<string, string>,
  ): string | null {
    const candidates = Array.from(
      new Set([target, decodeURIComponent(target), this.basename(target)]),
    );

    for (const candidate of candidates) {
      const payload = pageImages[candidate];
      if (typeof payload === 'string' && payload.trim().length > 0) {
        return payload;
      }
    }

    return null;
  }

  private basename(target: string): string {
    const value = target.split('?')[0]?.split('#')[0] ?? target;
    const parts = value.split('/');
    return parts[parts.length - 1] ?? value;
  }

  private decodeImagePayload(
    payload: string,
    target: string,
  ): { bytes: Buffer; contentType: string; extension: string } | null {
    if (payload.trim().length === 0) {
      return null;
    }

    const dataUriMatch = payload.match(/^data:([^;,]+);base64,(.+)$/i);
    let bytes: Buffer;
    let contentType: string | null = null;

    if (dataUriMatch) {
      bytes = this.safeDecodeBase64(dataUriMatch[2]);
      contentType = dataUriMatch[1].toLowerCase();
    } else {
      bytes = this.safeDecodeBase64(payload);
      contentType = this.mimeTypeFromExtension(target) ?? this.mimeTypeFromBytes(bytes);
    }

    if (bytes.length === 0 || bytes.length > this.maxImageBytes) {
      return null;
    }

    const detectedContentType =
      contentType?.startsWith('image/') === true
        ? contentType
        : this.mimeTypeFromBytes(bytes);

    if (!detectedContentType || !detectedContentType.startsWith('image/')) {
      return null;
    }

    const extension = IMAGE_MIME_TO_EXTENSION[detectedContentType] ?? 'bin';

    return {
      bytes,
      contentType: detectedContentType,
      extension,
    };
  }

  private safeDecodeBase64(value: string): Buffer {
    const normalized = value.replace(/\s+/g, '');
    try {
      return Buffer.from(normalized, 'base64');
    } catch {
      return Buffer.alloc(0);
    }
  }

  private mimeTypeFromExtension(target: string): string | null {
    const lower = target.toLowerCase();
    if (lower.endsWith('.png')) {
      return 'image/png';
    }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    if (lower.endsWith('.gif')) {
      return 'image/gif';
    }
    if (lower.endsWith('.webp')) {
      return 'image/webp';
    }
    if (lower.endsWith('.svg')) {
      return 'image/svg+xml';
    }
    return null;
  }

  private mimeTypeFromBytes(bytes: Buffer): string | null {
    if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return 'image/png';
    }
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    if (bytes.length >= 6 && bytes.subarray(0, 6).toString('ascii') === 'GIF89a') {
      return 'image/gif';
    }
    if (bytes.length >= 6 && bytes.subarray(0, 6).toString('ascii') === 'GIF87a') {
      return 'image/gif';
    }
    if (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }
    const trimmed = bytes.subarray(0, 256).toString('utf8').trimStart();
    if (trimmed.startsWith('<svg')) {
      return 'image/svg+xml';
    }
    return null;
  }
}
