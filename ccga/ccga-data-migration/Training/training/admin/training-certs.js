/* Migration of Training Levels from ccga system to new system */
const mysql = require('mysql2/promise');
const syncrequest = require('sync-request');
const fs = require('fs');
const shortid = require('shortid');
// const config = require('../../config');

const config = {
    workflowApi: `https://api.ccga-stage.innovexa.cloud/workflow`,
    dbHost: 'localhost',
    dbUser: 'root',
    dbPassword: 'password',
    elasticUrl: 'https://vpc-ccga-elastic-7u5oztsvajkmnnihtmj5abbr7m.ca-central-1.es.amazonaws.com/'
}
const elasticsearch = require('elasticsearch');
const moment = require('moment');
const base64 = require('base-64');
const request = require('request-promise');
const SimpleNodeLogger = require('simple-node-logger');
const DB_HOST = '92.81.56.62';
const unserialize = require('locutus/php/var/unserialize');
const {toInteger, isNil, isEmpty, get} = require('lodash');
const utf8 = require('utf8');
const base64Unserialize = value => unserialize(base64.decode(value));
const encodeUtf8 = value => (!isNil(value) ? utf8.encode(value) : null);
const data = [];
const submissionsMap = {};
const TRAINING_LEVEL_FORMNAME = 'trainingcertification';


// const opts = {
//     logFilePath: `training-cert-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
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
    host: config.elasticUrl
});
const databases = [
    {name: 'pacific', regionId: 23},
    {name: 'ccga q', regionId: 22},
    {name: 'maritimes', regionId: 24},
    {name: 'central_arctic', regionId: 25}
];

const migrate = async d => {
    // const conn = await mysql.createConnection({
    //     host: DB_HOST,
    //     user: DB_USER,
    //     password: DB_PWD,
    //     database: d.name
    // });
    try {
        const conn = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'password',
            database: d.name
        });
        const [rows, fields] = await conn.execute(
                `select * from sar_cert_type`
        );

        console.log(rows, '----**----');
        const data = await Promise.all(rows.map(row => processEachRow(conn, row, d)));
        // const data = {}
        return data;
    } catch (ex) {
        console.log(ex, '----**----');
    }
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
        regex = /s:12:"instructions";s:\d+:"([^"]*)";/g;
        match = regex.exec(decodedInfo);
        if (match && match.length > 1) {
            const countRegex = /s:12:"instructions";s:\d+:/g;
            decodedInfo = decodedInfo.replace(
                countRegex,
                `s:12:"instructions";s:${getBinarySize(match[1])}:`
            );
        }
        const unserialized = unserialize(decodedInfo);
        return unserialized;
    } catch (err) {
        console.error('trying to correct data', err, info, base64.decode(info));
    }
};

const capitalizeFirstLetter = (lower) => {
    return lower.charAt(0).toUpperCase() + lower.substring(1);
};

const processEachRow = async (conn, row, d) => {
        const info = get(row, 'info');
        const regionId = d.regionId;
        const refId = row.id;
        const expires = row.expires;


        const name = encodeUtf8(row.name);
        const active = row.active ? 'yes' : 'no';
        const required = row.required ? 'yes' : 'no';
        let {
            description,
            agency,
            tagcolour,
            exp_duration,
            exp_metric,
            notify,
            instructions

        } = regexCorrectDecode(row.info);


        const [rows, fields] = await conn.query(
            'select sc.* from sar_cert_type_xref scx inner join sar_cert_type sc on sc.id = scx.rsctid where sctid = ?',
            [row.id]
        );
        let certRefIds = rows.map(r => r.id);


        const trainingCertObj = {
                name,
                certRefIds,
                refId,
                designationAssociation: {
                    issueAgency: encodeUtf8(agency),
                    numberOption: required
                },

                description: encodeUtf8(description),

                active,
                instructions: encodeUtf8(instructions),
                colorTag: tagcolour ? `#${tagcolour}` : null,
                regionId,
                primaryRegionId: regionId,
                required,
                expires
            }
        ;

        if (expires == 2 && !isEmpty(exp_duration) && !isEmpty(exp_metric))
            trainingCertObj['notificationAlert'] = {
                "isEnableExpiry": false,
                "isEnableAlert": false,
                "isEnableRole": false,
                "isEnablePersonnel": false,
                "hideConfiguration": true,
                "isEnableSpecific": true,
                "specifyDuration": {
                    "number": exp_duration,
                    "tag": capitalizeFirstLetter(exp_metric),
                    "flatValue": `${exp_duration} ${capitalizeFirstLetter(exp_metric)}`
                }
            };
        console.log(trainingCertObj);
        return trainingCertObj;
    }
;


const values = Promise.all(databases.map(d => migrate(d)));
values.then(resp => {
    let accum = resp.reduce((arr, values) => {
        return [...arr, ...values];
    }, []);
    let submissionInfo = [];


    let i = 0;
    while (i < accum.length) {
        const item = accum[i];
        try {
            const resp = syncrequest(
                'POST',
                `${config.workflowApi}/forms/${TRAINING_LEVEL_FORMNAME}/submission`,
                {
                    json: {data: item}
                }
            );
            const submissionInformation = get(JSON.parse(resp.getBody('utf8')), 'data');
            submissionInfo.push(submissionInformation);
        } catch (e) {
            console.error(item, e);
        }

        i++;
    }

    const trainingCertDicts = submissionInfo.reduce((updateObj, si) => {
        return {...updateObj, [si.regionId + '_' + si.refId]: {value: si.id, label: si.name}};
    }, {});
    fs.writeFile("training-certs.json", JSON.stringify(submissionInfo), 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing JSON Object to File.");
            return console.log(err);
        }

        console.log("JSON file has been saved.");
    });


    fs.writeFile("training-certs-dict.json", JSON.stringify(trainingCertDicts), 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing JSON Object to File.");
            return console.log(err);
        }

        console.log("JSON file has been saved.");
    });

    submissionInfo.forEach(si => {
        const rId = si.regionId;
        const assocCertificates = si.certRefIds.reduce((array, cid) => {
                const key = `${rId}_${cid}`;
                const obj = trainingCertDicts[key];
                if (obj) {
                    return [...array, obj];
                } else {
                    return array;
                }
            }
            , []);
        elasticClient
            .update({
                id: si.id,
                index: TRAINING_LEVEL_FORMNAME,
                body: {doc: {assocCertificates}, doc_as_upsert: true},
                type: 'doc'
            })
            .catch(e => {
                console.log(e);
                return next(e);
            });
    })

});


