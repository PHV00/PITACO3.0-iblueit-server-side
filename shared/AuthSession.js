'use strict';
const mongoose = require('mongoose');
const AuthSessionSchema = new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAccount', required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.models.AuthSession || mongoose.model('AuthSession', AuthSessionSchema);
