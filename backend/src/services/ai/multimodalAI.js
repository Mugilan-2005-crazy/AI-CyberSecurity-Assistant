/**
 * services/ai/multimodalAI.js
 * ------------------------------------------------------------
 * Multimodal AI service for PDF, Image, and Video analysis.
 * Uses Gemini Vision for images and videos, and text analysis
 * for PDFs/DOCX. Falls back to text guidance when vision is
 * unavailable.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../config/index.js';
import { analyzeFile, extractTextContent, extractVideoFrames } from '../fileAnalysisService.js';
import AttachmentAnalysis from '../../models/AttachmentAnalysis.js';
import path from 'path';
import logger from '../../utils/logger.js';

let genAI = null;
let visionModel = null;
let textModel = null;
let currentVisionModelName = null;
let currentTextModelName = null;
const FALLBACK_VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest', 'gemini-pro-latest'];
const FALLBACK_TEXT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest', 'gemini-pro-latest'];

if (config.gemini.apiKey) {
  genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  for (const modelName of FALLBACK_VISION_MODELS) {
    try {
      visionModel = genAI.getGenerativeModel({ model: modelName });
      currentVisionModelName = modelName;
      break;
    } catch (err) {
      logger.warn(`[multimodalAI] Failed to init vision model ${modelName}: ${err.message}`);
    }
  }
  for (const modelName of FALLBACK_TEXT_MODELS) {
    try {
      textModel = genAI.getGenerativeModel({ model: modelName });
      currentTextModelName = modelName;
      break;
    } catch (err) {
      logger.warn(`[multimodalAI] Failed to init text model ${modelName}: ${err.message}`);
    }
  }
  logger.info('[multimodalAI] Gemini models initialized', { visionModel: currentVisionModelName, textModel: currentTextModelName });
} else {
  logger.warn('[multimodalAI] Gemini API key not configured, vision will be unavailable');
}

const SYSTEM_INSTRUCTION = [
  'You are "CyberSec File Analyzer", a specialized cybersecurity file analyst.',
  'Analyze uploaded files for security threats: malware, phishing indicators, suspicious content, data exfiltration risks.',
  'Always answer in the user\'s selected language. Keep technical terms in English.',
  'Provide structured analysis with: summary, detected threats, risk level, recommendations.',
  'If the file appears safe, say so clearly with reasons.',
  'If analysis is limited, explain what was checked and what could not be analyzed.',
].join(' ');

const askGeminiText = async (prompt, language = 'en') => {
  if (!textModel) throw new Error('Gemini not configured');
  const langInstruction = language === 'ta' ? 'Reply in Tamil.' : language === 'hi' ? 'Reply in Hindi.' : language === 'tanglish' ? 'Reply in Tanglish.' : 'Reply in English.';
  
  const tryTextModel = async (modelName) => {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${SYSTEM_INSTRUCTION}\n[Language: ${langInstruction}]\n\n${prompt}` }] }],
    });
    return result.response.text();
  };

  try {
    const reply = await tryTextModel(currentTextModelName);
    return reply;
  } catch (err) {
    if (err.statusCode === 404 || err.status === 404) {
      logger.warn(`[askGeminiText] Model ${currentTextModelName} not found, trying fallbacks...`);
      for (const fallbackName of FALLBACK_TEXT_MODELS) {
        if (fallbackName === currentTextModelName) continue;
        try {
          const reply = await tryTextModel(fallbackName);
          logger.info(`[askGeminiText] Fallback model ${fallbackName} succeeded`);
          return reply;
        } catch (fallbackErr) {
          logger.warn(`[askGeminiText] Fallback model ${fallbackName} failed: ${fallbackErr.message}`);
        }
      }
    }
    throw err;
  }
};

const askGeminiVision = async (prompt, imageBuffer, mimeType = 'image/png', language = 'en') => {
  if (!visionModel) throw new Error('Gemini Vision not configured');

  const base64Data = imageBuffer.toString('base64');
  const base64Length = base64Data.length;

  logger.info('[GEMINI] Vision request starting', {
    model: currentVisionModelName,
    mimeType,
    imageSize: imageBuffer.length,
    base64Length,
    language,
    promptPreview: prompt.slice(0, 80),
    apiKeyExists: Boolean(config.gemini.apiKey),
    apiKeyLength: config.gemini.apiKey ? config.gemini.apiKey.length : 0,
  });

  const langInstruction = language === 'ta' ? 'Reply in Tamil.' : language === 'hi' ? 'Reply in Hindi.' : language === 'tanglish' ? 'Reply in Tanglish.' : 'Reply in English.';

   const tryVisionModel = async (modelName) => {
     logger.info('[GEMINI] Trying model', { model: modelName });
     const model = genAI.getGenerativeModel({ model: modelName });
     const requestPayload = {
       contents: [
         {
           parts: [
             { text: `${SYSTEM_INSTRUCTION}\n[Language: ${langInstruction}]\n\n${prompt}` },
             {
               inlineData: {
                 mimeType,
                 data: base64Data,
               },
             },
           ],
         },
       ],
     };
     logger.info('[GEMINI] Request payload structure validated', {
       model: modelName,
       contentType: 'inlineData',
       mimeType,
       textLength: requestPayload.contents[0].parts[0].text.length,
       base64Length: base64Data.length,
     });

     const result = await model.generateContent(requestPayload);
     const reply = result.response.text();
     logger.info('[GEMINI] Success', { model: modelName, replyLength: reply.length, replyPreview: reply.slice(0, 100) });
     return reply;
   };

  try {
    let reply = await tryVisionModel(currentVisionModelName);
    return reply;
  } catch (err) {
    if (err.statusCode === 404 || err.status === 404) {
      logger.warn(`[GEMINI] Model ${currentVisionModelName} not found, trying fallbacks...`);
      for (const fallbackName of FALLBACK_VISION_MODELS) {
        if (fallbackName === currentVisionModelName) continue;
        try {
          const reply = await tryVisionModel(fallbackName);
          return reply;
        } catch (fallbackErr) {
          logger.warn(`[GEMINI] Fallback model ${fallbackName} failed: ${fallbackErr.message}`, {
            statusCode: fallbackErr.statusCode,
            status: fallbackErr.status,
          });
        }
      }
    }
    logger.error('[GEMINI] Failed', {
      error: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      status: err.status,
      completeError: err.message,
    });
    throw err;
  }
};

const analyzePdf = async (buffer, filename, language, userQuery, userId = null) => {
  const text = await extractTextContent(buffer, filename);
  if (!text || text.trim().length === 0) {
    return {
      success: true,
      analysis: 'Could not extract readable text from this PDF. The file may be scanned images, encrypted, or empty.',
      threatLevel: 'unknown',
      detectedIssues: ['No extractable text content'],
      provider: 'gemini-text',
    };
  }

  const chunks = [];
  const chunkSize = 4000;
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  const contextPrompt = chunks.length > 1
    ? `This document has been split into ${chunks.length} sections for analysis. Here is the full text:\n\n${text.slice(0, 8000)}${text.length > 8000 ? '\n\n[...document continues...]' : ''}\n\nUser question: ${userQuery || 'Please analyze this document for security threats, sensitive data, and provide a summary.'}`
    : `Document content:\n\n${text}\n\nUser question: ${userQuery || 'Please analyze this document for security threats, sensitive data, and provide a summary.'}`;

  try {
    const analysis = await askGeminiText(contextPrompt, language);
    const result = { success: true, analysis, threatLevel: 'unknown', detectedIssues: [], extractedLength: text.length, provider: 'gemini-text' };
    await saveAttachmentAnalysis(userId, filename, 'pdf', buffer.length, result);
    return result;
  } catch (err) {
    logger.warn(`Gemini PDF analysis failed: ${err.message}`);
    
    const fallbackResult = {
      success: false,
      analysis: 'AI analysis failed. Document extracted successfully but analysis unavailable.',
      threatLevel: 'unknown',
      detectedIssues: ['AI analysis failed'],
      extractedLength: text.length,
      error: err.message,
      provider: 'gemini-text',
    };
    await saveAttachmentAnalysis(userId, filename, 'pdf', buffer.length, fallbackResult);
    return fallbackResult;
  }
};

const analyzeImage = async (buffer, filename, mimeType, language, userQuery) => {
  const prompt = userQuery || 'Analyze this image for security threats: phishing indicators, suspicious URLs, malware warnings, QR codes, sensitive data exposure, social engineering visuals. Provide a structured security assessment.';

  logger.info('[analyzeImage] Starting image analysis', {
    filename,
    mimeType,
    size: buffer.length,
    language,
    queryPreview: prompt.slice(0, 80),
  });

  if (!visionModel || !genAI) {
    logger.warn('[analyzeImage] Gemini Vision not configured');
    return {
      success: true,
      analysis: 'Image analysis requires Gemini Vision. Text AI is available. Please describe the image or enable Gemini quota.',
      threatLevel: 'unknown',
      detectedIssues: ['Vision analysis unavailable - Gemini not configured'],
      imageAnalyzed: false,
      fallback: true,
      errorCategory: 'MODEL_UNAVAILABLE',
    };
  }

  try {
    const analysis = await askGeminiVision(prompt, buffer, mimeType, language);
    logger.info('[analyzeImage] Vision analysis success', { filename, replyPreview: analysis.slice(0, 100) });
    return { success: true, analysis, threatLevel: 'unknown', detectedIssues: [], imageAnalyzed: true };
  } catch (err) {
    const errorCategory = classifyGeminiError(err);
    logger.warn(`[analyzeImage] Gemini Vision failed: ${err.message}`, { filename, errorCategory, statusCode: err.statusCode, status: err.status });

    if (errorCategory === 'INVALID_API_KEY') {
      return {
        success: false,
        analysis: 'Image analysis is currently unavailable due to an authentication issue. Please contact support.',
        threatLevel: 'unknown',
        detectedIssues: ['Invalid API key'],
        imageAnalyzed: false,
        fallback: true,
        errorCategory: 'INVALID_API_KEY',
      };
    }

    if (errorCategory === 'QUOTA_EXCEEDED') {
      return {
        success: false,
        analysis: 'Image analysis quota exceeded. Please try again later or enable billing in your Google Cloud project.',
        threatLevel: 'unknown',
        detectedIssues: ['Quota exceeded'],
        imageAnalyzed: false,
        fallback: true,
        errorCategory: 'QUOTA_EXCEEDED',
      };
    }

    if (errorCategory === 'MODEL_UNAVAILABLE') {
      return {
        success: false,
        analysis: 'Image analysis model is temporarily unavailable. Please try again later.',
        threatLevel: 'unknown',
        detectedIssues: ['Model not found'],
        imageAnalyzed: false,
        fallback: true,
        errorCategory: 'MODEL_UNAVAILABLE',
      };
    }

    if (errorCategory === 'INVALID_IMAGE') {
      return {
        success: false,
        analysis: 'The uploaded image format is not supported for AI analysis. Please try a PNG or JPEG image.',
        threatLevel: 'unknown',
        detectedIssues: ['Invalid image format'],
        imageAnalyzed: false,
        fallback: true,
        errorCategory: 'INVALID_IMAGE',
      };
    }

    return {
      success: false,
      analysis: 'Image analysis is currently unavailable due to a network or service error. Please try again later.',
      threatLevel: 'unknown',
      detectedIssues: ['Network/service error'],
      imageAnalyzed: false,
      fallback: true,
      errorCategory: 'NETWORK_ERROR',
    };
  }
};

const classifyGeminiError = (err) => {
  const message = (err.message || '').toLowerCase();
  if (message.includes('api key') || message.includes('401') || message.includes('permission')) return 'INVALID_API_KEY';
  if (message.includes('not found') || message.includes('no longer available')) return 'MODEL_UNAVAILABLE';
  if (message.includes('invalid') && message.includes('image')) return 'INVALID_IMAGE';
  if (message.includes('quota') || message.includes('429') || message.includes('resource exhausted')) return 'QUOTA_EXCEEDED';
  if (message.includes('400') || message.includes('bad request')) return 'INVALID_REQUEST';
  if (message.includes('network') || message.includes('econnreset') || message.includes('timeout')) return 'NETWORK_ERROR';
  return 'UNKNOWN_ERROR';
};

const analyzeVideo = async (buffer, filename, language, userQuery) => {
  const metadata = {
    format: path.extname(filename).slice(1).toUpperCase(),
    size: buffer.length,
  };

  const frames = await extractVideoFrames(buffer, filename, 3);
  if (frames.length === 0) {
    return {
      success: true,
      analysis: `Video received (${metadata.format}, ${(metadata.size / 1024 / 1024).toFixed(2)} MB). Full video frame extraction requires ffmpeg on the server. Based on the video metadata alone: this is a ${metadata.format} file. For security analysis, please describe what is shown in the video, or upload key frames as images for AI vision analysis. Common video-based threats include: phishing tutorials, malware demonstration videos, social engineering demonstrations, suspicious screen recordings.`,
      threatLevel: 'unknown',
      detectedIssues: ['Frame extraction unavailable - metadata analysis only'],
      metadata,
      framesAnalyzed: 0,
    };
  }

  const analyses = [];
  for (const frame of frames) {
    try {
      const frameAnalysis = await askGeminiVision(`Analyze this video frame (timestamp: ${frame.timestamp}) for security threats.`, frame.buffer, frame.mimeType || 'image/png', language);
      analyses.push({ timestamp: frame.timestamp, analysis: frameAnalysis });
    } catch (err) {
      analyses.push({ timestamp: frame.timestamp, analysis: 'Frame analysis failed', error: true });
    }
  }

  const combinedAnalysis = `Video Security Analysis (${frames.length} frames analyzed):\n\n${analyses.map((a, i) => `Frame ${i + 1} (${a.timestamp}): ${a.analysis}`).join('\n\n')}\n\nOverall: This video has been analyzed frame-by-frame for security content.`;

  return {
    success: true,
    analysis: combinedAnalysis,
    threatLevel: 'unknown',
    detectedIssues: [],
    metadata,
    framesAnalyzed: frames.length,
    frameDetails: analyses,
  };
};

const generateSecurityReport = (result, filename, fileType) => {
  const report = {
    summary: result.analysis || 'Analysis completed.',
    riskLevel: result.threatLevel || 'unknown',
    detectedThreats: result.detectedIssues || [],
    recommendations: result.detectedIssues?.length ? 'Review the detected issues and take appropriate action.' : 'No immediate action required. Continue monitoring.',
    confidenceScore: result.imageAnalyzed ? 'High' : result.framesAnalyzed > 0 ? 'Medium' : 'Low',
    aiProvider: result.provider || 'unknown',
    fileType,
    filename,
  };
  return report;
};

const saveAttachmentAnalysis = async (userId, filename, fileType, fileSize, result) => {
  try {
    if (!userId) return;
    const report = generateSecurityReport(result, filename, fileType);
    await AttachmentAnalysis.create({
      user: userId,
      filename,
      fileType,
      fileSize,
      mimeType: result.metadata?.mimeType || 'application/octet-stream',
      analysisResult: report.summary,
      threatLevel: report.riskLevel,
      detectedIssues: report.detectedThreats,
      provider: result.provider,
      language: result.language || 'en',
    });
    logger.info('[multimodalAI] AttachmentAnalysis saved', { userId, filename, fileType, provider: result.provider });
  } catch (err) {
    logger.warn(`[multimodalAI] Failed to save AttachmentAnalysis: ${err.message}`);
  }
};

export const analyzeAttachment = async (buffer, filename, mimeType, language, userQuery = '', userId = null) => {
  logger.info('[multimodalAI] analyzeAttachment called', { filename, mimeType, size: buffer.length, language, queryPreview: userQuery.slice(0, 80) });
  const analysisResult = await analyzeFile(buffer, filename, mimeType);

  if (!analysisResult.allowed) {
    logger.warn('[multimodalAI] File not allowed', { filename, reason: analysisResult.reason });
    return analysisResult;
  }

  const { fileType, textContent, metadata, frames } = analysisResult;
  logger.info('[multimodalAI] File type detected', { filename, fileType });

  const analyzerMap = {
    pdf: 'Gemini Text / PDF',
    docx: 'Gemini Text / DOCX',
    text: 'Gemini Text / TXT',
    image: 'Gemini Vision',
    video: 'Gemini Vision / Metadata',
  };
  logger.info('[multimodalAI] Analyzer selected', { filename, analyzer: analyzerMap[fileType] || 'Unknown' });

  try {
    if (fileType === 'pdf' || fileType === 'docx' || fileType === 'text') {
      const result = await analyzePdf(buffer, filename, language, userQuery, userId);
      const provider = result.provider || 'gemini-text';
      logger.info('[multimodalAI] AI provider selected', { filename, provider });
      logger.info('[multimodalAI] PDF/DOCX/TXT analysis complete', { filename, provider, replyPreview: (result.analysis || '').slice(0, 100) });
      const report = generateSecurityReport(result, filename, fileType);
      return { ...result, fileType, filename, metadata, detectedIssues: result.detectedIssues || [], report };
    }
    if (fileType === 'image') {
      const result = await analyzeImage(buffer, filename, mimeType, language, userQuery);
      const provider = result.imageAnalyzed ? 'gemini-vision' : 'multimodal-fallback';
      logger.info('[multimodalAI] AI provider selected', { filename, provider });
      logger.info('[multimodalAI] Image analysis complete', { filename, provider, imageAnalyzed: result.imageAnalyzed, replyPreview: (result.analysis || '').slice(0, 100) });
      await saveAttachmentAnalysis(userId, filename, fileType, buffer.length, { ...result, provider, language });
      const report = generateSecurityReport(result, filename, fileType);
      return { ...result, fileType, filename, metadata, provider, report };
    }
    if (fileType === 'video') {
      const result = await analyzeVideo(buffer, filename, language, userQuery);
      const provider = result.framesAnalyzed > 0 ? 'gemini-vision' : 'multimodal-fallback';
      logger.info('[multimodalAI] AI provider selected', { filename, provider });
      logger.info('[multimodalAI] Video analysis complete', { filename, provider, framesAnalyzed: result.framesAnalyzed, replyPreview: (result.analysis || '').slice(0, 100) });
      await saveAttachmentAnalysis(userId, filename, fileType, buffer.length, { ...result, provider, language });
      const report = generateSecurityReport(result, filename, fileType);
      return { ...result, fileType, filename, provider, report };
    }
    return { success: false, analysis: 'Unsupported file type for AI analysis.', threatLevel: 'unknown', detectedIssues: ['Unsupported file type'] };
  } catch (err) {
    logger.error(`[multimodalAI] Analysis error: ${err.message}`, { filename, fileType, stack: err.stack });
    return { success: false, analysis: 'Analysis failed due to an internal error.', threatLevel: 'unknown', detectedIssues: ['Internal analysis error'], error: err.message };
  }
};

export default { analyzeAttachment };
