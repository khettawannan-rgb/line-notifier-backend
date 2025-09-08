const { Schema: S4, model: M4 } = require('mongoose');
const weighbridgeDataSchema = new S4(
{
batchId: { type: S4.Types.ObjectId, ref: 'UploadBatch', index: true },
date: { type: Date, index: true },
companyId: { type: String, index: true },
product: { type: String, index: true },
type: { type: String, enum: ['BUY', 'SELL'], index: true },
weightKg: { type: Number, default: 0 },
raw: { type: Object },
},
{ timestamps: true }
);
module.exports = M4('WeighbridgeData', weighbridgeDataSchema);