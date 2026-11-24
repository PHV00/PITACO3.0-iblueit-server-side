'use strict';

// HTTP handler smoke tests with an in-memory Mongoose adapter.
// No Atlas credentials or network access required.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const fixture = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/pitaco3-stage.example.json'), 'utf8'
));

const state = { overviews: [], flows: [], sessions: [] };
class Flow {
    constructor(data) { Object.assign(this, data); this._id = 'flow-' + (state.flows.length + 1); }
    async save() { state.flows.push(this); return this; }
    static async deleteOne(q) {
        state.flows = state.flows.filter(x => x._id !== q._id);
    }
}
class Overview {
    constructor(data) {
        Object.assign(this, data);
        this._id = 'overview-' + (state.overviews.length + 1);
    }
    async save() { state.overviews.push(this); return this; }
    static async findOne(q) {
        return state.overviews.find(
            x => x._gameToken === q._gameToken && x.clientRunId === q.clientRunId
        ) || null;
    }
}
class Patient {
    static async exists(q) {
        return q._gameToken === 'test-token' && q._id === fixture.pacientId;
    }
}
class Session {
    constructor(data) { Object.assign(this, data); this.created_at = new Date(); }
    async save() { state.sessions.push(this); return this; }
    static async findOne() { return state.sessions[state.sessions.length - 1] || null; }
}

const mockMongoose = {
    connect: () => undefined,
    model: name => ({
        FlowDataDevice: Flow, PlataformOverview: Overview, PlaySession: Session, Pacient: Patient
    })[name]
};
const mocks = {
    mongoose: mockMongoose,
    '../shared/FlowDataDevice': {},
    '../shared/PlataformOverview': {},
    '../shared/PlaySession': {},
    '../shared/Pacient': {},
    '../shared/Validators': {
        plataformOverviewSaveValidator: () => ({ errorCount: 0, errors: { errors: {} } })
    },
    '../shared/utils': {
        verifyGameToken: async token => token === 'test-token',
        createResponse: (success, authorized, message, data, errors) =>
            ({ success, authorized, message, data, errors })
    }
};
const originalLoad = Module._load;
let handler;
try {
    Module._load = function (request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
        return originalLoad.apply(this, arguments);
    };
    handler = require('../SendPlataformOverview/index');
} finally {
    // Requires inside the handler occur at invocation time, not module load.
    Module._load = originalLoad;
}

async function request(body, token) {
    const ctx = { res: null, log: () => {}, done: () => {} };
    const old = Module._load;
    try {
        Module._load = function (name, parent, isMain) {
            if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
            return old.apply(this, arguments);
        };
        await handler(ctx, { body, headers: { gametoken: token || 'test-token' } });
    } finally {
        Module._load = old;
    }
    return ctx.res;
}

(async function () {
    const first = await request(fixture);
    assert.strictEqual(first.status, 201);
    assert.strictEqual(state.overviews.length, 1);
    assert.strictEqual(state.flows.length, 1);
    assert.strictEqual(state.overviews[0].flowDataDevicesId, state.flows[0]._id);
    assert.deepStrictEqual(
        ['flowData', 'bpmData', 'spo2Data', 'ppgRawData'].map(
            name => Array.isArray(state.flows[0].flowDataDevices[0][name])
        ), [true, true, true, true]
    );

    const repeated = await request(fixture);
    assert.strictEqual(repeated.status, 200);
    assert.strictEqual(state.overviews.length, 1);
    assert.strictEqual(state.flows.length, 1);

    const conflict = await request(Object.assign({}, fixture, { level: 9 }));
    assert.strictEqual(conflict.status, 409);
    assert.strictEqual(state.overviews.length, 1);

    const invalid = JSON.parse(JSON.stringify(fixture));
    invalid.clientRunId = '2222222233334444aaaa555555555555';
    invalid.flowDataDevices[0].ppgRawData[0].red = -50;
    const invalidResponse = await request(invalid);
    assert.strictEqual(invalidResponse.status, 400);
    assert.strictEqual(state.overviews.length, 1);

    const otherAccount = Object.assign({}, fixture, {
        pacientId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        clientRunId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    });
    assert.strictEqual((await request(otherAccount)).status, 403);
    assert.strictEqual(state.overviews.length, 1);

    const forbidden = await request(fixture, 'invalid-token');
    assert.strictEqual(forbidden.status, 403);
    assert.strictEqual(state.overviews.length, 1);

    console.log('PITACO 3.0 backend HTTP handler: 5 scenarios passed.');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
