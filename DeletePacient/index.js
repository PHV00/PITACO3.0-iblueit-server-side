'use strict';
module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    const utils = require('../shared/utils');
    const access = require('../shared/AccessControl');
    await mongoose.connect(process.env.MongoDbAtlas);
    for (const schema of ['Pacient', 'PlataformOverview', 'CalibrationOverview',
        'MinigameOverview', 'UserAccount', 'PlaySession', 'FlowDataDevice'])
        require('../shared/' + schema);
    const Patient = mongoose.model('Pacient');
    const Overview = mongoose.model('PlataformOverview');
    const Calibration = mongoose.model('CalibrationOverview');
    const Minigame = mongoose.model('MinigameOverview');
    const Account = mongoose.model('UserAccount');
    const Session = mongoose.model('PlaySession');
    const Flow = mongoose.model('FlowDataDevice');
    const id = req.params && req.params.pacientId;
    const token = req.headers && req.headers.gametoken;
    const reply = require('../shared/SecurityResponse').bind(context);
    if (!/^[0-9a-f]{24}$/i.test(id || ''))
        return reply(400, false, false, 'Paciente inválido.', null, 300);
    try {
        const admin = await access.administrator(req, mongoose);
        if (!admin || !token || !admin.gameToken || admin.gameToken.token !== token)
            return reply(403, false, false, 'Operação não autorizada.', null, 1);
        const owner = await Patient.findOne({ _id: id, _gameToken: token });
        if (!owner) return reply(404, false, false, 'Paciente não encontrado nesta conta.');

        if (req.query && req.query.allData === '0') {
            await Patient.deleteOne({ _id: id, _gameToken: token });
            return reply(200, true, true, 'Paciente excluído.', null);
        }

        const dbSession = await mongoose.startSession();
        try {
            await dbSession.withTransaction(async () => {
                const scoped = { pacientId: id };
                // All destructive operations must complete before the HTTP 200.
                const overviews = await Overview.find(
                    { pacientId: id, _gameToken: token }, 'flowDataDevicesId'
                ).session(dbSession);
                const flowIds = overviews.map(row => row.flowDataDevicesId).filter(Boolean);
                await Overview.deleteMany({ pacientId: id, _gameToken: token }).session(dbSession);
                await Calibration.deleteMany(scoped).session(dbSession);
                await Minigame.deleteMany(scoped).session(dbSession);
                await Account.deleteMany({
                    pacientId: id, role: 'User', 'gameToken.token': token
                }).session(dbSession);
                await Session.deleteMany(scoped).session(dbSession);
                if (flowIds.length) {
                    await Flow.deleteMany({ _id: { $in: flowIds }, _gameToken: token }).session(dbSession);
                }
                await Patient.deleteOne({ _id: id, _gameToken: token }).session(dbSession);
            });
        } finally {
            await dbSession.endSession();
        }
        return reply(200, true, true, 'Exclusão realizada com sucesso.', null);
    } catch (err) {
        context.log('[PATIENT DELETE] Falha:', err && err.name);
        return reply(500, false, false, 'Falha ao excluir registros do paciente.', null, 0);
    }
};
