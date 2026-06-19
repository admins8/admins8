export interface TableInfo {
    name: string;
    engine: string;
    rows: number;
    dataSizeKB: number;
    indexSizeKB: number;
    totalSizeKB: number;
    collation: string | null;
    createTime: string | null;
    updateTime: string | null;
}
export interface BackupFile {
    fileName: string;
    sizeKB: number;
    createdAt: string;
    hash: string | null;
}
export interface TableResult {
    table: string;
    operation: 'optimize' | 'repair';
    status: 'OK' | 'warning' | 'error';
    message: string;
    durationMs: number;
}
export declare function listTables(): Promise<TableInfo[]>;
export declare function backupTable(tableName: string): Promise<{
    fileName: string;
    sizeKB: number;
    rows: number;
}>;
export declare function backupAllTables(): Promise<{
    fileName: string;
    sizeKB: number;
    tables: number;
}>;
export declare function listBackupFiles(): Promise<BackupFile[]>;
export declare function restoreBackup(fileName: string): Promise<{
    success: true;
    sizeKB: number;
}>;
export declare function deleteBackup(fileName: string): Promise<void>;
export declare function optimizeTables(tables: string[]): Promise<TableResult[]>;
export declare function repairTables(tables: string[]): Promise<TableResult[]>;
export declare function getBackupDir(): string;
export declare function sha256File(filePath: string): Promise<string>;
//# sourceMappingURL=databaseService.d.ts.map