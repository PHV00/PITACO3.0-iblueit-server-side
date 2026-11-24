'use strict';

module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    mongoose.connect(process.env.MongoDbAtlas);
    mongoose.Promise = global.Promise;

    require('../shared/FlowDataDevice');
    const Flow = mongoose.model('FlowDataDevice');
    const utils = require('../shared/utils');
    const reader = await require('../shared/AccessControl').enforceRead(
        context, req, mongoose
    );
    if (!reader) return;

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
    if (!read.isObjectId(req.params.flowDataDeviceId)) {
        context.res = {
            status: 400,
            body: utils.createResponse(false, false, 'Identificador de dados inválido.', null, 300)
        };
        context.done();
        return;
    }

    try {
        // Same response shape as the legacy GET: data remains an array.
        // Never expose a flow record owned by a different GameToken.
        const flows = await Flow.find({
            _id: req.params.flowDataDeviceId, _gameToken: token
        });
        context.log('[DB QUERYING] - FlowDataDevice Get by ID');
        context.res = {
            status: 200,
            body: utils.createResponse(true, true, 'Consulta realizada com sucesso.', flows, null)
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
