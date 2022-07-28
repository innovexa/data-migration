/* Migration of Training Levels from ccga system to new system */
const mysql = require('mysql2/promise');
const fs = require('fs');
const config = require('../../config');
const syncrequest = require('sync-request');
const elasticsearch = require('elasticsearch');
const moment = require('moment');
const base64 = require('base-64');
const request = require('request-promise');
const SimpleNodeLogger = require('simple-node-logger');
const DB_HOST = config.dbHost;
const unserialize = require('locutus/php/var/unserialize');

let unitsDict = JSON.parse(fs.readFileSync('units-dict.json', 'utf8'));
let usersDict = JSON.parse(fs.readFileSync('backup-users.json', 'utf8'));
let itemsDict = JSON.parse(fs.readFileSync('training-item-dict.json', 'utf8'));
const { get, isNil } = require('lodash');
const utf8 = require('utf8');
base64Unserialize = value => unserialize(base64.decode(value));
const encodeUtf8 = value => (!isNil(value) ? utf8.encode(value) : null);
const data = [];


var emailAlerts = require('email-alerts')({
    fromEmail: 'engineershen@gmail.com',
    toEmail: 'tony@innovexa.com',
    apiKey: config.sendGridApiKey,
    subject: 'Alert'
});
const DB_PORT = 3306;
const DB_USER = config.dbUser;
const DB_PWD = config.dbPassword;
const opts = {
    logFilePath: `training-item-log-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
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
    // {
    //     name: 'ccgap',
    //     regionId: 5
    // },
    //
    // {
    //     name: 'ccgaq',
    //     regionId: 4
    // },
    // {name: 'ccgam', regionId: 6},
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
        `select stl.*, sti.name as itemName , u.email as signoffEmail, u.id as uid, sp.id as signoffPersonId 
        from sar_training_log stl inner join sar_training_item sti on sti.id = stl.stiid 
        inner join sar_person sp on sp.id = stl.spid inner join users 
        u on u.id = sp.uid where stl.stiid> 0 order by sti.name asc`
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
        const refId = row.id;

        const item = get(itemsDict, `${d.regionId}_${row.stiid}`);
    // const trainingItems = isNil(item) ? [] : [{id: item.value, name: item.label}];

        let {
            uid: userId,
            name : userName
        } = regexCorrectDecode(row.info);

    const {
        cdate: trainingStartDate,
        signoffEmail,
        itemName: name,
        id: archiveId
    } = row;
    const [rows, fields] = await conn.execute(
        `select id, email from users where id = ?`, [userId]
        );
    const userObj = get(rows, '[0].email' ) ? usersDict[get(rows, '[0].email' )] : null;
    const createdByUserObj = usersDict[signoffEmail];
    const user = !isNil(userObj) ? userObj : null;
    const givenName = get(user, 'givenName');
    const lastName = get(user, 'lastName');
    const givenLast = givenName && lastName ? `${givenName} ${lastName}` : null;
    const unit = get(unitsDict, get(user, 'primarySquadron'));
    const unitId = get(unit, 'squadronId');
    const unitName =  get(unit, 'nameEN');
    const regionName = get(unit, 'regionNameEN');
    const zoneId = get(unit, 'districtId');
    const zoneName = get(unit, 'districtNameEN');


    const createdBy = !isNil(createdByUserObj) ? createdByUserObj._id : null;
    const trainingFormType = "trainingitem";

    const active = row.active ? 'yes' : 'no';
    let trainingObj = null;
    if(item.value && item.label &&  user && unit) {
        trainingObj = {
            name: encodeUtf8(name),
            trainingStartDate: moment(trainingStartDate).isValid() ? moment(trainingStartDate).toISOString() : null,
            archiveId,
            trainingItemsName: item.label,
            trainingItemsId: item.value,
            user: get(user, '_id', null),
            userName: givenLast,
            regionId,
            regionName,
            unitId,
            unitName,
            zoneId,
            zoneName,
            createdBy,
            archived: true,
            trainingFormType,
            submissionId: "0",
            closed: true,
            logType: 'trainingItem'
        };
    }
    return trainingObj;

    }
;

const values = Promise.all(databases.map(d => migrate(d)));
values.then(resp => {
    let accum = resp.reduce((arr, values) => {
        return [...arr, ...values.filter(v => !isNil(v))];
    }, []);

    let i = 0;
        while (i < accum.length) {
            const item = accum[i];
            if(item.user) {
                const resp = syncrequest(
                    'POST',
                    `${config.idcUserApi}/training/log`,
                    {
                        json: item
                    }
                );

            }
            else{
                console.error(item);
            }
            i++;
        }

    emailAlerts.alert('task is done', 'Training Items Log Migration is Done');
    process.exit();
});
