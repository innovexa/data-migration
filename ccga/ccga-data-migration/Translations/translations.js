const syncrequest = require('sync-request');
const _ = require("lodash");
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'ccga-stage-k8.cx0ep9ygxsma.ca-central-1.rds.amazonaws.com',
    user: 'ccga_dev',
    password: 'x2oYAR2X6D19',
    database: 'translations'
});
connection.connect();
connection.query('select t.*, tk.name, c.name as category from translations t inner join translate_keys tk on t.key_id = tk.id inner join categories c on tk.category_id = c.id', function (error, results, fields) {
    if (error) throw error;
    const translations = _.groupBy(_.toArray(results), 'name');
    const formatted = Object.keys(translations).map(k => {
        return {
            key: k, description: translations[k][0].description, category: translations[k][0].category, translation: translations[k].reduce((accum, i) => {
                return {...accum, [i.locale]: i.translation}
            }, {}), help: translations[k].reduce((accum, i) => {
                return {...accum, [i.locale]: i.help}
            }, {})
        }
    });
    console.log(formatted,'trans');
    const usersArr = _.toArray(formatted).forEach(f => {
        const resp = syncrequest(
            'POST',
            `https://api.ccga-stage.innovexa.cloud/translation-api/translation`,
            {
                json: f,
                retry: true,
                retryDelay: 200,
                maxRetries: 5
            },
        );
    });
    connection.end();
    console.log('done');
});