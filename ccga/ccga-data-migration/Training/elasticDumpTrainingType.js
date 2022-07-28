const fs = require('fs');
const yargs = require('yargs');
const config = require('./config');
const args = yargs.argv;
const elasticsearch = require('elasticsearch');
const { isNil, get} = require('lodash');

const elasticClient = new elasticsearch.Client({
    host: config.elasticUrl
});

fileName = `training-type-dict.json`;


elasticClient.search({
    index: 'trainingtype',
    body: {
        "from": 0,
        "size": 8000
    }
}).then(resp => {
    const dataEntryObj = get(resp, 'hits.hits', []).reduce((obj, data) => {
        return{
            ...obj,
            [`${data._source.regionId}_${data._source.refId}`]: {...data._source, _id: get(data, '_id', null)}
        }
    }, {});

    fs.writeFile(fileName, JSON.stringify(dataEntryObj), 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing JSON Object to File.");
            return console.log(err);
        }

        console.log("JSON file has been saved.");
    });

});
