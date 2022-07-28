/* Migration of Training Levels from ccga system to new system */
const fs = require('fs');
const mysql = require('mysql2/promise');
const syncrequest = require('sync-request');
const elasticsearch = require('elasticsearch');
const moment = require('moment');
const base64 = require('base-64');
const config = require('../../config');
let certificatesDict = JSON.parse(fs.readFileSync('training-certs-dict.json', 'utf8'));
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
    logFilePath: `training-course-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
    timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
};
const logger = SimpleNodeLogger.createSimpleLogger(opts);

console.log = logger.info;
console.warn = logger.warn;
console.error = logger.error;

const workflowApi =`https://api.ccga-stage.innovexa.cloud/workflow`;
function getBinarySize(string) {
    return Buffer.byteLength(string, 'utf8');
}

const elasticClient = new elasticsearch.Client({
    host: 'http://15.223.11.122:9200'
});
const databases = [
    // {
    //     name: 'ccgaca',
    //     regionId: 7
    // },
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
        `select * from sar_course_type`
    );


    // Get time type defs
    const resp = await elasticClient.search({
        index: 'timetype',
        body: {
            "query": {
                "bool": {
                    "must": [
                        {"match": {"regionId": d.regionId}}
                    ]
                }
            }
        },
        size: 100,
        from: 0,
    });

    const timeTypes = get(resp, 'hits.hits', []).map(data => ({
        ...get(data, "_source", {}),
        _id: get(data, '_id', null)
    }));
    const classroomSessionTimeType = timeTypes.find(t => t.name === "TimeType.Classroom");
    const simulatorSessionTimeType = timeTypes.find(t => t.name === "TimeType.SimulatorSessions");
    const exerciseTimeType = timeTypes.find(t => t.name === "TimeType.TrainingExercises");
    const timeTypeDefs = {
        classroomSessionTimeType,
        simulatorSessionTimeType,
        exerciseTimeType
    };

    const data = await Promise.all(rows.map(row => processEachRow(conn, row, d, timeTypeDefs)));

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

const processEachRow = async (conn, row, d, timeTypes) => {
    const { classroomSessionTimeType,
        simulatorSessionTimeType,
        exerciseTimeType } = timeTypes;
        const info = get(row, 'info');
        const regionId = d.regionId;
        const name = encodeUtf8(row.name);

        const active = row.active ? 'yes' : 'no';

        let {
            description,
            tagcolour,
            assets,
            timeOverride,
            sctid,
            signoff,
            instructions,
            classcount,
            traincount,
            simcount,
            classtime,
            traintime,
            simtime,
            othertime,
            insclasstime,
            instraintime,
            inssimtime,
            insothertime,
            assistclasstime,
            assisttraintime,
            assistsimtime,
            assistothertime,
            allowMultiple,
        } = regexCorrectDecode(row.info);





        const timeFields = ["name", "_id"];
        const selectedType = [{
            hours: classcount || "0" ,
            tType: pick(classroomSessionTimeType, timeFields)
        },
            {
                hours: traincount || "0" ,
                tType: pick(exerciseTimeType, timeFields)
            },
            {
                hours: simcount || "0",
                tType: pick(simulatorSessionTimeType, timeFields)
            }];

        const participation = {
            Assist: [
                {
                    hours: assistclasstime || "0",
                    tType: pick(classroomSessionTimeType, timeFields)
                },
                {
                    hours: assisttraintime || "0",
                    tType: pick(exerciseTimeType, timeFields)
                },
                {
                    hours: assistsimtime || "0",
                    tType: pick(simulatorSessionTimeType, timeFields)
                }],
            Attend: [
                {
                    hours: classtime || "0" ,
                    tType: pick(classroomSessionTimeType, timeFields)
                },
                {
                    hours: traintime || "0" ,
                    tType: pick(exerciseTimeType, timeFields)
                },
                {
                    hours: simtime || "0",
                    tType: pick(simulatorSessionTimeType, timeFields)
                }],
            Instruct: [
                {
                    hours: insclasstime || "0" ,
                    tType: pick(classroomSessionTimeType, timeFields)
                },
                {
                    hours: instraintime || "0" ,
                    tType: pick(exerciseTimeType, timeFields)
                },
                {
                    hours: inssimtime || "0" ,
                    tType: pick(simulatorSessionTimeType, timeFields)
                }]
        };
        const totalParticipation = participation;
        const timeCreditArr = {
            participation,
            totalParticipation,
            selectedType
        };

        const courseConfig = {
            "enableUnitAsset": true,
            "enableMultiAsset": true,
            "showAssetRate": true,
            "showAssetCoxwain": true,
            "enableMultiCoxwain":true,
            "showAssetLinkage": true,
            "showParticipationLinkage": true,
            "showAdditionalResources": true,
            "showTimeCreditResource": true,
            "enableTimeCreditAdj":true,
            "enableTimeCreditCopy":true,
            "showTimeCreditTotal": true,
            "showPassFailOpt": true,
            "hideClassStructure":false,
            "hideSessionCounts":false,
            timeCreditArr,
            courseStructure: {
                instruction: encodeUtf8(instructions)
            }
        };

        timeOverride = timeOverride ? 'allow' : 'prohibit';
        const multipleSubmission = allowMultiple ? 'allowed' : 'prohibited';
        let assocCertificates = [];
        let assocCertificate = get(certificatesDict, `${regionId}_${sctid}`, null);
        if (assocCertificate) {
            assocCertificates.push({ label: assocCertificate.name, value: assocCertificate._id});
        }


        const trainingCourseObj = {
                name,
                description: encodeUtf8(description),
                active,
                workflow: "Training",
                issueType: "Training",
                colorTag: tagcolour ? `#${tagcolour}` : null,
            assocCertificates,
                timeOverride,
                multipleSubmission,
                regionId,
                courseConfig,
                dateCreated: moment(),
                primaryRegionId: regionId,
                itemsAchieved:
                    [],
            }
        ;
        console.log(trainingCourseObj);

        return trainingCourseObj;
    }
;

const values = Promise.all(databases.map(d => migrate(d)));
values.then(resp => {
    let accum = resp.reduce((arr, values) => {
        return [...arr, ...values];
    }, []);

    const TRAINING_LEVEL_FORMNAME = 'trainingcourse';
    let i = 0;
    while (i < accum.length) {
        const item = accum[i];
        const resp = syncrequest(
            'POST',
            `${workflowApi}/forms/${TRAINING_LEVEL_FORMNAME}/submission`,
            {
                json: {data: item}
            }
        );
        i++;
    }
});
