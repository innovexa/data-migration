const syncrequest = require('sync-request');
const _ = require("lodash");
//const base_elastic = "http://ccga-stage.innovexa.com:5200";
var mysql = require('mysql');
const dotenv = require("dotenv");
const config = dotenv.config().parsed;
const elastic = require('elasticsearch');
var base64 = require('base-64');
const unserialize = require('locutus/php/var/unserialize');



const elasticClient = new elastic.Client({
    host: config.ELASTIC_URL
});

const databases = [
    { name: 'pacific',regionId: 23},
    { name: 'ccga q',regionId:22},
    { name: 'maritimes', regionId: 24},
    { name: 'central_arctic', regionId: 25},
    { name: 'nlcc', regionId: 26}
];


const migrateLevels = async () => {
    var connection = mysql.createConnection({
        host: config.OLD_DB_HOST,
        user: config.OLD_DB_USER,
        password: config.OLD_DB_PWD,
        database: 'central_arctic'
    });
    connection.connect();
    connection.query('select * from sar_training_level',
        function (error, results, fields) {
            if (error) throw error;
            const workflowUrl = `${config.BASE_API_BASE_URL}/workflow/forms/traininglevel/submission`;
            results.map(async res => {
                const name = _.get(res, 'name');
                const nextLevelId = _.get(res, 'nstlid');
                const info = _.get(res, 'info');
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
                const description = _.get(unserialized, 'description');
                const regionId = getRegionId('central_arctic');
                const postData = {
                    data: {
                        name: name,
                        nextLevel: null,
                        nextLevelId: nextLevelId,
                        active: "yes",
                        description: description,
                        seatimeHours: 0,
                        certificates: [],
                        issueType: "Training",
                        primaryRegionId: regionId
                    },
                    noValidate: false
                };
                try {
                    const resp = await syncrequest(
                        'POST',
                        workflowUrl,
                        {
                            json: postData
    
                        }
                    );
                } catch (e) {
                    return next(e);
                }
            })
            connection.end();
            console.log('done');
        });
};

function getRegionId(region) {
    let regionId;
    switch (region) {
        case 'central_arctic':
            regionId = 25
            break;
        case 'maritimes':
            regionId = 24;
            break;
        case 'pacific':
            regionId = 23;
            break;
        case 'ccga q':
            regionId = 22;
            break;
        case 'nlcc':
            regionId = 26;
            break;    
    }
    return regionId
}

function getBinarySize(string) {
    return Buffer.byteLength(string, 'utf8');
}

migrateLevels();
