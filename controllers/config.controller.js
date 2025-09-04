const { v4: uuidv4 } = require('uuid');
const WeighbridgeData = require('../models/weighbridgeData.model');
const NotificationConfig = require('../models/config.model');
const User = require('../models/user.model');
const Log = require('../models/log.model');
const UploadBatch = require('../models/uploadBatch.model'); // Import the new model
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
    const uploadSessionId = uuidv4();
    logger.info(`[Upload-${uploadSessionId}] Starting file upload process.`);

    try {
        const { allData, mixData } = req.body.fileData;
        const fileName = req.body.fileName || 'Untitled';

        const parseThaiDate = (thaiDateStr) => {
            if (!thaiDateStr) return new Date();
            // Match "dd/mm/yyyy, HH:MM" format
            const parts = thaiDateStr.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/);
            if (!parts) return new Date();
            const day = parseInt(parts[1], 10), month = parseInt(parts[2], 10) - 1, year = parseInt(parts[3], 10) - 543;
            const hour = parseInt(parts[4], 10), minute = parseInt(parts[5], 10);
            return new Date(year, month, day, hour, minute);
        };
        
        let dataRowsToSave = [];
        for (const row of allData) {
            const weighType = row['ประเภทชั่ง'];
            if (weighType === 'BUY' || weighType === 'SELL') {
                dataRowsToSave.push({
                    uploadSessionId: uploadSessionId,
                    transactionDate: parseThaiDate(row['วัน/เวลา ออก']),
                    companyName: row['ชื่อบริษัท'],
                    productType: row['ประเภทสินค้า'],
                    productName: row['สินค้า'],
                    weighType: weighType,
                    netWeight: row['น้ำหนักสุทธิ final'],
                });
            }
        }
        
        if(dataRowsToSave.length > 0) {
             await WeighbridgeData.insertMany(dataRowsToSave);
        }
        logger.info(`[Upload-${uploadSessionId}] Saved ${dataRowsToSave.length} data rows from All_data sheet.`);

        const newBatch = new UploadBatch({
            uploadSessionId: uploadSessionId,
            fileName: fileName,
            rowCount: dataRowsToSave.length,
        });
        await newBatch.save();
        logger.info(`[Upload-${uploadSessionId}] Created new upload batch record.`);
        
        let companiesProcessed = 0;
        for (const row of mixData) {
            if (row.companyId) {
                await NotificationConfig.findOneAndUpdate(
                    { companyId: row.companyId },
                    { companyId: row.companyId },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                companiesProcessed++;
            }
        }
        logger.info(`[Upload-${uploadSessionId}] Processed ${companiesProcessed} companies from Mix sheet.`);


        res.status(200).json({
            message: 'File processed successfully',
            companiesProcessed: companiesProcessed,
            dataRowsSaved: dataRowsToSave.length
        });

    } catch (error) {
        logger.error(`[Upload-${uploadSessionId}] Error during file upload processing: ${error.message}`);
        res.status(500).json({ message: `Upload failed: ${error.message}` });
    }
};

const getDashboardSummary = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ message: 'Date query parameter is required.' });
        }

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(0, 0, 0, 0);

        const summaryPipeline = (weighType) => ([
            { $match: { weighType: weighType, transactionDate: { $gte: startDate, $lt: endDate } } },
            { $group: { _id: "$productName", totalWeight: { $sum: "$netWeight" } } },
            { $sort: { totalWeight: -1 } },
            { $project: { product: "$_id", totalWeight: 1, _id: 0 } }
        ]);

        const buySummary = await WeighbridgeData.aggregate(summaryPipeline('BUY'));
        const sellSummary = await WeighbridgeData.aggregate(summaryPipeline('SELL'));

        res.status(200).json({ buySummary, sellSummary });
    } catch (error) {
        logger.error(`Error fetching dashboard summary: ${error.message}`);
        res.status(500).json({ message: 'Server Error' });
    }
};

const getUploadBatches = async (req, res) => {
    try {
        const batches = await UploadBatch.find().sort({ uploadedAt: -1 }).limit(50);
        res.status(200).json(batches);
    } catch (error) {
        logger.error(`Error fetching upload batches: ${error.message}`);
        res.status(500).json({ message: 'Server Error' });
    }
};

const deleteUploadBatch = async (req, res) => {
    try {
        const { id } = req.params;
        const batch = await UploadBatch.findById(id);
        if (!batch) {
            return res.status(404).json({ message: 'Batch not found' });
        }

        await WeighbridgeData.deleteMany({ uploadSessionId: batch.uploadSessionId });
        
        await UploadBatch.findByIdAndDelete(id);
        
        res.status(200).json({ message: `Successfully deleted batch and associated data.` });
    } catch (error) {
        logger.error(`Error deleting upload batch: ${error.message}`);
        res.status(500).json({ message: 'Server Error' });
    }
};


module.exports = {
    getUsers,
    getConfigs,
    updateConfig,
    getLogs,
    handleFileUpload,
    getDashboardSummary,
    getUploadBatches,
    deleteUploadBatch
};

