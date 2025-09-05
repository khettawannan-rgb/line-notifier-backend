const { v4: uuidv4 } = require('uuid');
const WeighbridgeData = require('../models/weighbridgeData.model');
const NotificationConfig = require('../models/config.model');
const User = require('../models/user.model');
const Log = require('../models/log.model');
const UploadBatch = require('../models/uploadBatch.model');
const { client } = require('../services/lineService');
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

const handleFileUpload = async (req, res) => {
    const uploadSessionId = uuidv4();
    logger.info(`[Upload-${uploadSessionId}] Starting file upload process.`);

    try {
        const { allData, mixData } = req.body.fileData;
        const fileName = req.body.fileName || 'Untitled';

        const parseThaiDate = (dateStr, timeStr) => {
            if (!dateStr) return new Date();
            // Handle Excel date serial number
            if (typeof dateStr === 'number') {
                const utc_days  = Math.floor(dateStr - 25569);
                const utc_value = utc_days * 86400;                                        
                const date_info = new Date(utc_value * 1000);
                return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
            }

            // Handle string date like "DD/MM/YYYY, HH:mm"
             const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/);
            if (parts) {
                const day = parseInt(parts[1], 10), month = parseInt(parts[2], 10) - 1, year = parseInt(parts[3], 10) - 543;
                const hour = parseInt(parts[4], 10), minute = parseInt(parts[5], 10);
                return new Date(year, month, day, hour, minute);
            }
             // Handle string date like "YYYY-MM-DD HH:mm:ss" from Mix sheet
            if (typeof dateStr === 'string' && dateStr.includes('-')) {
                return new Date(dateStr);
            }
            return new Date();
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
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'startDate and endDate query parameters are required.' });
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const summaryPipeline = (weighType) => ([
            { $match: { weighType: weighType, transactionDate: { $gte: start, $lte: end } } },
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

const sendBatchReport = async (req, res) => {
    const { id } = req.params; // Batch ID
    logger.info(`[Manual Send] Triggered for batch ID: ${id}`);
    try {
        const batch = await UploadBatch.findById(id);
        if (!batch) {
            return res.status(404).json({ message: 'Upload batch not found.' });
        }

        const dataForBatch = await WeighbridgeData.find({ uploadSessionId: batch.uploadSessionId });
        if (dataForBatch.length === 0) {
            return res.status(400).json({ message: 'No data found for this batch to send.' });
        }

        const companyData = dataForBatch.reduce((acc, item) => {
            if (!acc[item.companyName]) {
                acc[item.companyName] = [];
            }
            acc[item.companyName].push(item);
            return acc;
        }, {});

        let companiesNotified = 0;
        let usersNotified = 0;

        for (const companyName in companyData) {
            const config = await NotificationConfig.findOne({ companyId: companyName });
            if (config && config.uuids && config.uuids.length > 0) {
                const companyItems = companyData[companyName];
                
                let buyTotal = 0;
                let sellTotal = 0;
                const buyItems = {};
                const sellItems = {};
                
                companyItems.forEach(item => {
                     if (item.weighType === 'BUY') {
                        buyTotal += item.netWeight;
                        buyItems[item.productName] = (buyItems[item.productName] || 0) + item.netWeight;
                    } else if (item.weighType === 'SELL') {
                        sellTotal += item.netWeight;
                        sellItems[item.productName] = (sellItems[item.productName] || 0) + item.netWeight;
                    }
                });

                let reportDate = companyItems.length > 0 ? companyItems[0].transactionDate.toLocaleDateString('th-TH') : new Date().toLocaleDateString('th-TH');
                let replyText = `สรุปข้อมูลวันที่ ${reportDate}\nบริษัท: ${companyName}\n\n`;
                
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
                
                if (replyText.length > 50) {
                     await client.multicast(config.uuids, [{ type: 'text', text: replyText.trim() }]);
                     companiesNotified++;
                     usersNotified += config.uuids.length;
                     logger.info(`[Manual Send] Sent report for ${companyName} to ${config.uuids.length} users.`);
                }
            } else {
                 logger.warn(`[Manual Send] No config or UUIDs found for company: ${companyName}`);
            }
        }
        
        res.status(200).json({ message: `Report sending process finished. Notified ${usersNotified} users across ${companiesNotified} companies.` });

    } catch (error) {
        logger.error(`[Manual Send] Error for batch ID ${id}: ${error.message}`);
        res.status(500).json({ message: 'Failed to send reports.' });
    }
};


module.exports = {
    getUsers,
    getConfigs,
    updateConfig,
    handleFileUpload,
    getDashboardSummary,
    getUploadBatches,
    deleteUploadBatch,
    sendBatchReport
};

