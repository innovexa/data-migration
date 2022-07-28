


const random = require('random');
const syncrequest = require('sync-request');

const _ = require("lodash");

const base_elastic = "http://localhost:9200";


const elasticsearch = require('elasticsearch');
const { isNil, get} = require('lodash');

const elasticClient = new elasticsearch.Client({
    host: base_elastic
});

elasticClient.search({
    index: 'asset_test',
    body: {
        "from": 0,
        "size": 10000
    }
}).then(resp => {
    const dataEntryObj = get(resp, 'hits.hits', []).map(data => ({
        ...get(data, "_source", {}),
        _id: get(data, '_id', null)
    }));
dataEntryObj.forEach(d => {
    const ownerAddress = get(d, 'OwnerAddress', {});
    const ownerName = get(d, 'OwnerName', "User");

    var resp = syncrequest(
        'POST',
        `${base_elastic}/asset_test/default/${d._id}/_update`,
        {
            json: {
                doc: {
                    reimbursementOwnerName: ownerName,
                    reimbursementAddress: ownerAddress

                }
            },
            retry: true,
            retryDelay: 200,
            maxRetries: 5

        },
    );
})

    console.log("done");
});

