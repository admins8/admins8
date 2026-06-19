export class ChapterContentLoadQueue {
  private readonly running = new Map<string, Promise<unknown>>();

  private key(bookUrl: string, chapterIndex: number): string {
    return `${bookUrl}::${chapterIndex}`;
  }

  async run<T>(bookUrl: string, chapterIndex: number, task: () => Promise<T>): Promise<T> {
    const key = this.key(bookUrl, chapterIndex);
    const existing = this.running.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = task().finally(() => {
      this.running.delete(key);
    });
    this.running.set(key, promise);
    return promise;
  }
}

export const chapterContentLoadQueue = new ChapterContentLoadQueue();
