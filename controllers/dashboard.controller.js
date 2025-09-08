const WeighbridgeData2 = require('../models/weighbridgeData.model');
async function getDashboardSummary(req, res) {
const { startDate, endDate } = req.query; if (!startDate || !endDate) return res.status(400).json({ message: 'startDate and endDate are required (YYYY-MM-DD)' });
const start = new Date(`${startDate}T00:00:00.000Z`); const end = new Date(`${endDate}T23:59:59.999Z`);
const rows = await WeighbridgeData2.aggregate([{ $match: { date: { $gte: start, $lte: end } } }, { $group: { _id: { type: '$type', product: '$product' }, totalWeight: { $sum: '$weightKg' } } }]);
const buySummary = [], sellSummary = []; for (const r of rows) { const item = { product: r._id.product, totalWeight: r.totalWeight }; if (r._id.type === 'BUY') buySummary.push(item); else sellSummary.push(item); }
res.json({ buySummary, sellSummary });
}
module.exports = { getDashboardSummary };