import mysql from 'mysql2/promise';
/**
 * 获取 MySQL 连接池（单例模式）
 */
export declare function getDb(): mysql.Pool;
/**
 * 关闭数据库连接池
 */
export declare function closeDb(): void;
/**
 * 辅助查询函数 - 执行 SELECT 查询，返回行数组
 */
export declare function query(sql: string, params?: any[]): Promise<any[]>;
/**
 * 辅助查询函数 - 执行 SELECT 查询，返回单行
 */
export declare function queryOne(sql: string, params?: any[]): Promise<any>;
/**
 * 辅助执行函数 - 执行 INSERT/UPDATE/DELETE，返回 affectedRows 和 insertId
 */
export declare function execute(sql: string, params?: any[]): Promise<{
    affectedRows: number;
    insertId: number;
}>;
/**
 * 事务执行器 - 在事务中执行回调函数
 */
export declare function transaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T>;
/**
 * 初始化数据库 - 创建所有表（MySQL 语法）
 */
export declare function initDatabase(): Promise<void>;
//# sourceMappingURL=database.d.ts.map