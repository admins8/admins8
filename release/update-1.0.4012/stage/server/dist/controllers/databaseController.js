"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTables = getTables;
exports.postBackupTable = postBackupTable;
exports.postBackupAll = postBackupAll;
exports.getBackups = getBackups;
exports.postRestore = postRestore;
exports.deleteBackupFile = deleteBackupFile;
exports.postOptimize = postOptimize;
exports.postRepair = postRepair;
const databaseService_1 = require("../services/databaseService");
function ok(res, data, extra) {
    res.json({ code: 0, msg: extra?.msg ?? 'ok', ...(extra || {}), data });
}
function fail(res, status, msg) {
    res.status(status).json({ code: status, msg });
}
async function getTables(req, res) {
    try {
        const tables = await (0, databaseService_1.listTables)();
        ok(res, { totalSizeKB: tables.reduce((s, t) => s + t.totalSizeKB, 0), tables });
    }
    catch (e) {
        fail(res, 500, e?.message || String(e));
    }
}
async function postBackupTable(req, res) {
    try {
        const { table } = req.body;
        if (!table) {
            return fail(res, 400, '缺少 table 参数');
        }
        const result = await (0, databaseService_1.backupTable)(table);
        ok(res, result, { msg: `表 ${table} 备份成功` });
    }
    catch (e) {
        fail(res, 500, e?.message || String(e));
    }
}
async function postBackupAll(req, res) {
    try {
        const result = await (0, databaseService_1.backupAllTables)();
        ok(res, result, { msg: '全库备份成功' });
    }
    catch (e) {
        fail(res, 500, e?.message || String(e));
    }
}
async function getBackups(req, res) {
    try {
        const files = await (0, databaseService_1.listBackupFiles)();
        ok(res, { totalSizeKB: files.reduce((s, f) => s + f.sizeKB, 0), files });
    }
    catch (e) {
        fail(res, 500, e?.message || String(e));
    }
}
async function postRestore(req, res) {
    try {
        const { file } = req.body;
        if (!file) {
            return fail(res, 400, '缺少 file 参数');
        }
        const result = await (0, databaseService_1.restoreBackup)(file);
        ok(res, result, { msg: `已还原 ${file}` });
    }
    catch (e) {
        fail(res, 500, e?.message || String(e));
    }
}
async function deleteBackupFile(req, res) {
    try {
        const { file } = req.body;
        if (!file) {
            return fail(res, 400, '缺少 file 参数');
        }
        await (0, databaseService_1.deleteBackup)(file);
        ok(res, { file }, { msg: '已删除' });
    }
    catch (e) {
        fail(res, 500, e?.message || String(e));
    }
}
async function postOptimize(req, res) {
    try {
        const { tables } = req.body;
        if (!tables) {
            return fail(res, 400, '缺少 tables 参数');
        }
        const result = await (0, databaseService_1.optimizeTables)(tables);
        ok(res, result, { msg: `优化 ${result.length} 张表完成` });
    }
    catch (e) {
        fail(res, 500, e?.message || String(e));
    }
}
async function postRepair(req, res) {
    try {
        const { tables } = req.body;
        if (!tables) {
            return fail(res, 400, '缺少 tables 参数');
        }
        const result = await (0, databaseService_1.repairTables)(tables);
        ok(res, result, { msg: `修复 ${result.length} 张表完成` });
    }
    catch (e) {
        fail(res, 500, e?.message || String(e));
    }
}
//# sourceMappingURL=databaseController.js.map