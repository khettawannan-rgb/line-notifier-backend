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

        // 1. Process Mix sheet to create/update company configurations
        let companiesProcessed = 0;
        for (const row of mixData) {
            const companyId = row.companyId;
            if (companyId) {
                await NotificationConfig.findOneAndUpdate(
                    { companyId: companyId },
                    { companyId: companyId }, // ensures the doc has this field
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                companiesProcessed++;
            }
        }
        logger.info(`[Upload-${uploadId}] Processed ${companiesProcessed} companies from Mix sheet.`);

        // 2. Process All_data sheet to save data for dashboard and reports
        let dataRowsSaved = 0;
        for (const row of allData) {
            const weighType = row['ประเภทชั่ง'];
            if (weighType === 'BUY' || weighType === 'SELL') {
                const dataEntry = new WeighbridgeData({
                    companyId: row['ชื่อบริษัท'],
                    product: row['สินค้า'],
                    weighType: weighType,
                    netWeight: row['น้ำหนักสุทธิ final'],
                    transactionDate: new Date() // Or parse from Excel if available
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
            { $group: { _id: "$product", totalWeight: { $sum: "$netWeight" } } },
            { $sort: { totalWeight: -1 } },
            { $project: { product: "$_id", totalWeight: 1, _id: 0 } }
        ]);

        const sellSummary = await WeighbridgeData.aggregate([
            { $match: { weighType: 'SELL' } },
            { $group: { _id: "$product", totalWeight: { $sum: "$netWeight" } } },
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

