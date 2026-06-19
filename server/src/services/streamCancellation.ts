export interface StreamCancellationState {
  cancel(): void;
  isCancelled(): boolean;
  canSend(): boolean;
}

export function createStreamCancellationState(): StreamCancellationState {
  let cancelled = false;
  return {
    cancel() {
      cancelled = true;
    },
    isCancelled() {
      return cancelled;
    },
    canSend() {
      return !cancelled;
    },
  };
}
