'use strict';
// Shared handler response to avoid duplicating security-sensitive envelope logic.
// Bound to an Azure Functions context with Function.prototype.bind(context).
module.exports = function reply(status, success, authorized, message, data, code) {
    const utils = require('./utils');
    this.res = {
        status,
        body: utils.createResponse(success, authorized, message, data || null, code ?? null)
    };
    this.done();
};
