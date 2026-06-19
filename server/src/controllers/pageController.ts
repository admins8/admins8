import { Request, Response } from 'express';
import {
  createItem,
  createSection,
  deleteItem,
  deleteSection,
  getAdminChannel,
  getPublicChannel,
  seedChannel,
  updateChannel,
  updateItem,
  updateSection,
} from '../services/pageChannelService';
import {
  getAdminContentPage,
  getPublicContentPage,
  listContentPages,
  updateContentPage,
} from '../services/contentPageService';
import {
  createFriendlyLink,
  deleteFriendlyLink,
  getFriendlyLinkSettings,
  getPublicFriendlyLinks,
  listFriendlyLinks,
  updateFriendlyLink,
  updateFriendlyLinkSettings,
} from '../services/friendlyLinkService';

function ok(res: Response, data: any, msg = 'ok') {
  res.json({ code: 0, msg, data });
}

function fail(res: Response, status: number, error: any) {
  res.status(status).json({ code: status, msg: error?.message || String(error) });
}

function paramString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : String(value || '');
}

export async function getPublicChannelHandler(req: Request, res: Response) {
  try {
    const data = await getPublicChannel(paramString(req.params.code));
    if (!data) return fail(res, 404, new Error('频道不存在或未启用'));
    ok(res, data);
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function getAdminChannelHandler(req: Request, res: Response) {
  try {
    ok(res, await getAdminChannel(paramString(req.params.code)));
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function updateChannelHandler(req: Request, res: Response) {
  try {
    ok(res, await updateChannel(paramString(req.params.code), req.body), '频道设置已保存');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function seedChannelHandler(req: Request, res: Response) {
  try {
    ok(res, await seedChannel(paramString(req.params.code)), '频道已初始化');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function createSectionHandler(req: Request, res: Response) {
  try {
    ok(res, await createSection(paramString(req.params.code), req.body), '区块已创建');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function updateSectionHandler(req: Request, res: Response) {
  try {
    ok(res, await updateSection(Number(req.params.id), req.body), '区块已保存');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function deleteSectionHandler(req: Request, res: Response) {
  try {
    ok(res, await deleteSection(Number(req.body.id)), '区块已删除');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function createItemHandler(req: Request, res: Response) {
  try {
    ok(res, await createItem(Number(req.params.id), req.body), '条目已创建');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function updateItemHandler(req: Request, res: Response) {
  try {
    ok(res, await updateItem(Number(req.params.id), req.body), '条目已保存');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function deleteItemHandler(req: Request, res: Response) {
  try {
    ok(res, await deleteItem(Number(req.body.id)), '条目已删除');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function getPublicContentPageHandler(req: Request, res: Response) {
  try {
    const data = await getPublicContentPage(paramString(req.params.slug));
    if (!data) return fail(res, 404, new Error('页面不存在或未启用'));
    ok(res, data);
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function listContentPagesHandler(_req: Request, res: Response) {
  try {
    ok(res, await listContentPages());
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function getAdminContentPageHandler(req: Request, res: Response) {
  try {
    const data = await getAdminContentPage(paramString(req.params.slug));
    if (!data) return fail(res, 404, new Error('页面不存在'));
    ok(res, data);
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function updateContentPageHandler(req: Request, res: Response) {
  try {
    ok(res, await updateContentPage(paramString(req.params.slug), req.body), '页面已保存');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function getPublicFriendlyLinksHandler(_req: Request, res: Response) {
  try {
    ok(res, await getPublicFriendlyLinks());
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function listFriendlyLinksHandler(_req: Request, res: Response) {
  try {
    const [links, settings] = await Promise.all([listFriendlyLinks(), getFriendlyLinkSettings()]);
    ok(res, { links, settings });
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function updateFriendlyLinkSettingsHandler(req: Request, res: Response) {
  try {
    ok(res, await updateFriendlyLinkSettings(Boolean(req.body?.enabled)), '友情链接设置已保存');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function createFriendlyLinkHandler(req: Request, res: Response) {
  try {
    ok(res, await createFriendlyLink(req.body), '友情链接已创建');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function updateFriendlyLinkHandler(req: Request, res: Response) {
  try {
    ok(res, await updateFriendlyLink(Number(req.params.id), req.body), '友情链接已保存');
  } catch (e) {
    fail(res, 500, e);
  }
}

export async function deleteFriendlyLinkHandler(req: Request, res: Response) {
  try {
    ok(res, await deleteFriendlyLink(Number(req.body.id)), '友情链接已删除');
  } catch (e) {
    fail(res, 500, e);
  }
}
