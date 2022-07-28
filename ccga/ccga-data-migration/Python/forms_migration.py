import json

import requests
from urllib3.connectionpool import xrange

from objects import *
from zone_migration import get_squadrons_from_api, sync_squadrons_with_old_id

STAGE = 'https://vpc-ccga-elastic-7u5oztsvajkmnnihtmj5abbr7m.ca-central-1.es.amazonaws.com'

HEADERS = {'Content-type': 'application/json'}
old_regions = {
    4: 0,
    5: 1,
    6: 2,
    7: 3,
    8: 4
}
base = [
    Region(22, "Québec", 21),
    Region(23, "Pacific", 21),
    Region(24, "Maritimes", 21),
    Region(25, "Central and Artic", 21),
    Region(26, "NewFoundLand and Labrador", 21)
]


def get_zone_by_name():
    url = "https://api.ccga-stage.innovexa.cloud/authentication/v2/districts?perPage=50&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=true"
    req = requests.get(url, headers=HEADERS)
    res = req.json()
    if res['isSuccess'] and res['data']['resultsTotal'] > 0:
        return res['data']['results']
    else:
        return None


def get_units_by_name():
    url = "https://api.ccga-stage.innovexa.cloud/authentication/v2/squadrons?&perPage=10000&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=true"
    req = requests.get(url, headers=HEADERS)
    res = req.json()
    if res['isSuccess'] and res['data']['resultsTotal'] > 0:
        return res['data']['results']
    else:
        return None


def get_region_from_id(id):
    url = "https://api.ccga-stage.innovexa.cloud/authentication/v2/region/{}".format(
        id
    )
    req = requests.get(url, headers=HEADERS)
    res = req.json()
    if res['isSuccess']:
        return res['data']
    else:
        return None


def get_forms(name):
    url = "{}/{}/_search/".format(STAGE, name)
    req = requests.post(url)
    res = req.json()
    return res['hits']['hits']


def update_form(name, form, zones=None, units=None):
    id = form.get('_id')
    url = "{}/{}/doc/{}/_update?pretty".format(STAGE, name, id)
    source = dict(form.get('_source'))
    if int(source['primaryRegionId']) > 20:
        return 1, "Great"
    doc = {}
    # zoneId
    district = None
    squadron = None
    # for zone in zones:
    #     if (source['zoneName']).strip() in zone["nameEN"]:
    #         district = zone
    #         break
    # for unit in units:
    #     if source['unitName'] in unit["nameEN"]:
    #         squadron = unit
    #         break
    # doc['zoneId'] = district['districtId']
    # doc['district'] = district['districtId']
    # regionId
    if source['regionId'] > 10:
        doc['regionId'] = int(base[old_regions[int(source['primaryRegionId'])]].id)
    else:
        doc['regionId'] = int(base[old_regions[int(source['regionId'])]].id)
    # primaryRegionId
    doc['primaryRegionId'] = int(base[old_regions[int(source['primaryRegionId'])]].id)
    # unitId
    # if units.get("{}-{}".format(doc['unitId'], doc['primaryRegionId']), None) is not None:
    #     doc['unitId'] = units.get("{}-{}".format(doc['unitId'], doc['primaryRegionId']))
    # doc['squadronId'] = squadron['squadronId']
    req = requests.post(url, json.dumps({"doc": doc}), headers=HEADERS)
    res = req.json()
    if req.status_code == 200:
        return 1, "Great"
    else:
        return -1, req.status_code


# with open('JSON/data.json') as json_file:
form_name = "traininglevel"
forms = get_forms(form_name)
# zones = get_zone_by_name()
# units = get_squadrons_from_api(base)
# units_2 = get_units()
# updated = sync_squadrons_with_old_id(units, units_2)
failed = []
count = 0
with open("JSON/failed_forms_claims.json", "a") as file:
    for form in forms:
        count += 1
        print("{}/{}".format(count, len(forms)))
        num, mes = update_form(form_name, form, None, None)
        if num == -1:
            file.write(json.dumps({"mission": form, "message": mes}))
            file.write(",")
    file.close()
