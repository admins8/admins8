import { Router } from 'express';
import { getActiveLicense } from '../services/licenseService';

const router = Router();

/**
 * 公开的授权状态接口：返回脱敏信息，便于运维确认服务是否已激活。
 */
router.get('/status', (_req, res) => {
  const lic = getActiveLicense();
  if (!lic) {
    res.json({ code: 0, data: { activated: false } });
    return;
  }
  res.json({
    code: 0,
    data: {
      activated: true,
      licenseId: lic.licenseId,
      customerId: lic.customerId,
      customerName: lic.customerName || '',
      domains: lic.domains,
      issuedAt: lic.issuedAt,
      features: lic.features || {},
    },
  });
});

export default router;
