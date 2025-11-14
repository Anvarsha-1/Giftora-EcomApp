// config/logger.js
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }), // keep stack in `error`
        format.splat(),
        format.json()
    ),
    defaultMeta: { service: 'giftora' },
    transports: [
        new transports.Console({
            stderrLevels: ['error'],
            format: format.combine(
                format.colorize({ all: true }),
                format.printf(({ level, message, timestamp, stack }) => {
                    if (stack) return `${timestamp} ${level}: ${message} - ${stack}`;
                    return `${timestamp} ${level}: ${message}`;
                })
            )
        }),
        
        new transports.File({ filename: 'logs/combined.log' }),
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
    ],
    exitOnError: false,
});

module.exports = logger;
