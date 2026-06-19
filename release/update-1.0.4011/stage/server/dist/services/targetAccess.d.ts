import { UrlOption } from './bookSourceHttpClient';
export type TargetAccessMode = 'direct' | 'snapshot-fallback' | 'snapshot-first';
export interface TargetAccessOption extends UrlOption {
    targetAccessMode?: TargetAccessMode;
}
export declare function buildJinaMarkdownSnapshotUrl(url: string): string;
export declare function shouldUseJinaSnapshot(url: string, option?: Pick<TargetAccessOption, 'method'>): boolean;
export declare function buildTargetAccessAttempts(url: string, option?: TargetAccessOption): string[];
export declare function isJinaMarkdownSnapshot(html: string): boolean;
export declare function jinaMarkdownContent(html: string): string;
export declare function normalizeJinaMarkdownText(value: string): string;
export declare function extractJinaMarkdownLinks(html: string): Array<{
    title: string;
    url: string;
}>;
export declare function extractJinaMarkdownText(html: string): string;
export declare function requestTargetHtml(url: string, headers: Record<string, string>, option?: TargetAccessOption): Promise<string>;
//# sourceMappingURL=targetAccess.d.ts.map