import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';

// Disallowed dangerous executable file extensions for security
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.msi', '.vbs', 
  '.ps1', '.scr', '.com', '.pif', '.hta', '.cpl', '.jar'
]);

// 50 MB max file size limit per file (50 * 1024 * 1024 bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File extension '${ext}' is blocked for security reasons.`));
  }

  cb(null, true);
};

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Max 10 files per batch
  },
  fileFilter,
});
