import { Request, Response } from 'express';
import {
  deleteRssSources,
  importRssSourcesFromUrl,
  listRssArticles,
  listRssSources,
  updateRssSource,
  getRssArticleContent,
} from '../services/rssSourceService';

export async function getRssSources(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ code: 0, data: await listRssSources() });
  } catch (err: any) {
    res.status(500).json({ code: 500, msg: err.message || '获取订阅源失败' });
  }
}

export async function importRssSourceUrl(req: Request, res: Response): Promise<void> {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      res.status(400).json({ code: 400, msg: '请输入订阅源链接' });
      return;
    }
    const result = await importRssSourcesFromUrl(url);
    res.json({
      code: 0,
      msg: `订阅源导入完成：成功 ${result.success} 个，失败 ${result.fail} 个`,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ code: 400, msg: err.message || '订阅源导入失败' });
  }
}

export async function putRssSource(req: Request, res: Response): Promise<void> {
  try {
    await updateRssSource(Number(req.params.id), req.body || {});
    res.json({ code: 0, msg: '更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, msg: err.message || '更新订阅源失败' });
  }
}

export async function removeRssSources(req: Request, res: Response): Promise<void> {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.body?.ids];
    const idList = ids.map(Number).filter((id: number) => Number.isFinite(id) && id > 0);
    await deleteRssSources(idList);
    res.json({ code: 0, msg: `已删除 ${idList.length} 个订阅源` });
  } catch (err: any) {
    res.status(500).json({ code: 500, msg: err.message || '删除订阅源失败' });
  }
}

export async function getRssArticles(req: Request, res: Response): Promise<void> {
  try {
    const result = await listRssArticles(Number(req.params.id), String(req.query.url || ''));
    res.json({ code: 0, data: result });
  } catch (err: any) {
    res.status(400).json({ code: 400, msg: err.message || '读取订阅源文章失败' });
  }
}

export async function getRssContent(req: Request, res: Response): Promise<void> {
  try {
    const link = String(req.query.link || '');
    if (!link) {
      res.status(400).json({ code: 400, msg: '缺少文章链接' });
      return;
    }
    const result = await getRssArticleContent(Number(req.params.id), link);
    res.json({ code: 0, data: result });
  } catch (err: any) {
    res.status(400).json({ code: 400, msg: err.message || '读取文章内容失败' });
  }
}
