const User = require('../models/user.model');
const NotificationConfig = require('../models/config.model');
const WeighbridgeData = require('../models/weighbridgeData.model');
const { client, notifyAdmin } = require('../services/lineService');
const logger = require('../services/logger');

// ฟังก์ชันสำหรับจัดการเมื่อมีคนเพิ่มเพื่อน
const handleFollowEvent = async (event) => {
    try {
        const userId = event.source.userId;
        const profile = await client.getProfile(userId);

        const newUser = new User({
            userId: userId,
            displayName: profile.displayName,
        });
        await newUser.save();
        logger.info(`New user added: ${profile.displayName} (ID: ${userId})`);

        const welcomeMessage = {
            type: 'text',
            text: `สวัสดีคุณ ${profile.displayName}! ขอบคุณที่เพิ่มเราเป็นเพื่อน ผู้ดูแลระบบจะทำการตั้งค่าการแจ้งเตือนสำหรับบริษัทของคุณในไม่ช้า`,
        };
        await client.replyMessage(event.replyToken, welcomeMessage);

    } catch (error) {
        logger.error(`Error handling follow event: ${error.message}`);
        await notifyAdmin(`Failed to onboard user. Error: ${error.message}`);
    }
};

// ฟังก์ชันสำหรับจัดการเมื่อได้รับข้อความ
const handleMessageEvent = async (event) => {
    const userId = event.source.userId;
    const userText = event.message.text.trim().toLowerCase();

    // ตรวจสอบคีย์เวิร์ด
    if (userText === 'sorni' || userText === 'ซ้อนิ') {
        try {
            // 1. ค้นหาว่า user ID นี้ผูกกับบริษัทอะไร
            const config = await NotificationConfig.findOne({ uuids: userId });
            if (!config) {
                await client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: 'ไม่พบบริษัทที่ผูกกับบัญชี LINE ของคุณ กรุณาติดต่อผู้ดูแลระบบ'
                });
                return;
            }

            // 2. ค้นหาข้อมูลของวันนี้สำหรับบริษัทนั้นๆ
            const today = new Date();
            today.setHours(0, 0, 0, 0); // ตั้งเวลาเป็นเที่ยงคืน
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1); // วันพรุ่งนี้ตอนเที่ยงคืน

            const dailyData = await WeighbridgeData.find({
                companyId: config.companyId,
                transactionDate: {
                    $gte: today,
                    $lt: tomorrow
                }
            });

            if (dailyData.length === 0) {
                await client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: `ยังไม่มีการอัปเดตข้อมูลสำหรับบริษัท ${config.companyId} ในวันนี้`
                });
                return;
            }

            // 3. สร้างข้อความสรุป
            let buyTotal = 0;
            let sellTotal = 0;
            const buyItems = {};
            const sellItems = {};

            dailyData.forEach(item => {
                if (item.weighType === 'BUY') {
                    buyTotal += item.netWeight;
                    buyItems[item.product] = (buyItems[item.product] || 0) + item.netWeight;
                } else if (item.weighType === 'SELL') {
                    sellTotal += item.netWeight;
                    sellItems[item.product] = (sellItems[item.product] || 0) + item.netWeight;
                }
            });
            
            let replyText = `สรุปข้อมูลวันที่ ${today.toLocaleDateString('th-TH')}\nบริษัท: ${config.companyId}\n\n`;

            if (Object.keys(buyItems).length > 0) {
                replyText += 'สรุปยอดซื้อ (BUY):\n';
                for (const product in buyItems) {
                    replyText += `- ${product}: ${(buyItems[product] / 1000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ตัน\n`;
                }
                replyText += `รวมยอดซื้อทั้งหมด: ${(buyTotal / 1000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ตัน\n\n`;
            }

            if (Object.keys(sellItems).length > 0) {
                replyText += 'สรุปยอดขาย (SELL):\n';
                for (const product in sellItems) {
                    replyText += `- ${product}: ${(sellItems[product] / 1000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ตัน\n`;
                }
                replyText += `รวมยอดขายทั้งหมด: ${(sellTotal / 1000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ตัน`;
            }

            await client.replyMessage(event.replyToken, {
                type: 'text',
                text: replyText.trim()
            });


        } catch (error) {
            logger.error(`Error processing 'sorni' keyword for user ${userId}: ${error.message}`);
            await client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'เกิดข้อผิดพลาดในการดึงข้อมูล กรุณาลองใหม่อีกครั้ง'
            });
        }
    }
    // ถ้าไม่ใช่คีย์เวิร์ด ก็ไม่ต้องทำอะไร
};


const webhookHandler = (req, res) => {
    Promise
        .all(req.body.events.map(event => {
            if (event.type === 'follow') {
                return handleFollowEvent(event);
            } else if (event.type === 'message' && event.message.type === 'text') {
                return handleMessageEvent(event);
            }
            return Promise.resolve(null);
        }))
        .then((result) => res.json(result))
        .catch((err) => {
            logger.error(err);
            res.status(500).end();
        });
};

module.exports = { webhookHandler };

