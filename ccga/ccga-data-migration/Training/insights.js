var randomColor = require("randomcolor");
const request = require("request");
const fs = require('fs');


const random = require('random');
const syncrequest = require('sync-request');

const _ = require("lodash");
let usersDict = JSON.parse(fs.readFileSync('backup-users.json', 'utf8'));
const engagements = [
"high",
    "low",
    "medium"
];

const base_elastic = "http://ccga-stage.innovexa.com:5200";


var mysql      = require('mysql');
var connection = mysql.createConnection({
    host     : 'ccga-stage.cx0ep9ygxsma.ca-central-1.rds.amazonaws.com',
    user     : 'me',
    password : 'secret',
    database : 'translations'
});

connection.connect();

connection.query('select t.id, t.translation, t.help, t.locale, tk.id as keyId, t.description, tk.`name` as `key`, c.name as category, c.id as categoryId from translations t left join translate_keys tk on tk.id = t.key_id left join categories c on c.id = tk.category_id', function (error, results, fields) {
    if (error) throw error;
    const usersArr = _.toArray(results).forEach(u => {;

        const resp = syncrequest(
            'POST',
            `${base_elastic}/translations/doc/${id}/_update`,
            {
                json: {
                    doc: {
                        insights_score: _.toString(randomFloat),
                        insights_engagement:randomEngagement,
                    }
                },
                retry: true,
                retryDelay: 200,
                maxRetries: 5

            },
        );

    });

connection.end();


const updateInsights = () => {

    })


};
updateInsights();
