const fs = require('fs');
const yargs = require('yargs');
const args = yargs.argv;
const config = require('./config');
const elasticsearch = require('elasticsearch');
const { isNil, get} = require('lodash');

const elasticClient = new elasticsearch.Client({
    host: config.elasticUrl
});

fileName = 'milestoneTypes.json';

elasticClient.search({
    index: 'milestone',
    body: {
        "from": 0,
        "size": 8000,
        "_source": !isNil(args.fields) ? args.fields.split(',') : ["*"]
    }
}).then(resp => {
    const dataEntryObj = get(resp, 'hits.hits', []).map(data => ({
        ...get(data, "_source", {}),
        _id: get(data, '_id', null)
    }));

    fs.writeFile(fileName, JSON.stringify(dataEntryObj), 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing JSON Object to File.");
            return console.log(err);
        }

        console.log("JSON file has been saved.");
    });

});
