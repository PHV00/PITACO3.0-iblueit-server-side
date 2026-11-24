module.exports = async function (context, req) {
    const mongoose = require('mongoose');
    mongoose.connect(process.env.MongoDbAtlas);
    mongoose.Promise = global.Promise;

    require('../shared/PlataformOverview');
    require('../shared/FlowDataDevice');
    require('../shared/PlaySession');
    require('../shared/Pacient');

    const PlataformOverviewModel = mongoose.model('PlataformOverview');
    const FlowDataDeviceModel = mongoose.model('FlowDataDevice');
    const PlaySessionModel = mongoose.model('PlaySession');
    const PatientModel = mongoose.model('Pacient');
    const validations = require('../shared/Validators');
    const contract = require('../shared/Pitaco3Contract');
    const utils = require('../shared/utils');
    const gameToken = req.headers.gametoken;

    const verified = await utils.verifyGameToken(gameToken, mongoose);
    if (!verified) {
        context.res = {
            status: 403,
            body: utils.createResponse(false, false, 'Chave de acesso inválida.', null, 1)
        };
        context.done();
        return;
    }

    const body = req.body || {};
    // The Unity GameToken is a write-scoped credential for this account.
    // Reject writes for patient IDs owned by a different account before side effects.
    if (body.pacientId !== undefined && !/^[a-f0-9]{24}$/i.test(body.pacientId)) {
        context.res = { status: 400,
            body: utils.createResponse(false, false, 'Identificador de paciente inválido.', null, 300) };
        context.done();
        return;
    }
    if (body.pacientId) {
        const belongsToAccount = await PatientModel.exists({
            _id: body.pacientId, _gameToken: gameToken
        });
        if (!belongsToAccount) {
            context.res = { status: 403,
                body: utils.createResponse(false, false, 'Paciente fora do escopo deste token.', null, 1) };
            context.done();
            return;
        }
    }
    if (Object.keys(body).length === 0) {
        context.res = {
            status: 400,
            body: utils.createResponse(false, true, 'Dados vazios!', null, 2)
        };
        context.done();
        return;
    }

    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > contract.MAX_JSON_BYTES) {
        context.res = {
            status: 413,
            body: utils.createResponse(false, true, 'Registro excede o limite de tamanho por etapa.', null, 2)
        };
        context.done();
        return;
    }

    const validationResult = validations.plataformOverviewSaveValidator(body);
    const seriesErrors = contract.validateStageContract(body);
    if (validationResult.errorCount !== 0 || seriesErrors.length > 0) {
        const response = utils.createResponse(false, true, 'Erros de validação encontrados!', null, 2);
        const errors = validationResult.errors.errors || {};
        if (seriesErrors.length) errors.telemetry = seriesErrors;
        response.errors = errors;
        context.res = { status: 400, body: response };
        context.done();
        return;
    }

    // Build the overview without changing req.body or the optical arrays.
    const overview = Object.assign({}, body, {
        _gameToken: gameToken,
        devices: body.flowDataDevices.map(x => x.deviceName),
        flowDataDevicesValues: contract.respiratorySummary(body.flowDataDevices)
    });
    delete overview.flowDataDevices;

    const runFilter = overview.clientRunId
        ? { _gameToken: gameToken, clientRunId: overview.clientRunId }
        : null;

    function alreadySaved(existing) {
        if (!contract.sameStageIdentity(existing, overview)) {
            context.res = {
                status: 409,
                body: utils.createResponse(false, true, 'clientRunId pertence a outra execução.', null, 2)
            };
            return;
        }
        context.res = {
            status: 200,
            body: utils.createResponse(true, true, 'Execução já registrada; reenvio reconhecido.', existing, null)
        };
    }

    let createdFlow = null;
    try {
        if (runFilter) {
            const previous = await PlataformOverviewModel.findOne(runFilter);
            if (previous) {
                alreadySaved(previous);
                context.done();
                return;
            }
        }

        // Preserve the original daily session behavior for old devices.
        const lastSession = await PlaySessionModel.findOne(
            { pacientId: overview.pacientId }, null,
            { sort: { sessionNumber: -1 } }
        );
        if (!lastSession) {
            await new PlaySessionModel({ pacientId: overview.pacientId, sessionNumber: 1 }).save();
        } else {
            const lastDate = new Date(lastSession.created_at);
            lastDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (lastDate.getTime() !== today.getTime()) {
                await new PlaySessionModel({
                    pacientId: overview.pacientId,
                    sessionNumber: lastSession.sessionNumber + 1
                }).save();
            }
        }

        createdFlow = await new FlowDataDeviceModel({
            _gameToken: gameToken,
            flowDataDevices: body.flowDataDevices
        }).save();

        overview.flowDataDevicesId = createdFlow._id;
        const saved = await new PlataformOverviewModel(overview).save();
        context.log('[PITACO3] Plataforma salva:', saved._id,
            '| devices:', overview.devices,
            '| run:', overview.clientRunId || 'legacy');
        context.res = {
            status: 201,
            body: utils.createResponse(true, true, 'Plataforma salva com sucesso.', saved, null)
        };
    } catch (err) {
        // Compensate failure of the overview write (including duplicate runs).
        // This is not a MongoDB transaction: session writes are unchanged.
        if (createdFlow) {
            try {
                await FlowDataDeviceModel.deleteOne({
                    _id: createdFlow._id, _gameToken: gameToken
                });
            } catch (cleanupError) {
                context.log('[PITACO3] Falha ao limpar dados órfãos:', cleanupError);
            }
        }

        if (err.code === 11000 && runFilter) {
            try {
                const previous = await PlataformOverviewModel.findOne(runFilter);
                if (previous) {
                    alreadySaved(previous);
                    context.done();
                    return;
                }
            } catch (lookupError) {
                context.log('[PITACO3] Falha na consulta de reenvio:', lookupError);
            }
        }

        context.log('[DB SAVING] - ERROR:', err);
        context.res = {
            status: 500,
            body: utils.createResponse(false, true, 'Ocorreu um erro interno ao realizar a operação.', null, 0)
        };
    }
    context.done();
};
