'use strict';

const assert = require('assert');
const {
    DEVICE_NAMES, MAX_RAW_SAMPLES,
    validateStageContract, respiratorySummary, sameStageIdentity
} = require('../shared/Pitaco3Contract');

let passed = 0;
function test(name, run) {
    run();
    passed++;
    console.log('PASS ' + name);
}
function modern() {
    const time = '2026-11-22T22:00:00.000Z';
    return {
        clientRunId: 'baf9a4eb90cb4ba7824a02bfbd67cb02',
        pacientId: '6add58adcf73630071f09209',
        stageId: 1, phase: 1, level: 6,
        playStart: time, playFinish: time,
        flowDataDevices: [{
            deviceName: 'Pitaco 3.0', schemaVersion: 1,
            flowData: [{ timestamp: time, flowValue: 13.5 }],
            bpmData: [{
                timestamp: time, deviceTimeMs: 12000,
                bpm: 76.4, autocorrelation: 0.83,
                status: 'EXPERIMENTAL', contactConfirmed: true,
                g1Approved: true, queueLagMs: 20
            }],
            spo2Data: [{
                timestamp: time, deviceTimeMs: 12000,
                spo2Percent: null, ratioOfRatios: null,
                isDemonstration: true, status: 'EXPERIMENTAL',
                contactConfirmed: true, g1Approved: true,
                queueLagMs: 20
            }],
            ppgRawData: [{
                timestamp: time, deviceTimeMs: 11960, seq: 125,
                red: 72500, ir: 81200, contact: false,
                sqiReason: 0, queueLagMs: 20
            }],
            rawSamplesOmitted: 0
        }]
    };
}
function errors(v) { return validateStageContract(v); }

test('modern four-array contract is accepted', () => {
    assert.deepStrictEqual(errors(modern()), []);
});
test('legacy respiratory contract still works', () => {
    const x = modern(); x.clientRunId = null;
    x.flowDataDevices = [{
        deviceName: 'Pitaco', flowData: [{ timestamp: x.playStart, flowValue: -4 }]
    }];
    assert.deepStrictEqual(errors(x), []);
});
test('uncalibrated SpO2 null does not become a false reading', () => {
    const x = modern(); x.flowDataDevices[0].spo2Data[0].spo2Percent = null;
    assert.deepStrictEqual(errors(x), []);
});
test('modern device may have no respiratory samples', () => {
    const x = modern(); x.flowDataDevices[0].flowData = [];
    assert.deepStrictEqual(errors(x), []);
    assert.deepStrictEqual(respiratorySummary(x.flowDataDevices), [{
        deviceName: 'Pitaco 3.0', minFlowValue: null,
        maxFlowValue: null, meanFlowValue: null
    }]);
});
test('respiratory statistics preserve signed values', () => {
    const x = modern();
    x.flowDataDevices[0].flowData.push({
        timestamp: x.playStart, flowValue: -3.5
    });
    const values = respiratorySummary(x.flowDataDevices)[0];
    assert.strictEqual(values.maxFlowValue, 13.5);
    assert.strictEqual(values.minFlowValue, -3.5);
    assert.strictEqual(values.meanFlowValue, 5);
});
test('modern requires a unique run ID', () => {
    const x = modern(); delete x.clientRunId;
    assert(errors(x).some(e => e.includes('clientRunId')));
});
test('unknown device rejected', () => {
    const x = modern(); x.flowDataDevices[0].deviceName = 'Oximetro';
    assert(errors(x).length > 0);
});
test('invalid RED/IR rejected', () => {
    const x = modern(); x.flowDataDevices[0].ppgRawData[0].ir = -1;
    assert(errors(x).length > 0);
});
test('invalid timestamps rejected', () => {
    const x = modern(); x.flowDataDevices[0].bpmData[0].timestamp = 'not-a-date';
    assert(errors(x).length > 0);
});
test('raw sample cap enforced', () => {
    const x = modern();
    const sample = x.flowDataDevices[0].ppgRawData[0];
    x.flowDataDevices[0].ppgRawData = Array(MAX_RAW_SAMPLES + 1).fill(sample);
    assert(errors(x).some(e => e.includes('excede limite')));
});
test('legacy empty flow rejected instead of throwing', () => {
    const x = modern();
    x.flowDataDevices = [{ deviceName: 'Pitaco', flowData: [] }];
    assert(errors(x).length > 0);
});
test('duplicate run must identify the same stage', () => {
    const x = modern();
    assert(sameStageIdentity(x, x));
    assert(!sameStageIdentity(x, Object.assign({}, x, { level: 8 })));
});
test('both modern and legacy PITACO recognized', () => {
    assert(DEVICE_NAMES.includes('Pitaco 3.0') && DEVICE_NAMES.includes('Pitaco'));
});
console.log('PITACO 3.0 backend contract: ' + passed + ' tests passed.');
