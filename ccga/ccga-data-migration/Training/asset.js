


const random = require('random');
const syncrequest = require('sync-request');

const _ = require("lodash");
const fs = require('fs');
const base_elastic = "http://ccga-stage.innovexa.com:5200";

let assets = _.toArray(JSON.parse(fs.readFileSync('backup-asset.json', 'utf8')));
const elasticsearch = require('elasticsearch');
const { isNil, get} = require('lodash');

const elasticClient = new elasticsearch.Client({
    host: base_elastic
});

assets.forEach(d => {
    const ownerAddress = get(d, 'OwnerAddress', {});
    const ownerName = get(d, 'OwnerName', "User");
const doc = {
    reimbursementOwnerName: ownerName,
    reimbursementOwnerAddress: ownerAddress

};
const {_id, ...docToUpsert} = doc;
    var resp = syncrequest(
        'POST',
        `${base_elastic}/asset_test/default/${d.id}/_update`,
        {
            json: {
                doc:docToUpsert,
                doc_as_upsert: true
            },
            retry: true,
            retryDelay: 200,
            maxRetries: 5

        },
    );
});


