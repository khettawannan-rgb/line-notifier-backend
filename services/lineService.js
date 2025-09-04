const line = require('@line/bot-sdk');
const logger = require('./logger');
require('dotenv').config();

const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

const notifyAdmin = async (message) => {
    if (!process.env.ADMIN_LINE_UID) {
        logger.warn('ADMIN_LINE_UID not set. Cannot send admin notification.');
        return;
    }
    try {
        await client.pushMessage(process.env.ADMIN_LINE_UID, { type: 'text', text: `[ADMIN ALERT] ${message}` });
    } catch (error) {
        logger.error(`Failed to send notification to admin: ${error.message}`);
    }
};

module.exports = { client, middleware: line.middleware(config), notifyAdmin };
