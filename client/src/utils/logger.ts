/**
 * Frontend dev-only logger
 * Replaces console.log — only logs in development mode.
 * In production builds, these calls are completely silent.
 *
 * Usage:
 *   import { devLog, devWarn, devError } from '../utils/logger';
 *   devLog('Fetching data:', params);
 */

const isDev = process.env.NODE_ENV !== 'production';

export const devLog = (...args: any[]) => {
    if (isDev) console.log(...args);
};

export const devWarn = (...args: any[]) => {
    if (isDev) console.warn(...args);
};

export const devError = (...args: any[]) => {
    // Always log errors, even in production
    console.error(...args);
};

export const devTable = (...args: any[]) => {
    if (isDev) console.table(...args);
};
