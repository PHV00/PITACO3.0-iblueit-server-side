'use strict';

module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    mongoose.connect(process.env.MongoDbAtlas);
    mongoose.Promise = global.Promise;

    require('../shared/PlataformOverview');
    const Overview = mongoose.model('PlataformOverview');
    const utils = require('../shared/utils');
    const read = require('../shared/Pitaco3Read');
    const token = req.headers.gametoken;

    if (!await utils.verifyGameToken(token, mongoose)) {
        context.res = {
            status: 403,
            body: utils.createResponse(false, false, 'Chave de acesso inválida.', null, 1)
        };
        context.done();
        return;
    }

    let parsed;
    try {
        parsed = read.buildOverviewQuery(req.query, token);
        if (req.query && req.query.plataformOverviewId) {
            if (!read.isObjectId(req.query.plataformOverviewId))
                throw new Error('plataformOverviewId invalido');
            parsed.filter._id = req.query.plataformOverviewId;
        }
    } catch (error) {
        context.res = {
            status: 400,
            body: utils.createResponse(false, true, error.message, null, 300)
        };
        context.done();
        return;
    }

    try {
        const stages = await Overview.find(parsed.filter, null, parsed.findOptions);
        context.log('[DB QUERYING] - PlataformOverview Get');
        context.res = {
            status: 200,
            body: utils.createResponse(true, true, 'Consulta realizada com sucesso.', stages, null)
        };
    } catch (error) {
        context.log('[DB QUERYING] - ERROR:', error);
        context.res = {
            status: 500,
            body: utils.createResponse(false, true, 'Ocorreu um erro interno ao realizar a operação.', null, 0)
        };
    }
    context.done();
};
