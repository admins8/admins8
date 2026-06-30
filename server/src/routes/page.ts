import { Router } from 'express';
import {
  autoFillChannelHandler,
  autoFillSectionHandler,
  createFriendlyLinkHandler,
  createItemHandler,
  createSectionHandler,
  deleteFriendlyLinkHandler,
  deleteItemHandler,
  deleteSectionHandler,
  getAdminContentPageHandler,
  getAdminChannelHandler,
  getPublicContentPageHandler,
  getPublicChannelHandler,
  getPublicFriendlyLinksHandler,
  listContentPagesHandler,
  listFriendlyLinksHandler,
  listPublicContentPagesHandler,
  seedChannelHandler,
  updateChannelHandler,
  updateContentPageHandler,
  updateFriendlyLinkHandler,
  updateFriendlyLinkSettingsHandler,
  updateItemHandler,
  updateSectionHandler,
} from '../controllers/pageController';
import { adminMiddleware, authMiddleware } from '../middleware/auth';

export const publicPageRoutes = Router();
export const adminPageRoutes = Router();

publicPageRoutes.get('/channels/:code', getPublicChannelHandler);
publicPageRoutes.get('/content/:slug', getPublicContentPageHandler);
publicPageRoutes.get('/content-pages', listPublicContentPagesHandler);
publicPageRoutes.get('/friendly-links/public', getPublicFriendlyLinksHandler);
publicPageRoutes.get('/friendly-links', getPublicFriendlyLinksHandler);

adminPageRoutes.use(authMiddleware, adminMiddleware);
adminPageRoutes.get('/channels/:code', getAdminChannelHandler);
adminPageRoutes.put('/channels/:code', updateChannelHandler);
adminPageRoutes.post('/channels/:code/seed', seedChannelHandler);
adminPageRoutes.post('/channels/:code/auto-fill', autoFillChannelHandler);
adminPageRoutes.post('/sections/:id/auto-fill', autoFillSectionHandler);
adminPageRoutes.post('/channels/:code/sections', createSectionHandler);
adminPageRoutes.put('/sections/:id', updateSectionHandler);
adminPageRoutes.post('/sections/delete', deleteSectionHandler);
adminPageRoutes.post('/sections/:id/items', createItemHandler);
adminPageRoutes.put('/items/:id', updateItemHandler);
adminPageRoutes.post('/items/delete', deleteItemHandler);
adminPageRoutes.get('/content-pages', listContentPagesHandler);
adminPageRoutes.get('/content-pages/:slug', getAdminContentPageHandler);
adminPageRoutes.put('/content-pages/:slug', updateContentPageHandler);
adminPageRoutes.get('/friendly-links', listFriendlyLinksHandler);
adminPageRoutes.put('/friendly-links/settings', updateFriendlyLinkSettingsHandler);
adminPageRoutes.post('/friendly-links', createFriendlyLinkHandler);
adminPageRoutes.put('/friendly-links/:id', updateFriendlyLinkHandler);
adminPageRoutes.post('/friendly-links/delete', deleteFriendlyLinkHandler);
