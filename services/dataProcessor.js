const NotificationConfig = require('../models/config.model');
const Log = require('../models/log.model');
const { client, notifyAdmin } = require('./lineService');
const logger = require('./logger');

// ฟังก์ชันหลักสำหรับประมวลผลและส่ง LINE
const processWeighbridgeEntry = async (entry) => {
    const { companyId, weigh_type, amount, unit, timestamp } = entry;
    const logStatus = {
        status: 'pending',
        message: '',
        companyId: companyId,
        weighType: weigh_type,
        details: entry
    };

    try {
        const config = await NotificationConfig.findOne({ companyId: companyId });

        if (!config) {
            logStatus.status = 'error';
            logStatus.message = `No notification config found for companyId: ${companyId}`;
            logger.warn(logStatus.message);
            await new Log(logStatus).save();
            return;
        }

        if ((weigh_type === 'BUY' && !config.notify_buy) || (weigh_type === 'SELL' && !config.notify_sell)) {
            logStatus.status = 'skipped';
            logStatus.message = `Skipping notification for ${companyId} - ${weigh_type} as per config.`;
            logger.info(logStatus.message);
            await new Log(logStatus).save();
            return;
        }

        if (!config.uuids || config.uuids.length === 0) {
            logStatus.status = 'error';
            logStatus.message = `Config found for ${companyId}, but no UUIDs are assigned.`;
            logger.warn(logStatus.message);
            await notifyAdmin(logStatus.message);
            await new Log(logStatus).save();
            return;
        }
        
        const messageText = `แจ้งเตือนข้อมูลใหม่จากบริษัท ${companyId}:\nมีรายการ ${weigh_type} ปริมาณ ${amount.toLocaleString('en-US')} ${unit}\nเมื่อเวลา ${new Date(timestamp).toLocaleString('th-TH')}`;
        const messagePayload = { type: 'text', text: messageText };

        await client.multicast(config.uuids, [messagePayload]);

        logStatus.status = 'success';
        logStatus.message = `Successfully sent notification to ${config.uuids.length} users for ${companyId}.`;
        logger.info(logStatus.message);
        await new Log(logStatus).save();

    } catch (error) {
        logStatus.status = 'error';
        logStatus.message = `Failed to send LINE message for ${companyId}: ${error.message}`;
        logger.error(logStatus.message);
        await notifyAdmin(logStatus.message);
        await new Log(logStatus).save();
    }
};

// --- แก้ไขส่วนนี้ ---
// เราจะ export ฟังก์ชัน processWeighbridgeEntry ออกไปด้วย
module.exports = {
    processWeighbridgeEntry
};

