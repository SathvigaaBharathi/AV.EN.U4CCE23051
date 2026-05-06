// logger.js
// simple custom logger for the affordmed test

/**
 * Sends logs to the central evaluation service
 * @param {string} stack - "backend" or "frontend"
 * @param {string} level - "debug", "info", "warn", "error", "fatal"
 * @param {string} pkg - e.g. "auth", "db", "controller", "api", "ui"
 * @param {string} message - the actual log message
 */
export async function Log(stack, level, pkg, message) {
    // some basic checks to avoid bad api calls
    if (stack !== 'backend' && stack !== 'frontend') {
        stack = 'frontend'; // default
    }
    
    // just using fetch so we don't need axios
    try {
        const response = await fetch('http://20.207.122.201/evaluation-service/logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stack: stack,
                level: level,
                package: pkg,
                message: message
            })
        });
        
        // not throwing errors here because logging shouldn't break the app
        if (!response.ok) {
            // maybe log to console in dev mode
        }
    } catch (err) {
        // silently fail if log server is down
        // console.error("logging failed", err);
    }
}
