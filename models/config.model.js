const { Schema: S2, model: M2 } = require('mongoose');
const configSchema = new S2(
{ companyId: { type: String, index: true, unique: true, required: true }, uuids: { type: [String], default: [] }, meta: { type: Object, default: {} } },
{ timestamps: true }
);
module.exports = M2('Config', configSchema);