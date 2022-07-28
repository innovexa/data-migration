const csvFilePath='./designations.csv'
const KEY ="USER";
const TYPE ="DESIGNATION"
const csv  = require('csvtojson');
const request = require('request');
const _ = require('lodash');
const createMeta = (arr, orgId ) => {
    arr.forEach(a=> {request.post(
        {
          headers: { 'content-type': 'application/json' },
          url: `http://api.ccga-dev.innovexa.com/dashboard/meta/create`,
          body: JSON.stringify({
            "key":KEY,
            "type": TYPE,
            orgId,
            "value": a

          })
        })
    })
}

csv()
.fromFile(csvFilePath)
.then((desiginations)=>{
    CentralArctic= []; 
    Maritimes = [];
    Pacific = [];
    Quebec = [];
    NewFoundland = [];
    desiginations.forEach(d => {
        if(d['Central and artic'])
        CentralArctic.push(d['Central and artic']);
        if(d['Maritimes'])
        Maritimes.push(d['Maritimes']);
        if(d['Pacific'])
        Pacific.push(d['Pacific']);
        if(d['Quebec'])
        Quebec.push(d['Quebec']);
        if(d['newfoundland'])
        NewFoundland.push(d['newfoundland']);
    });
console.log('length', NewFoundland.length+ CentralArctic.length+ Pacific.length+ Quebec.length+ Maritimes.length)
    // createMeta(CentralArctic, 7);
    // createMeta(Maritimes, 6);
    // createMeta(Pacific, 5);
    // createMeta(NewFoundland, 15);
    // createMeta(Quebec, 4);

})


