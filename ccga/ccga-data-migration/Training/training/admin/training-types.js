const fs = require('fs');
const syncrequest = require('sync-request');
const config = require('../../config');
const elasticsearch = require('elasticsearch');
const { toInteger, isNil, isEmpty, get } = require('lodash');

const utf8 = require('utf8');
base64Unserialize = value => unserialize(base64.decode(value));
const encodeUtf8 = value => (!isNil(value) ? utf8.encode(value) : null);

const resp = syncrequest(
    'POST',
    `${config.idcUserApi}/training/type/search`,
    {
        json: {"filters": [], "perPage": 400, "page":1 }
    }
);
const submissionInfo = get(JSON.parse(resp.getBody('utf8')), 'data', []);
const trainingTypesDict = submissionInfo.reduce((updateObj, si) => {
    return {...updateObj, [si.regionId + '_' + si.refId]: {value: si._id, label: encodeUtf8(si.name).trim()}};
}, {});
fs.writeFile("training-type-dict.json", JSON.stringify(trainingTypesDict), 'utf8', function (err) {
    if (err) {
        console.log("An error occured while writing JSON Object to File.");
        return console.log(err);
    }

    console.log("JSON file has been saved.");
});


