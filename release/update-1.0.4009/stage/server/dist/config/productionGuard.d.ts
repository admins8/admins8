export interface ProductionConfigInput {
    nodeEnv: string;
    jwtSecret: string;
    adminPassword: string;
    licensePath: string;
    sourceJsEnabled: boolean;
    redisEnabled: boolean;
}
export interface ProductionConfigResult {
    ok: boolean;
    errors: string[];
    warnings: string[];
}
export declare function validateProductionConfig(input: ProductionConfigInput): ProductionConfigResult;
export declare function validateNativeModuleState(input: {
    sourceJsEnabled: boolean;
    isolatedVmAvailable: boolean;
}): ProductionConfigResult;
export declare function assertProductionReady(config: {
    jwtSecret: string;
    adminPassword: string;
    licensePath?: string;
    sourceJsEnabled: boolean;
    redisEnabled: boolean;
}): void;
//# sourceMappingURL=productionGuard.d.ts.map