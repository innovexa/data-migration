const {format  } = require('date-fns');
const config = require('../config');
const SimpleNodeLogger = require('simple-node-logger');
module.exports = {
    getFileLogger: (name, logPath = 'logs') => {
        const date = format(new Date(), config.logDateFormat);
        const opts = {
            logFilePath: `${logPath}/${name}-${date}.log`,
        };
        return SimpleNodeLogger.createSimpleFileLogger(opts);
    }
};


