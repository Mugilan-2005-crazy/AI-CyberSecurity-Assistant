/**
 * controllers/aiUploadController.js
 * ------------------------------------------------------------
 * Handles AI-powered file upload analysis for the chatbox.
 * Accepts multipart uploads, runs multimodal AI analysis,
 * and persists results.
 */
import ApiError from '../utils/ApiError.js';
import AttachmentAnalysis from '../models/AttachmentAnalysis.js';
import { analyzeAttachment } from '../services/ai/multimodalAI.js';
import { isBlocked, getAllowed, detectFileType } from '../services/fileAnalysisService.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

const computeSha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

export const uploadAndAnalyze = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new ApiError(400, 'No file uploaded');

    if (isBlocked(file.originalname)) {
      throw new ApiError(400, 'File type blocked for security');
    }
    if (!getAllowed(file.originalname)) {
      throw new ApiError(400, 'Unsupported file type');
    }

    const language = req.language || req.user?.language || 'en';
    const userQuery = typeof req.body?.query === 'string' ? req.body.query : '';
    const sha256 = computeSha256(file.buffer);

    logger.info('[aiUploadController] Upload metadata', {
      userId: req.user?.id,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      sha256,
      language,
      queryPreview: userQuery.slice(0, 80),
    });

    const result = await analyzeAttachment(file.buffer, file.originalname, file.mimetype, language, userQuery);

    const analysisDoc = {
      user: req.user.id,
      filename: file.originalname,
      fileType: detectFileType(file.originalname, file.mimetype),
      fileSize: file.size,
      mimeType: file.mimetype,
      sha256,
      analysisResult: result.analysis || 'Analysis completed',
      threatLevel: result.threatLevel || 'unknown',
      detectedIssues: result.detectedIssues || [],
      chatSessionId: req.body?.sessionId || null,
      chatMessageId: req.body?.messageId || null,
    };

    let persisted = null;
    try {
      persisted = await AttachmentAnalysis.create(analysisDoc);
    } catch (err) {
      logger.warn(`AttachmentAnalysis persistence failed: ${err.message}`);
    }

    res.json({
      success: true,
      result,
      persisted: Boolean(persisted),
      analysisId: persisted?._id || null,
    });
  } catch (err) {
    next(err);
  }
};

export const getUploadHistory = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const analyses = await AttachmentAnalysis.find({ user: req.user.id })
      .sort({ uploadDate: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, analyses });
  } catch (err) {
    next(err);
  }
};

export default { uploadAndAnalyze, getUploadHistory };
