'use strict';
module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    const { v4: uuidv4 } = require('uuid');
    const access = require('../shared/AccessControl');
    const utils = require('../shared/utils');
    const validations = require('../shared/Validators');
    await mongoose.connect(process.env.MongoDbAtlas);
    require('../shared/UserAccount');
    const User = mongoose.model('UserAccount');
    function reply(status, success, authorized, message, data, code) {
        context.res = { status, body: utils.createResponse(success, authorized, message, data || null, code ?? null) };
        context.done();
    }
    const input = req.body || {};
    const v = validations.createTokenValidator(input);
    if (v.errorCount) return reply(400, false, false, 'Parâmetros inválidos.', null, 2);
    try {
        const admin = await access.administrator(req, mongoose, input.userId);
        if (!admin) return reply(403, false, false, 'Operação administrativa não autorizada.', null, 1);
        const token = admin.gameToken && admin.gameToken.token;
        if (token) return reply(200, true, true, 'Token já existente.', { gameToken: token });
        const fresh = uuidv4();
        const updated = await User.findOneAndUpdate(
            { _id: admin._id, role: 'Administrator', 'gameToken.token': { $in: ['', null] } },
            { $set: { 'gameToken.token': fresh,
                'gameToken.description': typeof input.description === 'string' ? input.description.slice(0, 200) : '',
                'gameToken.createdAt': new Date() } },
            { new: true }
        );
        if (!updated) return reply(409, false, false, 'Estado do token alterado; repita a consulta.');
        return reply(201, true, true, 'Token criado com sucesso.',
            { gameToken: updated.gameToken.token });
    } catch (err) {
        context.log.error('[AUTH] Falha ao criar token:', err && err.name);
        return reply(500, false, false, 'Erro interno ao gerar token.', null, 0);
    }
};
