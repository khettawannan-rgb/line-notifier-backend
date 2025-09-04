const mongoose = require('mongoose');

// แก้ไข "แบบแปลน" ให้ถูกต้องและสอดคล้องกับการใช้งานจริง
const weighbridgeDataSchema = new mongoose.Schema({
    uploadSessionId: { type: String, required: true, index: true },
    transactionDate: { type: Date, required: true, index: true }, // เปลี่ยนจาก timestamp เป็น transactionDate เพื่อความชัดเจน
    
    companyName: { type: String, required: true, index: true },
    productType: { type: String, required: true }, // e.g., 'หิน', 'ยาง'
    productName: { type: String, required: true }, // e.g., 'หินฝุ่น', 'ยาง AC-60/70'
    weighType: { type: String, required: true, enum: ['BUY', 'SELL'] },
    netWeight: { type: Number, required: true },
});

const WeighbridgeData = mongoose.model('WeighbridgeData', weighbridgeDataSchema);

module.exports = WeighbridgeData;

