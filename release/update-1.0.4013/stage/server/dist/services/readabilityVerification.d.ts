interface ReadableEngine {
    getChapterList(source: any, book: any): Promise<any[]>;
    getContent(source: any, book: any, chapter: any): Promise<string | null>;
}
interface VerifyReadableBookCandidateOptions {
    engine: ReadableEngine;
    source: any;
    book: any;
    timeoutMs: number;
}
interface VerifyReadableSwitchCandidateOptions extends VerifyReadableBookCandidateOptions {
    chapterIndex: number;
}
export interface ReadabilityVerificationResult {
    readable: boolean;
    tocVerified: boolean;
    contentVerified: boolean;
    chapter?: any;
}
export declare function verifyReadableBookCandidate(options: VerifyReadableBookCandidateOptions): Promise<ReadabilityVerificationResult>;
export declare function verifyReadableSwitchCandidate(options: VerifyReadableSwitchCandidateOptions): Promise<ReadabilityVerificationResult>;
export {};
//# sourceMappingURL=readabilityVerification.d.ts.map