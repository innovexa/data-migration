/* Migration of Training Levels from ccga system to new system */
const mysql = require('mysql2/promise');
const fs = require('fs');
const syncrequest = require('sync-request');
const elasticsearch = require('elasticsearch');
const moment = require('moment');
const base64 = require('base-64');
const config = require('../../config');
const request = require('request-promise');
const SimpleNodeLogger = require('simple-node-logger');
const DB_HOST = config.dbHost;
const unserialize = require('locutus/php/var/unserialize');
const {toInteger, isNil, isEmpty, get} = require('lodash');
const utf8 = require('utf8');
base64Unserialize = value => unserialize(base64.decode(value));
const encodeUtf8 = value => (!isNil(value) ? utf8.encode(value).trim() : null);
const data = [];
let typesDict = JSON.parse(fs.readFileSync('training-type-dict.json', 'utf8'));
let certificatesDict = JSON.parse(fs.readFileSync('training-certs-dict.json', 'utf8'));
let levelDict = JSON.parse(fs.readFileSync('training-level-dict.json', 'utf8'));

const DB_PORT = 3306;
const DB_USER = config.dbUser;
const DB_PWD = config.dbPassword;
const opts = {
    logFilePath: `training-item-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
    timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
};
const logger = SimpleNodeLogger.createSimpleLogger(opts);

console.log = logger.info;
console.warn = logger.warn;
console.error = logger.error;

const workflowApi ='https://api.ccga-stage.innovexa.cloud/workflow';
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
        host: '192.81.56.62',
        user: 'innovexa',
        password: 'inno@123!',
        database: d.name
    });
    const [rows, fields] = await conn.execute(
        `select  i.*, sc.id as signoff_cert , stl.id as signoff_level from sar_training_item i left join sar_cert sc on sc.id = i.so_scid left join sar_training_level stl on stl.id = i.so_stlid where i.stlid > 0`
    );
    // console.log(rows, fields);

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
        regex = /s:10:"evaluation";s:\d+:"([^"]*)";/g;
        match = regex.exec(decodedInfo);
        if (match && match.length > 1) {
            const countRegex = /s:10:"evaluation";s:\d+:/g;
            decodedInfo = decodedInfo.replace(
                countRegex,
                `s:10:"evaluation";s:${getBinarySize(match[1])}:`
            );
        }
        regex = /s:9:"knowledge";s:\d+:"([^"]*)";/g;
        match = regex.exec(decodedInfo);
        if (match && match.length > 1) {
            const countRegex = /s:9:"knowledge";s:\d+:/g;
            decodedInfo = decodedInfo.replace(
                countRegex,
                `s:9:"knowledge";s:${getBinarySize(match[1])}:`
            );
        }
        regex = /s:6:"skills";s:\d+:"([^"]*)";/g;
        match = regex.exec(decodedInfo);
        if (match && match.length > 1) {
            const countRegex = /s:6:"skills";s:\d+:/g;
            decodedInfo = decodedInfo.replace(
                countRegex,
                `s:6:"skills";s:${getBinarySize(match[1])}:`
            );
        }
        regex = /s:8:"attitude";s:\d+:"([^"]*)";/g;
        match = regex.exec(decodedInfo);
        if (match && match.length > 1) {
            const countRegex = /s:8:"attitude";s:\d+:/g;
            decodedInfo = decodedInfo.replace(
                countRegex,
                `s:8:"attitude";s:${getBinarySize(match[1])}:`
            );
        }
        const unserialized = unserialize(decodedInfo);
        return unserialized;
    } catch (err) {
        console.error('trying to correct data', err, info, base64.decode(info));
    }
};

const processEachRow = async (conn, row, d) => {
    const info = get(row, 'info');
    const regionId = d.regionId;
    const requiredSignoffCert = get(certificatesDict, `${regionId}_${row.signoff_cert}`, null);
    const name = encodeUtf8(row.name);
    const requiredSignoffLevel = get(levelDict, `${regionId}_${row.signoff_level}`, null);
    const refId = row.id;

    const active = row.active ? 'yes' : 'no';
    const optional = row.optional ? 'optional' : 'required';

    const {
        description,
        skills,
        knowledge,
        attitude,
        evaluation
    } = regexCorrectDecode(row.info);
    const trainingLevelId = row.stlid;
    let levelName;
    let levelSubmissionId;
        // const resp = await elasticClient.search({
        //     index: 'traininglevel',
        //     type: 'doc',
        //     body: JSON.stringify({
        //         query: {
        //             bool: {
        //                 must: [
        //                     {match: {regionId: regionId}},
        //                     {match: {refId: trainingLevelId}}
        //                 ]
        //             }
        //         }
        //     })
        // });
        //
        // const result = get(resp, 'hits.hits[0]._source', []);
        const trainingLevel = get(levelDict, `${regionId}_${row.stlid}`, null);
        levelName = get(trainingLevel, 'label', null);
        levelSubmissionId = get(trainingLevel, 'value', null);

    const [rows, fields] = await conn.query(
        'select itm.stiid as item_id , stt.* from sar_training_item_type_xref itm inner join sar_training_type stt on stt.id = itm.sttid  where  itm.stiid= ?',
        [row.id]
    );
    let relatedTrainingTypes = [];
    if (rows) {
        relatedTrainingTypes = rows.reduce((arr, r) => {
                const obj = get(typesDict, `${regionId}_${r.id}`, null)
                if (obj) {
                    return [...arr, obj]
                } else return arr;
            }
            , []);
    }
    const trainingItemObj = {
        name,
        trainingLevel,
        levelSubmissionId,
        relatedTrainingTypes,
        active,
        optional,
        levelName,
        description: encodeUtf8(description),
        skills: encodeUtf8(skills),
        knowledge: encodeUtf8(knowledge),
        attitude: encodeUtf8(attitude),
        evaluationCriteria: encodeUtf8(evaluation),
        regionId: d.regionId,
        primaryRegionId: d.regionId,
        requiredSignoffCert,
        requiredSignoffLevel,
        refId,
    };
    console.log(trainingItemObj);
    return trainingItemObj;
};

const values = Promise.all(databases.map(d => migrate(d)));
values.then(resp => {
    let accum = resp.reduce((arr, values) => {
        return [...arr, ...values];
    }, []);
    let i = 0;
    let submissionInfo = [];
    while (i < accum.length) {
        const item = accum[i];
        const TRAINING_LEVEL_FORMNAME = 'trainingitem';
        try{
            const resp = syncrequest(
                'POST',
                `${workflowApi}/forms/${TRAINING_LEVEL_FORMNAME}/submission`,
                {
                    json: {data: item}
                }
            );
            const submissionInformation = get(JSON.parse(resp.getBody('utf8')), 'data');
            submissionInfo.push(submissionInformation);
        }
        catch(e) {
            console.error(e, accum[i]);
        }
        i++;

    }
    const trainingItemDicts = submissionInfo.reduce((updateObj, si) => {
        return {...updateObj, [si.regionId + '_' + si.refId]: {value: si.id, label: utf8.encode(si.name).trim()}};
    }, {});



    fs.writeFile("training-item-dict.json", JSON.stringify(trainingItemDicts), 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing JSON Object to File.");
            return console.log(err);
        }
        console.log("JSON file has been saved.");
    });

});
