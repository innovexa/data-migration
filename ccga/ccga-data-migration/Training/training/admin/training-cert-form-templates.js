const { get, some, isObject, isNil } = require('lodash');
const _ = require('lodash');
const TRAINING_LEVEL_FORMNAME = 'trainingcertification';
// const config = require('../../config');

const config = {
    workflowApi: `https://api.ccga-stage.innovexa.cloud/workflow`,
    dbHost: 'localhost',
    dbUser: 'root',
    dbPassword: 'password'
}
const elasticsearch = require('elasticsearch');
const uniqid = require('uniqid');
const utf8 = require('utf8');
const encodeUtf8 = value => (!_.isNil(value) ? utf8.encode(value) : null);
const syncrequest = require('sync-request');
const elasticClient = new elasticsearch.Client({
    host: config.elasticUrl
});

const WORKFLOW_BASE_URL = config.workflowApi;
console.log(config, '===', WORKFLOW_BASE_URL)
const saveForm = (submissionObj) => {
    const tags = [TRAINING_LEVEL_FORMNAME];
    const formKey = uniqid();
    const title = encodeUtf8(submissionObj.name);
    let name = `${submissionObj.name.replace(/\s/g, "")}` + '-' + formKey;
    name = name.replace(/[\W_]+/g, "");
    let instructionComponent = '';
    if (submissionObj.instructions) {
        instructionComponent = {
            type: 'panel',
            key: `instructionspanel`,
            collapsible: false,
            hideLabel: false,
            components: [
                {
                    type: 'htmlelement',
                    key: 'instructions',
                    content: submissionObj.instructions
                }
            ]
        }
    }
    let NotificationComponent = '';
    if (submissionObj.notificationAlert && submissionObj.isEnableExpiry || submissionObj.isEnableSpecific || submissionObj.isEnableAlert) {
        NotificationComponent = {
            type: 'panel',
            key: `notificationAlert`,
            collapsible: false,
            hideLabel: false,
            components: [
                {
                    input: true,
                    type: "notificationAlert",
                    key: "notificationAlert",
                    panelTitle: "Global.ExpiryAlert.Title",
                    hideConfiguration: true,
                    isEnableAlert: submissionObj.notificationAlert.isEnableAlert,
                    isEnableRole: submissionObj.notificationAlert.isEnableRole,
                    isEnablePersonnel: submissionObj.notificationAlert.isEnablePersonnel,
                    isEnableExpiry: submissionObj.notificationAlert.isEnableExpiry,
                    isEnableSpecific: submissionObj.notificationAlert.isEnableSpecific,
                    specifyDuration: submissionObj.notificationAlert.specifyDuration ? submissionObj.notificationAlert.specifyDuration.flatValue : ''
                }
            ]
        };
    }


    let designationComponent = '';
    if (submissionObj.designationAssociation) {
        designationComponent = {
            type: 'panel',
            key: `associationPanel`,
            collapsible: false,
            hideLabel: false,
            components: [
                {
                    type: 'designationAssociation',
                    key: 'designation',
                    input: true,
                    hideConfiguration: true,
                    issueAgency: submissionObj.designationAssociation.issueAgency,
                    numberOption: submissionObj.designationAssociation.numberOption,
                    hideAssociatedCertficates: true,
                    certificateName: encodeUtf8(submissionObj.name)
                }
            ]
        };
    }

    const ImageDocsComponent = {
        type: "panel",
        key: `fileUploaPanel`,
        hideLabel: false,
        collapsible: false,
        properties: {
            panelType: "inner-panel",
            translationLabel: "Training.Certificate.Images"
        },
        components: [
            {
                input: true,
                type: "customfile",
                key: "fileUpload",
                panelTitle: "File Upload",
                label: "Add another File",
                url: "{BASE_API_URL}uploader/upload/ccga-test",
            }
        ]
    }


    const certificationProofComponent = {
        type: 'panel',
        key: `designationAssociationPanel`,
        collapsible: false,
        hideLabel: false,
        components: [
            {
                type: 'designationAssociation',
                key: 'certificationProof',
                input: true,
                hideConfiguration: true,
                hideAssociatedCertficates: false,
                associatedCertificates: submissionObj.assocCertificates
            }
        ],
        properties: {
            panelType: 'inner-panel',
            translationLabel: 'Training.Associated.Certifications'
        },
    }
    const innerComponents = [certificationProofComponent, ImageDocsComponent];

    let components = [
        {

            type: 'panel',
            key: 'instructionPanel',
            hideLabel: false,
            collapsible: true,
            properties: {
                panelType: 'main-panel',
                translationLabel: 'Global.Instructions.Title',
                iconClass: 'current-mark-icon',
                panelCollapsed: true
            },
            components: [instructionComponent],
        },
        {

            type: 'panel',
            key: 'designationPanel',
            hideLabel: false,
            collapsible: true,
            properties: {
                panelType: 'main-panel',
                translationLabel: encodeUtf8(submissionObj.name),
                iconClass: 'current-mark-icon',
            },
            components: [designationComponent],
        },
        {

            type: 'panel',
            key: 'certificateDatesPanel',
            hideLabel: false,
            collapsible: true,
            properties: {
                panelType: 'main-panel',
                translationLabel: 'Training.Certificates.Dates',
                iconClass: 'current-mark-icon',
            },
            components: [NotificationComponent],
        },
        {

            type: 'panel',
            key: 'mian-panel',
            hideLabel: false,
            collapsible: true,
            properties: {
                panelType: 'main-panel',
                translationLabel: 'Training.Certificates.Proof',
                iconClass: 'current-mark-icon',
            },
            components: [...innerComponents],
        }

    ];
    components = components.filter(function (el) {
        let activeComps = some(el.components, isObject);
        if (activeComps && el.components.length !== 0) {
            return el;
        }

    });
    let formCreateJson;
    formCreateJson = {
        title,
        name,
        path: name,
        type: 'form',
        display: 'form',
        tags,
        components
    };
    return formCreateJson;


};

elasticClient.search({
    index: TRAINING_LEVEL_FORMNAME,
    body: {
        "from": 0,
        "size": 2000,
        "query": {
            "bool": {
                "must_not": {
                    "exists": {
                        "field": "formRefId"
                    }
                }
            }
        }
    }
}).then(resp => {
    const dataEntryObj = get(resp, 'hits.hits', []).map(data => ({
        ...get(data, "_source", {}),
        _id: get(data, '_id', null)
    }));
    const formCreate = dataEntryObj.map(s => ({ ...saveForm(s), _id: s._id }));
    formCreate.forEach((f) => {
        const { _id, ...form } = f;
        const resp = syncrequest('POST', `${WORKFLOW_BASE_URL}/forms/create`, {
            json: form
        });
        const formInformation = JSON.parse(resp.getBody('utf8'));
        const formRefId = get(formInformation, '_id', null);
        const formRef = get(formInformation, 'path', null);

        elasticClient
            .update({
                id: _id,
                index: TRAINING_LEVEL_FORMNAME,
                body: { doc: { formRefId, formRef }, doc_as_upsert: true },
                type: 'doc'
            })
            .catch(e => {
                console.log(e);
                return next(e);
            });
    });
});


