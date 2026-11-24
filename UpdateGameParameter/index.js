module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    const DATABASE = process.env.MongoDbAtlas;
    mongoose.connect(DATABASE);
    mongoose.Promise = global.Promise;

    //GameParameterModel Schema
    require('../shared/GameParameter');
    require('../shared/Pacient');
    const GameParameterModel = mongoose.model('GameParameter');
    const PatientModel = mongoose.model('Pacient');

    const utils = require('../shared/utils');
    const access = require('../shared/AccessControl');
    const admin = await access.administrator(req, mongoose);
    if (!admin || !admin.gameToken || admin.gameToken.token !== req.headers.gametoken) {
        context.res = { status: 403,
            body: utils.createResponse(false, false, 'Operação administrativa não autorizada.', null, 1) };
        context.done();
        return;
    }


    var isVerifiedGameToken = await utils.verifyGameToken(req.headers.gametoken, mongoose);

    if (!isVerifiedGameToken) {
        context.res = {
            status: 403,
            body: utils.createResponse(false, false, "Chave de acesso inválida.", null, 1)
        }
        context.done();
        return;
    }

    const pacientReq = req.body || {};

    if (req.params.pacientId === undefined || req.params.pacientId == null) {
        context.res = {
            status: 400,
            body: utils.createResponse(false,
                false,
                "Parâmetros de consulta inexistentes.",
                null,
                300)
        }
        context.done();
        return;
    }

    if (String(req.params.pacientId) !== String(pacientReq.pacientId) ||
        !await PatientModel.exists({
            _id: req.params.pacientId, _gameToken: req.headers.gametoken
        })) {
        context.res = { status: 403,
            body: utils.createResponse(false, false, 'Paciente não autorizado.', null, 1) };
        context.done();
        return;
    }

    try {
        const updatedGameParameter = await GameParameterModel.updateOne(
            { pacientId: req.params.pacientId, stageId: req.body.stageId, phase: req.body.phase, level: req.body.level },
            {
                $set:
                {
                    stageId: req.body.stageId,
                    phase:  req.body.phase,
                    level: req.body.level,
                    ObjectSpeedFactor: req.body.ObjectSpeedFactor,
                    Loops: req.body.Loops,
                    HeightIncrement: req.body.HeightIncrement,
                    HeightUpThreshold: req.body.HeightUpThreshold,
                    HeightDownThreshold: req.body.HeightDownThreshold,
                    SizeIncrement: req.body.SizeIncrement,
                    SizeUpThreshold: req.body.SizeUpThreshold,
                    SizeDownThreshold: req.body.SizeDownThreshold,
                }
            });
        context.log("[DB UPDATE] - Game Parameter Updated: ", updatedGameParameter);
        context.res = {
            status: 200,
            body: utils.createResponse(true, true, "Registro atualizado com sucesso.", updatedGameParameter, null)
        }
    } catch (err) {
        context.log("[DB DELETE] - ERROR: ", err);
        context.res = {
            status: 500,
            body: utils.createResponse(false,
                true,
                "Ocorreu um erro interno ao realizar a operação.",
                null,
                0)
        }
    }

    context.done();
};