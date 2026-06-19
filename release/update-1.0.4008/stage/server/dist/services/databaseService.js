"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTables = listTables;
exports.backupTable = backupTable;
exports.backupAllTables = backupAllTables;
exports.listBackupFiles = listBackupFiles;
exports.restoreBackup = restoreBackup;
exports.deleteBackup = deleteBackup;
exports.optimizeTables = optimizeTables;
exports.repairTables = repairTables;
exports.getBackupDir = getBackupDir;
exports.sha256File = sha256File;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const node_crypto_1 = __importDefault(require("node:crypto"));
const database_1 = require("../config/database");
const config_1 = require("../config");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
const BACKUP_DIR = node_path_1.default.resolve(process.cwd(), 'data', 'backups', 'database');
function ensureBackupDir() {
    if (!node_fs_1.default.existsSync(BACKUP_DIR)) {
        node_fs_1.default.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}
async function queryAll(sql, params) {
    const db = (0, database_1.getDb)();
    const conn = await db.getConnection();
    try {
        const [rows] = await conn.query(sql, params ?? []);
        return rows;
    }
    finally {
        conn.release();
    }
}
async function listTables() {
    const rows = await queryAll('SELECT TABLE_NAME, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, TABLE_COLLATION, CREATE_TIME, UPDATE_TIME ' +
        "FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
    return rows.map((r) => {
        const dataKB = Number(r.DATA_LENGTH ?? 0) / 1024;
        const indexKB = Number(r.INDEX_LENGTH ?? 0) / 1024;
        return {
            name: String(r.TABLE_NAME),
            engine: String(r.ENGINE ?? ''),
            rows: Number(r.TABLE_ROWS ?? 0),
            dataSizeKB: Math.round(dataKB * 100) / 100,
            indexSizeKB: Math.round(indexKB * 100) / 100,
            totalSizeKB: Math.round((dataKB + indexKB) * 100) / 100,
            collation: r.TABLE_COLLATION ? String(r.TABLE_COLLATION) : null,
            createTime: r.CREATE_TIME ? String(r.CREATE_TIME) : null,
            updateTime: r.UPDATE_TIME ? String(r.UPDATE_TIME) : null,
        };
    });
}
function sanitizeTable(name) {
    if (!/^[A-Za-z0-9_$]+$/.test(name)) {
        throw new Error(`非法表名: ${name}`);
    }
    return name;
}
async function backupTable(tableName) {
    const safe = sanitizeTable(tableName);
    ensureBackupDir();
    const rows = await queryAll(`SELECT COUNT(*) AS cnt FROM \`${safe}\``);
    const totalRows = Number(rows[0]?.cnt ?? 0);
    const dateStr = new Date()
        .toISOString()
        .replace(/[:T]/g, '-')
        .replace(/\..*Z$/, '');
    const fileName = `${safe}-${dateStr}.sql`;
    const filePath = node_path_1.default.join(BACKUP_DIR, fileName);
    const host = config_1.config.db.host || '127.0.0.1';
    const port = String(config_1.config.db.port || 3306);
    const user = config_1.config.db.user || 'root';
    const password = config_1.config.db.password || '';
    const database = config_1.config.db.database || '';
    const mysqldumpArgs = [
        `--host=${host}`,
        `--port=${port}`,
        `--user=${user}`,
        `--password="${password.replace(/"/g, '\\"')}"`,
        `--default-character-set=utf8mb4`,
        `--no-create-db`,
        `--skip-comments`,
        database,
        safe,
        `> "${filePath}"`,
    ];
    const cmd = `mysqldump ${mysqldumpArgs.join(' ')}`;
    try {
        await execAsync(cmd, { timeout: 5 * 60 * 1000, maxBuffer: 128 * 1024 * 1024 });
    }
    catch (e) {
        if (e?.code === 'ENOENT' || /not found/i.test(e?.message || '')) {
            throw new Error('未检测到 mysqldump，无法调用系统 mysqldump。请在服务器安装 MySQL client 后重试。');
        }
        throw new Error(`mysqldump 执行失败: ${e?.message || String(e)}`);
    }
    const stat = node_fs_1.default.statSync(filePath);
    if (stat.size === 0) {
        try {
            node_fs_1.default.unlinkSync(filePath);
        }
        catch { /* noop */ }
        throw new Error(`mysqldump 生成的文件为空: ${safe}`);
    }
    return {
        fileName,
        sizeKB: Math.round((stat.size / 1024) * 100) / 100,
        rows: totalRows,
    };
}
async function backupAllTables() {
    const tables = await listTables();
    if (!tables.length) {
        throw new Error('没有可备份的表');
    }
    ensureBackupDir();
    const dateStr = new Date()
        .toISOString()
        .replace(/[:T]/g, '-')
        .replace(/\..*Z$/, '');
    const fileName = `full-backup-${dateStr}.sql`;
    const filePath = node_path_1.default.join(BACKUP_DIR, fileName);
    const host = config_1.config.db.host || '127.0.0.1';
    const port = String(config_1.config.db.port || 3306);
    const user = config_1.config.db.user || 'root';
    const password = config_1.config.db.password || '';
    const database = config_1.config.db.database || '';
    const mysqldumpArgs = [
        `--host=${host}`,
        `--port=${port}`,
        `--user=${user}`,
        `--password="${password.replace(/"/g, '\\"')}"`,
        `--default-character-set=utf8mb4`,
        `--no-create-db`,
        `--skip-comments`,
        database,
        `> "${filePath}"`,
    ];
    const cmd = `mysqldump ${mysqldumpArgs.join(' ')}`;
    try {
        await execAsync(cmd, { timeout: 10 * 60 * 1000, maxBuffer: 512 * 1024 * 1024 });
    }
    catch (e) {
        if (e?.code === 'ENOENT' || /not found/i.test(e?.message || '')) {
            throw new Error('未检测到 mysqldump，无法调用系统 mysqldump。请在服务器安装 MySQL client 后重试。');
        }
        throw new Error(`mysqldump 执行失败: ${e?.message || String(e)}`);
    }
    const stat = node_fs_1.default.statSync(filePath);
    return {
        fileName,
        sizeKB: Math.round((stat.size / 1024) * 100) / 100,
        tables: tables.length,
    };
}
async function listBackupFiles() {
    ensureBackupDir();
    const files = node_fs_1.default.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.sql'));
    const result = [];
    for (const f of files) {
        try {
            const full = node_path_1.default.join(BACKUP_DIR, f);
            const stat = node_fs_1.default.statSync(full);
            result.push({
                fileName: f,
                sizeKB: Math.round((stat.size / 1024) * 100) / 100,
                createdAt: stat.mtime.toISOString(),
                hash: null,
            });
        }
        catch { /* skip */ }
    }
    return result.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
async function restoreBackup(fileName) {
    if (!/^[A-Za-z0-9_$\-]+\.sql$/.test(fileName)) {
        throw new Error(`非法备份文件名: ${fileName}`);
    }
    ensureBackupDir();
    const filePath = node_path_1.default.join(BACKUP_DIR, fileName);
    if (!node_fs_1.default.existsSync(filePath)) {
        throw new Error(`备份文件不存在: ${fileName}`);
    }
    const host = config_1.config.db.host || '127.0.0.1';
    const port = String(config_1.config.db.port || 3306);
    const user = config_1.config.db.user || 'root';
    const password = config_1.config.db.password || '';
    const database = config_1.config.db.database || '';
    const mysqlArgs = [
        `--host=${host}`,
        `--port=${port}`,
        `--user=${user}`,
        `--password="${password.replace(/"/g, '\\"')}"`,
        `--default-character-set=utf8mb4`,
        database,
        `< "${filePath}"`,
    ];
    const cmd = `mysql ${mysqlArgs.join(' ')}`;
    try {
        await execAsync(cmd, { timeout: 10 * 60 * 1000, maxBuffer: 512 * 1024 * 1024 });
    }
    catch (e) {
        if (e?.code === 'ENOENT' || /not found/i.test(e?.message || '')) {
            throw new Error('未检测到 mysql 命令行客户端。请在服务器安装 MySQL client 后重试。');
        }
        throw new Error(`还原失败: ${e?.message || String(e)}`);
    }
    const stat = node_fs_1.default.statSync(filePath);
    return { success: true, sizeKB: Math.round((stat.size / 1024) * 100) / 100 };
}
async function deleteBackup(fileName) {
    if (!/^[A-Za-z0-9_$\-]+\.sql$/.test(fileName)) {
        throw new Error(`非法备份文件名: ${fileName}`);
    }
    const filePath = node_path_1.default.join(BACKUP_DIR, fileName);
    if (!node_fs_1.default.existsSync(filePath)) {
        throw new Error(`备份文件不存在: ${fileName}`);
    }
    node_fs_1.default.unlinkSync(filePath);
}
async function optimizeTables(tables) {
    const results = [];
    const rows = tables.length ? tables : (await listTables()).map((t) => t.name);
    for (const table of rows) {
        const start = Date.now();
        let status = 'OK';
        let message = 'OK';
        try {
            const safe = sanitizeTable(table);
            const data = await queryAll(`OPTIMIZE TABLE \`${safe}\``);
            const row = data[0] || {};
            const text = String(row.Msg_text || row.msg_text || 'OK');
            if (/error/i.test(text)) {
                status = 'error';
            }
            else if (/warning|note/i.test(text)) {
                status = 'warning';
            }
            message = text;
        }
        catch (e) {
            status = 'error';
            message = e?.message || String(e);
        }
        results.push({ table, operation: 'optimize', status, message, durationMs: Date.now() - start });
    }
    return results;
}
async function repairTables(tables) {
    const results = [];
    const rows = tables.length ? tables : (await listTables()).map((t) => t.name);
    for (const table of rows) {
        const start = Date.now();
        let status = 'OK';
        let message = 'OK';
        try {
            const safe = sanitizeTable(table);
            const data = await queryAll(`REPAIR TABLE \`${safe}\``);
            const row = data[0] || {};
            const text = String(row.Msg_text || row.msg_text || 'OK');
            if (/error/i.test(text)) {
                status = 'error';
            }
            else if (/warning|note/i.test(text)) {
                status = 'warning';
            }
            message = text;
        }
        catch (e) {
            status = 'error';
            message = e?.message || String(e);
        }
        results.push({ table, operation: 'repair', status, message, durationMs: Date.now() - start });
    }
    return results;
}
function getBackupDir() {
    return BACKUP_DIR;
}
async function sha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = node_crypto_1.default.createHash('sha256');
        const stream = node_fs_1.default.createReadStream(filePath);
        stream.on('error', reject);
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.pipe(hash);
    });
}
//# sourceMappingURL=databaseService.js.map