const mongoose = require('mongoose');

const uploadBatchSchema = new mongoose.Schema({
    uploadSessionId: { type: String, required: true, unique: true, index: true },
    fileName: { type: String, required: true },
    rowCount: { type: Number, required: true },
    status: { type: String, default: 'Processed' }, // e.g., Processed, Sent
    uploadedAt: { type: Date, default: Date.now },
});

const UploadBatch = mongoose.model('UploadBatch', uploadBatchSchema);

module.exports = UploadBatch;

