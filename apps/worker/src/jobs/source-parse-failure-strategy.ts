export type SourceParseFailureStrategy = {
  markFailed: boolean;
  unrecoverable: boolean;
};

export function getSourceParseFailureStrategy(input: {
  retryable: boolean;
  attemptsMade: number;
  maxAttempts: number;
}): SourceParseFailureStrategy {
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
