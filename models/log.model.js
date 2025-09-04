const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    companyId: { type: String, required: true, index: true },
    weigh_type: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, required: true, enum: ['Success', 'Failed'] },
    recipientCount: { type: Number, required: true },
    error: { type: String } // For logging any potential errors
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
module.exports = ActivityLog;
