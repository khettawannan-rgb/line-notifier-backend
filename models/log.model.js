const { Schema: S5, model: M5 } = require('mongoose');
const logSchema = new S5({ level: { type: String, default: 'info' }, message: String, meta: Object }, { timestamps: true });
module.exports = M5('Log', logSchema);