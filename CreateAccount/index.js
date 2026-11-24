'use strict';
module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    const bcrypt = require('bcryptjs');
    const utils = require('../shared/utils');
    const validations = require('../shared/Validators');
    const access = require('../shared/AccessControl');
    await mongoose.connect(process.env.MongoDbAtlas);
    require('../shared/UserAccount');
    require('../shared/Pacient');
    const User = mongoose.model('UserAccount');
    const Patient = mongoose.model('Pacient');
    function reply(status, success, authorized, message, data, errorCode) {
        context.res = { status, body: utils.createResponse(success, authorized, message, data || null, errorCode ?? null) };
        context.done();
    }
    const input = req.body || {};
    if (!Object.keys(input).length) return reply(400, false, false, 'Dados vazios!', null, 2);
    const result = validations.createUserValidator(input);
    if (result.errorCount) {
        const body = utils.createResponse(false, false, 'Erros de validação encontrados!', null, 2);
        body.errors = result.errors.errors;
        context.res = { status: 400, body };
        return context.done();
    }
    try {
        const role = input.role;
        let admin = await access.administrator(req, mongoose);
        let parentToken = '';
        if (role === 'Administrator') {
            // Provisioning the very first admin requires a one-time secret set in Azure settings.
            if (!admin) {
                const exists = await User.exists({ role: 'Administrator' });
                if (exists || !access.validBootstrap(req))
                    return reply(403, false, false, 'Operação administrativa não autorizada.');
            }
        } else if (role === 'User') {
            if (!admin) return reply(403, false, false, 'Cadastro de paciente não autorizado.');
            parentToken = admin.gameToken && admin.gameToken.token;
            if (!parentToken) return reply(409, false, false, 'Conta administradora sem GameToken.');
            if (!/^[a-f0-9]{24}$/i.test(input.pacientId || '') ||
                !await Patient.exists({ _id: input.pacientId, _gameToken: parentToken }))
                return reply(404, false, false, 'Paciente não encontrado nesta conta.');
        } else {
            return reply(400, false, false, 'Tipo de conta inválido.');
        }

        const match = role === 'Administrator'
            ? { role, $or: [{ username: input.username }, { email: input.email }] }
            : { role, username: input.username, 'gameToken.token': parentToken };
        if (await User.exists(match))
            return reply(409, false, false, 'Nome de usuário ou e-mail já utilizado.');

        const passwordHash = await bcrypt.hash(input.password, 12);
        const newUser = new User({
            fullname: input.fullname,
            username: input.username,
            password: passwordHash,
            email: input.email,
            role,
            pacientId: role === 'User' ? input.pacientId : '',
            gameToken: { token: parentToken, description: '', createdAt: null }
        });
        await newUser.save();
        // Do not log the saved model or send passwords by email.
        context.log('[AUTH] Conta criada', { role, userId: String(newUser._id) });
        if (role === 'Administrator') {
            try {
                await utils.sendWelcomeEmail(newUser.fullname, newUser.username, newUser.email);
            } catch (_) {
                context.log.warn('[AUTH] Falha ao enviar e-mail de boas-vindas (sem credenciais).');
            }
        }
        return reply(201, true, true, 'Usuário criado com sucesso.',
            role === 'Administrator' ? { redirectUrl: '/login' } : null);
    } catch (err) {
        context.log.error('[AUTH] Falha no cadastro:', err && err.name);
        return reply(500, false, false, 'Erro interno ao cadastrar conta.', null, 0);
    }
};
