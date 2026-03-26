export type ExportFailureStrategy = {
  markFailed: boolean;
  unrecoverable: boolean;
};

export function getExportFailureStrategy(input: {
  retryable: boolean;
  attemptsMade: number;
  maxAttempts: number;
}): ExportFailureStrategy {
  if (!input.retryable) {
    return {
      markFailed: true,
      unrecoverable: true,
    };
  }

  const maxAttempts = Math.max(1, input.maxAttempts);
  const isLastAttempt = input.attemptsMade + 1 >= maxAttempts;

  return {
    markFailed: isLastAttempt,
    unrecoverable: false,
  };
}
