export interface StreamCancellationState {
    cancel(): void;
    isCancelled(): boolean;
    canSend(): boolean;
}
export declare function createStreamCancellationState(): StreamCancellationState;
//# sourceMappingURL=streamCancellation.d.ts.map