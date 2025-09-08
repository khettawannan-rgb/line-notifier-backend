const { Schema, model } = require('mongoose');
const userSchema = new Schema(
{ userId: { type: String, index: true, unique: true }, displayName: String, pictureUrl: String, statusMessage: String },
{ timestamps: true }
);
module.exports = model('User', userSchema);