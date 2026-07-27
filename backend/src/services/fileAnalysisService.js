/**
 * services/fileAnalysisService.js
 * ------------------------------------------------------------
 * File parsing and preprocessing for AI security analysis.
 * Supports PDF, TXT, DOCX, PNG/JPG/JPEG, MP4/MOV/AVI.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'docx', 'png', 'jpg', 'jpeg', 'mp4', 'mov', 'avi'];
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'js', 'sh', 'ps1'];

const isBlocked = (filename) => {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return BLOCKED_EXTENSIONS.includes(ext);
};

const getAllowed = (filename) => {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
};

const detectFileType = (filename, mimeType) => {
  const ext = path.extname(filename).slice(1).toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('pdf') || ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg'].includes(ext) || mime.includes('image')) return 'image';
  if (['mp4', 'mov', 'avi'].includes(ext) || mime.includes('video')) return 'video';
  if (ext === 'docx' || mime.includes('word')) return 'docx';
  if (ext === 'txt') return 'text';
  return 'unknown';
};

const writeTempFile = async (buffer, filename) => {
  const tmpDir = path.join(os.tmpdir(), 'cybersec-uploads');
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `${crypto.randomUUID()}-${filename}`);
  await fs.writeFile(tmpPath, buffer);
  return tmpPath;
};

const cleanupTempFile = async (tmpPath) => {
  try { await fs.unlink(tmpPath); } catch {}
};

const extractPdfText = async (buffer) => {
  const data = await pdf(buffer);
  return data.text || '';
};

const extractDocxText = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
};

const extractTextContent = async (buffer, filename) => {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (ext === 'pdf') return await extractPdfText(buffer);
  if (ext === 'docx') return await extractDocxText(buffer);
  if (ext === 'txt') return buffer.toString('utf-8');
  return '';
};

const extractVideoMetadata = async (buffer, filename) => {
  return {
    format: path.extname(filename).slice(1).toUpperCase(),
    size: buffer.length,
    note: 'Video frame extraction requires ffmpeg on the server for full analysis. Metadata-only analysis available.',
  };
};

const extractVideoFrames = async (buffer, filename, maxFrames = 3) => {
  logger.warn('Video frame extraction skipped: ffmpeg not installed on server');
  return [];
};

const analyzeFile = async (buffer, filename, mimeType) => {
  if (isBlocked(filename)) {
    return { allowed: false, reason: 'Blocked file type for security', threatLevel: 'malicious', detectedIssues: ['Blocked executable upload'], fileType: 'blocked' };
  }
  if (!getAllowed(filename)) {
    return { allowed: false, reason: 'Unsupported file type', threatLevel: 'unknown', detectedIssues: [], fileType: 'unknown' };
  }
  if (buffer.length > MAX_FILE_SIZE) {
    return { allowed: false, reason: 'File exceeds 25MB limit', threatLevel: 'unknown', detectedIssues: [], fileType: 'unknown' };
  }

  const fileType = detectFileType(filename, mimeType);
  let textContent = '';
  let metadata = {};
  let frames = [];

  try {
    if (fileType === 'pdf' || fileType === 'docx' || fileType === 'text') {
      textContent = await extractTextContent(buffer, filename);
    } else if (fileType === 'video') {
      metadata = await extractVideoMetadata(buffer, filename);
      frames = await extractVideoFrames(buffer, filename, 3);
    } else if (fileType === 'image') {
      metadata = { size: buffer.length, format: path.extname(filename).slice(1).toUpperCase() };
    }
  } catch (err) {
    logger.error(`File analysis extraction error: ${err.message}`);
    return { allowed: true, fileType, textContent: '', metadata: {}, frames: [], error: 'Extraction partially failed', threatLevel: 'unknown', detectedIssues: ['Analysis extraction error'] };
  }

  return { allowed: true, fileType, textContent, metadata, frames, threatLevel: 'unknown', detectedIssues: [] };
};

export { isBlocked, getAllowed, detectFileType, analyzeFile, extractTextContent, extractVideoMetadata, extractVideoFrames, cleanupTempFile, writeTempFile };
export default { analyzeFile, isBlocked, getAllowed, detectFileType };
