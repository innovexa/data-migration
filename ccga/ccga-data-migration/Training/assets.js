var randomColor = require("randomcolor");
const request = require("request");
const moment = require("moment");
let DateGenerator = require("random-date-generator");
let usersDict = JSON.parse(fs.readFileSync('backup-users.json', 'utf8'));
const _ = require("lodash");
const engagements = [
"high",
    "low",
    "medium"
];

const updateAssetsLocations = () => {
  const fs = require("fs");
  for (let i = 1; i <= 1038; i++)
    request.get(
      {
        headers: {
          "Content-Type": "application/json",
          Connection: "keep-alive"
        },
        url: `http://ccga-dev.innovexa.com:5200/asset/default/${i}`
      },
      (err, res) => {
        const location = _.get(JSON.parse(res.body), "_source.location");

        const locationElastic = {
          lat: location[1],
          lon: location[0]
        };
        request.post(
          {
            headers: {
              "Content-Type": "application/json",
              Connection: "keep-alive"
            },
            url: `http://ccga-dev.innovexa.com:5200/asset/default/${i}/_update`,
            body: JSON.stringify({
              doc: {
                geo_location: locationElastic
              }
            })
          },
          (error, r, y) => {
            if (error || r || y) {
              console.log(error, r, y);
            }
          }
        );
      }
    );
};
const updateAssetsDates = () => {
  for (let i = 1; i <= 1038; i++) {
    DateGenerator.getRandomDate(); // random date

    let startDate = new Date(2014, 2, 2);
    let endDate = new Date();
    date = moment(
      DateGenerator.getRandomDateInRange(startDate, endDate)
    ).format("YYYY-MM-DD");
    request.post(
      {
        headers: {
          "Content-Type": "application/json",
          Connection: "keep-alive"
        },
        url: `http://ccga-dev.innovexa.com:5200/asset/default/${i}/_update`,
        body: JSON.stringify({
          doc: {
            created: date
          }
        })
      },
      (error, r, y) => {
        if (error || r || y) {
          console.log(error, r, y);
        }
      }
    );
  }
};
const updateAssetsNumber = () => {
  for (let i = 1; i <= 1038; i++) {
    request.post(
      {
        headers: {
          "Content-Type": "application/json",
          Connection: "keep-alive"
        },
        url: `http://ccga-dev.innovexa.com:5200/asset/default/${i}/_update`,
        body: JSON.stringify({
          doc: {
            number: i
          }
        })
      },
      (error, r, y) => {
        if (error || r || y) {
          console.log(error, r, y);
        }
      }
    );
  }
};

updateAssetsNumber();
