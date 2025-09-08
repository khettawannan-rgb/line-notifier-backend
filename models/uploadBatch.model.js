const { Schema: S3, model: M3 } = require('mongoose');
const uploadBatchSchema = new S3(
{ fileName: String, rowCount: Number, companiesProcessed: Number, uploadedAt: { type: Date, default: Date.now } },
{ timestamps: true }
);
module.exports = M3('UploadBatch', uploadBatchSchema);