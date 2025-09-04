const mongoose = require('mongoose');

const notificationConfigSchema = new mongoose.Schema({
    companyId: { type: String, required: true, unique: true, index: true },
    notify_buy: { type: Boolean, default: true },
    notify_sell: { type: Boolean, default: true },
    uuids: [{ type: String }]
});

const NotificationConfig = mongoose.model('NotificationConfig', notificationConfigSchema);
module.exports = NotificationConfig;
