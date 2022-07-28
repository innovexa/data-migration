import requests
import json

from objects import *

URL = 'https://api.ccga-stage.innovexa.cloud/authentication'
# URL = 'http://localhost:9000'
REGION_URL = '/v2/regions'
REGION__PATCH_URL = '/v2/region/'
DISTRICT_URL = '/v2/districts'
DISTRICT_PATCH_URL = '/v2/district/'
UNIT_URL = '/v2/squadrons'
UNIT_URL_V3 = '/v3/squadrons'
UNIT_PATCH_URL = '/v2/squadron/'
USER_URL = '/v2/users'
USER_SQUAD = '/v2/user/{}/squadrons'
HEADERS = {'Content-type': 'application/json'}

base = [
    Region(22, "Québec", 21),
    Region(23, "Pacific", 21),
    Region(24, "Maritimes", 21),
    Region(25, "Central and Artic", 21),
    Region(26, "NewFoundLand and Labrador", 21)
]


def add_region(reg):
    # Table is region
    # Headers are region_id - name_en - name_fr - is_active - parent_id - color - timezone
    # example:
    # 4,Québec,Québec,1,3 (links to CCGA region) ,#c67b01,
    # Child example:
    # 13,Québec,Québec,1,4,#e01d2a,Eastern (UTC-04:00)
    data = {
        "nameEN": reg.name_en,
        "nameFR": reg.name_fr,
        "regionId": str(reg.id),
        "parentId": int(reg.parent_id),
        "color": "",
        "timeZone": ""
    }
    url = URL + REGION_URL
    req = requests.post(url, json.dumps(data), headers=HEADERS)
    res = req.json()
    if res["isSuccess"]:
        d = res["data"]
        return int(d["regionId"])
    else:
        print("Error at region with uid: {}".format(reg.id))
        return -1


def add_district(dist):
    # Table is district
    # Headers are district_id - name_en - name_fr - is_active - region_id - disctrict_no - color
    # example:
    # 29,3 - Québec Centre,3 - Québec Centre,1,13,3,#0920ed
    data = {
        "nameEN": dist.name,
        "nameFR": dist.name,
        "districtId": str(dist.id),
        "regionId": str(dist.region),
        "isActive": True,
        "districtNo": dist.number,
        "color": ""
    }
    url = URL + DISTRICT_URL
    req = requests.post(url, json.dumps(data), headers=HEADERS)
    res = req.json()
    if res["isSuccess"]:
        d = res["data"]
        return int(d["districtId"])
    else:
        print("Error at district with uid: {}".format(dist.number))
        return -1


def add_squadron(unit):
    # Table is squadron
    # Headers are name_en - name_fr - city - province_state - squadron_id - homepage - district_id - lat - lng - is_active - squadron_no - color
    # example:
    # Quebec,Quebec,City,BC,358,"",29,43.6525,-79.38167,1,4,#604fdd
    uid = unit.id
    if uid is '':
        uid = 0
    squadnumb = unit.number
    if squadnumb is '':
        squadnumb = 0
    data = {
        "nameEN": unit.name,
        "nameFR": unit.name,
        "squadronId": str(uid),
        "city": "",
        "provinceState": unit.province,
        "districtId": str(unit.zone_id),
        "isActive": bool(unit.active),
        "homePage": "",
        "squadronNo": int(squadnumb),
        "color": "string"
    }
    url = URL + UNIT_URL
    req = requests.post(url, json.dumps(data), headers=HEADERS)
    res = req.json()
    if res["isSuccess"]:
        d = res["data"]
        return int(d["squadronId"])
    else:
        print("Error at squadron with uid: {}".format(uid))
        return -1


def add_user(user, updated=None):
    data = {
        "email": user.email.strip(),
        "givenName": user.first_name.strip(),
        "lastName": user.last_name.strip(),
        "preferredLanguage": "en",
        "middleName": user.middle_name.strip(),
        "addressLine1": user.address1.strip(),
        "addressLine2": user.address2.strip(),
        "city": user.city.strip(),
        "postalCodeZip": user.postal_code,
        "country": "CA",
        "regionId": int(user.region_id)
    }
    url = URL + USER_URL
    req = requests.post(url, json.dumps(data), headers=HEADERS)
    res = req.json()
    if res["isSuccess"]:
        d = res["data"]
        url_primary_squad = URL + USER_SQUAD.format(d["uid"])
        main_region = None
        unit = updated.get('{}-{}'.format(user.primary_unit, user.region_id))
        # unit = main_region.getUnit(user.primary_unit)
        if unit is not None:
            body = {
                "squadronIdsToAdd": [
                    str(unit.id)
                ],
                "primarySquadron": int(unit.id)
            }
            req = requests.patch(url_primary_squad, json.dumps(body), headers=HEADERS)
            res = req.json()
            if not res["isSuccess"]:
                print("Error at primary for user with uid {}".format(user.userId))
                return -1, res["message"]
        else:
            return -1, "Unit Id was None"
        return int(d["uid"]), "all, good"
    else:
        print("Error at user with uid: {}".format(user.userId))
        return -1, res["data"]


def update_zone(id, region_id):
    data = {
        "regionId": str(region_id)
    }
    url = URL + DISTRICT_PATCH_URL + str(id)
    req = requests.patch(url, json.dumps(data), headers=HEADERS)
    res = req.json()
    if res["isSuccess"]:
        d = res["data"]
        return int(d["districtId"])
    else:
        return -1


def delete_regions():
    count = 1
    url = URL + REGION_URL
    req = requests.get(url + "?perPage=5000&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=false",
                       headers=HEADERS)
    res = req.json()
    regions = res["data"]["results"]
    for region in regions:
        print(count)
        count += 1
        if region is not "1" or region is not "2":
            url_del = URL + DISTRICT_PATCH_URL + "{}".format(region)
            req_del = requests.delete(url_del)
            res_del = req_del.json()
            if not res_del["isSuccess"]:
                print("Failed at {}".format(region))


def delete_zone():
    count = 1
    url = URL + DISTRICT_URL
    req = requests.get(url + "?perPage=5000&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=false",
                       headers=HEADERS)
    res = req.json()
    zones = res["data"]["results"]
    for zone in zones:
        print(count)
        count += 1
        url_del = URL + DISTRICT_PATCH_URL + "{}".format(zone)
        req_del = requests.delete(url_del)
        res_del = req_del.json()
        if not res_del["isSuccess"]:
            print("Failed at {}".format(zone))


def delete_squadron():
    count = 1
    url = URL + UNIT_URL_V3
    req = requests.get(url + "?perPage=5000&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=false",
                       headers=HEADERS)
    res = req.json()
    units = res["data"]["results"]
    for unit in units:
        print(count)
        count += 1
        url_del = URL + UNIT_PATCH_URL + "{}".format(unit["squadronId"])
        req_del = requests.delete(url_del)
        res_del = req_del.json()
        if not res_del["isSuccess"]:
            print("Failed at {}".format(unit["squadronId"]))
