import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from './index.js';
import logger from '../utils/logger.js';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cyber Security Assistant API',
      version: '1.0.0',
      description: 'Production-ready AI-powered Cyber Security Assistant REST API',
      contact: {
        name: 'Mugilan',
        email: 'mugilan@example.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['user', 'admin'] },
            isEmailVerified: { type: 'boolean' },
            language: { type: 'string' },
          },
        },
        ScanResult: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            input: { type: 'string' },
            verdict: { type: 'string', enum: ['safe', 'suspicious', 'malicious'] },
            riskScore: { type: 'integer', minimum: 0, maximum: 100 },
            threats: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
          },
        },
        SecurityIncident: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            userId: { type: 'string' },
            threatType: { type: 'string' },
            severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
            status: { type: 'string', enum: ['open', 'in-progress', 'resolved', 'closed'] },
            description: { type: 'string' },
            mitreTechnique: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        SecurityAlert: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            userId: { type: 'string' },
            alertType: { type: 'string' },
            severity: { type: 'string', enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            title: { type: 'string' },
            message: { type: 'string' },
            source: { type: 'string' },
            status: { type: 'string', enum: ['unread', 'read', 'acknowledged', 'resolved'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CVE: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            severity: { type: 'string' },
            cvssScore: { type: 'number' },
            description: { type: 'string' },
            publishedDate: { type: 'string' },
            references: { type: 'array', items: { type: 'string' } },
          },
        },
        ThreatCorrelation: {
          type: 'object',
          properties: {
            confidenceScore: { type: 'number', minimum: 0, maximum: 1 },
            threatPriority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
            recommendedEscalation: { type: 'string', enum: ['monitor', 'schedule', 'urgent', 'immediate'] },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/app.js',
  ],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

export function setupSwagger(app) {
  const isProduction = config.env === 'production';

  if (isProduction) {
    app.get('/api/docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerDocs);
    });
    logger.info('Swagger JSON available at /api/docs.json (UI disabled in production)');
    return;
  }

  const swaggerUiOptions = {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
    },
    customSiteTitle: 'Cyber Security Assistant API Docs',
    customCssUrl: '',
  };

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, swaggerUiOptions));

  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocs);
  });

  logger.info(`Swagger docs available at http://localhost:${config.port}/api/docs`);
}

export default swaggerDocs;
