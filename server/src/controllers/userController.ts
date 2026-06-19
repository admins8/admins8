import { Request, Response } from 'express';
import { checkinToday, getUserCheckinMonth, getUserCheckinStatus } from '../services/userCheckinService';

export async function getCheckinStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    res.json({ code: 0, data: await getUserCheckinStatus(user.userId) });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function checkin(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    res.json({ code: 0, data: await checkinToday(user.userId), msg: '签到成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function getCheckinMonth(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    res.json({ code: 0, data: await getUserCheckinMonth(user.userId, String(req.query.month || '')) });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}
