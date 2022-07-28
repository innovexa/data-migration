const fs = require('fs');
const mysql = require('mysql2/promise');
const syncrequest = require('sync-request');
const elasticsearch = require('elasticsearch');
const moment = require('moment');
const base64 = require('base-64');
const config = require('./config');
let milestoneDict = JSON.parse(fs.readFileSync('milestone.json', 'utf8'));
let usersDict = JSON.parse(fs.readFileSync('backup-users.json', 'utf8'));
const request = require('request-promise');
const SimpleNodeLogger = require('simple-node-logger');
const DB_HOST =  config.dbHost;
const unserialize = require('locutus/php/var/unserialize');
const {toInteger, isNil, isEmpty, get, pick} = require('lodash');
const utf8 = require('utf8');
base64Unserialize = value => unserialize(base64.decode(value));
const encodeUtf8 = value => (!isNil(value) ? utf8.encode(value) : null);

const data = [];

const DB_PORT = 3306;
const DB_USER =  config.dbUser;
const DB_PWD = config.dbPassword;
const opts = {
    logFilePath: `roles-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
    timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
};
const logger = SimpleNodeLogger.createSimpleLogger(opts);

console.log = logger.info;
console.warn = logger.warn;
console.error = logger.error;

function getBinarySize(string) {
    return Buffer.byteLength(string, 'utf8');
}

const elasticClient = new elasticsearch.Client({
    host: config.elasticUrl
});
const databases = [
    {
        name: 'ccgaca',
        regionId: 7
    },
    {
        name: 'ccgap',
        regionId: 5
    },
    {
        name: 'ccgaq',
        regionId: 4
    },
    {name: 'ccgam', regionId: 6},

];

const migrate = async d => {
    const conn = await mysql.createConnection({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PWD,
        database: d.name
    });
    const [rows, fields] = await conn.execute(
        `select name from sar_person_position`
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
        //get rid of lang
        decodedInfo = decodedInfo.replace(/s:4:"lang";a:\d+:{.+/g, 's:1:"a";s:0:"";}');


        let regex = /s:11:"description";s:\d+:"([^"]*)";/g;

        let match = regex.exec(decodedInfo);
        if (match && match.length > 1) {
            const countRegex = /s:11:"description";s:\d+:/g;
            decodedInfo = decodedInfo.replace(
                countRegex,
                `s:11:"description";s:${getBinarySize(match[1])}:`
            );
        }
        regex = /s:4:"name";s:\d+:"([^"]*)";/g;
        match = regex.exec(decodedInfo);
        if (match && match.length > 1) {
            const countRegex = /s:4:"name";s:\d+:/g;
            decodedInfo = decodedInfo.replace(
                countRegex,
                `s:4:"name";s:${getBinarySize(match[1])}:`
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

        const name = row.name;

        // const active = row.active ? 'yes' : 'no';



        return { regionId, name }
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
                `${config.authApi}/v3/permissions/createRole`,
                {
                    json: item,
                    retry: true,
                    retryDelay: 200,
                    maxRetries: 5

                },
            );
            console.log(resp);


        i++;
    }
    process.exit();
});

