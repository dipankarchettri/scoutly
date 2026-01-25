
import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

// Log format
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => {
            const { timestamp, level, message, ...meta } = info;
            return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        },
    ),
);

const transports = [
    // Allow the use of the console to print the messages
    new winston.transports.Console(),

    // Allow to print all the error level messages inside the error.log file
    new winston.transports.File({
        filename: path.join('logs', 'error.log'),
        level: 'error',
        format: winston.format.uncolorize(), // File logs shouldn't have ANSI colors
    }),

    // Allow to print all the error message inside the all.log file
    new winston.transports.File({
        filename: path.join('logs', 'all.log'),
        format: winston.format.uncolorize(),
    }),
];

const Logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
    levels,
    format,
    transports,
});

export default Logger;
export { Logger };
