import { Request, Response } from 'express'
import {
  listTables,
  backupTable,
  backupAllTables,
  listBackupFiles,
  restoreBackup,
  deleteBackup,
  optimizeTables,
  repairTables,
} from '../services/databaseService'

function ok<T>(res: Response, data: T, extra?: Partial<{ code: number; msg: string }>) {
  res.json({ code: 0, msg: extra?.msg ?? 'ok', ...(extra || {}), data })
}

function fail(res: Response, status: number, msg: string) {
  res.status(status).json({ code: status, msg })
}

export async function getTables(req: Request, res: Response) {
  try {
    const tables = await listTables()
    ok(res, { totalSizeKB: tables.reduce((s, t) => s + t.totalSizeKB, 0), tables })
  } catch (e: any) {
    fail(res, 500, e?.message || String(e))
  }
}

export async function postBackupTable(req: Request, res: Response) {
  try {
    const { table } = req.body as { table?: string }
    if (!table) {
      return fail(res, 400, '缺少 table 参数')
    }
    const result = await backupTable(table)
    ok(res, result, { msg: `表 ${table} 备份成功` })
  } catch (e: any) {
    fail(res, 500, e?.message || String(e))
  }
}

export async function postBackupAll(req: Request, res: Response) {
  try {
    const result = await backupAllTables()
    ok(res, result, { msg: '全库备份成功' })
  } catch (e: any) {
    fail(res, 500, e?.message || String(e))
  }
}

export async function getBackups(req: Request, res: Response) {
  try {
    const files = await listBackupFiles()
    ok(res, { totalSizeKB: files.reduce((s, f) => s + f.sizeKB, 0), files })
  } catch (e: any) {
    fail(res, 500, e?.message || String(e))
  }
}

export async function postRestore(req: Request, res: Response) {
  try {
    const { file } = req.body as { file?: string }
    if (!file) {
      return fail(res, 400, '缺少 file 参数')
    }
    const result = await restoreBackup(file)
    ok(res, result, { msg: `已还原 ${file}` })
  } catch (e: any) {
    fail(res, 500, e?.message || String(e))
  }
}

export async function deleteBackupFile(req: Request, res: Response) {
  try {
    const { file } = req.body as { file?: string }
    if (!file) {
      return fail(res, 400, '缺少 file 参数')
    }
    await deleteBackup(file)
    ok(res, { file }, { msg: '已删除' })
  } catch (e: any) {
    fail(res, 500, e?.message || String(e))
  }
}

export async function postOptimize(req: Request, res: Response) {
  try {
    const { tables } = req.body as { tables?: string[] }
    if (!tables) {
      return fail(res, 400, '缺少 tables 参数')
    }
    const result = await optimizeTables(tables)
    ok(res, result, { msg: `优化 ${result.length} 张表完成` })
  } catch (e: any) {
    fail(res, 500, e?.message || String(e))
  }
}

export async function postRepair(req: Request, res: Response) {
  try {
    const { tables } = req.body as { tables?: string[] }
    if (!tables) {
      return fail(res, 400, '缺少 tables 参数')
    }
    const result = await repairTables(tables)
    ok(res, result, { msg: `修复 ${result.length} 张表完成` })
  } catch (e: any) {
    fail(res, 500, e?.message || String(e))
  }
}
