/* Migration of Training Levels from ccga system to new system */
const mysql = require('mysql2/promise');
// const config = require('../../config');
const config = {
  workflowApi: `https://api.ccga-stage.innovexa.cloud/workflow`,
  dbHost: 'localhost',
  dbUser: 'root',
  dbPassword: 'password'
}
var fs = require('fs');
const elasticsearch = require('elasticsearch');

const moment = require('moment');
const base64 = require('base-64');
const request = require('request-promise');
const syncrequest = require('sync-request');
const SimpleNodeLogger = require('simple-node-logger');
const DB_HOST = config.dbHost;
const unserialize = require('locutus/php/var/unserialize');
const { toInteger, isNil, isEmpty, get } = require('lodash');
const utf8 = require('utf8');
base64Unserialize = value => unserialize(base64.decode(value));
let certificatesDict = JSON.parse(fs.readFileSync('training-certs-dict.json', 'utf8'));



const DB_PORT = 3306;
const DB_USER = config.dbUser;
const DB_PWD = config.dbPassword;
const opts = {
  logFilePath: `training-level-${moment().format('YYYY-MM-DD HH:mm:ss')}.log`,
  timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
};
const logger = SimpleNodeLogger.createSimpleLogger(opts);



const elasticClient = new elasticsearch.Client({
  host: 'https://vpc-ccga-elastic-7u5oztsvajkmnnihtmj5abbr7m.ca-central-1.es.amazonaws.com'
});
console.log = logger.info;
console.warn = logger.warn;
console.error = logger.error;


const workflowApi = 'https://api.ccga-stage.innovexa.cloud/workflow';
function getBinarySize(string) {
  return Buffer.byteLength(string, 'utf8');
}

const databases = [
  {name: 'pacific', regionId: 23},
  {name: 'ccga q', regionId: 22},
  {name: 'maritimes', regionId: 24},
  {name: 'central_arctic', regionId: 25}
];

const migrate = async d => {
  // const conn = await mysql.createConnection({
  //   host: DB_HOST,
  //   user: DB_USER,
  //   password: DB_PWD,
  //   database: d.name
  // });
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: d.name
  });
  const [
    rows,
    fields
  ] = await conn.execute(`select p.id as id , p.name as name, p.info as info, p.active as active, p.nstlid as nstlid, n.name  as next_level from sar_training_level p
  left outer join sar_training_level n on p.nstlid=n.id`);
  // console.log(rows, fields);

  const data = await Promise.all(rows.map(row => processEachRow(conn, row, d)));

  return data;
};

const processEachRow = async (conn, row, d) => {
  const info = get(row, 'info');
  const regionId = d.regionId;
  const refId = row.id;

  let decodedInfo = base64.decode(info);
  const regex = /s:11:"description";s:\d+:"([^"]+)";/g;

  var match = regex.exec(decodedInfo);
  if (match && match.length > 1) {
    const countRegex = /description";s:\d+:/g;
    decodedInfo = decodedInfo.replace(
      countRegex,
      `description";s:${getBinarySize(match[1])}:`
    );
  }
  decodedInfo = unserialize(decodedInfo);
  const description = utf8.encode(get(match, '[1]', ''));
  const active = row.active ? 'yes' : 'no';
  const seatimeHours = isEmpty(get(decodedInfo, 'seatime', '0'))
    ? toInteger(get(decodedInfo, 'seatime', '0'))
    : 0;
  const nextLevelId = get(row, 'nstlid')
    ? get(row, 'nstlid')
    : null;
  const dateCreated = moment.now();
  const id = row.id;
  const name = utf8.encode(row.name.trim());
  const certIds = Object.keys(get(decodedInfo, 'ctxr', {}));
  let certificates;
  if (isEmpty(certIds)) {
    certificates = [];
  } else {
    const query = `select id, name from sar_cert_type where id in (${certIds.join()})`;
    const [rows, fields] = await conn.execute(query);
    if (isEmpty(rows)) {
      certificates = [];
    } else {
      certificates = rows.map(r =>
        certificatesDict[`${regionId}_${r.id}`]
      );
    }
  }

  const formSubmission = {
    regionId,
    primaryRegionId: regionId,
    description,
    active,
    seatimeHours,
    nextLevelId,
    dateCreated,
    name,
    certificates,
    refId
  };
  console.log(formSubmission);
  return formSubmission;
  // console.log('formsubmission is ', formSubmission);

};

const values = Promise.all(databases.map(d => migrate(d)));
values.then(resp => {
  let accum = resp.reduce((arr, values) => {
    return [...arr, ...values];
  }, []);
  let i = 0;
  const TRAINING_LEVEL_FORMNAME = 'traininglevel';
  let submissionInfo = [];
  while (i < accum.length) {
    const item = accum[i];

    const resp = syncrequest(
      'POST',
      `${workflowApi}/forms/${TRAINING_LEVEL_FORMNAME}/submission`,
      {
        json: { data: item }
      }
    );
    const submissionInformation = get(JSON.parse(resp.getBody('utf8')), 'data');
    submissionInfo.push(submissionInformation);
    i++;
  }
  const trainingLevelDicts = submissionInfo.reduce((updateObj, si) => {
    return { ...updateObj, [si.regionId + '_' + si.refId]: { value: si.id, label: utf8.encode(si.name).trim() } };
  }, {});
  fs.writeFile("training-levels.json", JSON.stringify(submissionInfo), 'utf8', function (err) {
    if (err) {
      console.log("An error occured while writing JSON Object to File.");
      return console.log(err);
    }

    console.log("JSON file has been saved.");
  });


  fs.writeFile("training-level-dict.json", JSON.stringify(trainingLevelDicts), 'utf8', function (err) {
    if (err) {
      console.log("An error occured while writing JSON Object to File.");
      return console.log(err);
    }

    console.log("JSON file has been saved.");
  });

  submissionInfo.forEach(si => {
    const nextLevel = si.nextLevelId ? trainingLevelDicts[`${si.regionId}_${si.nextLevelId}`] : null;
    elasticClient
      .update({
        id: si.id,
        index: TRAINING_LEVEL_FORMNAME,
        body: { doc: { nextLevel }, doc_as_upsert: true },
        type: 'doc'
      })
      .catch(e => {
        console.log(e);
        return next(e);
      });
  })
});
