
const syncrequest = require('sync-request');

const _ = require("lodash");


const base_elastic = "http://ccga-stage.innovexa.com:5200";


var mysql      = require('mysql');
var connection = mysql.createConnection({
    host     : 'ccga-stage.cx0ep9ygxsma.ca-central-1.rds.amazonaws.com',
    user     : 'ccga_dev',
    password : 'x2oYAR2X6D19',
    database : 'translations'
});

connection.connect();

connection.query('select t.id, t.translation, t.help, t.locale, tk.id as keyId, t.description, tk.`name` as `key`, c.name as category, c.id as categoryId from translations t left join translate_keys tk on tk.id = t.key_id left join categories c on c.id = tk.category_id', function (error, results, fields) {
    if (error) throw error;
    const usersArr = _.toArray(results).forEach(u => {
        const id = 2000;
        const resp = syncrequest(
            'POST',
            `${base_elastic}/translations/default/${u.id}/_update`,
            {
                json: {
                    doc: {
                        id: u.id,
                        description: u.description,
                        keyId: u.keyId,
                        locale: u.locale,
                        key: u.key,
                        help: u.help,
                        category: u.category,
                        translation: u.translation,
                        categoryId: u.categoryId

                    },
                    "doc_as_upsert" : true
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
