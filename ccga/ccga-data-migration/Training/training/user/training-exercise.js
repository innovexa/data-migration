/* Migration of Training Levels from ccga system to new system */
const mysql = require('mysql2/promise');
const syncrequest = require('sync-request');
const elasticsearch = require('elasticsearch');
const moment = require('moment');
const base64 = require('base-64');
const request = require('request-promise');
const SimpleNodeLogger = require('simple-node-logger');
const DB_HOST = '192.81.56.62';
const unserialize = require('locutus/php/var/unserialize');
const {toInteger, isNil, isEmpty, get} = require('lodash');
const utf8 = require('utf8');
base64Unserialize = value => unserialize(base64.decode(value));
const encodeUtf8 = value => (!isNil(value) ? utf8.encode(value) : null);
const data = [];

const DB_PORT = 3306;
const DB_USER = 'innovexa';
const DB_PWD = 'inno@123!';
const opts = {
    logFilePath: `training-exercise-user-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
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
    host: 'http://ccga-dev.innovexa.com:5200'
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
    {name: 'ccgam', regionId: 6},
    {
        name: 'ccgaca',
        regionId: 7
    }
];

const migrate = async d => {
    const conn = await mysql.createConnection({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PWD,
        database: d.name
    });
    const [rows, fields] = await conn.execute(
        `select * from sar_training;
`
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

         regex = /s:7:"weather";s:\d+:"([^"]*)";/g;

         match = regex.exec(decodedInfo);
        if (match && match.length > 1) {
            const countRegex = /s:7:"weather";s:\d+:/g;
            decodedInfo = decodedInfo.replace(
                countRegex,
                `s:7:"weather";s:${getBinarySize(match[1])}:`
            );
        }
        regex = /s:10:"instructor";s:\d+:"([^"]*)";/g;

        match = regex.exec(decodedInfo);
        if (match && match.length > 1) {
            const countRegex = /s:10:"instructor";s:\d+:/g;
            decodedInfo = decodedInfo.replace(
                countRegex,
                `s:10:"instructor";s:${getBinarySize(match[1])}:`
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
            winddir,
            windspeed,
            seas,
            description
        } = regexCorrectDecode(row.info);

        // Get all related training types
    const [rows, fields] = await conn.execute(
        `select stt.*, stref.stid from sar_training_type_xref stref inner join  sar_training_type stt on stref.sttid = stt.id where stref.stid = ? `, [row.id]
    );


    // const [rows, fields] = await conn.execute(
    //     `select stt.*, stref.stid from sar_training_type_xref stref inner join  sar_training_type stt on stref.sttid = stt.id where stref.stid = ? `, [row.id]
    // );



    const trainingObj = {
            name,
        winddir,
        windspeed,
        seas,
            refId,
            description: encodeUtf8(description),
            active,
            regionId
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
    const TRAINING_FORMNAME = 'trainingexercise';
    let i = 0;
    // while (i < accum.length) {
    //     const item = accum[i];
    //     syncrequest(
    //         'POST',
    //         `https://api.ccga-dev.innovexa.com/workflow/forms/${TRAINING_FORMNAME}/submission`,
    //         {
    //             json: {data: item}
    //         }
    //     );
    //     i++;
    // }
});
