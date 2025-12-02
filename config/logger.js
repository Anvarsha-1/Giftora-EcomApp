// config/logger.js
const { createLogger, format, transports } = require('winston');

const logFormat = format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
        return `${timestamp} ${level}: ${message} - ${stack}`;
    }
    return `${timestamp} ${level}: ${message}`;
});

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.splat()
    ),
    defaultMeta: { service: 'giftora' },
    transports: [
        new transports.Console({
            stderrLevels: ['error'],
            format: format.combine(format.colorize({ all: true }), logFormat)
        }),
        new transports.File({ filename: 'logs/combined.log', format: logFormat }),
        new transports.File({ filename: 'logs/error.log', level: 'error', format: logFormat }),
    ],
    exitOnError: false,
});

module.exports = logger;
