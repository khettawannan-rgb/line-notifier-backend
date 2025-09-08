const Config = require('../models/config.model');
async function listConfigs(req, res) { const cfgs = await Config.find({}).sort({ companyId: 1 }).lean(); res.json(cfgs); }
async function updateConfig(req, res) {
const { id } = req.params; const { uuids = [], meta = {} } = req.body || {};
const doc = await Config.findByIdAndUpdate(id, { $set: { uuids, meta } }, { new: true }).lean();
if (!doc) return res.status(404).json({ message: 'Config not found' });
res.json(doc);
}
module.exports = { listConfigs, updateConfig };