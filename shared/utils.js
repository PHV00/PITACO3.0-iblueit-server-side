const verifyGameToken = async (token, mongoose) => {
    // A User account may share a GameToken with the Administrator; the issuer
    // must always be an active Administrator account.
    if (typeof token !== 'string' || !token || token.length > 200) return false;
    require('../shared/UserAccount');
    const User = mongoose.model('UserAccount');
    return Boolean(await User.exists({ role: 'Administrator', 'gameToken.token': token }));
}

const validateHeaders = async (headers, context) => {

    var result = {};

    if (headers.gametoken === undefined || headers.gametoken == null)
        result = { message: "Valor inválido!", header: "GameToken" }

    if (Object.entries(result).length > 0) {
        context.res = {
            status: 400,
            body: result
        }
        context.done();
        return;
    }
}

/**
 * @param {Boolean} success Successefull request?
 * @param {Boolean} authorized Authorized Request?
 * @param {String} message Error message
 * @param {Object} data Data object
 * @param {Number} errors Array of error codes
 */
const createResponse = function (success, authorized, message, data, errorCode) {
    let response = {
        success: success,
        authorized: authorized,
        message: message,
        data: data,
        errors: createErrorObj(errorCode)
    }
    return response;
}

function createErrorObj(errorCode) {
    if (errorCode == null) return null;
    var errorMessage = errorCodes[errorCode];
    var errorObj = [{
        code: errorCode,
        message: errorMessage
    }];
    return errorObj;
}

const errorCodes = {
    1: "Esta chave de acesso é inválida. Por favor, verifique-a novamente. Se o erro persistir, entre em contato com a equipe de suporte",
    2: "É necessário o envio dos dados para realizar esta operação.",
    0: "Erro interno ao realizar a operação. Por favor, entre em contato com a equipe de suporte.",
    300: "O ID do registro é necessário para realizar esta consulta/atualização."
}

const sendWelcomeEmail = async function (fullname, username, userEmail) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_Server_Hostname,
        port: 587,
        auth: {
            user: process.env.SMTP_Server_Username,
            pass: process.env.SMTP_Server_Password
        }
    });
    return transporter.sendMail({
        from: process.env.SMTP_FromEmail,
        to: userEmail,
        subject: 'Bem-vindo(a) ao I BLUE IT Service!',
        text: 'Olá ' + fullname + ', sua conta I BLUE IT (' + username +
            ') foi cadastrada. Por segurança, nenhuma senha é enviada por e-mail. ' +
            'Use o procedimento de acesso ou redefinição disponibilizado pelo administrador.'
    });
}

exports.verifyGameToken = verifyGameToken;
exports.validateHeaders = validateHeaders;
exports.createResponse = createResponse;
exports.sendWelcomeEmail = sendWelcomeEmail;