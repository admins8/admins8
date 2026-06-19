import { Router } from 'express'
import {
  getTables,
  postBackupAll,
  postBackupTable,
  getBackups,
  postRestore,
  deleteBackupFile,
  postOptimize,
  postRepair,
} from '../controllers/databaseController'
import { authMiddleware, superAdminMiddleware } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)
router.use(superAdminMiddleware)

router.get('/tables', getTables)
router.post('/backup', postBackupAll)
router.post('/backup/:table', postBackupTable)
router.get('/backups', getBackups)
router.post('/restore', postRestore)
router.post('/backups/delete', deleteBackupFile)
router.post('/optimize', postOptimize)
router.post('/repair', postRepair)

export default router
