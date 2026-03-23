type Logger = {
  info: (message: string) => void;
  error: (message: string, error?: unknown) => void;
};

export function createLogger(scope: string): Logger {
  return {
    info(message) {
      console.info(`[${scope}] ${message}`);
    },
    error(message, error) {
      console.error(`[${scope}] ${message}`, error);
    },
  };
}
