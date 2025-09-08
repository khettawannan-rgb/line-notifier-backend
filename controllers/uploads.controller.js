const UploadBatch = require('../models/uploadBatch.model');
const WeighbridgeData = require('../models/weighbridgeData.model');
const Config = require('../models/config.model');
const { pushMessage } = require('../services/lineService');
const logger2 = require('../services/logger');
const mongoose2 = require('mongoose');


function pickFirstKey(obj, candidates) { for (const k of candidates) if (obj[k] !== undefined) return obj[k]; return undefined; }
function normalizeRow(row) {
const dateRaw = pickFirstKey(row, ['Date','วันที่','date','DATETIME','TicketDate','time_in']);
const dir = (pickFirstKey(row, ['Type','ประเภท','type','IN/OUT','Direction']) || '').toString().toUpperCase();
const product = (pickFirstKey(row, ['Product','สินค้า','Material','product','material']) || 'UNKNOWN').toString();
const companyId = (pickFirstKey(row, ['CompanyID','Company','Customer','บริษัท','Partner','customer_code']) || 'UNKNOWN').toString();
const weight = Number(pickFirstKey(row, ['NetWeight','NetKG','น้ำหนักสุทธิ(กก.)','NET','net','WeightKg','Weight']) || 0);
const date = dateRaw ? new Date(dateRaw) : null;
let type; if (['BUY','SELL'].includes(dir)) type = dir; else if (['IN','INBOUND'].includes(dir)) type='BUY'; else if (['OUT','OUTBOUND'].includes(dir)) type='SELL'; else type='BUY';
return { date, companyId, product, type, weightKg: isNaN(weight) ? 0 : weight, raw: row };
}


async function uploadFile(req, res) {
const { fileData, fileName } = req.body || {};
if (!fileData || !Array.isArray(fileData.allData) || !Array.isArray(fileData.mixData)) return res.status(400).json({ message: 'Payload must contain fileData.allData and fileData.mixData arrays' });
const session = await mongoose2.startSession(); session.startTransaction();
try {
const batch = await UploadBatch.create([{ fileName: fileName || 'unknown.xlsx', rowCount: fileData.allData.length, companiesProcessed: 0 }], { session });
const batchId = batch[0]._id;


const companyIds = new Set();
for (const row of fileData.mixData) {
const companyId = (pickFirstKey(row, ['CompanyID','บริษัท','Partner','customer_code']) || '').toString().trim();
if (!companyId) continue; companyIds.add(companyId);
await Config.updateOne({ companyId }, { $setOnInsert: { uuids: [], meta: {} } }, { upsert: true, session });
}


const docs = fileData.allData.map(r => ({ ...normalizeRow(r), batchId }));
if (docs.length) await WeighbridgeData.insertMany(docs, { session, ordered: false });
await UploadBatch.findByIdAndUpdate(batchId, { companiesProcessed: companyIds.size }, { session });
await session.commitTransaction();
res.json({ batchId, fileName, dataRowsSaved: docs.length, companiesProcessed: companyIds.size });
} catch (err) {
await session.abortTransaction().catch(()=>{});
logger2.error('Upload failed', { err: err.message });
res.status(500).json({ message: 'Upload failed', error: err.message });
} finally { session.endSession(); }
}


async function listBatches(req, res) { const list = await UploadBatch.find({}).sort({ uploadedAt: -1 }).lean(); res.json(list); }
async function deleteBatch(req, res) { const { id } = req.params; const found = await UploadBatch.findById(id); if (!found) return res.status(404).json({ message: 'Batch not found' }); await WeighbridgeData.deleteMany({ batchId: id }); await UploadBatch.findByIdAndDelete(id); res.status(204).end(); }


async function sendBatchReport(req, res) {
const { id } = req.params; const batch = await UploadBatch.findById(id).lean(); if (!batch) return res.status(404).json({ message: 'Batch not found' });
const rows = await WeighbridgeData.aggregate([{ $match: { batchId: new mongoose2.Types.ObjectId(id) } }, { $group: { _id: { companyId: '$companyId', type: '$type', product: '$product' }, totalWeight: { $sum: '$weightKg' } } }]);
const byCompany = new Map();
for (const r of rows) { const key = r._id.companyId || 'UNKNOWN'; if (!byCompany.has(key)) byCompany.set(key, []); byCompany.get(key).push({ type: r._id.type, product: r._id.product, totalWeight: r.totalWeight }); }
let pushes = 0, failures = 0;
for (const [companyId, items] of byCompany.entries()) {
const cfg = await Config.findOne({ companyId }).lean(); if (!cfg || !cfg.uuids?.length) continue;
const buy = items.filter(i => i.type === 'BUY'); const sell = items.filter(i => i.type === 'SELL');
const fmt = (arr) => arr.map(i => `• ${i.product}: ${(i.totalWeight/1000).toFixed(2)} ตัน`).join('\n') || '-';
const text = `สรุปรีพอร์ตไฟล์: ${batch.fileName}\nบริษัท: ${companyId}\n\nซื้อ (BUY)\n${fmt(buy)}\n\nขาย (SELL)\n${fmt(sell)}`;
for (const uid of cfg.uuids) { const r = await pushMessage(uid, text); if (r.ok) pushes++; else failures++; }
}
res.json({ message: `Sent messages: ${pushes}, failures: ${failures}` });
}
module.exports = { uploadFile, listBatches, deleteBatch, sendBatchReport };