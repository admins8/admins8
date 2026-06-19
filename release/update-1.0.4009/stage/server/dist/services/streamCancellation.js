"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStreamCancellationState = createStreamCancellationState;
function createStreamCancellationState() {
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
//# sourceMappingURL=streamCancellation.js.map