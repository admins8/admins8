export interface SocialBookInput {
    bookUrl: string;
    name?: string;
    author?: string;
}
export declare function getBookLikeTargetId(bookUrl: string): string;
export declare function normalizeCommentContent(content: unknown): string;
export declare function normalizeSocialBookInput(input: any): SocialBookInput;
export declare function getBookComments(bookUrl: string): Promise<any[]>;
export declare function createBookComment(userId: number, bookUrl: string, content: unknown): Promise<any>;
export declare function deleteBookComment(userId: number, commentId: number): Promise<boolean>;
export declare function toggleBookLike(userId: number, bookUrl: string): Promise<{
    liked: boolean;
}>;
export declare function getBookSocialStats(input: any, userId?: number | null): Promise<{
    commentCount: number;
    likeCount: number;
    favoriteCount: number;
    liked: boolean;
    favorited: boolean;
}>;
//# sourceMappingURL=bookSocialService.d.ts.map