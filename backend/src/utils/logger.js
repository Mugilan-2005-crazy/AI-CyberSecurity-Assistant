/**
 * utils/logger.js
 * ------------------------------------------------------------
 * Winston-based structured logger. In development it prints
 * colored console output; in production it writes JSON logs
 * that are easy to ingest into a log aggregator.
 */


import winston from 'winston';

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]: ${message}${extra}`;
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(timestamp(), json()),
  transports: [new winston.transports.Console()],
});

if (process.env.NODE_ENV !== 'production') {
  logger.clear();
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), devFormat),
    })
  );
}

export const createRequestLogger = (reqId) => ({
  info: (message, meta = {}) => logger.info(message, { ...meta, reqId }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, reqId }),
  error: (message, meta = {}) => logger.error(message, { ...meta, reqId }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, reqId }),
});

export default logger;
