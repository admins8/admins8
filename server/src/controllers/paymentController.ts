import { Request, Response } from 'express';
import { query, queryOne, execute } from '../config/database';

// 获取支付配置
export async function getPaymentConfigs(req: Request, res: Response): Promise<void> {
  try {
    const rows = await query('SELECT id, channel, app_id, merchant_id, is_active, notify_url, created_at, updated_at FROM payment_config');
    res.json({ code: 0, data: rows });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 获取单个支付配置
export async function getPaymentConfig(req: Request, res: Response): Promise<void> {
  try {
    const { channel } = req.params;
    const row = await queryOne('SELECT * FROM payment_config WHERE channel = ?', [channel]);
    if (!row) {
      res.json({ code: 0, data: null });
      return;
    }
    // 私钥只返回前20字符，安全考虑
    res.json({
      code: 0,
      data: {
        ...row,
        private_key: row.private_key ? row.private_key.substring(0, 20) + '...' : '',
      },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 保存支付配置
export async function savePaymentConfig(req: Request, res: Response): Promise<void> {
  try {
    const { channel, app_id, merchant_id, private_key, public_key, api_key, notify_url, is_active } = req.body;
    if (!channel) {
      res.json({ code: 400, msg: '支付渠道不能为空' });
      return;
    }
    const existing = await queryOne('SELECT id FROM payment_config WHERE channel = ?', [channel]);
    if (existing) {
      // 如果 private_key 是占位符（***），则不更新
      const updateFields: string[] = [];
      const params: any[] = [];
      if (app_id !== undefined) { updateFields.push('app_id = ?'); params.push(app_id); }
      if (merchant_id !== undefined) { updateFields.push('merchant_id = ?'); params.push(merchant_id); }
      if (public_key !== undefined) { updateFields.push('public_key = ?'); params.push(public_key); }
      if (api_key !== undefined) { updateFields.push('api_key = ?'); params.push(api_key); }
      if (notify_url !== undefined) { updateFields.push('notify_url = ?'); params.push(notify_url); }
      if (is_active !== undefined) { updateFields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
      if (private_key && !private_key.includes('***')) { updateFields.push('private_key = ?'); params.push(private_key); }
      if (updateFields.length === 0) {
        res.json({ code: 0, msg: '无更新内容' });
        return;
      }
      params.push(channel);
      await execute(`UPDATE payment_config SET ${updateFields.join(', ')} WHERE channel = ?`, params);
    } else {
      await execute(
        'INSERT INTO payment_config (channel, app_id, merchant_id, private_key, public_key, api_key, notify_url, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [channel, app_id || '', merchant_id || '', private_key || '', public_key || '', api_key || '', notify_url || '', is_active ? 1 : 0]
      );
    }
    res.json({ code: 0, msg: '保存成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 删除支付配置
export async function deletePaymentConfig(req: Request, res: Response): Promise<void> {
  try {
    const { channel } = req.params;
    await execute('DELETE FROM payment_config WHERE channel = ?', [channel]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 微信支付回调
export async function wechatNotify(req: Request, res: Response): Promise<void> {
  try {
    // TODO: 接入微信支付 SDK 后实现验签和订单处理
    // 当前为占位实现
    console.log('[微信支付回调]', req.body);
    res.set('Content-Type', 'application/xml');
    res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
  } catch (err: any) {
    res.set('Content-Type', 'application/xml');
    res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[处理失败]]></return_msg></xml>');
  }
}

// 支付宝回调
export async function alipayNotify(req: Request, res: Response): Promise<void> {
  try {
    // TODO: 接入支付宝 SDK 后实现验签和订单处理
    // 当前为占位实现
    console.log('[支付宝回调]', req.body);
    res.send('success');
  } catch (err: any) {
    res.send('fail');
  }
}
