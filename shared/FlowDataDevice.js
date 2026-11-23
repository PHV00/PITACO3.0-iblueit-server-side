const mongoose = require('mongoose');

// Single stage document, linked through PlataformOverview.flowDataDevicesId.
// Keep the legacy respiratory shape unchanged for existing clients.
const FlowDataDeviceSchema = mongoose.Schema({
    _gameToken: { type: String },
    flowDataDevices: [{
        deviceName: { type: String },
        flowData: [{ flowValue: Number, timestamp: Date }],
        schemaVersion: { type: Number },
        rawSamplesOmitted: { type: Number },
        bpmData: {
            type: [{
                timestamp: Date, deviceTimeMs: Number, bpm: Number,
                autocorrelation: Number, status: String,
                contactConfirmed: Boolean, g1Approved: Boolean,
                queueLagMs: Number
            }],
            default: undefined
        },
        spo2Data: {
            type: [{
                timestamp: Date, deviceTimeMs: Number, spo2Percent: Number,
                ratioOfRatios: Number, isDemonstration: Boolean,
                status: String, contactConfirmed: Boolean,
                g1Approved: Boolean, queueLagMs: Number
            }],
            default: undefined
        },
        ppgRawData: {
            type: [{
                timestamp: Date, deviceTimeMs: Number, seq: Number,
                red: Number, ir: Number, contact: Boolean,
                sqiReason: Number, queueLagMs: Number
            }],
            default: undefined
        }
    }]
}, { timestamps: { createdAt: 'created_at' } });

module.exports = mongoose.model('FlowDataDevice', FlowDataDeviceSchema);
