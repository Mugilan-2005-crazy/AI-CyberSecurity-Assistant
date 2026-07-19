/**
 * middleware/upload.js
 * ------------------------------------------------------------
 * Multer-based file upload middleware for the file malware
 * scanner. Limits size (25MB) and strips potentially
 * dangerous executable uploads at the gate. The raw buffer is
 * passed to the VirusTotal service; nothing is persisted to disk.
 */
import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Reject obvious script/executable extensions as a precaution.
    const blocked = /\.(exe|scr|bat|cmd|js|jar|vbs|ps1)$/i;
    if (blocked.test(file.originalname)) {
      return cb(new ApiError(400, 'File type not allowed'), false);
    }
    cb(null, true);
  },
});

export const uploadSingle = upload.single('file');

// QR-specific upload: restrict to image types only (PNG/JPG/JPEG).
// Reuses the same 25MB size cap and executable blocklist.
const ALLOWED_IMAGE = /\.(png|jpe?g)$/i;
const uploadQrInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE.test(file.originalname)) {
      return cb(new ApiError(400, 'Only PNG or JPG/JPEG images are allowed'), false);
    }
    cb(null, true);
  },
});
export const uploadQr = uploadQrInstance.single('qr');

export default uploadSingle;
