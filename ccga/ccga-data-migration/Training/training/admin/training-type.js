/* Migration of Training Levels from ccga system to new system */
const mysql = require('mysql2/promise');
const fs = require('fs');
const syncrequest = require('sync-request');
const elasticsearch = require('elasticsearch');
const moment = require('moment');
const base64 = require('base-64');
const request = require('request-promise');
const config = require('../../config');
const SimpleNodeLogger = require('simple-node-logger');
const DB_HOST = config.dbHost;
const unserialize = require('locutus/php/var/unserialize');
const { toInteger, isNil, isEmpty, get } = require('lodash');
const utf8 = require('utf8');
base64Unserialize = value => unserialize(base64.decode(value));
const encodeUtf8 = value => (!isNil(value) ? utf8.encode(value) : null);
const data = [];

const DB_PORT = 3306;
const DB_USER = config.dbUser;
const DB_PWD = config.dbPassword;
const opts = {
    logFilePath: `training-type-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
    timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
};
const logger = SimpleNodeLogger.createSimpleLogger(opts);

console.log = logger.info;
console.warn = logger.warn;
console.error = logger.error;

const idcUserApi = 'https://api.ccga-dev.innovexa.cloud/idc-user-api';
function getBinarySize(string) {
    return Buffer.byteLength(string, 'utf8');
}

const elasticClient = new elasticsearch.Client({
    host: config.elasticUrl
});
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
    // const conn = await mysql.createConnection({
    //     host: DB_HOST,
    //     user: DB_USER,
    //     password: DB_PWD,
    //     database: d.name
    // });
    const conn = await mysql.createConnection({
        host: '192.81.56.62',
        user: 'innovexa',
        password: 'inno@123!',
        database: d.name
    });
    const [rows, fields] = await conn.execute(
        `select * from sar_training_type`
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

    const active = row.active ? 'yes' : 'no';
    let {
        description
    } = regexCorrectDecode(row.info);

    const trainingObj = {
        name,
        description: encodeUtf8(description),
        active,
        regionId,
        refId
    };

    console.log(trainingObj);
    return trainingObj;
}
    ;

const values = Promise.all(databases.map(d => migrate(d)));
values.then(resp => {
    let accum = resp.reduce((arr, values) => {
        return [...arr, ...values];
    }, []);

    let i = 0;
    let submissionInfo = [];
    while (i < accum.length) {
        const item = accum[i];
        const resp = syncrequest(
            'POST',
            `${idcUserApi}/training/type`,
            {
                json: item
            }
        );
        i++;
        const submissionInformation = get(JSON.parse(resp.getBody('utf8')), 'data');
        submissionInfo.push(submissionInformation);
        i++;
    }


    const trainingTypesDict = submissionInfo.reduce((updateObj, si) => {
        return { ...updateObj, [si.regionId + '_' + si.refId]: { value: si.id, label: encodeUtf8(si.name).trim() } };
    }, {});
    fs.writeFile("training-type-dict.json", JSON.stringify(trainingTypesDict), 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing JSON Object to File.");
            return console.log(err);
        }

        console.log("JSON file has been saved.");
    });
});




