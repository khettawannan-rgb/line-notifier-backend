require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const connectDB = require('./services/mongo');
const logger = require('./services/logger');
const { middleware } = require('./services/lineService');
const { webhookHandler } = require('./controllers/webhook.controller');
// --- แก้ไขส่วนนี้: ลบ createConfig ออกจาก import ---
const { getConfigs, updateConfig, getUsers, getLogs, handleFileUpload, getDashboardSummary } = require('./controllers/config.controller');

const app = express();

// --- การตั้งค่า CORS (เวอร์ชันล่าสุด) ---
const allowedOrigins = [
    'http://localhost:8000',
    /\.googleusercontent\.goog$/i,
    /^https?:\/\/localhost(?::\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/
];
const corsOptions = {
    origin: (origin, callback) => {
        logger.info(`CORS Check: Request from origin: ${origin}`);
        if (!origin || allowedOrigins.some(regexOrString => {
            if (typeof regexOrString === 'string') return regexOrString === origin;
            return regexOrString.test(origin);
        })) {
            callback(null, true);
        } else {
            logger.error(`CORS Blocked: Origin not allowed: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// เพิ่มขนาด request body limit สำหรับรองรับไฟล์ใหญ่
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

connectDB();

// --- ROUTES ---
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date() }));
app.post('/webhook', middleware, webhookHandler);
app.get('/api/users', getUsers);
app.get('/api/configs', getConfigs);
app.put('/api/configs/:id', updateConfig);
app.get('/api/logs', getLogs);
app.post('/api/upload', handleFileUpload);
app.get('/api/dashboard-summary', getDashboardSummary);
// --- แก้ไขส่วนนี้: ลบบรรทัดที่เรียกใช้ createConfig ที่ไม่จำเป็นแล้ว ---
// app.post('/api/configs', createConfig); // <-- ลบบรรทัดนี้ทิ้ง

// --- เริ่มการทำงานของเซิร์ฟเวอร์ ---
if (process.env.NODE_ENV === 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        logger.info(`✅ เซิร์ฟเวอร์กำลังทำงานในโหมด Production บน Port ${PORT}`);
    });
} else {
    const httpsPort = 3443;
    const privateKeyPath = './localhost-key.pem';
    const certificatePath = './localhost.pem';

    try {
        if (fs.existsSync(privateKeyPath) && fs.existsSync(certificatePath)) {
            const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
            const certificate = fs.readFileSync(certificatePath, 'utf8');
            const credentials = { key: privateKey, cert: certificate };

            https.createServer(credentials, app).listen(httpsPort, () => {
                logger.info(`✅ เซิร์ฟเวอร์ HTTPS สำหรับทดสอบกำลังทำงานที่ https://localhost:${httpsPort}`);
            });
        } else {
            logger.warn('ไม่พบไฟล์ SSL certificate, เปลี่ยนไปใช้ HTTP สำหรับการทดสอบ');
            const PORT = process.env.PORT || 3000;
            app.listen(PORT, () => {
                logger.info(`เซิร์ฟเวอร์กำลังทำงานแบบไม่ปลอดภัย (HTTP) ที่ http://localhost:${PORT}`);
            });
        }
    } catch (err) {
        logger.error('❌ ไม่สามารถเริ่มเซิร์ฟเวอร์ HTTPS ได้:', err.message);
        process.exit(1);
    }
}

