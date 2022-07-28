const syncrequest = require('sync-request');
const config = require('../../config');
const regions = [
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 40, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59
];
const secondaryTimeTypes = ["TimeType.SelfStudy", "TimeType.CoursePreparation", "TimeType.CurriculumDevelopment", "TimeType.Instruction", "TimeType.Maintenance", "TimeType.Administration", "TimeType.SARPrevention", "TimeType.Fundraising", 'TimeType.CommunityEvent', 'TimeType.OtherActivities']
const primaryTimeTypes = ["TimeType.SARCall", 'TimeType.SARGroundCall', 'TimeType.OnCall', 'TimeType.SARPatrol', 'TimeType.SARMeetings', 'TimeType.Classroom', 'TimeType.TrainingExercises', 'TimeType.SimulatorSessions'];

regions.forEach(r => {
    primaryTimeTypes.forEach(tt => {
        const body = {
            name: tt,
            type: "TimeType.Type.Primary",
            category: "seatime",
            regionId: r,

        };
        const resp = syncrequest(
            'POST',
            // `${config.idcUserApi}/system/timetype/create`,
            `https://api.ccga-stage.innovexa.cloud/idc-user-api/system/timetype/create`,
            {
                json: body
            }
        );
    });


    secondaryTimeTypes.forEach(tt => {
        const body = {
            name: tt,
            type: "TimeType.Type.Secondary",
            category: "seatime",
            regionId: r,

        };
        syncrequest(
            'POST',
            //`${config.idcUserApi}/system/timetype/create`,
            `https://api.ccga-stage.innovexa.cloud/idc-user-api/system/timetype/create`,
            {
                json: body
            }
        );
    });
});
