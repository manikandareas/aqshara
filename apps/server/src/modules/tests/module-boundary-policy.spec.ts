import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

type ImportViolation = {
  file: string;
  importedModule: string;
  currentModule: string;
};

const ALLOWED_CROSS_REPOSITORY_IMPORTS = new Set([
  'reader->documents',
  'engagement->documents',
]);

function walkFiles(root: string): string[] {
  const result: string[] = [];

  const entries = readdirSync(root);
  for (const entry of entries) {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      result.push(...walkFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith('.service.ts')) {
      result.push(fullPath);
    }
  }

  return result;
}

function getCurrentModuleFromPath(pathname: string): string {
  const normalized = pathname.replace(/\\/g, '/');
  const match = normalized.match(/src\/modules\/([^/]+)\//);

  if (!match) {
    throw new Error(`Unable to resolve module name from path: ${pathname}`);
  }

  return match[1];
}

describe('Module boundary policy', () => {
  const modulesRoot = join(process.cwd(), 'src', 'modules');

  it('disallows unauthorized cross-module repository imports', () => {
    const serviceFiles = walkFiles(modulesRoot);
    const violations: ImportViolation[] = [];

    for (const file of serviceFiles) {
      const currentModule = getCurrentModuleFromPath(file);
      const content = readFileSync(file, 'utf8');

      const importMatches = content.matchAll(
        /from ['"](?:\.\.\/)+([^/]+)\/[^'"]+\.repository['"]/g,
      );

      for (const match of importMatches) {
        const importedModule = match[1];
        if (importedModule === currentModule) {
          continue;
        }

        const key = `${currentModule}->${importedModule}`;
        if (ALLOWED_CROSS_REPOSITORY_IMPORTS.has(key)) {
          continue;
        }

        violations.push({
          file: relative(process.cwd(), file),
          importedModule,
          currentModule,
        });
      }
    }

    expect(violations).toEqual([]);
  });

  it('allows only ownership-read method usage for documents repository cross-module access', () => {
    const allowedFiles = [
      join(process.cwd(), 'src', 'modules', 'reader', 'reader.service.ts'),
      join(
        process.cwd(),
        'src',
        'modules',
        'engagement',
        'engagement.service.ts',
      ),
    ];

    for (const file of allowedFiles) {
      const content = readFileSync(file, 'utf8');
      const methodCalls = [
        ...content.matchAll(/documentsRepository\.(\w+)\(/g),
      ].map((match) => match[1]);

      const disallowed = methodCalls.filter(
        (method) => method !== 'findOwnedDocumentById',
      );

      expect(disallowed).toEqual([]);
    }
  });
});
