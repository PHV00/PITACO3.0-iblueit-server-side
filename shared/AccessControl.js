'use strict';
const crypto = require('crypto');
const SESSION_MS = 2 * 60 * 60 * 1000;

function bearerToken(req) {
    const headers = (req && req.headers) || {};
    const raw = headers.authorization || headers.Authorization || '';
    const match = /^Bearer ([a-f0-9]{64})$/i.exec(raw);
    return match ? match[1].toLowerCase() : null;
}
function hashToken(token) {
    return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}
function constantTimeMatch(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
    const ah = crypto.createHash('sha256').update(a).digest();
    const bh = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ah, bh);
}
async function createSession(user, mongoose) {
    require('./AuthSession');
    const Session = mongoose.model('AuthSession');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_MS);
    await Session.create({ tokenHash: hashToken(token), userId: user._id, expiresAt });
    return { token, expiresAt };
}
async function authenticate(req, mongoose) {
    const token = bearerToken(req);
    if (!token) return null;
    require('./AuthSession');
    require('./UserAccount');
    const Session = mongoose.model('AuthSession');
    const User = mongoose.model('UserAccount');
    const session = await Session.findOne({
        tokenHash: hashToken(token), expiresAt: { $gt: new Date() }
    });
    if (!session) return null;
    const user = await User.findById(session.userId);
    if (!user) return null;
    return { user, session };
}
async function administrator(req, mongoose, expectedId) {
    const context = await authenticate(req, mongoose);
    if (!context || context.user.role !== 'Administrator') return null;
    if (expectedId && String(context.user._id) !== String(expectedId)) return null;
    return context.user;
}
function validBootstrap(req) {
    const configured = process.env.ADMIN_BOOTSTRAP_TOKEN;
    const supplied = ((req && req.headers) || {})['x-admin-bootstrap-token'];
    return Boolean(configured && supplied && constantTimeMatch(supplied, configured));
}
module.exports = {
    SESSION_MS, bearerToken, hashToken, constantTimeMatch,
    createSession, authenticate, administrator, validBootstrap
};
