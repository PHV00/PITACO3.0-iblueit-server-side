'use strict';
const assert = require('assert');
const Module = require('module');
const access = require('../shared/AccessControl');

(async () => {
    let user = {
        _id: '5faaa111bbcc1122dd334455', role: 'Administrator',
        pacientId: null, gameToken: { token: 'account-A' }
    };
    let saved;
    const Session = {
        async create(v) { saved = v; return v; },
        async findOne(q) {
            return saved && q.tokenHash === saved.tokenHash &&
                saved.expiresAt > q.expiresAt.$gt ? saved : null;
        }
    };
    const User = { async findById() { return user; } };
    const Overview = { async exists(q) {
        return q.pacientId === user.pacientId &&
            q.flowDataDevicesId === 'owned-flow';
    } };
    const db = { model(name) {
        return {
            AuthSession: Session, UserAccount: User,
            PlataformOverview: Overview
        }[name];
    } };
    const mocks = {
        './AuthSession': {}, './UserAccount': {},
        './PlataformOverview': {},
        './utils': {
            createResponse(success, authorized, message, data, error) {
                return { success, authorized, message, data, error };
            }
        }
    };
    const original = Module._load;
    try {
        Module._load = function (request, parent, isMain) {
            if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
            return original.apply(this, arguments);
        };
        const session = await access.createSession(user, db);
        const headers = { authorization: 'Bearer ' + session.token, gametoken: 'account-A' };
        const ctx = () => ({ res: null, done() {} });
        assert.strictEqual(
            (await access.enforceRead(ctx(), { headers, params: { pacientId: 'patient-A' } },
                db)).role, 'Administrator'
        );

        user = { _id: user._id, role: 'User', pacientId: 'patient-A',
            gameToken: { token: 'account-A' } };
        assert.strictEqual(
            (await access.enforceRead(ctx(), { headers,
                params: { pacientId: 'patient-A' } }, db)).role, 'User'
        );
        const wrong = ctx();
        assert.strictEqual(await access.enforceRead(wrong, { headers,
            params: { pacientId: 'patient-B' } }, db), null);
        assert.strictEqual(wrong.res.status, 403);

        const forbiddenCohort = ctx();
        assert.strictEqual(await access.enforceRead(forbiddenCohort,
            { headers, params: {} }, db, { adminOnly: true }), null);
        assert.strictEqual(forbiddenCohort.res.status, 403);

        assert.strictEqual(
            (await access.enforceRead(ctx(), { headers,
                params: { flowDataDeviceId: 'owned-flow' } }, db)).role, 'User'
        );
        const wrongFlow = ctx();
        assert.strictEqual(await access.enforceRead(wrongFlow, { headers,
            params: { flowDataDeviceId: 'another-flow' } }, db), null);
        assert.strictEqual(wrongFlow.res.status, 403);
        const wrongToken = ctx();
        assert.strictEqual(await access.enforceRead(wrongToken, {
            headers: { authorization: headers.authorization, gametoken: 'account-B' },
            params: { pacientId: 'patient-A' }
        }, db), null);
        assert.strictEqual(wrongToken.res.status, 403);
    } finally {
        Module._load = original;
    }
    console.log('Scoped read access: admin, patient, wrong ID, flow and tenant isolation passed');
})().catch(err => { console.error(err); process.exitCode = 1; });
