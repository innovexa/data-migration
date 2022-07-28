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
const {toInteger, isNil, isEmpty, get} = require('lodash');
const utf8 = require('utf8');
base64Unserialize = value => unserialize(base64.decode(value));
const milestoneObjectDict = JSON.parse(fs.readFileSync('milestone-object.json', 'utf8'));
const milestonePropertyDict = JSON.parse(fs.readFileSync('milestone-property.json', 'utf8'));
const encodeUtf8 = value => (!isNil(value) ? utf8.encode(value) : null);
const data = [];

const DB_PORT = 3306;
const DB_USER = config.dbUser;
const DB_PWD = config.dbPassword;
const opts = {
    logFilePath: `training-milestone-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
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
        `select * from sar_milestone_type`
    );


    const data = await Promise.all(rows.map(row => processEachRow(conn, row, d)));

    return data;
};

function getBinarySize(string) {
    return Buffer.byteLength(string, 'utf8');
}

const correctData = (header, data) => {
    const length = header.length;
    let regex = new RegExp(`s:${length}:"${header}";s:\\d+:"([^"]*)";`, 'g');
    let match = regex.exec(data);
    const noncapturing = match.filter((s, index) => index % 2 === 0);
    const capturing = match.filter((s, index) => index % 2 === 1)
    if (noncapturing && noncapturing.length >= 1) {
        //`s:${length}:"${header}";s:${getBinarySize(match[1])}:`
        capturing.forEach((m, matchIndex) => {
            const countRegex = new RegExp(`s:${length}:"${header}";s:\\d+:`, 'g');
            var counter = 0;
            data = data.replace(
                countRegex,
                function (matched, i, original) {
                    let returnValue;
                    if (counter === matchIndex) {
                        returnValue = `s:${length}:"${header}";s:${getBinarySize(capturing[counter])}:`
                    } else {
                        returnValue = matched;
                    }
                    counter++;
                    return returnValue;

                }
            );
        });


    }
    return data;

};

const regexCorrectDecode = info => {
    try {
        let decodedInfo = base64.decode(info);
        decodedInfo = correctData('message', decodedInfo);

        decodedInfo = correctData('description', decodedInfo);
        decodedInfo = correctData('from_name', decodedInfo);
        // let match = regex.exec(decodedInfo);
        // if (match && match.length > 1) {
        //     const countRegex = /s:11:"description";s:\d+:/g;
        //     decodedInfo = decodedInfo.replace(
        //         countRegex,
        //         `s:11:"message";s:${getBinarySize(match[1])}:`
        //     );
        // }
        const unserialized = unserialize(decodedInfo);
        return unserialized;
    } catch (err) {
        console.error('trying to correct data', err, info, base64.decode(info));
    }
};
const mperiodDict = {
    0: {'label': 'Overall', 'value': "0"},
    1: {'label': 'Calendar Year', 'value': "1"},
    2: {'label': 'Fiscal Year', value: "2"}
};
const processEachRow = async (conn, row, d) => {
        const regionId = d.regionId;
        const name = encodeUtf8(row.name);
        // const object = encodeUtf8(row.object);
        let objective = get(milestoneObjectDict, `${row.object}_${regionId}`, {});
        objective = { label: objective.value, value: objective.type };
        let property = get(milestonePropertyDict, `${row.property}_${regionId}`, {});
    property = { label: property.value, value: property.type };
        const amount = get(row, 'amount', 0);
        const refId = row.id;
        let mperiod = row.mperiod;


        mperiod = mperiodDict[mperiod];

        const active = row.active ? 'active' : 'inactive';
        let {
            description,
            email,
            admin_email,
        } = regexCorrectDecode(row.info);
        const {
            email: adminEmail,
            message: adminEmailMessage
        } = admin_email;
        const {
            from_name: fromName,
            from_email: fromEmail,
            message: fromMessage
        } = email;
        const trainingObj = {
            name,
            status: active,
            description: encodeUtf8(description),
            objective,
            property,
            amount: amount.toString(),
            adminEmail: encodeUtf8(adminEmail),
            adminEmailMessage: encodeUtf8(adminEmailMessage),
            notificationName: encodeUtf8(fromName),
            fromEmail: encodeUtf8(fromEmail),
            emailMessage: encodeUtf8(fromMessage),
            regionId,
            period: mperiod,
            primaryRegionId: regionId,
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
            `${config.workflowApi}/forms/milestone/submission`,
            {
                json: {data: item}
            }
        );
        i++;
        const submissionInformation = get(JSON.parse(resp.getBody('utf8')), 'data');
        submissionInfo.push(submissionInformation);
        i++;
    }

});

// const decodedData = regexCorrectDecode('YTozOntzOjExOiJkZXNjcmlwdGlvbiI7czoyNjoiUHJlbWnocmUgbWlzc2lvbiBkdSBtZW1icmUiO3M6NToiZW1haWwiO2E6Mzp7czo5OiJmcm9tX25hbWUiO3M6NTA6IkdhcmRlIEP0dGnocmUgQXV4aWxsaWFpcmUgQ2FuYWRpZW5uZSAoUXXpYmVjKSBJbmMuIjtzOjEwOiJmcm9tX2VtYWlsIjtzOjE0OiJpbmZvQGdjYWMtcS5jYSI7czo3OiJtZXNzYWdlIjtzOjE4OToiVG91dGVzIG5vcyBm6WxpY2l0YXRpb25zLCB2b3RyZSBwcmVtaehyZSBtaXNzaW9uIFNBUiBhIOl06SBjb21wbOl06WUgZXQgYSDpdOkgZW50cullIGRhbnMgbGUgc3lzdOhtZSBHSVNBUi4gTm91cyBlc3Dpcm9ucyBxdWUgdG91dCBztGVzdCBiaWVuIHBhc3PpIGV0IG5vdXMgYXBwculjaW9ucyB2b3RyZSBpbXBsaWNhdGlvbi4NCg0KIjt9czoxMToiYWRtaW5fZW1haWwiO2E6Mjp7czo1OiJlbWFpbCI7czoxNDoiaW5mb0BnY2FjLXEuY2EiO3M6NzoibWVzc2FnZSI7czowOiIiO319');
// console.log(decodedData);



