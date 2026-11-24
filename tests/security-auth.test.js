'use strict';
// No network, Atlas, Azure, or real credentials: security regression smoke tests.
const assert = require('assert');
const Module = require('module');
const access = require('../shared/AccessControl');

(async () => {
    assert.strictEqual(access.bearerToken({ headers: { authorization: 'foo' } }), null);
    assert.strictEqual(access.bearerToken({ headers: {} }), null);
    assert.strictEqual(access.hashToken('abc').length, 64);
    assert(access.constantTimeMatch('fixed', 'fixed'));
    assert(!access.constantTimeMatch('fixed', 'other'));
    assert(!access.constantTimeMatch('', ''));

    const user = { _id: '5ff9df20d3b84897c63011aa',
        role: 'Administrator', gameToken: { token: 'scoped-token' } };
    let row = null;
    const Session = {
        async create(obj) { row = obj; return obj; },
        async findOne(q) {
            if (!row || q.tokenHash !== row.tokenHash ||
                row.expiresAt <= q.expiresAt.$gt) return null;
            return row;
        }
    };
    const User = { async findById(id) {
        return String(id) === String(user._id) ? user : null;
    } };
    const db = { model(name) {
        return name === 'AuthSession' ? Session : name === 'UserAccount' ? User : null;
    } };
    const original = Module._load;
    try {
        Module._load = function (request, parent, isMain) {
            if (request === './AuthSession' || request === './UserAccount') return {};
            return original.apply(this, arguments);
        };
        const created = await access.createSession(user, db);
        assert(/^[a-f0-9]{64}$/.test(created.token));
        assert.notStrictEqual(row.tokenHash, created.token);
        const headers = { authorization: 'Bearer ' + created.token };
        assert.strictEqual((await access.authenticate({ headers }, db)).user, user);
        assert.strictEqual(await access.administrator({ headers }, db), user);
        assert.strictEqual(await access.administrator({ headers }, db, 'wrong-id'), null);
        assert.strictEqual(await access.authenticate({
            headers: { authorization: 'Bearer ' + '0'.repeat(64) }
        }, db), null);
        row.expiresAt = new Date(Date.now() - 1000);
        assert.strictEqual(await access.authenticate({ headers }, db), null);
    } finally {
        Module._load = original;
    }

    const prev = process.env.ADMIN_BOOTSTRAP_TOKEN;
    try {
        process.env.ADMIN_BOOTSTRAP_TOKEN = 'test-only-provisioning-value';
        assert(access.validBootstrap({ headers: {
            'x-admin-bootstrap-token': 'test-only-provisioning-value'
        } }));
        assert(!access.validBootstrap({ headers: {
            'x-admin-bootstrap-token': 'wrong'
        } }));
    } finally {
        if (prev === undefined) delete process.env.ADMIN_BOOTSTRAP_TOKEN;
        else process.env.ADMIN_BOOTSTRAP_TOKEN = prev;
    }
    console.log('AccessControl: session, authorization, expiry and bootstrap checks passed');
})().catch(err => { console.error(err); process.exitCode = 1; });
