const Log = require('../models/log.model');
function log(level, message, meta) {
console[level === 'error' ? 'error' : 'log'](`[${level}] ${message}`, meta || '');
try { Log.create({ level, message, meta }); } catch (_) {}
}
module.exports = { info: (m, x) => log('info', m, x), warn: (m, x) => log('warn', m, x), error: (m, x) => log('error', m, x) };