"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImageMiddleware = void 0;
exports.isAllowedImageMimeType = isAllowedImageMimeType;
exports.uploadImage = uploadImage;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const config_1 = require("../config");
const imageMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
]);
function isAllowedImageMimeType(mimeType) {
    return imageMimeTypes.has(mimeType);
}
function ensureUploadDir() {
    if (!fs_1.default.existsSync(config_1.config.upload.dir)) {
        fs_1.default.mkdirSync(config_1.config.upload.dir, { recursive: true });
    }
}
function getSafeExt(file) {
    const ext = path_1.default.extname(file.originalname || '').toLowerCase();
    if (ext && /^[a-z0-9.]+$/.test(ext))
        return ext;
    const subtype = file.mimetype.split('/')[1] || 'bin';
    return `.${subtype.replace(/[^a-z0-9]/gi, '')}`;
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        ensureUploadDir();
        cb(null, config_1.config.upload.dir);
    },
    filename: (_req, file, cb) => {
        const ext = getSafeExt(file);
        const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
        cb(null, name);
    },
});
exports.uploadImageMiddleware = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 2 * 1024 * 1024,
        files: 1,
    },
    fileFilter: (_req, file, cb) => {
        if (!isAllowedImageMimeType(file.mimetype)) {
            cb(new Error('只允许上传图片文件'));
            return;
        }
        cb(null, true);
    },
}).single('file');
function uploadImage(req, res) {
    const file = req.file;
    if (!file) {
        res.status(400).json({ code: 400, msg: '请选择要上传的图片' });
        return;
    }
    res.json({
        code: 0,
        msg: '上传成功',
        data: {
            url: `/uploads/${file.filename}`,
            filename: file.filename,
        },
    });
}
//# sourceMappingURL=uploadController.js.map