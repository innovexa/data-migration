const config = require('../config');
const { getFileLogger } = require('../common/logger');
console.log('roles seed test');

console.log(config.dbHost);
console.log(config.dbUser);

const log = getFileLogger('RolesSeed');

log.error('Hi');
