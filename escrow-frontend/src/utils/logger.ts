// Safe logging utility for production
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors, but sanitize in production
    if (isDev) {
      console.error(...args);
    } else {
      // In production, log only sanitized error messages
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'string' ? arg : '[object]'
      );
      console.error('[PRODUCTION ERROR]:', ...sanitizedArgs);
    }
  }
};