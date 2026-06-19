import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import crypto from 'node:crypto'
import { getDb } from '../config/database'
import { config } from '../config'

const execAsync = promisify(exec)

export interface TableInfo {
  name: string
  engine: string
  rows: number
  dataSizeKB: number
  indexSizeKB: number
  totalSizeKB: number
  collation: string | null
  createTime: string | null
  updateTime: string | null
}

export interface BackupFile {
  fileName: string
  sizeKB: number
  createdAt: string
  hash: string | null
}

export interface TableResult {
  table: string
  operation: 'optimize' | 'repair'
  status: 'OK' | 'warning' | 'error'
  message: string
  durationMs: number
}

const BACKUP_DIR = path.resolve(process.cwd(), 'data', 'backups', 'database')

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

async function queryAll(sql: string, params?: any[]): Promise<any[]> {
  const db = getDb()
  const conn = await db.getConnection()
  try {
    const [rows] = await conn.query(sql, params ?? []) as any
    return rows as any[]
  } finally {
    conn.release()
  }
}

export async function listTables(): Promise<TableInfo[]> {
  const rows = await queryAll(
    'SELECT TABLE_NAME, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, TABLE_COLLATION, CREATE_TIME, UPDATE_TIME ' +
      "FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
  )
  return rows.map((r) => {
    const dataKB = Number(r.DATA_LENGTH ?? 0) / 1024
    const indexKB = Number(r.INDEX_LENGTH ?? 0) / 1024
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
    }
  })
}

function sanitizeTable(name: string): string {
  if (!/^[A-Za-z0-9_$]+$/.test(name)) {
    throw new Error(`非法表名: ${name}`)
  }
  return name
}

export async function backupTable(tableName: string): Promise<{ fileName: string; sizeKB: number; rows: number }> {
  const safe = sanitizeTable(tableName)
  ensureBackupDir()
  const rows = await queryAll(`SELECT COUNT(*) AS cnt FROM \`${safe}\``)
  const totalRows = Number(rows[0]?.cnt ?? 0)

  const dateStr = new Date()
    .toISOString()
    .replace(/[:T]/g, '-')
    .replace(/\..*Z$/, '')
  const fileName = `${safe}-${dateStr}.sql`
  const filePath = path.join(BACKUP_DIR, fileName)

  const host = config.db.host || '127.0.0.1'
  const port = String(config.db.port || 3306)
  const user = config.db.user || 'root'
  const password = config.db.password || ''
  const database = config.db.database || ''

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
  ]
  const cmd = `mysqldump ${mysqldumpArgs.join(' ')}`

  try {
    await execAsync(cmd, { timeout: 5 * 60 * 1000, maxBuffer: 128 * 1024 * 1024 })
  } catch (e: any) {
    if (e?.code === 'ENOENT' || /not found/i.test(e?.message || '')) {
      throw new Error('未检测到 mysqldump，无法调用系统 mysqldump。请在服务器安装 MySQL client 后重试。')
    }
    throw new Error(`mysqldump 执行失败: ${e?.message || String(e)}`)
  }

  const stat = fs.statSync(filePath)
  if (stat.size === 0) {
    try { fs.unlinkSync(filePath) } catch { /* noop */ }
    throw new Error(`mysqldump 生成的文件为空: ${safe}`)
  }
  return {
    fileName,
    sizeKB: Math.round((stat.size / 1024) * 100) / 100,
    rows: totalRows,
  }
}

export async function backupAllTables(): Promise<{ fileName: string; sizeKB: number; tables: number }> {
  const tables = await listTables()
  if (!tables.length) {
    throw new Error('没有可备份的表')
  }
  ensureBackupDir()
  const dateStr = new Date()
    .toISOString()
    .replace(/[:T]/g, '-')
    .replace(/\..*Z$/, '')
  const fileName = `full-backup-${dateStr}.sql`
  const filePath = path.join(BACKUP_DIR, fileName)

  const host = config.db.host || '127.0.0.1'
  const port = String(config.db.port || 3306)
  const user = config.db.user || 'root'
  const password = config.db.password || ''
  const database = config.db.database || ''

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
  ]
  const cmd = `mysqldump ${mysqldumpArgs.join(' ')}`

  try {
    await execAsync(cmd, { timeout: 10 * 60 * 1000, maxBuffer: 512 * 1024 * 1024 })
  } catch (e: any) {
    if (e?.code === 'ENOENT' || /not found/i.test(e?.message || '')) {
      throw new Error('未检测到 mysqldump，无法调用系统 mysqldump。请在服务器安装 MySQL client 后重试。')
    }
    throw new Error(`mysqldump 执行失败: ${e?.message || String(e)}`)
  }

  const stat = fs.statSync(filePath)
  return {
    fileName,
    sizeKB: Math.round((stat.size / 1024) * 100) / 100,
    tables: tables.length,
  }
}

export async function listBackupFiles(): Promise<BackupFile[]> {
  ensureBackupDir()
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.sql'))
  const result: BackupFile[] = []
  for (const f of files) {
    try {
      const full = path.join(BACKUP_DIR, f)
      const stat = fs.statSync(full)
      result.push({
        fileName: f,
        sizeKB: Math.round((stat.size / 1024) * 100) / 100,
        createdAt: stat.mtime.toISOString(),
        hash: null,
      })
    } catch { /* skip */ }
  }
  return result.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function restoreBackup(fileName: string): Promise<{ success: true; sizeKB: number }> {
  if (!/^[A-Za-z0-9_$\-]+\.sql$/.test(fileName)) {
    throw new Error(`非法备份文件名: ${fileName}`)
  }
  ensureBackupDir()
  const filePath = path.join(BACKUP_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    throw new Error(`备份文件不存在: ${fileName}`)
  }

  const host = config.db.host || '127.0.0.1'
  const port = String(config.db.port || 3306)
  const user = config.db.user || 'root'
  const password = config.db.password || ''
  const database = config.db.database || ''

  const mysqlArgs = [
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
    `--password="${password.replace(/"/g, '\\"')}"`,
    `--default-character-set=utf8mb4`,
    database,
    `< "${filePath}"`,
  ]
  const cmd = `mysql ${mysqlArgs.join(' ')}`

  try {
    await execAsync(cmd, { timeout: 10 * 60 * 1000, maxBuffer: 512 * 1024 * 1024 })
  } catch (e: any) {
    if (e?.code === 'ENOENT' || /not found/i.test(e?.message || '')) {
      throw new Error('未检测到 mysql 命令行客户端。请在服务器安装 MySQL client 后重试。')
    }
    throw new Error(`还原失败: ${e?.message || String(e)}`)
  }

  const stat = fs.statSync(filePath)
  return { success: true, sizeKB: Math.round((stat.size / 1024) * 100) / 100 }
}

export async function deleteBackup(fileName: string): Promise<void> {
  if (!/^[A-Za-z0-9_$\-]+\.sql$/.test(fileName)) {
    throw new Error(`非法备份文件名: ${fileName}`)
  }
  const filePath = path.join(BACKUP_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    throw new Error(`备份文件不存在: ${fileName}`)
  }
  fs.unlinkSync(filePath)
}

export async function optimizeTables(tables: string[]): Promise<TableResult[]> {
  const results: TableResult[] = []
  const rows = tables.length ? tables : (await listTables()).map((t) => t.name)
  for (const table of rows) {
    const start = Date.now()
    let status: TableResult['status'] = 'OK'
    let message = 'OK'
    try {
      const safe = sanitizeTable(table)
      const data = await queryAll(`OPTIMIZE TABLE \`${safe}\``)
      const row = data[0] || {}
      const text = String(row.Msg_text || row.msg_text || 'OK')
      if (/error/i.test(text)) {
        status = 'error'
      } else if (/warning|note/i.test(text)) {
        status = 'warning'
      }
      message = text
    } catch (e: any) {
      status = 'error'
      message = e?.message || String(e)
    }
    results.push({ table, operation: 'optimize', status, message, durationMs: Date.now() - start })
  }
  return results
}

export async function repairTables(tables: string[]): Promise<TableResult[]> {
  const results: TableResult[] = []
  const rows = tables.length ? tables : (await listTables()).map((t) => t.name)
  for (const table of rows) {
    const start = Date.now()
    let status: TableResult['status'] = 'OK'
    let message = 'OK'
    try {
      const safe = sanitizeTable(table)
      const data = await queryAll(`REPAIR TABLE \`${safe}\``)
      const row = data[0] || {}
      const text = String(row.Msg_text || row.msg_text || 'OK')
      if (/error/i.test(text)) {
        status = 'error'
      } else if (/warning|note/i.test(text)) {
        status = 'warning'
      }
      message = text
    } catch (e: any) {
      status = 'error'
      message = e?.message || String(e)
    }
    results.push({ table, operation: 'repair', status, message, durationMs: Date.now() - start })
  }
  return results
}

export function getBackupDir(): string {
  return BACKUP_DIR
}

export async function sha256File(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.pipe(hash)
  })
}
