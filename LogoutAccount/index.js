'use strict';
module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    const access = require('../shared/AccessControl');
    const utils = require('../shared/utils');
    await mongoose.connect(process.env.MongoDbAtlas);
    require('../shared/AuthSession');
    const AuthSession = mongoose.model('AuthSession');
    const token = access.bearerToken(req);
    try {
        if (!token || !await access.authenticate(req, mongoose)) {
            context.res = { status: 401,
                body: utils.createResponse(false, false, 'Sessão inválida.', null, 1) };
        } else {
            await AuthSession.deleteOne({ tokenHash: access.hashToken(token) });
            context.res = { status: 200,
                body: utils.createResponse(true, true, 'Sessão encerrada.', null, null) };
        }
    } catch (err) {
        context.log('[AUTH] Falha no logout:', err && err.name);
        context.res = { status: 500,
            body: utils.createResponse(false, false, 'Falha ao encerrar sessão.', null, 0) };
    }
    context.done();
};
