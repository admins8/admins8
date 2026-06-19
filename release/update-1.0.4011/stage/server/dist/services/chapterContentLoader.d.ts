export declare class ChapterContentLoadQueue {
    private readonly running;
    private key;
    run<T>(bookUrl: string, chapterIndex: number, task: () => Promise<T>): Promise<T>;
}
export declare const chapterContentLoadQueue: ChapterContentLoadQueue;
//# sourceMappingURL=chapterContentLoader.d.ts.map