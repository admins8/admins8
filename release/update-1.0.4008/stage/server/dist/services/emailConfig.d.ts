export interface EmailConfig {
    email_enabled: boolean;
    email_from_name: string;
    email_from_address: string;
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    smtp_username: string;
    smtp_password: string;
    pop3_host: string;
    pop3_port: number;
    pop3_secure: boolean;
    imap_host: string;
    imap_port: number;
    imap_secure: boolean;
}
export declare const EMAIL_CONFIG_KEYS: readonly ["email_enabled", "email_from_name", "email_from_address", "smtp_host", "smtp_port", "smtp_secure", "smtp_username", "smtp_password", "pop3_host", "pop3_port", "pop3_secure", "imap_host", "imap_port", "imap_secure"];
export declare function parseBool(value: unknown): boolean;
export declare function parsePort(value: unknown, fallback: number): number;
export declare function buildEmailConfig(map: Record<string, string | undefined>): EmailConfig;
export declare function maskEmailConfig<T extends {
    config_key: string;
    config_value: string;
}>(items: T[]): T[];
export declare function isEmailConfigComplete(config: EmailConfig): boolean;
export declare function formatSmtpError(err: any): string;
//# sourceMappingURL=emailConfig.d.ts.map