/**
 * utils/logger.js
 * ------------------------------------------------------------
 * Winston-based structured logger. In development it prints
 * colored console output; in production it writes JSON logs
 * that are easy to ingest into a log aggregator.
 */
import winston from 'winston';
import config from '../config/index.js';

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]: ${message}${extra}`;
});

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: json(),
  transports: [new winston.transports.Console()],
});

if (config.env !== 'production') {
  logger.clear();
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), devFormat),
    })
  );
}

export default logger;
