const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const fs = require('fs');
const yargs = require('yargs');
const args = yargs.argv;
const config = require('./config');



// Connection URL
const url = config.mongoUrl;
// Database Name
const collectionName = 'forms';
const tags = args.tags.split(',');
const dbName = args.db || 'formio';


const deleteForms = async () => {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    const forms = db.collection(collectionName);
    if(tags) {
        await forms.deleteMany({tags});
    }
};
deleteForms();
// Use connect method to connect to the server
