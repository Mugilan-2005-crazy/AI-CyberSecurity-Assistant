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
import { createRequestLogger } from './utils/logger.js';

import authRoutes from './routes/authRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import aiUploadRoutes from './routes/aiUploadRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import socRoutes from './routes/socRoutes.js';
import responseRoutes from './routes/responseRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import threatIntelRoutes from './routes/threatIntelRoutes.js';
import aiSocRoutes from './routes/aiSocRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import executiveRoutes from './routes/executiveRoutes.js';
import incidentReportRoutes from './routes/incidentReportRoutes.js';
import knowledgeGraphRoutes from './routes/knowledgeGraphRoutes.js';
import uebaRoutes from './routes/uebaRoutes.js';
import observabilityRoutes from './routes/observabilityRoutes.js';
import cloudSecurityRoutes from './routes/cloudSecurityRoutes.js';
import containerSecurityRoutes from './routes/containerSecurityRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { sanitize } from './middleware/sanitize.js';
import { csrfProtection } from './middleware/csrf.js';
import { requestSizeLimit } from './middleware/requestSizeLimit.js';

const app = express();
logger.info('APP.JS loaded');

app.set('trust proxy', true);

// Request correlation ID middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  req.traceId = req.id;
  req.logger = createRequestLogger(req.id);
  res.setHeader('X-Request-ID', req.id);
  next();
});

app.get("/", (req, res) => {
  res.send("ROOT WORKING");
});

// --- Security & base middleware ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "http://localhost:5000", "http://127.0.0.1:5000"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  permissionsPolicy: {
    camera: ['none'],
    microphone: ['none'],
    geolocation: ['none'],
    payment: ['none'],
    usb: ['none'],
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false,
}));

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);

app.use(requestSizeLimit(10 * 1024 * 1024));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(sanitize);
app.use(rateLimiter(15 * 60 * 1000, 1000, 'Global rate limit exceeded'));

if (config.env !== 'test') app.use(morgan('dev'));

// --- Health check ---
/**
 * @openapi
 * /api/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: API health check
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
app.get('/api/health', (_req, res) => res.json({ success: true, message: 'Cyber Security Assistant API running' }));
/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check (no prefix)
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 env:
 *                   type: string
 */
app.get('/health', (_req, res) => res.json({ status: 'ok', env: config.env }));

// --- API routes ---
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/scan`, scanRoutes);
app.use(`${config.apiPrefix}/chat`, chatRoutes);
app.use(`${config.apiPrefix}/admin`, adminRoutes);
app.use(`${config.apiPrefix}/notes`, documentRoutes);
app.use(`${config.apiPrefix}/ai/upload`, aiUploadRoutes);
app.use(`${config.apiPrefix}/agent`, agentRoutes);
app.use(`${config.apiPrefix}/soc`, socRoutes);
app.use(`${config.apiPrefix}/response`, responseRoutes);
app.use(`${config.apiPrefix}/alerts`, alertRoutes);
app.use(`${config.apiPrefix}/threat-intel`, threatIntelRoutes);
app.use(`${config.apiPrefix}/ai/soc`, aiSocRoutes);
app.use(`${config.apiPrefix}/notifications`, notificationRoutes);
app.use(`${config.apiPrefix}/executive`, executiveRoutes);
app.use(`${config.apiPrefix}/incident-reports`, incidentReportRoutes);
app.use(`${config.apiPrefix}/knowledge-graph`, knowledgeGraphRoutes);
app.use(`${config.apiPrefix}/ueba`, uebaRoutes);
app.use(`${config.apiPrefix}/cloud-security`, cloudSecurityRoutes);
app.use(`${config.apiPrefix}/container-security`, containerSecurityRoutes);
app.use(`${config.apiPrefix}/observability`, observabilityRoutes);

// --- Swagger docs (lazy init to avoid blocking app export) ---
let swaggerInitialized = false;
app.use('/api/docs', (_req, _res, next) => {
  if (!swaggerInitialized) {
    swaggerInitialized = true;
    import('./config/swagger.js').then(({ setupSwagger }) => {
      if (setupSwagger) setupSwagger(app);
    }).catch(err => {
      logger.error(`Swagger init failed: ${err.message}`);
    });
  }
  next();
});

// --- Error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

export default app;