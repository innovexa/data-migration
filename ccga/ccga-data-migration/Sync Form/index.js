const MongoClient = require('mongodb').MongoClient;
const dotenv = require('dotenv');
dotenv.config();
// Connection URL
const syncFromUrl = process.env.SYNC_FROM;
const syncFromDb = process.env.SYNC_FROM_DB;
const syncToUrl = process.env.SYNC_TO;
const syncToDb = process.env.SYNC_TO_DB;


const forms = ['editusertraining']; // Form Name
const run = async (form, collection, toCollection) => {
    const doc = await collection.findOne({ path: form });
    const { components } = doc;
    await toCollection.updateOne({ path: form }, { $set: { components } });
    const newDoc = toCollection.findOne({ path: form });
    console.log(await newDoc);

};
// Database Name

const runScript = async () => {
    try {
        const client = await MongoClient.connect(syncFromUrl, { useNewUrlParser: true });
        const toClient = await MongoClient.connect(syncToUrl, { useNewUrlParser: true });
        const fromDb = client.db(syncFromDb);
        const toDb = toClient.db(syncToDb);


        const collection = fromDb.collection('forms');
        const toCollection = toDb.collection('forms');

        forms.forEach(form => {
            run(form, collection, toCollection)

        });
        console.log('done');

    }
    catch (e) {
        console.error(e);
    }
};
runScript();

