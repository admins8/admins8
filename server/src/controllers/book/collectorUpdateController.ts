import { Request, Response } from 'express';
import { sendError } from '../../utils/apiResponse';
import { checkCollectorBookUpdate, updateCollectorBookToLatest } from '../../services/collectorPlugin';

export async function checkCollectorUpdate(req: Request, res: Response): Promise<void> {
  try {
    const bookUrl = String(req.query.bookUrl || '').trim();
    if (!bookUrl) {
      res.json({ code: 400, msg: '缺少bookUrl参数' });
      return;
    }
    const result = await checkCollectorBookUpdate(bookUrl);
    res.json({ code: 0, data: result });
  } catch (err: any) {
    sendError(res, err, '检查采集更新失败');
  }
}

export async function updateCollectorBook(req: Request, res: Response): Promise<void> {
  try {
    const bookUrl = String(req.body.bookUrl || '').trim();
    if (!bookUrl) {
      res.json({ code: 400, msg: '缺少bookUrl参数' });
      return;
    }
    const result = await updateCollectorBookToLatest(bookUrl);
    res.json({ code: 0, msg: '更新完成', data: result });
  } catch (err: any) {
    sendError(res, err, '更新采集章节失败');
  }
}
