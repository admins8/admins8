"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const databaseController_1 = require("../controllers/databaseController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.use(auth_1.superAdminMiddleware);
router.get('/tables', databaseController_1.getTables);
router.post('/backup', databaseController_1.postBackupAll);
router.post('/backup/:table', databaseController_1.postBackupTable);
router.get('/backups', databaseController_1.getBackups);
router.post('/restore', databaseController_1.postRestore);
router.post('/backups/delete', databaseController_1.deleteBackupFile);
router.post('/optimize', databaseController_1.postOptimize);
router.post('/repair', databaseController_1.postRepair);
exports.default = router;
//# sourceMappingURL=database.js.map