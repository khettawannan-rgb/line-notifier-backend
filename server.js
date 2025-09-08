require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectMongo } = require('./services/mongo');
const logger = require('./services/logger');
const { listUsers } = require('./controllers/users.controller');
const { listConfigs, updateConfig } = require('./controllers/configs.controller');
const { uploadFile, listBatches, deleteBatch, sendBatchReport } = require('./controllers/uploads.controller');
const { getDashboardSummary } = require('./controllers/dashboard.controller');


const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '15mb' }));


app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/api/users', listUsers);
app.get('/api/configs', listConfigs);
app.put('/api/configs/:id', updateConfig);
app.get('/api/uploads', listBatches);
app.post('/api/upload', uploadFile);
app.delete('/api/uploads/:id', deleteBatch);
app.post('/api/uploads/:id/send', sendBatchReport);
app.get('/api/dashboard-summary', getDashboardSummary);
app.get('/', (req, res) => res.send('NILA Weighbridge API OK'));


app.use((err, req, res, next) => { logger.error('Unhandled', { err: err.message }); res.status(500).json({ message: 'Internal error', error: err.message }); });


const PORT = process.env.PORT || 8080;
connectMongo(process.env.MONGODB_URI).then(() => { app.listen(PORT, () => console.log(`API listening on :${PORT}`)); }).catch((err) => { console.error('Mongo connection error:', err); process.exit(1); });