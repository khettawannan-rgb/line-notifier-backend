const mongoose = require('mongoose');

// Schema นี้ออกแบบมาเพื่อเก็บข้อมูลดิบจากไฟล์ Excel ที่อัปโหลด
// เพื่อนำไปใช้ในการคำนวณและแสดงผลบน Dashboard
const weighbridgeDataSchema = new mongoose.Schema({
    // เราจะเก็บข้อมูลเท่าที่จำเป็นสำหรับการคำนวณและการแสดงผล
    weighbridgeTransactionId: { type: String, unique: true, sparse: true }, // ID จากระบบชั่งน้ำหนัก
    weighType: { type: String, required: true, index: true }, // ประเภทชั่ง (BUY/SELL)
    productType: { type: String, required: true }, // ประเภทสินค้า (หิน, ยาง)
    productName: { type: String, required: true, index: true }, // สินค้า (หินฝุ่น, หิน 3/4")
    netWeight: { type: Number, required: true }, // น้ำหนักสุทธิ
    companyName: { type: String, required: true, index: true }, // ชื่อบริษัท
    timestamp: { type: Date, required: true, index: true }, // วันเวลาที่ทำรายการ
    uploadSessionId: { type: String, required: true, index: true }, // ID ของการอัปโหลดแต่ละครั้ง
}, {
    timestamps: true // เพิ่ม createdAt และ updatedAt อัตโนมัติ
});

const WeighbridgeData = mongoose.model('WeighbridgeData', weighbridgeDataSchema);

module.exports = WeighbridgeData;