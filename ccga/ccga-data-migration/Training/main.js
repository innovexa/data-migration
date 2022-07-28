var randomColor = require('randomcolor');
const request = require('request');
const _ = require('lodash');

const updateRegionColors = () => {
  request(
    'https://api.ccga-stage.innovexa.com/authentication/v2/regions?perPage=500&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=false',
    function(error, response, body) {
      const results = _.get(JSON.parse(response.body), 'data.results', []);

      results.forEach(r => {
        setTimeout( () => {
            request.patch(
                {
                    url: `https://api.ccga-stage.innovexa.com/authentication/v2/region/${r}`,
                    headers: {'content-type': 'application/json'},
                    body: JSON.stringify({
                        color: randomColor({
                            luminosity: 'bright',
                            hue: 'random'
                        })
                    })
                },
                function (error, response, body) {
                    console.log(error, response);
                }
            )},

          50
        );
      });
    }
  );
};
const updateZoneColors = () => {
  request(
    'https://api.ccga-stage.innovexa.com/authentication/v2/districts?perPage=400&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=false',
    function(error, response, body) {
      const results = _.get(JSON.parse(response.body), 'data.results', []);

      results.forEach(r => {
        request.patch(
          {
            url: `https://api.ccga-stage.innovexa.com/authentication/v2/district/${r}`,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                // ...r,
              color: randomColor({
                luminosity: 'bright',
                hue: 'random'
              })
            })
          },
          function(error, response, body) {
            console.log(error, response);
          }
        );
      });
    }
  );
};

const updateSquadronWithRegionAndZoneColors = () => {
  request(
    'https://api.ccga-dev.innovexa.cloud/authentication/v2/squadrons?perPage=10000&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=true',
    function(error, response, body) {
      const results = _.get(JSON.parse(response.body), 'data.results', [])

      results.forEach(r => {
          const doc = {

              color: randomColor({
                luminosity: 'bright',
                hue: 'random'
              })};

        request.patch(
          {
            url: `https://api.ccga-dev.innovexa.cloud/authentication/v2/squadron/${r['squadronId']}`,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(doc)
          },
          function(error, response, body) {
              console.log(response, error);
          }
        );
      });
    }
  );
};
updateSquadronWithRegionAndZoneColors();

