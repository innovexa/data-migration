const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const assert = require('assert');
const TRAINING_LEVEL_FORM_ID = '5c33b8e08e59674606538ed0';
const TRAINING_ITEM_FORM_ID = '5c42010d42accf0079e5df89';
const TRAINING_CERT_FORM_ID = '5c37b8d942accf0079e5df42';
const TRAINING_COURSE_FORM_ID = '5c420e2342accf0079e5df8b';
const config = require('./config');

// Connection URL
const url = config.mongoUrl;

// Database Name
const collectionName = 'submissions';
const dbName = 'formio';
const deleteSubmissions = async formId => {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    const submissions = db.collection(collectionName);
    await submissions.deleteMany({form: ObjectId(formId)});
};
deleteSubmissions(TRAINING_COURSE_FORM_ID);
// Use connect method to connect to the server
