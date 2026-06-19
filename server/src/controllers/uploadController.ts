import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { config } from '../config';

const imageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export function isAllowedImageMimeType(mimeType: string): boolean {
  return imageMimeTypes.has(mimeType);
}

function ensureUploadDir(): void {
  if (!fs.existsSync(config.upload.dir)) {
    fs.mkdirSync(config.upload.dir, { recursive: true });
  }
}

function getSafeExt(file: Express.Multer.File): string {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext && /^[a-z0-9.]+$/.test(ext)) return ext;
  const subtype = file.mimetype.split('/')[1] || 'bin';
  return `.${subtype.replace(/[^a-z0-9]/gi, '')}`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, config.upload.dir);
  },
  filename: (_req, file, cb) => {
    const ext = getSafeExt(file);
    const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, name);
  },
});

export const uploadImageMiddleware = multer({
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

export function uploadImage(req: Request, res: Response): void {
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
