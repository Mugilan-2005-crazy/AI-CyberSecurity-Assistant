/**
 * app.js
 * ------------------------------------------------------------
 * Assembles the Express application: security headers (Helmet),
 * CORS, body parsing, compression, logging, routes, and the
 * global error handler. Exported separately from server.js so
 * it can be imported for testing without binding a port.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import config from './config/index.js';
import logger from './utils/logger.js';

import authRoutes from './routes/authRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import aiUploadRoutes from './routes/aiUploadRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { sanitize } from './middleware/sanitize.js';

const app = express();
logger.info('APP.JS loaded');

app.get("/", (req, res) => {
  res.send("ROOT WORKING");
});

// --- Security & base middleware ---
app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(sanitize);
app.use(rateLimiter(15 * 60 * 1000, 1000, 'Global rate limit exceeded'));

if (config.env !== 'test') app.use(morgan('dev'));

// --- Health check ---
app.get('/api/health', (_req, res) => res.json({ success: true, message: 'Cyber Security Assistant API running' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', env: config.env }));

// --- API routes ---
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/scan`, scanRoutes);
app.use(`${config.apiPrefix}/chat`, chatRoutes);
app.use(`${config.apiPrefix}/admin`, adminRoutes);
app.use(`${config.apiPrefix}/notes`, documentRoutes);
app.use(`${config.apiPrefix}/ai/upload`, aiUploadRoutes);

// --- Error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

export default app;
