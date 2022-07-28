
require('dotenv').config();
module.exports = {
    dbHost: process.env.DB_HOST,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    idcUserApi: process.env.IDC_USER_API,
    elasticUrl: process.env.ELASTIC_URL,
    workflowApi: process.env.WORKFLOW_API,
    mongoUrl: process.env.MONGO_URL,
    sendGridApiKey: process.env.SENDGRID_API_KEY,
    authApi:  process.env.AUTH_API


};
