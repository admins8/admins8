export declare const config: {
    port: number;
    jwt: {
        secret: string;
        expiresIn: string;
    };
    db: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
        connectionLimit: number;
    };
    redis: {
        enabled: boolean;
        url: string;
        searchTtlSeconds: number;
        connectTimeout: number;
    };
    upload: {
        dir: string;
    };
    log: {
        level: string;
    };
    security: {
        enableSourceJs: boolean;
    };
    admin: {
        username: string;
        password: string;
        email: string;
    };
    legadoApp: {
        url: string;
    };
    search: {
        sourceConcurrency: number;
        globalConcurrency: number;
    };
    update: {
        manifestUrl: string;
        workDir: string;
        backupDir: string;
        historyFile: string;
        pm2Name: string;
        publicKeyPath: string;
        online: boolean;
    };
};
//# sourceMappingURL=index.d.ts.map