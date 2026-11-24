'use strict';
module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    const utils = require('../shared/utils');
    const access = require('../shared/AccessControl');
    await mongoose.connect(process.env.MongoDbAtlas);
    require('../shared/UserAccount');
    require('../shared/Pacient');
    const User = mongoose.model('UserAccount');
    const Patient = mongoose.model('Pacient');
    const reply = require('../shared/SecurityResponse').bind(context);
    try {
        const admin = await access.administrator(req, mongoose);
        if (!admin) return reply(403, false, false, 'Acesso restrito ao administrador.', null, 1);
        const token = admin.gameToken && admin.gameToken.token;
        if (!token || token !== req.headers.gametoken)
            return reply(403, false, false, 'Credencial da conta inválida.', null, 1);
        const id = req.params && req.params.pacientId;
        if (!/^[a-f0-9]{24}$/i.test(id || '')) return reply(400, false, false, 'Paciente inválido.', null, 300);
        if (!await Patient.exists({ _id: id, _gameToken: token }))
            return reply(404, false, false, 'Paciente não encontrado nesta conta.');
        // Explicit allowlist: NEVER select or return password.
        const patientAccount = await User.findOne({
            role: 'User', pacientId: id, 'gameToken.token': token
        }).select('_id pacientId username');
        return reply(200, true, true, 'Consulta realizada com sucesso.', patientAccount);
    } catch (err) {
        context.log.error('[PATIENT ACCOUNT] Falha:', err && err.name);
        return reply(500, false, false, 'Erro interno ao consultar a conta.', null, 0);
    }
};
