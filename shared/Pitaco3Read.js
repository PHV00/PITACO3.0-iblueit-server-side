'use strict';

// Shared, dependency-free read/query helpers. No changes to write contracts.
const OBJECT_ID = /^[0-9a-f]{24}$/i;

function isObjectId(value) {
    return typeof value === 'string' && OBJECT_ID.test(value);
}
function parseInteger(value, field, min, max) {
    if (value === undefined || value === null || value === '') return null;
    if (!/^\d+$/.test(String(value))) throw new Error(field + ': inteiro invalido');
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < min || result > max)
        throw new Error(field + ': fora dos limites');
    return result;
}
function boundaryDate(input, endOfDay) {
    if (input === undefined || input === null || input === '') return null;
    if (typeof input !== 'string') throw new Error('data: formato invalido');
    const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(input);
    const date = new Date(dayOnly
        ? input + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z')
        : input);
    if (!Number.isFinite(date.getTime()) ||
        (dayOnly && date.toISOString().slice(0, 10) !== input))
        throw new Error('data: valor invalido');
    return date;
}
function buildOverviewQuery(query, token, pacientId, options) {
    const q = query || {};
    const settings = options || {};
    if (typeof token !== 'string' || !token) throw new Error('GameToken ausente');
    const filter = { _gameToken: token };
    if (pacientId) filter.pacientId = pacientId;

    const phase = parseInteger(q.phase, 'phase', 0, 10000);
    const level = parseInteger(q.level, 'level', 0, 10000);
    if (phase !== null) filter.phase = phase;
    if (level !== null) filter.level = level;

    // 'gameDevice' is the historic client parameter; 'devices' is canonical.
    const device = q.devices || q.gameDevice;
    if (device !== undefined && device !== null && device !== '') {
        if (typeof device !== 'string' || device.length > 100)
            throw new Error('devices: invalido');
        filter.$or = [{ devices: device }, { gameDevice: device }];
    }

    const start = boundaryDate(q.dataIni, false);
    const finish = boundaryDate(q.dataFim, true);
    if (start && finish && start > finish)
        throw new Error('dataIni: posterior a dataFim');
    if (start || finish) {
        filter.created_at = {};
        if (start) filter.created_at.$gte = start;
        if (finish) filter.created_at.$lte = finish;
    }

    const findOptions = { sort: { created_at: q.sort === 'asc' ? 1 : -1 } };
    const maxLimit = settings.maxLimit || 10000;
    const limit = parseInteger(q.limit, 'limit', 1, maxLimit);
    const skip = parseInteger(q.skip, 'skip', 0, 1000000);
    if (limit !== null) findOptions.limit = limit;
    else if (settings.defaultLimit) findOptions.limit = settings.defaultLimit;
    if (skip !== null) findOptions.skip = skip;
    return { filter, findOptions };
}

// Technical data availability, not a clinical validity determination.
// A valid estimate needs a numeric value, confirmed contact and an approved G1.
function metricSummary(samples, field, demonstrationOnly) {
    const rows = Array.isArray(samples) ? samples : [];
    const values = [];
    let numericCount = 0;
    for (const sample of rows) {
        if (!sample || !Number.isFinite(sample[field])) continue;
        numericCount++;
        if (sample.contactConfirmed !== true || sample.g1Approved !== true) continue;
        if (demonstrationOnly && sample.isDemonstration !== true) continue;
        values.push(sample[field]);
    }
    values.sort((a, b) => a - b);
    const count = values.length;
    const middle = Math.floor(count / 2);
    return {
        totalCount: rows.length,
        numericCount,
        acceptedCount: count,
        rejectedOrUnavailableCount: rows.length - count,
        coverageRatio: rows.length ? count / rows.length : null,
        mean: count ? values.reduce((sum, n) => sum + n, 0) / count : null,
        median: count ? (count % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2) : null,
        minimum: count ? values[0] : null,
        maximum: count ? values[count - 1] : null
    };
}
function summarizePitaco3(overview, flowDocument) {
    const devices = flowDocument && Array.isArray(flowDocument.flowDataDevices)
        ? flowDocument.flowDataDevices : [];
    const pitaco = devices.find(item => item && item.deviceName === 'Pitaco 3.0');
    if (!pitaco) return null;
    return {
        overviewId: overview._id,
        clientRunId: overview.clientRunId || null,
        flowDataDevicesId: overview.flowDataDevicesId,
        pacientId: overview.pacientId,
        playStart: overview.playStart,
        playFinish: overview.playFinish,
        created_at: overview.created_at,
        stageId: overview.stageId,
        phase: overview.phase,
        level: overview.level,
        deviceName: pitaco.deviceName,
        schemaVersion: pitaco.schemaVersion || null,
        rawSamplesOmitted: pitaco.rawSamplesOmitted || 0,
        metrics: {
            bpm: metricSummary(pitaco.bpmData, 'bpm', false),
            spo2Demo: metricSummary(pitaco.spo2Data, 'spo2Percent', true)
        }
    };
}

module.exports = {
    isObjectId, parseInteger, boundaryDate,
    buildOverviewQuery, metricSummary, summarizePitaco3
};
