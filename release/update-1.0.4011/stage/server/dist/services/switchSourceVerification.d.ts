export interface SwitchSourceVerificationDeps {
    findSourceByUrl(sourceUrl: string): Promise<any>;
    createEngine(): {
        getChapterList(source: any, book: any): Promise<any[]>;
        getContent?: (source: any, book: any, chapter: any) => Promise<string | null>;
    };
}
export declare function verifySwitchTargetReadable(newBook: any, chapterIndex: number, deps: SwitchSourceVerificationDeps): Promise<{
    ok: boolean;
    msg: string;
    toc?: undefined;
} | {
    ok: boolean;
    toc: any[];
    msg?: undefined;
}>;
//# sourceMappingURL=switchSourceVerification.d.ts.map