const {get} = require('lodash');
const TRAINING_LEVEL_FORMNAME = 'trainingcertification';
const elasticsearch = require('elasticsearch');
const config = require('../../config');
const elasticClient = new elasticsearch.Client({
    host: config.elasticUrl
});

const WORKFLOW_BASE_URL = config.workflowApi;

elasticClient.search({
    index: TRAINING_LEVEL_FORMNAME,
    body: {
        "from": 0,
        "size": 2000,
    }
}).then(resp => {
    const dataEntryObj = get(resp, 'hits.hits', []).map(data => ({
        ...get(data, "_source", {}),
        _id: get(data, '_id', null)
    }));
    dataEntryObj.forEach((f) => {
        const {_id} = f;
        // const resp =  syncrequest('POST',`${WORKFLOW_BASE_URL}/forms/create`, {
        //     json: form
        // });


        elasticClient
            .update({
                id: _id,
                index: TRAINING_LEVEL_FORMNAME,
                body: {doc: {formRefId: null}, doc_as_upsert: true},
                type: 'doc'
            })
            .catch(e => {
                console.log(e);
            });
    });
});
