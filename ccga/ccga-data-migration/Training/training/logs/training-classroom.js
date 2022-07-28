/* Migration of Training Levels from ccga system to new system */
const mysql = require('mysql2/promise');
const fs = require('fs');
const syncrequest = require('sync-request');
const elasticsearch = require('elasticsearch');
const config = require('../../config');
const moment = require('moment');
const base64 = require('base-64');
const request = require('request-promise');
const SimpleNodeLogger = require('simple-node-logger');
const DB_HOST = config.dbHost;
const unserialize = require('locutus/php/var/unserialize');
const {get, isNil} = require('lodash');
const utf8 = require('utf8');
const base64Unserialize = value => unserialize(base64.decode(value));
const encodeUtf8 = value => (!isNil(value) ? utf8.encode(value) : null);
let usersDict = JSON.parse(fs.readFileSync('backup-users.json', 'utf8'));
let unitsDict = JSON.parse(fs.readFileSync('units-dict.json', 'utf8'));
let trainingTypeDict = JSON.parse(fs.readFileSync('training-type-dict.json', 'utf8'));
var emailAlerts = require('email-alerts')({
    fromEmail: 'engineershen@gmail.com',
    toEmail: 'tony@innovexa.com',
    apiKey: config.sendGridApiKey,
    subject: 'Alert'
});
const data = [];

const statusPersonTypeMap = {0: 'Attend', 1: 'Attend', 2: 'Auditing', 11: 'Assist', 12: 'Instruct'};


const DB_PORT = 3306;
const DB_USER = config.dbUser;
const DB_PWD = config.dbPassword;
const opts = {
    logFilePath: `training-course-log-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
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
            `select * from sar_classroom   where  closed = 1`
    );


    let data = await Promise.all(rows.map(row => processEachRow(conn, row, d)));
    data = data.reduce((arr, row) => [...arr, ...row], []);
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
        const name = encodeUtf8(row.type_name);
        const refId = row.id;
        const refNumber = row.number;
        const {
            fdate: trainingStartDate,
            tdate: trainingEndDate,
            mdate: dateModified,
            id: archiveId
        } = row;

        const trainingFormType = "trainingclassroom";
        const [rows, fields] = await conn.query(
            'select u.email, u.id FROM sar_classroom_person_xref scp inner join sar_person sp on sp.id = scp.spid inner join `users` u on u.id = sp.uid where scp.scid = ?',
            [row.id]
        );

        const [trainingTypeRows, _] = await conn.query(
            'select sttid FROM sar_classroom_type_xref  where scid=?',
            [row.id]
        );
        const category = trainingTypeRows.reduce((accum, tt) => {
            const id = tt.sttid;

            const typeKey = `${regionId}_${id}`;
            const trainingType = trainingTypeDict[typeKey];
            if (trainingType && trainingType._id) {
                return [...accum, {label: trainingType.name, value: trainingType._id}]
            }
            return accum
        }, []);


        const trainingObj = {
            name,
            trainingStartDate: moment(trainingStartDate).isValid() ? moment(trainingStartDate).toISOString() : null,
            trainingEndDate: moment(trainingEndDate).isValid() ? moment(trainingEndDate).toISOString() : null,
            archiveId,
            archived: true,
            trainingFormType,
            submissionId: "0",
            closed: true,
            category,
            refNumber,

        };
        if (moment(dateModified).isValid()) {
            trainingObj.dateModified = moment(dateModified).toISOString();
        }
        // const trainingCourseObjs = rows.reduce((arr, r) => {
        //     const user = get(usersDict, r.email, null);
        //     const status = get(r, 'status', null);
        //
        //     const personType = get(statusPersonTypeMap, status, 'Attend');
        //     let classTime = 0;
        //     let simTime = 0;
        //     let trainTime = 0;
        //     switch (personType) {
        //         case 'Assist':
        //             trainTime = row.assisttraintime;
        //             classTime = row.assistclasstime;
        //             simTime = row.assistsimtime;
        //             break;
        //         case 'Instruct':
        //             trainTime = row.instraintime;
        //             classTime = row.insclasstime;
        //             simTime = row.inssimtime;
        //             break;
        //         case 'Auditing':
        //         case 'Attend':
        //         default:
        //             trainTime = row.traintime;
        //             classTime = row.classtime;
        //             simTime = row.simtime;
        //             break;
        //     }
        //     const timeCredit = [
        //         {
        //             timeType: 'TimeType.Classroom',
        //             value: classTime || 0
        //         },
        //         {
        //             timeType: 'TimeType.SimulatorSessions',
        //             value: simTime || 0
        //         },
        //         {
        //             timeType: 'TimeType.TrainingExercises',
        //             value: trainTime || 0
        //         },
        //     ];
        //
        //     if (user) {
        //         const givenName = get(user, 'givenName');
        //         const lastName = get(user, 'lastName');
        //         const givenLast = givenName && lastName ? `${givenName} ${lastName}` : null;
        //         const unit = get(unitsDict, get(user, 'primarySquadron'));
        //         const unitId = get(unit, 'squadronId');
        //         const unitName = get(unit, 'nameEN');
        //         const regionName = get(unit, 'regionNameEN');
        //         const zoneId = get(unit, 'districtId');
        //         const zoneName = get(unit, 'districtNameEN');
        //         const userInfo = {
        //             user: get(user, '_id'),
        //             userName: givenLast,
        //             unitId,
        //             unitName,
        //             regionName,
        //             zoneId,
        //             zoneName,
        //         };
        //         const commonInfo = {...trainingObj, ...userInfo, personType};
        //         const newArr = [{
        //             ...commonInfo, simulatorCount: row.simcount || 0,
        //             exerciseCount: row.traincount || 0,
        //             classroomCount: row.classcount || 0, logType: 'submission'
        //         },
        //             {
        //                 ...commonInfo,
        //                 logType: 'timeCredit',
        //                 timeCreditType: 'TimeType.Classroom',
        //                 timeCreditValue: classTime || 0,
        //                 'TimeType.Classroom': classTime || 0
        //             },
        //             {
        //                 ...commonInfo,
        //                 logType: 'timeCredit',
        //                 timeCreditType: 'TimeType.SimulatorSessions',
        //                 timeCreditValue: simTime || 0,
        //                 'TimeType.SimulatorSessions': simTime || 0
        //             },
        //             {
        //                 ...commonInfo,
        //                 logType: 'timeCredit',
        //                 timeCreditType: 'TimeType.TrainingExercises',
        //                 timeCreditValue: trainTime || 0,
        //                 'TimeType.TrainingExercises': trainTime || 0
        //             }
        //         ];
        //         return [...arr,
        //             ...newArr];
        //     } else {
        //         return arr;
        //     }
        // }, []) || [];


        return trainingCourseObjs;
    }
;

const values = Promise.all(databases.map(d => migrate(d)));
values.then(resp => {
    let accum = resp.reduce((arr, values) => {
        return [...arr, ...values];
    }, []);

    let i = 0;
    // while (i < accum.length) {
    //     const item = accum[i];
    //     if (item.user) {
    //         const resp = syncrequest(
    //             'POST',
    //             `${config.idcUserApi}/training/log`,
    //             {
    //                 json: item
    //             }
    //         );
    //         console.log(i, resp);
    //     }
    //     i++;
    // }

    emailAlerts.alert('task is done', 'Training Course Log Migration is Done');
    process.exit();


});
