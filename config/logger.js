// config/logger.js
const { createLogger, format, transports } = require('winston');

const isProd = process.env.NODE_ENV === 'production';

const logFormat = format.printf(({ level, message, timestamp, stack }) => {
    if (stack) return `${timestamp} ${level}: ${message} - ${stack}`;
    return `${timestamp} ${level}: ${message}`;
});

const loggerTransports = [
    new transports.Console({
        stderrLevels: ['error'],
        format: format.combine(format.colorize({ all: true }), logFormat),
    }),
];

// Only use file logging in LOCAL development
if (!isProd) {
    loggerTransports.push(
        new transports.File({ filename: 'logs/combined.log', format: logFormat }),
        new transports.File({ filename: 'logs/error.log', level: 'error', format: logFormat })
    );
}

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.splat()
    ),
    defaultMeta: { service: 'giftora' },
    transports: loggerTransports,
    exitOnError: false,
});

module.exports = logger;
