"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '005_source_validation';
async function up(db) {
    // 增加书源验证状态相关字段
    const columns = [
        {
            name: 'last_check_time',
            ddl: 'ADD COLUMN last_check_time DATETIME NULL COMMENT \'最近一次验证时间\'',
        },
        {
            name: 'last_check_status',
            ddl: 'ADD COLUMN last_check_status TINYINT NOT NULL DEFAULT 0 COMMENT \'0=未验证 1=有效 2=失效\'',
        },
        {
            name: 'last_check_message',
            ddl: 'ADD COLUMN last_check_message VARCHAR(500) NOT NULL DEFAULT \'\' COMMENT \'验证失败/成功原因\'',
        },
    ];
    for (const col of columns) {
        const [rows] = await db.query(`SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'book_sources'
         AND COLUMN_NAME = ?`, [col.name]);
        const exists = rows[0]?.cnt > 0;
        if (!exists) {
            await db.query(`ALTER TABLE book_sources ${col.ddl}`);
        }
    }
    // 索引：按状态筛选
    const [idxRows] = await db.query(`SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'book_sources'
       AND INDEX_NAME = 'idx_check_status'`);
    if (idxRows[0]?.cnt === 0) {
        await db.query(`ALTER TABLE book_sources ADD INDEX idx_check_status (last_check_status)`);
    }
}
//# sourceMappingURL=005_source_validation.js.map