const logger = require('./logger');
const PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
async function pushMessage(userId, text) {
if (!userId) return { ok: false, error: 'missing userId' };
if (!token) { logger.info('LINE dry-run', { userId, text }); return { ok: true, dryRun: true }; }
const res = await fetch(PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }) });
if (!res.ok) { const err = await res.text().catch(()=> ''); logger.error('LINE push error', { status: res.status, err }); return { ok: false, status: res.status, err }; }
return { ok: true };
}
module.exports = { pushMessage };