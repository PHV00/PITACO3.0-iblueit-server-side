'use strict';

// Pure validation of a stage payload; no MongoDB dependency.
const MAX_RAW_SAMPLES = 12000;
const MAX_ESTIMATES = 30000;
const MAX_FLOW_SAMPLES = 100000;
const MAX_JSON_BYTES = 9 * 1024 * 1024;
const DEVICE_NAMES = ['Pitaco', 'Pitaco 3.0', 'Manovacuômetro', 'Cinta'];

function record(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function finite(v) { return typeof v === 'number' && Number.isFinite(v); }
function nonNegativeInteger(v) { return Number.isSafeInteger(v) && v >= 0; }
function date(v) { return typeof v === 'string' && v.length > 0 && !Number.isNaN(Date.parse(v)); }
function nullableNumber(v, min, max) {
    return v === null || (finite(v) && v >= min && v <= max);
}
function nullableInteger(v) { return v === null || nonNegativeInteger(v); }
function nullableBoolean(v) { return v === null || typeof v === 'boolean'; }

function checkSeries(device, name, max, check, errors, prefix) {
    const entries = device[name];
    if (entries == null) return;
    if (!Array.isArray(entries)) {
        errors.push(prefix + '.' + name + ': deve ser array ou null');
        return;
    }
    if (entries.length > max) {
        errors.push(prefix + '.' + name + ': excede limite de ' + max);
        return;
    }
    for (let i = 0; i < entries.length; i++) {
        const path = prefix + '.' + name + '[' + i + ']';
        if (!record(entries[i]) || !check(entries[i])) {
            errors.push(path + ': campos ausentes ou inválidos');
            if (errors.length >= 25) return;
        }
    }
}
function validEstimateCommon(e) {
    return date(e.timestamp) && nonNegativeInteger(e.deviceTimeMs) &&
        typeof e.status === 'string' && e.status.length > 0 &&
        e.status.length <= 512 && typeof e.contactConfirmed === 'boolean' &&
        typeof e.g1Approved === 'boolean' && nonNegativeInteger(e.queueLagMs);
}
function validBpm(e) {
    return validEstimateCommon(e) &&
        Object.prototype.hasOwnProperty.call(e, 'bpm') &&
        nullableNumber(e.bpm, 0, 350) &&
        (e.autocorrelation == null || nullableNumber(e.autocorrelation, -1, 1));
}
function validSpo2(e) {
    return validEstimateCommon(e) &&
        Object.prototype.hasOwnProperty.call(e, 'spo2Percent') &&
        nullableNumber(e.spo2Percent, 0, 100) &&
        (e.ratioOfRatios == null || (finite(e.ratioOfRatios) && e.ratioOfRatios >= 0)) &&
        typeof e.isDemonstration === 'boolean';
}
function validRaw(e) {
    return date(e.timestamp) && nonNegativeInteger(e.deviceTimeMs) &&
        nonNegativeInteger(e.seq) && nonNegativeInteger(e.red) &&
        nonNegativeInteger(e.ir) && nullableBoolean(e.contact) &&
        (e.sqiReason === undefined || nullableInteger(e.sqiReason)) &&
        nonNegativeInteger(e.queueLagMs);
}
function validateStageContract(body) {
    const errors = [];
    if (!record(body)) return ['body: objeto JSON obrigatório'];
    const devices = body.flowDataDevices;
    if (!Array.isArray(devices) || devices.length < 1 || devices.length > 4)
        return ['flowDataDevices: esperado array de 1 a 4 dispositivos'];

    const runId = body.clientRunId;
    if (runId != null && (typeof runId !== 'string' || !/^[a-f0-9]{32}$/i.test(runId)))
        errors.push('clientRunId: esperado GUID com 32 caracteres hexadecimais');

    devices.forEach((device, index) => {
        const prefix = 'flowDataDevices[' + index + ']';
        if (!record(device) || DEVICE_NAMES.indexOf(device.deviceName) < 0) {
            errors.push(prefix + '.deviceName: dispositivo não suportado');
            return;
        }
        const modern = device.deviceName === 'Pitaco 3.0';
        if (modern && !runId) errors.push('clientRunId: obrigatório para Pitaco 3.0');
        if (modern && device.schemaVersion !== 1)
            errors.push(prefix + '.schemaVersion: esperado 1');
        if (!Array.isArray(device.flowData) ||
            device.flowData.length > MAX_FLOW_SAMPLES ||
            (!modern && device.flowData.length === 0)) {
            errors.push(prefix + '.flowData: array respiratório inválido');
        } else {
            for (let i = 0; i < device.flowData.length; i++) {
                const e = device.flowData[i];
                if (!record(e) || !date(e.timestamp) || !finite(e.flowValue)) {
                    errors.push(prefix + '.flowData[' + i + ']: valor ou timestamp inválido');
                    if (errors.length >= 25) break;
                }
            }
        }
        if (!modern) return;
        if (device.rawSamplesOmitted != null && !nonNegativeInteger(device.rawSamplesOmitted))
            errors.push(prefix + '.rawSamplesOmitted: inteiro não negativo obrigatório');
        checkSeries(device, 'bpmData', MAX_ESTIMATES, validBpm, errors, prefix);
        checkSeries(device, 'spo2Data', MAX_ESTIMATES, validSpo2, errors, prefix);
        checkSeries(device, 'ppgRawData', MAX_RAW_SAMPLES, validRaw, errors, prefix);
    });
    return errors.slice(0, 25);
}
function respiratorySummary(devices) {
    return devices.map(device => {
        const values = device.flowData.map(sample => sample.flowValue);
        if (!values.length) return {
            deviceName: device.deviceName,
            maxFlowValue: null, minFlowValue: null, meanFlowValue: null
        };
        let total = 0, min = values[0], max = values[0];
        for (const v of values) {
            total += v;
            if (v < min) min = v;
            if (v > max) max = v;
        }
        return {
            deviceName: device.deviceName, maxFlowValue: max,
            minFlowValue: min, meanFlowValue: total / values.length
        };
    });
}
function sameStageIdentity(saved, incoming) {
    return String(saved.pacientId) === String(incoming.pacientId) &&
        Number(saved.stageId) === Number(incoming.stageId) &&
        Number(saved.phase) === Number(incoming.phase) &&
        Number(saved.level) === Number(incoming.level) &&
        new Date(saved.playStart).getTime() === new Date(incoming.playStart).getTime() &&
        new Date(saved.playFinish).getTime() === new Date(incoming.playFinish).getTime();
}
module.exports = {
    DEVICE_NAMES, MAX_JSON_BYTES, MAX_RAW_SAMPLES,
    validateStageContract, respiratorySummary, sameStageIdentity
};
