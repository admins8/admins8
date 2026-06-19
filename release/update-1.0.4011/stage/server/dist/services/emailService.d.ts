export declare function sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
}): Promise<void>;
export declare function sendPasswordResetCode(to: string, code: string): Promise<void>;
export declare function sendTestEmail(to: string): Promise<void>;
//# sourceMappingURL=emailService.d.ts.map