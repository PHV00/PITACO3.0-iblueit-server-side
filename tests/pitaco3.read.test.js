'use strict';

// Backend read regression tests. All storage is simulated; no live patients or Atlas secrets.
const assert = require('assert');
const Module = require('module');
const read = require('../shared/Pitaco3Read');

const PATIENT = '6add58adcf73630071f09209';
const OTHER = '6add58adcf73630071f09208';
const STAGE = '6b038f9d1c0cf50072392dc0';
const FLOW = '6b038f9a1c0cf50072390c2d';
const OTHER_FLOW = '6b038f9a1c0cf50072390c2e';
const A = 'test-token-a', B = 'test-token-b';

const stages = [
    {
        _id: STAGE, _gameToken: A, pacientId: PATIENT,
        clientRunId: 'd8e579ee03834b969c0c0027d4ccf847',
        devices: ['Pitaco 3.0'], flowDataDevicesId: FLOW,
        phase: 1, level: 6, created_at: new Date('2026-11-23T00:58:05Z')
    },
    {
        _id: '6b038f9d1c0cf50072392dc2', _gameToken: A, pacientId: PATIENT,
        devices: ['Pitaco'], gameDevice: 'Pitaco', phase: 1, level: 3,
        created_at: new Date('2026-11-21T00:58:05Z')
    },
    {
        _id: '6b038f9d1c0cf50072392dc3', _gameToken: B, pacientId: PATIENT,
        devices: ['Pitaco 3.0'], flowDataDevicesId: OTHER_FLOW, phase: 1, level: 6,
        created_at: new Date('2026-11-22T00:58:05Z')
    },
    {
        _id: '6b038f9d1c0cf50072392dc4', _gameToken: A, pacientId: OTHER,
        devices: ['Pitaco 3.0'], phase: 1, level: 6,
        created_at: new Date('2026-11-23T00:58:05Z')
    }
];
const flows = [
    {
        _id: FLOW, _gameToken: A,
        flowDataDevices: [{
            deviceName: 'Pitaco 3.0', schemaVersion: 1, rawSamplesOmitted: 0,
            flowData: [{ flowValue: 1 }], ppgRawData: [{ red: 100, ir: 200 }],
            bpmData: [
                { bpm: 80, contactConfirmed: true, g1Approved: true },
                { bpm: null, contactConfirmed: true, g1Approved: true },
                { bpm: 200, contactConfirmed: false, g1Approved: true },
                { bpm: 90, contactConfirmed: true, g1Approved: true }
            ],
            spo2Data: [
                { spo2Percent: 96, isDemonstration: true, contactConfirmed: true, g1Approved: true },
                { spo2Percent: 98, isDemonstration: true, contactConfirmed: false, g1Approved: true },
                { spo2Percent: 97, isDemonstration: false, contactConfirmed: true, g1Approved: true },
                { spo2Percent: null, isDemonstration: true, contactConfirmed: true, g1Approved: true }
            ]
        }]
    },
    { _id: OTHER_FLOW, _gameToken: B, flowDataDevices: [{ deviceName: 'Pitaco 3.0' }] }
];

function matches(row, query) {
    return Object.entries(query || {}).every(([key, expected]) => {
        if (key === '$or') return expected.some(part => matches(row, part));
        const actual = row[key];
        if (key === 'created_at') {
            return (!expected.$gte || actual >= expected.$gte) &&
                (!expected.$lte || actual <= expected.$lte);
        }
        if (expected && typeof expected === 'object' && '$in' in expected)
            return expected.$in.map(String).includes(String(actual));
        if (Array.isArray(actual)) return actual.includes(expected);
        return String(actual) === String(expected);
    });
}
const aggregatePipelines = [];
class Aggregate {
    constructor() { this.ops = []; aggregatePipelines.push(this.ops); }
    append(x) { this.ops.push(['append', x]); return this; }
    lookup(x) { this.ops.push(['lookup', x]); return this; }
    sort(x) { this.ops.push(['sort', x]); return this; }
    project(x) { this.ops.push(['project', x]); return this; }
    match(x) { this.ops.push(['match', x]); return this; }
    replaceRoot(x) { this.ops.push(['replaceRoot', x]); return this; }
    unwind(x) { this.ops.push(['unwind', x]); return this; }
    group(x) { this.ops.push(['group', x]); return this; }
    limit(x) { this.ops.push(['limit', x]); return this; }
    skip(x) { this.ops.push(['skip', x]); return this; }
    async exec() { return []; }
}
class Overview {
    static async find(q, projection, opts) {
        let rows = stages.filter(x => matches(x, q));
        if (opts && opts.sort && opts.sort.created_at)
            rows.sort((a, b) => opts.sort.created_at * (a.created_at - b.created_at));
        if (opts && opts.skip) rows = rows.slice(opts.skip);
        if (opts && opts.limit) rows = rows.slice(0, opts.limit);
        return rows;
    }
    static aggregate() { return new Aggregate(); }
}
class Flow {
    static async find(q) { return flows.filter(x => matches(x, q)); }
}
class Pacient { static aggregate() { return new Aggregate(); } }
const mongoose = {
    connect() {}, Promise: null,
    model(name) { return { PlataformOverview: Overview, FlowDataDevice: Flow, Pacient }[name]; }
};
const utils = {
    verifyGameToken: async token => token === A || token === B,
    createResponse: (success, authorized, message, data, errors) =>
        ({ success, authorized, message, data, errors })
};
async function invoke(file, token, params, query) {
    const original = Module._load;
    Module._load = function (request, parent, isMain) {
        if (request === 'mongoose') return mongoose;
        if (request === '../shared/utils') return utils;
        if (/^\.\.\/shared\/(FlowDataDevice|PlataformOverview|Pacient)$/.test(request))
            return {};
        return original.apply(this, arguments);
    };
    const context = { log() {}, done() {}, res: null };
    try {
        const handler = require('../' + file + '/index');
        await handler(context, {
            headers: { gametoken: token },
            params: params || {},
            query: query || {}
        });
    } finally {
        Module._load = original;
    }
    return context.res;
}
(async function () {
    const q = read.buildOverviewQuery(
        { devices: 'Pitaco 3.0', phase: '1', level: '6', dataIni: '2026-11-23',
          dataFim: '2026-11-23', limit: '5', sort: 'asc' }, A, PATIENT
    );
    assert.strictEqual(q.filter._gameToken, A);
    assert.strictEqual(q.filter.phase, 1);
    assert.strictEqual(q.findOptions.limit, 5);
    assert.strictEqual(q.filter.created_at.$lte.toISOString(), '2026-11-23T23:59:59.999Z');
    assert.throws(() => read.buildOverviewQuery({ limit: '-1' }, A, PATIENT));
    assert.throws(() => read.buildOverviewQuery({ dataIni: '2026-02-30' }, A, PATIENT));
    assert.throws(() => read.buildOverviewQuery({ level: 'x' }, A, PATIENT));

    const list = await invoke('GetPacientPlataformOverview', A, { pacientId: PATIENT },
        { devices: 'Pitaco 3.0' });
    assert.strictEqual(list.status, 200);
    assert.strictEqual(list.body.success, true);
    assert.deepStrictEqual(list.body.data.map(x => x._id), [STAGE]);

    const legacy = await invoke('GetPacientPlataformOverview', A, { pacientId: PATIENT },
        { gameDevice: 'Pitaco' });
    assert.strictEqual(legacy.body.data.length, 1);
    assert.strictEqual(legacy.body.data[0].devices[0], 'Pitaco');
    assert.strictEqual((await invoke('GetPacientPlataformOverview', 'invalid', { pacientId: PATIENT })).status, 403);
    assert.strictEqual((await invoke('GetPacientPlataformOverview', B, { pacientId: OTHER })).body.data.length, 0);
    assert.strictEqual((await invoke('GetPacientPlataformOverview', A, { pacientId: PATIENT },
        { limit: 'bad' })).status, 400);

    const raw = await invoke('GetFlowDataDevice', A, { flowDataDeviceId: FLOW });
    assert.strictEqual(raw.status, 200);
    assert.strictEqual(raw.body.data[0].flowDataDevices[0].ppgRawData.length, 1);
    assert.strictEqual((await invoke('GetFlowDataDevice', B, { flowDataDeviceId: FLOW })).body.data.length, 0);
    assert.strictEqual((await invoke('GetFlowDataDevice', A, { flowDataDeviceId: 'oops' })).status, 400);

    const all = await invoke('GetPlataformOverview', A, {}, {});
    assert.strictEqual(all.status, 200);
    assert.strictEqual(all.body.data.length, 3);
    assert.strictEqual((await invoke('GetPlataformOverview', B, {}, {})).body.data.length, 1);

    const summary = await invoke('GetPacientPlataformPhysiologySummary', A, { pacientId: PATIENT });
    assert.strictEqual(summary.status, 200);
    assert.strictEqual(summary.body.data.length, 1);
    const metrics = summary.body.data[0].metrics;
    assert.strictEqual(metrics.bpm.totalCount, 4);
    assert.strictEqual(metrics.bpm.numericCount, 3);
    assert.strictEqual(metrics.bpm.acceptedCount, 2);
    assert.strictEqual(metrics.bpm.mean, 85);
    assert.strictEqual(metrics.spo2Demo.acceptedCount, 1);
    assert.strictEqual(metrics.spo2Demo.mean, 96);
    assert.strictEqual(summary.body.data[0].rawSamplesOmitted, 0);
    assert.strictEqual((await invoke('GetPacientPlataformPhysiologySummary', B, { pacientId: PATIENT })).body.data.length, 0);
    assert.strictEqual((await invoke('GetPacientPlataformPhysiologySummary', A, { pacientId: 'bad' })).status, 400);

    aggregatePipelines.length = 0;
    assert.strictEqual((await invoke('GetPacientPlataformStatistics', A,
        { pacientId: PATIENT }, { devices: 'Pitaco 3.0' })).status, 200);
    assert.strictEqual(aggregatePipelines[0][0][1].$match._gameToken, A);
    assert(JSON.stringify(aggregatePipelines[0]).includes('_gameToken'));

    aggregatePipelines.length = 0;
    assert.strictEqual((await invoke('GetPlataformStatistics', A, {}, { devices: 'Pitaco 3.0' })).status, 200);
    assert.strictEqual(aggregatePipelines[0][0][1].$match._gameToken, A);
    assert(JSON.stringify(aggregatePipelines[0]).includes('_gameToken'));

    console.log('PITACO 3.0 read API: 24+ assertions passed (legacy, token isolation, summaries, filters).');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
