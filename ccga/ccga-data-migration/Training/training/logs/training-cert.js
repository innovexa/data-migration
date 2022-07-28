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
const {get, isNil} = require('lodash');
var emailAlerts = require('email-alerts')({
    fromEmail: 'engineershen@gmail.com',
    toEmail: 'tony@innovexa.com',
    apiKey: config.sendGridApiKey,
    subject: 'Alert'
});

let usersDict = JSON.parse(fs.readFileSync('backup-users.json', 'utf8'));
let unitsDict = JSON.parse(fs.readFileSync('units-dict.json', 'utf8'));
const utf8 = require('utf8');
const base64Unserialize = value => unserialize(base64.decode(value));
const encodeUtf8 = value => (!isNil(value) ? utf8.encode(value) : null);
const data = [];

const DB_PORT = 3306;
const DB_USER = config.dbUser;
const DB_PWD = config.dbPassword;
const opts = {
    logFilePath: `training-cert-log-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
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
        ` select sc.*, sct.name, u.id as userId , u.email as userEmail, cu.id as createdById,
        cu.id, cu.email as createdByEmail from sar_cert sc left join sar_person sp on sc.spid
        = sp.id inner join users u on sp.uid = u.\`id\` left join users cu on sc.uid = cu.id 
        inner join sar_cert_type sct on sct.id = sc.sctid where sc.closed =1 `);

    const data = await Promise.all(rows.filter(r => r.closed===1).map(row => processEachRow(conn, row, d)));
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
        const {
            cdate: trainingStartDate,
            userEmail,
            mdate: dateModified,
            createdByEmail,
            edate: expiryDate,
            id: archiveId
        } = row;

        const userObj = usersDict[userEmail];
        const createdByUserObj = usersDict[createdByEmail];
        const user = userObj;
        const createdBy = !isNil(createdByUserObj) ? createdByUserObj._id : null;
    const trainingFormType = "trainingcertification";
    const givenName = get(user, 'givenName');
    const lastName = get(user, 'lastName');
    const givenLast = givenName && lastName ? `${givenName} ${lastName}` : null;
    const unit = get(unitsDict, get(user, 'primarySquadron'));
    const unitId = get(unit, 'squadronId');
    const unitName =  get(unit, 'nameEN');
    const regionName = get(unit, 'regionNameEN');
    const zoneId = get(unit, 'districtId');
    const zoneName = get(unit, 'districtNameEN');
        const active = row.active ? 'yes' : 'no';
        let {
            description
        } = regexCorrectDecode(row.info);
        const trainingObj = {
            name,
            trainingStartDate: moment(trainingStartDate).isValid() ? moment(trainingStartDate).toISOString() : null,
            expiryDate: moment(expiryDate).isValid() ? moment(expiryDate).toISOString() : null,
            archiveId,
            user: get(user, '_id'),
            createdBy,
            archived: true,
            trainingFormType,
            description: encodeUtf8(description),
            submissionId: "0",
            unitId,
            unitName,
            regionName,
            regionId,
            zoneId,
            zoneName,
            userName: givenLast,
            logType: 'submission',
            closed: true
        };
        if (moment(dateModified).isValid()) {
            trainingObj.dateModified = moment(dateModified).toISOString();
        }

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
        if (item.user) {
            const resp = syncrequest(
                'POST',
                `${config.idcUserApi}/training/log`,
                {
                    json: item
                }
            );
            console.log(i, resp);
        }
        i++;
    }
    emailAlerts.alert('task is done', 'Training Cert Log Migration is Done');
    process.exit();


});


