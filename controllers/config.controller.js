const { v4: uuidv4 } = require('uuid');
const WeighbridgeData = require('../models/weighbridgeData.model');
const NotificationConfig = require('../models/config.model');
const User = require('../models/user.model');
const Log = require('../models/log.model');
const logger = require('../services/logger');

const getUsers = async (req, res) => {
    try {
        const users = await User.find().sort({ addedAt: -1 });
        res.status(200).json(users);
    } catch (error) {
        logger.error(`Error fetching users: ${error.message}`);
        res.status(500).json({ message: 'Server Error' });
    }
};

const getConfigs = async (req, res) => {
    try {
        const configs = await NotificationConfig.find().sort({ companyId: 1 });
        res.status(200).json(configs);
    } catch (error) {
        logger.error(`Error fetching configs: ${error.message}`);
        res.status(500).json({ message: 'Server Error' });
    }
};

const updateConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const { uuids } = req.body;
        const updatedConfig = await NotificationConfig.findByIdAndUpdate(id, { uuids }, { new: true });
        if (!updatedConfig) {
            return res.status(404).json({ message: 'Config not found' });
        }
        res.status(200).json(updatedConfig);
    } catch (error) {
        logger.error(`Error updating config: ${error.message}`);
        res.status(500).json({ message: 'Server Error' });
    }
};

const getLogs = async (req, res) => {
    try {
        const logs = await Log.find().sort({ timestamp: -1 }).limit(100);
        res.status(200).json(logs);
    } catch (error) {
        logger.error(`Error fetching logs: ${error.message}`);
        res.status(500).json({ message: 'Server Error' });
    }
};

const handleFileUpload = async (req, res) => {
    const uploadId = uuidv4();
    logger.info(`[Upload-${uploadId}] Starting file upload process.`);

    try {
        const { allData, mixData } = req.body.fileData;

        // ฟังก์ชันช่วยแปลงวันที่จากรูปแบบไทยใน Excel
        const parseThaiDate = (thaiDateStr) => {
            if (!thaiDateStr) return new Date();
            const parts = thaiDateStr.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/);
            if (!parts) return new Date();
            
            const day = parseInt(parts[1], 10);
            const month = parseInt(parts[2], 10) - 1; // เดือนใน JS เริ่มจาก 0
            const year = parseInt(parts[3], 10) - 543; // แปลง พ.ศ. เป็น ค.ศ.
            const hour = parseInt(parts[4], 10);
            const minute = parseInt(parts[5], 10);
            
            return new Date(year, month, day, hour, minute);
        };

        // 1. ประมวลผลชีท Mix
        let companiesProcessed = 0;
        for (const row of mixData) {
            const companyId = row.companyId;
            if (companyId) {
                await NotificationConfig.findOneAndUpdate(
                    { companyId: companyId },
                    { companyId: companyId },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                companiesProcessed++;
            }
        }
        logger.info(`[Upload-${uploadId}] Processed ${companiesProcessed} companies from Mix sheet.`);

        // 2. ประมวลผลชีท All_data
        let dataRowsSaved = 0;
        for (const row of allData) {
            const weighType = row['ประเภทชั่ง'];
            if (weighType === 'BUY' || weighType === 'SELL') {
                // สร้างข้อมูลให้ตรงกับ "แบบแปลน" (Schema)
                const dataEntry = new WeighbridgeData({
                    uploadSessionId: uploadId,
                    transactionDate: parseThaiDate(row['วัน/เวลา ออก']),
                    companyName: row['ชื่อบริษัท'],
                    productType: row['ประเภทสินค้า'],
                    productName: row['สินค้า'],
                    weighType: weighType,
                    netWeight: row['น้ำหนักสุทธิ final'],
                });
                await dataEntry.save();
                dataRowsSaved++;
            }
        }
        logger.info(`[Upload-${uploadId}] Saved ${dataRowsSaved} data rows from All_data sheet.`);

        res.status(200).json({
            message: 'File processed successfully',
            companiesProcessed,
            dataRowsSaved
        });

    } catch (error) {
        logger.error(`[Upload-${uploadId}] Error during file upload processing: ${error.message}`);
        res.status(500).json({ message: `Upload failed: ${error.message}` });
    }
};

const getDashboardSummary = async (req, res) => {
    try {
        const buySummary = await WeighbridgeData.aggregate([
            { $match: { weighType: 'BUY' } },
            { $group: { _id: "$productName", totalWeight: { $sum: "$netWeight" } } },
            { $sort: { totalWeight: -1 } },
            { $project: { product: "$_id", totalWeight: 1, _id: 0 } }
        ]);

        const sellSummary = await WeighbridgeData.aggregate([
            { $match: { weighType: 'SELL' } },
            { $group: { _id: "$productName", totalWeight: { $sum: "$netWeight" } } },
            { $sort: { totalWeight: -1 } },
            { $project: { product: "$_id", totalWeight: 1, _id: 0 } }
        ]);

        res.status(200).json({ buySummary, sellSummary });
    } catch (error) {
        logger.error(`Error fetching dashboard summary: ${error.message}`);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getUsers,
    getConfigs,
    updateConfig,
    getLogs,
    handleFileUpload,
    getDashboardSummary
};

