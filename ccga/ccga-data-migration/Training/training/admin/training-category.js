/* Migration of Training Levels from ccga system to new system */
const mysql = require('mysql2/promise');
const config = require('../../config');
const syncrequest = require('sync-request');
const elasticsearch = require('elasticsearch');
const moment = require('moment');
const base64 = require('base-64');
const request = require('request-promise');
const SimpleNodeLogger = require('simple-node-logger');
const DB_HOST = config.dbHost;
const unserialize = require('locutus/php/var/unserialize');
const { toInteger, isNil, isEmpty, get } = require('lodash');
const utf8 = require('utf8');
const base64Unserialize = value => unserialize(base64.decode(value));

const encodeUtf8 = value => (!isNil(value) ? utf8.encode(value) : null);
const data = [];

const DB_PORT = 3306;
const DB_USER = config.dbUser;
const DB_PWD = config.dbPassword;
// const opts = {
//     logFilePath: `training-category-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
//     timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
// };
// const logger = SimpleNodeLogger.createSimpleLogger(opts);

// console.log = logger.info;
// console.warn = logger.warn;
// console.error = logger.error;

function getBinarySize(string) {
    return Buffer.byteLength(string, 'utf8');
}

const elasticClient = new elasticsearch.Client({
    host: 'http://15.223.11.122:9200'
});
const user_api = `https://api.ccga-dev.innovexa.cloud/idc-user-api`;
const databases = [
    {
        name: 'ccgap',
        regionId: 5
    },
    {
        name: 'ccgaq',
        regionId: 4
    },
    { name: 'ccgam', regionId: 6 },
    {
        name: 'ccgaca',
        regionId: 7
    }
];

const migrate = async d => {
    const conn = await mysql.createConnection({
        host: '192.81.56.62',
        user: 'innovexa',
        password: 'inno@123!',
        database: d.name
    });
    const [rows, fields] = await conn.execute(
        `select * from sar_training_category`
    );

    const data = await Promise.all(rows.map(row => processEachRow(conn, row, d)));

    return data;
};

function getBinarySize(string) {
    return Buffer.byteLength(string, 'utf8');
}

const regexCorrectDecode = info => {
    try {
        let decodedInfo = base64.decode(info);
        let regex = /s:11:"description";s:\d+:"([^"]*)";/g;

        let match = regex.exec(decodedInfo);
        if (match && match.length > 1) {
            const countRegex = /s:11:"description";s:\d+:/g;
            decodedInfo = decodedInfo.replace(
                countRegex,
                `s:11:"description";s:${getBinarySize(match[1])}:`
            );
        }
        const unserialized = unserialize(decodedInfo);
        return unserialized;
    } catch (err) {
        console.error('trying to correct data', err, info, base64.decode(info));
    }
};
const processEachRow = async (conn, row, d) => {
    const regionId = d.regionId;
    const name = encodeUtf8(row.name);
    const refId = row.id;
    //
    // let {
    //     description
    // } = regexCorrectDecode(row.info);

    const trainingObj = {
        name,
        // description: encodeUtf8(description),
        regionId,
        refId,
        status: "Active"
    };
    return trainingObj;
}
    ;

const values = Promise.all(databases.map(d => migrate(d)));
values.then(resp => {
    let accum = resp.reduce((arr, values) => {
        return [...arr, ...values];
    }, []);

    let i = 0;
    while (i < accum.length) {
        const item = accum[i];
        const resp = syncrequest(
            'POST',
            `${user_api}/training/category`,
            {
                json: item
            }
        );
        i++;
    }

    console.log('done', accum.length);

});
