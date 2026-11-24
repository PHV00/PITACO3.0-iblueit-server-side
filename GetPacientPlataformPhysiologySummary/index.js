'use strict';

// Lightweight per-stage BPM and DEMO SpO2 summaries; optical raw arrays are not fetched.
module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    mongoose.connect(process.env.MongoDbAtlas);
    mongoose.Promise = global.Promise;

    require('../shared/PlataformOverview');
    require('../shared/FlowDataDevice');
    const Overview = mongoose.model('PlataformOverview');
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
            body: utils.createResponse(false, false, 'Chave de acesso invalida.', null, 1)
        };
        context.done();
        return;
    }
    if (!read.isObjectId(req.params.pacientId)) {
        context.res = {
            status: 400,
            body: utils.createResponse(false, true, 'pacientId invalido.', null, 300)
        };
        context.done();
        return;
    }

    let filter, findOptions;
    try {
        const parsed = read.buildOverviewQuery(
            Object.assign({}, req.query || {}, { devices: 'Pitaco 3.0' }),
            token, req.params.pacientId,
            { defaultLimit: 20, maxLimit: 100 }
        );
        filter = parsed.filter;
        findOptions = parsed.findOptions;
    } catch (error) {
        context.res = {
            status: 400,
            body: utils.createResponse(false, true, error.message, null, 300)
        };
        context.done();
        return;
    }

    try {
        const stages = await Overview.find(filter, null, findOptions);
        const ids = stages
            .filter(stage => stage && stage.flowDataDevicesId)
            .map(stage => stage.flowDataDevicesId);
        if (!ids.length) {
            context.res = {
                status: 200,
                body: utils.createResponse(true, true, 'Consulta realizada com sucesso.', [], null)
            };
            context.done();
            return;
        }
        // Projection excludes flowData and ppgRawData to minimize transfer.
        const flows = await Flow.find(
            { _id: { $in: ids }, _gameToken: token },
            {
                'flowDataDevices.deviceName': 1,
                'flowDataDevices.schemaVersion': 1,
                'flowDataDevices.rawSamplesOmitted': 1,
                'flowDataDevices.bpmData': 1,
                'flowDataDevices.spo2Data': 1
            }
        );
        const flowById = new Map(flows.map(flow => [String(flow._id), flow]));
        const data = stages
            .map(stage => read.summarizePitaco3(
                stage, flowById.get(String(stage.flowDataDevicesId))
            ))
            .filter(Boolean);

        context.res = {
            status: 200,
            body: utils.createResponse(true, true, 'Consulta realizada com sucesso.', data, null)
        };
    } catch (error) {
        context.log('[PITACO3 READ] Falha na consulta de resumos:', error);
        context.res = {
            status: 500,
            body: utils.createResponse(false, true, 'Erro ao consultar resumos fisiologicos.', null, 0)
        };
    }
    context.done();
};
