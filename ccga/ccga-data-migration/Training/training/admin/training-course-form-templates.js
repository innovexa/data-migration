const { get } = require('lodash');
const _ = require('lodash');
const TRAINING_LEVEL_FORMNAME = 'trainingcourse';
const elasticsearch = require('elasticsearch');
const uniqid = require('uniqid');
const config = require('../../config');
const syncrequest = require('sync-request');
const utf8 = require('utf8');
const encodeUtf8 = value => (!_.isNil(value) ? utf8.encode(value) : null);
const elasticClient = new elasticsearch.Client({
    host: 'http://15.223.11.122:9200'
});

const WORKFLOW_BASE_URL = 'https://api.ccga-stage.innovexa.cloud/workflow';


//save form with components;
saveForm = (submission) => {

    const tags = [TRAINING_LEVEL_FORMNAME];
    const formKey = uniqid();
    const title = encodeUtf8(submission.name);
    let name = `${title.replace(/\s/g, "")}` + '-' + formKey;

    name = name.replace(/[\W_]+/g,"");

    // First Panel: START
    let panelGeneral = {
        type: 'panel',
        key: 'panelGeneralMain',
        hideLabel: false,
        title: title,
        properties: {
            panelType: 'main-panel',
            dynamicLabel: title
        },
        components: [{
            type: 'panel',
            key: 'panelGeneral',
            hideLabel: false,
            title: 'Training.CourseUser.IssueResourceDates',
            properties: {
                translationLabel: 'Training.CourseUser.IssueResourceDates',
                panelType: 'inner-panel'
            },
            components: []
        }]
    };
    let panelGeneral_component = panelGeneral.components[0].components;

    // Instruction Component to show as an alert message in First Panel
    if (!_.isNil(submission.courseConfig.courseStructure.instruction) &&
        !_.isEmpty(submission.courseConfig.courseStructure.instruction)) {
        const instructionComponent = {
            type: 'alert',
            key: 'instruction',
            message: submission.courseConfig.courseStructure.instruction
        };
        panelGeneral_component.push(instructionComponent);
    }

    // Name and Number
    const nameAndNumberComponent = {
        type: 'columns',
        key: 'columnNameAndNumber',
        hideLabel: true,
        columns: [
            {
                components: [{
                    input: true,
                    type: 'textfield',
                    key: 'name',
                    label: 'Global.Name.Title',
                    placeholder: '',
                    defaultValue: title,
                    multiple: false,
                    validate: {
                        required: true
                    },
                    properties: {
                        defaultValue: title
                    }
                }],
                width: 6,
                offset: 0,
                push: 0,
                pull: 0
            },
            {
                components: [{
                    input: true,
                    type: 'textfield',
                    key: 'number',
                    label: 'Global.Number.Title',
                    placeholder: '',
                    multiple: false,
                    defaultValue: '',
                }],
                width: 4,
                offset: 0,
                push: 0,
                pull: 0
            }
        ]
    };
    panelGeneral_component.push(nameAndNumberComponent);

    // Course Duration
    const courseDurationComponent = {
        type: 'columns',
        key: 'columnDuration',
        hideLabel: true,
        columns: [
            {
                components: [{
                    input: true,
                    type: 'daterange',
                    key: 'courseDurationRange',
                    hideLabel: true,
                    isEnable: true,
                    ToLabel: 'Training.Course.CourseEnd',
                    FromLabel: 'Training.Course.CourseStart',
                    isTimeEnable: true
                }],
                width: 12,
                offset: 0,
                push: 0,
                pull: 0
            }
        ]
    };
    panelGeneral_component.push(courseDurationComponent);

    // Notes
    const notesComponent = {
        type: 'columns',
        key: 'columnNotes',
        hideLabel: true,
        columns: [
            {
                components: [{
                    input: true,
                    type: 'textarea',
                    key: 'notes',
                    rows: 5,
                    label: 'Global.Notes',
                    placeholder: '',
                    multiple: false,
                    defaultValue: ''
                }],
                width: 10,
                offset: 0,
                push: 0,
                pull: 0
            }
        ]
    };
    panelGeneral_component.push(notesComponent);
    // First Panel: END

    // 2nd Panel: START
    let panelAttendance = {
        type: 'panel',
        key: 'panelAttendanceMain',
        hideLabel: false,
        title: 'Training.Course.AttendanceDetails',
        properties: {
            panelType: 'main-panel',
            translationLabel: 'Training.Course.AttendanceDetails',
            panelCollapsed: true
        },
        components: [{
            type: 'trainingCourseConfigComponent',
            key: 'userCourseConfig',
            label: 'Global.Configuration',
            input: true,
            assetConf: {
                labelUnitAsset: 'Training.Course.EnableUnitAsset',
                labelMultiAsset: 'Training.Course.EnableMultiAsset',
                labelAssetRate: 'Training.Course.ShowAssetRate',
                labelAssetCoxLink: 'Training.Course.ShowAssetCoxLink',
                labelAssetPersonnelLink: 'Training.Course.Show.PersonnelAssetLink',
                labelParticipationPersonnelLink: 'Training.Course.ShowPersonnelParticipationLink',
                labelAdditionalResource: 'Training.Course.ShowAddionalResourceOpt'
            },
            timeCreditConf: {
                labelTimeCreditAdj: 'Training.Course.EnableTimeCreditAdj',
                labelTimeCredit: 'Training.Course.ShowTimeCredit',
                labelTimeCreditTotal: 'Training.Course.ShowTimeCreditTotal',
                labelTimePassFailOpt: 'Training.Course.PassFailOpt'
            },
            alertLabel: 'Training.Course.ParticipatingAlertLabel',
            alertMessage: 'Training.Course.ParticipatingUnitMsg',
            URLs: {
                units: '{DASHBOARD_API_BASE_URL}squadrons?q=regionId&shouldExpandResults=true&perPage=1000',
                assets: '{ASSET_API_URL}v1/assets?q=regionId&perPage=200&page=1',
                personnel: '{AUTHENTICATION_API_BASE_URL}v2/users?q=regionId&perPage=5000&sortOn=givenName'
            },
            hideConfiguration: true,
            hideClassStructure: true,
            timeCreditArr: {}
        }]
    };
    let panelAttendance_component = panelAttendance.components[0];

    if (!_.isNil(submission.courseConfig)) {
        if (!_.isNil(submission.courseConfig.enableUnitAsset)) {
            panelAttendance_component['enableUnitAsset'] = submission.courseConfig.enableUnitAsset;
        }
        if (!_.isNil(submission.courseConfig.enableMultiAsset)) {
            panelAttendance_component['enableMultiAsset'] = submission.courseConfig.enableMultiAsset;
        }
        if (!_.isNil(submission.courseConfig.showAssetRate)) {
            panelAttendance_component['showAssetRate'] = submission.courseConfig.showAssetRate;
        }
        if (!_.isNil(submission.courseConfig.showAssetCoxwain)) {
            panelAttendance_component['showAssetCoxwain'] = submission.courseConfig.showAssetCoxwain;
        }
        if (!_.isNil(submission.courseConfig.enableMultiCoxwain)) {
            panelAttendance_component['enableMultiCoxwain'] = submission.courseConfig.enableMultiCoxwain;
        }
        if (!_.isNil(submission.courseConfig.showAssetLinkage)) {
            panelAttendance_component['showAssetLinkage'] = submission.courseConfig.showAssetLinkage;
        }
        if (!_.isNil(submission.courseConfig.showParticipationLinkage)) {
            panelAttendance_component['showParticipationLinkage'] = submission.courseConfig.showParticipationLinkage;
        }
        if (!_.isNil(submission.courseConfig.showAdditionalResources)) {
            panelAttendance_component['showAdditionalResources'] = submission.courseConfig.showAdditionalResources;
        }
        if (!_.isNil(submission.courseConfig.showTimeCreditResource)) {
            panelAttendance_component['showTimeCreditResource'] = submission.courseConfig.showTimeCreditResource;
        }
        if (!_.isNil(submission.courseConfig.enableTimeCreditAdj)) {
            panelAttendance_component['enableTimeCreditAdj'] = submission.courseConfig.enableTimeCreditAdj;
        }
        if (!_.isNil(submission.courseConfig.enableTimeCreditCopy)) {
            panelAttendance_component['enableTimeCreditCopy'] = submission.courseConfig.enableTimeCreditCopy;
        }
        if (!_.isNil(submission.courseConfig.showTimeCreditTotal)) {
            panelAttendance_component['showTimeCreditTotal'] = submission.courseConfig.showTimeCreditTotal;
        }
        if (!_.isNil(submission.courseConfig.showPassFailOpt)) {
            panelAttendance_component['showPassFailOpt'] = submission.courseConfig.showPassFailOpt;
        }

        if (!_.isNil(submission.courseConfig.timeCreditArr.selectedType) &&
            _.size(submission.courseConfig.timeCreditArr.selectedType) > 0) {

            panelAttendance_component.timeCreditArr['selectedType'] = submission.courseConfig.timeCreditArr.selectedType;
            panelAttendance_component.timeCreditArr['participation'] = submission.courseConfig.timeCreditArr.participation;
            panelAttendance_component.timeCreditArr['totalParticipation'] = submission.courseConfig.timeCreditArr.totalParticipation;

        }

        if (!_.isNil(submission.courseConfig.hideSessionCounts)) {
            panelAttendance_component['hideSessionCounts'] = submission.courseConfig.hideSessionCounts;

            if(!submission.courseConfig.hideSessionCounts &&
                !_.isNil(submission.courseConfig.courseStructure)) {

                panelAttendance_component['courseStructure'] = _.pick(submission.courseConfig.courseStructure, [
                    'classroomSessions', 'exercises', 'simulatorSessions'
                ]);

            }
        }

    }
    // 2nd Panel: END

    // 3rd Panel: START
    const panelAttachments = {
        type: 'panel',
        key: 'panelAttachmentsMain',
        title: 'Global.Attachments',
        hideLabel: false,
        properties: {
            panelType: 'main-panel',
            translationLabel: 'Global.Attachments',
            panelCollapsed: true
        },
        components: [{
            type: 'panel',
            key: 'panelAttachments',
            title: 'Training.Course.AtachementLabel',
            properties: {
                panelType: 'inner-panel',
                translationLabel: 'Training.Course.AtachementLabel'
            },
            components: [
                {
                    type: 'alert',
                    key: 'alertAttachment',
                    message: 'Training.Course.AttachAlertMsg'
                },
                {
                    type: 'customfile',
                    key: 'attachments',
                    input: true,
                    label: 'Fileupload.AddFileLabel',
                    url: '{BASE_API_URL}uploader/upload/ccga-test',
                    accept: '*'
                }
            ]
        }]
    };
    // 3rd Panel: END

    // 4th Panel: START
    const panelAssocCert = {
        type: 'panel',
        key: 'panelAssocCertMain',
        title: 'Training.Panel.AssocCertificates',
        hideLabel: false,
        properties: {
            panelType: 'main-panel',
            translationLabel: 'Training.Panel.AssocCertificates',
            panelCollapsed: true
        },
        components: [{
            type: 'panel',
            key: 'panelAssocCert',
            title: 'Training.Panel.AssocCertification',
            properties: {
                panelType: 'inner-panel',
                translationLabel: 'Training.Panel.AssocCertification'
            },
            components: [
                {
                    type: 'multiselectcombo',
                    key: 'assocCertificates',
                    input: true,
                    properties: {
                        isView: true,
                        bindLabel: 'name',
                        bindValue: 'id'
                    },
                    flatPosition: true,
                    values: submission.assocCertificates
                }
            ]
        }]
    };
    // 4th Panel: END

    // 5th Panel: START
    const panelItemsAchieved = {
        type: 'panel',
        key: 'panelItemsAchievedMain',
        title: 'Training.Panel.ItemsAchieved',
        hideLabel: false,
        properties: {
            panelType: 'main-panel',
            translationLabel: 'Training.Panel.ItemsAchieved',
            panelCollapsed: true
        },
        components: [{
            type: 'panel',
            key: 'panelItemsAchieved',
            title: 'Training.Panel.ItemsAchieved',
            hideLabel: true,
            properties: {
                panelType: 'inner-panel',
                translationLabel: 'Training.Panel.ItemsAchieved'
            },
            components: [
                {
                    type: 'trainingNestedSelectionComponent',
                    key: 'itemsAchieved',
                    input: true,
                    isView: true,
                    values: submission.itemsAchieved
                }
            ]
        }]
    };
    // 5th Panel: END

    // Hidden field
    const regionComponent = {
        input: true,
        key: 'primaryRegionId',
        type: 'hidden'
    };
    const courseNameComponent = {
        input: true,
        key: 'courseName',
        type: 'hidden'
    };
    const parentFormComponent = {
        input: true,
        key: 'formParentId',
        type: 'hidden'
    };
    const parentWorkflowComponent = {
        input: true,
        key: 'issueType',
        type: 'hidden'
    };


    const components = [panelGeneral, panelAttendance, panelAttachments, panelAssocCert, panelItemsAchieved, regionComponent, courseNameComponent, parentFormComponent, parentWorkflowComponent];
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
    const formCreate = dataEntryObj.map(s => ({ ...saveForm(s), _id: s._id}) );
    formCreate.forEach((f) => {
        const {_id, ...form} = f;
        const resp =  syncrequest('POST',`${WORKFLOW_BASE_URL}/forms/create`, {
            json: form
        });
        const formInformation = JSON.parse(resp.getBody('utf8'));
        const formRefId= get(formInformation, '_id', null);
        const formRef= get(formInformation, 'path', null);

        elasticClient
            .update({
                id: _id,
                index: TRAINING_LEVEL_FORMNAME,
                body: {doc: {formRefId, formRef}, doc_as_upsert: true},
                type: 'doc'
            })
            .catch(e => {
                console.log(e);
                return next(e);
            });
    });
});
