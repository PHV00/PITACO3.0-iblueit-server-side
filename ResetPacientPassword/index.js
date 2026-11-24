'use strict';
// Administrator-controlled password reset. The old password is never returned.
module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    const bcrypt = require('bcryptjs');
    const utils = require('../shared/utils');
    const access = require('../shared/AccessControl');
    await mongoose.connect(process.env.MongoDbAtlas);
    require('../shared/UserAccount');
    require('../shared/Pacient');
    require('../shared/AuthSession');
    const User = mongoose.model('UserAccount');
    const Patient = mongoose.model('Pacient');
    const AuthSession = mongoose.model('AuthSession');
    function reply(status, success, authorized, message, code) {
        context.res = { status, body: utils.createResponse(success, authorized, message, null, code ?? null) };
        context.done();
    }
    try {
        const admin = await access.administrator(req, mongoose);
        const token = req.headers && req.headers.gametoken;
        if (!admin || !token || !admin.gameToken || admin.gameToken.token !== token)
            return reply(403, false, false, 'Operação não autorizada.', 1);
        const id = req.params && req.params.pacientId;
        if (!/^[a-f0-9]{24}$/i.test(id || ''))
            return reply(400, false, false, 'Identificador inválido.', 300);
        const password = req.body && req.body.password;
        if (typeof password !== 'string' || password.length < 12 ||
            password.length > 128)
            return reply(400, false, false, 'Nova senha deve ter de 12 a 128 caracteres.', 2);
        if (!await Patient.exists({ _id: id, _gameToken: token }))
            return reply(404, false, false, 'Paciente não encontrado nesta conta.');
        const user = await User.findOne({
            role: 'User', pacientId: id, 'gameToken.token': token
        });
        if (!user) return reply(404, false, false, 'Conta não encontrada.');
        user.password = await bcrypt.hash(password, 12);
        await user.save();
        // Invalidate all old sessions for this patient after password reset.
        await AuthSession.deleteMany({ userId: user._id });
        return reply(200, true, true, 'Senha redefinida. Sessões anteriores foram revogadas.');
    } catch (err) {
        context.log('[AUTH] Falha ao redefinir senha:', err && err.name);
        return reply(500, false, false, 'Erro ao redefinir senha.', 0);
    }
};
