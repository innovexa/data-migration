var randomColor = require("randomcolor");
const request = require("request");
const fs = require('fs');


const random = require('random');
const syncrequest = require('sync-request');

const _ = require("lodash");

const base_elastic = "http://ccga-stage.innovexa.com:5200";

const usersDict = JSON.parse(fs.readFileSync('milestoneTypes.json', 'utf8'));

 Object.keys(usersDict).forEach(uk => {
const u =  usersDict[uk];
const {_id, ...udata} = u;
        const resp = syncrequest(
            'POST',
            `${base_elastic}/milestone/doc/${u._id}/_update`,
            {
                json: {
                    doc: {
                      ...udata

                    },
                    "doc_as_upsert" : true
                },
                retry: true,
                retryDelay: 200,
                maxRetries: 5

            },
        );
    });
    console.log('done');
