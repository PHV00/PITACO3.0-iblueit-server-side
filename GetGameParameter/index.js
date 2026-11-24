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

    var isVerifiedGameToken = await utils.verifyGameToken(req.headers.gametoken, mongoose);

    if (!isVerifiedGameToken) {
        context.res = {
            status: 403,
            body: utils.createResponse(false, false, "Chave de acesso inválida.", null, 1)
        }
        context.done();
        return;
    }

    const findObj = {}
    const findOptionsObj = { sort: { created_at: -1 } };

    if (req.query.pacientId)
        findObj["pacientId"] = req.query.pacientId;
    if (req.query.stageId)
        findObj["stageId"] = req.query.stageId;
    if (req.query.phase)
        findObj["phase"] = req.query.phase;
    if (req.query.level)
        findObj["level"] = req.query.level;
    if (req.query.ObjectSpeedFactor)
        findObj["ObjectSpeedFactor"] = req.query.ObjectSpeedFactor;
    if (req.query.HeightIncrement)
        findObj["HeightIncrement"] = req.query.HeightIncrement;
    if (req.query.HeightUpThreshold)
        findObj["HeightUpThreshold"] = req.query.HeightUpThreshold;
    if (req.query.HeightDownThreshold)
        findObj["HeightDownThreshold"] = req.query.HeightDownThreshold;
    if (req.query.SizeIncrement)
        findObj["SizeIncrement"] = req.query.SizeIncrement;
    if (req.query.SizeUpThreshold)
        findObj["SizeUpThreshold"] = req.query.SizeUpThreshold;    
    if (req.query.SizeDownThreshold)
        findObj["SizeDownThreshold"] = req.query.SizeDownThreshold;    
    if (req.query.Loops)
        findObj["Loops"] = req.query.Loops;    
    if (req.query.dataIni)
        findObj.created_at = {
            $gte: new Date(req.query.dataIni).toISOString("yyyy-MM-ddThh:mm:ss.msZ")
        };
    if (req.query.dataIni && req.query.dataFim)
        findObj.created_at = {
            $gte: new Date(`${req.query.dataIni} 00:00:00:000 UTC`).toISOString("yyyy-MM-ddThh:mm:ss.msZ"),
            $lte: new Date(`${req.query.dataFim} 23:59:59:999 UTC`).toISOString("yyyy-MM-ddThh:mm:ss.msZ")
        };
    for (const [field, min, max] of [['limit', 1, 1000], ['skip', 0, 1000000]]) {
        if (req.query[field] !== undefined) {
            const value = Number(req.query[field]);
            if (!Number.isSafeInteger(value) || value < min || value > max) {
                context.res = { status: 400,
                    body: utils.createResponse(false, true, field + ' inválido.', null, 300) };
                context.done();
                return;
            }
            findOptionsObj[field] = value;
        }
    }
    if (req.query.sort == "asc")
        findOptionsObj.sort = { created_at: 1 };

    try {
        // GameParameter lacks _gameToken in legacy storage. Scope through patient ownership.
        const owned = await PatientModel.find(
            { _gameToken: req.headers.gametoken }, '_id'
        );
        const ids = new Set(owned.map(item => String(item._id)));
        if (req.query.pacientId && !ids.has(String(req.query.pacientId))) {
            context.res = { status: 403,
                body: utils.createResponse(false, false, 'Paciente não autorizado.', null, 1) };
            context.done();
            return;
        }
        findObj.pacientId = req.query.pacientId
            ? String(req.query.pacientId) : { $in: Array.from(ids) };
        const GameParameterModels = await GameParameterModel.find(findObj, null, findOptionsObj);
        context.log("[DB QUERYING] - GameParameterModel Get");
        context.res = {
            status: 200,
            body: utils.createResponse(true, true, "Consulta realizada com sucesso.", GameParameterModels, null)
        }
    } catch (err) {
        context.log("[DB QUERYING] - ERROR: ", err);
        context.res = {
            status: 500,
            body: utils.createResponse(false, true, "Ocorreu um erro interno ao realizar a operação.", null, 00)
        }
    }

    context.done();
};



