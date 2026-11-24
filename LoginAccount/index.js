'use strict';
const crypto = require('crypto');
module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    const bcrypt = require('bcryptjs');
    const utils = require('../shared/utils');
    const validations = require('../shared/Validators');
    const access = require('../shared/AccessControl');
    await mongoose.connect(process.env.MongoDbAtlas);
    require('../shared/UserAccount');
    const User = mongoose.model('UserAccount');
    function reply(status, success, authorized, message, data, code) {
        context.res = { status, body: utils.createResponse(success, authorized, message, data || null, code ?? null) };
        context.done();
    }
    const input = req.body || {};
    const validated = validations.authenticateValidator(input);
    if (validated.errorCount) return reply(400, false, false, 'Credenciais inválidas.', null, 2);
    try {
        const user = await User.findOne({ username: input.username });
        let valid = false, needsMigration = false;
        if (user && typeof user.password === 'string') {
            if (/^\$2[aby]\$\d{2}\$/.test(user.password)) {
                valid = await bcrypt.compare(input.password, user.password);
            } else {
                // Transitional legacy account: constant-time comparison, then upgrade on success.
                valid = access.constantTimeMatch(input.password, user.password);
                needsMigration = valid;
            }
        }
        if (!valid) return reply(401, false, false, 'Usuário ou senha inválidos.');
        if (needsMigration) {
            user.password = await bcrypt.hash(input.password, 12);
            await user.save();
        }
        const session = await access.createSession(user, mongoose);
        const authTime = new Date();
        const payload = {
            redirectUrl: '/', authTime, authExpirationTime: session.expiresAt,
            fullname: user.fullname,
            gameToken: (user.gameToken && user.gameToken.token) || '',
            userId: user._id, role: user.role, pacientId: user.pacientId,
            sessionToken: session.token
        };
        return reply(200, true, true, 'Autenticado com sucesso.', payload);
    } catch (err) {
        context.log.error('[AUTH] Falha no login:', err && err.name);
        return reply(500, false, false, 'Erro interno ao autenticar.', null, 0);
    }
};
