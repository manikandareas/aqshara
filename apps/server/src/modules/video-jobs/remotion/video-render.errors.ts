const TERMINAL_RENDER_ERROR_PATTERNS = [
  'ERR_CERT_COMMON_NAME_INVALID',
  'SSL: no alternative certificate subject name matches',
  'Network error fetching',
  'Failed to load resource',
  'Received a status code of 404 while downloading file',
  'Unknown container format for',
  'The requested path (',
];

export class VideoRenderTerminalError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'VideoRenderTerminalError';

    if (options && 'cause' in options) {
      Object.defineProperty(this, 'cause', {
        configurable: true,
        enumerable: false,
        value: options.cause,
        writable: true,
      });
    }
  }
}

export const isVideoRenderTerminalError = (
  error: unknown,
): error is VideoRenderTerminalError => {
  return error instanceof VideoRenderTerminalError;
};

export const normalizeVideoRenderError = (error: unknown): Error => {
  if (error instanceof Error) {
    const { message } = error;

    if (isVideoRenderTerminalError(error)) {
      return error;
    }

    if (
      TERMINAL_RENDER_ERROR_PATTERNS.some((pattern) =>
        message.includes(pattern),
      )
    ) {
      return new VideoRenderTerminalError(message, { cause: error });
    }

    return error;
  }

  return new Error('Video rendering failed');
};
