var randomColor = require('randomcolor');
const request = require('request');
const _ = require('lodash');

const updateUsers = () => {
  const fs = require('fs');
  for(let i = 320; i <= 1038 ; i++)  
      setTimeout(() => {
        request.patch(
          {
            headers: {
              Host: 'api.ccga-dev.innovexa.com',
              Connection: 'keep-alive',
              'Content-Length': 2,
              'Accept': 'application/json',
              'Origin': 'https://api.ccga-dev.innovexa.com',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
              'Content-Type': 'application/json',
              'Referer': 'https://api.ccga-dev.innovexa.com/assetsswagger-ui/index.html?url=/assets/assets/swagger.json',
              'Accept-Encoding': 'gzip, deflate, br',
              'Accept-Language': 'en-US,en;q=0.9',
              Cookie: 'csrftoken=CWwkHtS8xclYas5FSfrmt8bORVWIayjDUGo02rxfdlTYJbHbLE6wY06qhpxNt5eN' },
            url: `https://api.ccga-dev.innovexa.com/assets/v1/asset/${i}`,
            body: JSON.stringify({} )
          }
        );
      }, 50);
    }

updateUsers();
