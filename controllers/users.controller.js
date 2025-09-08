const User = require('../models/user.model');
async function listUsers(req, res) { const users = await User.find({}).sort({ createdAt: -1 }).lean(); res.json(users); }
module.exports = { listUsers };