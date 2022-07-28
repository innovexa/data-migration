var randomColor = require("randomcolor");
const request = require("request");
const fs = require('fs');
const {get, toInteger }  = require('lodash');

const random = require('random');
const syncrequest = require('sync-request');

const _ = require("lodash");

const base_elastic = "http://localhost:9200";


const resp = syncrequest('GET',
    'https://api.ccga-dev.innovexa.cloud/authentication/v2/squadrons?perPage=10000&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=true');
const units = get(JSON.parse(resp.getBody('utf8')), 'data.results', [])
 units.forEach(u => {

        const resp = syncrequest(
            'POST',
            `${base_elastic}/units/default/${u.squadronId}/_update`,
            {
                json: {
                    doc: {
                      ...u,
                        squadronId: toInteger(u.squadronId),
                        regionId: toInteger(u.regionId),
                        districtId: toInteger(u.districtId)



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
