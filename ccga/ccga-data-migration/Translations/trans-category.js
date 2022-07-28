const syncrequest = require('sync-request');
const _ = require("lodash");
var mysql      = require('mysql');
var connection = mysql.createConnection({
    host: 'ccga-stage-k8.cx0ep9ygxsma.ca-central-1.rds.amazonaws.com',
    user: 'ccga_dev',
    password: 'x2oYAR2X6D19',
    database: 'translations'
})
connection.connect();
connection.query('select * from categories', function (error, results, fields) {
    if (error) throw error;
_.toArray(results).forEach(u => {
        const resp = syncrequest(
            'POST',
            `https://api.ccga-stage.innovexa.cloud/translation-api/category`,
            {
                json: {
                    name: u.name
                },
                retry: true,
                retryDelay: 200,
                maxRetries: 5
            },
        );
    });
    connection.end();
    console.log('done');
});