import copy
import html

import requests
from mysql.connector import MySQLConnection, Error
import json

from asset_migration import update_asset
from objects import *
from add_functions import add_user, add_region, add_squadron, add_district

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
    # Region(23, "Pacific", 21),
    # Region(24, "Maritimes", 21),
    # Region(25, "Central and Artic", 21),
    # Region(26, "NewFoundLand and Labrador", 21)
]

PARENT_REGIONS = {
    "ccga q": base[0],
    # "pacific": base[0],
    # "maritimes": base[0],
    # "central_arctic": base[0],
    # "nlcc": base[0]
}
province = {
    "ccga q": "QC",
    "pacific": "ON",
    "maritimes": "NB",
    "central_arctic": "NT",
    "nlcc": "NL"
}


def get_zones():
    # Table is sar_zone
    # Headers are id - name - number - info
    # example:
    # 1,1 - Côte Nord - Saguenay,1,YToxOntzOjExOiJkZXNjcmlwdGlvbiI7czoyMDoiQ/R0ZSBOb3JkIC0gU2FndWVuYXkiO30=
    zones = []
    try:
        print("Currently Importing Zones")
        for db, parent in PARENT_REGIONS.items():
            dbconfig = {
                "host": "localhost",
                "database": db,
                "user": "root",
                "password": "password"
            }
            conn = MySQLConnection(**dbconfig)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sar_zone")

            row = cursor.fetchone()
            while row is not None:
                new_reg = Zone(row[0], row[1], row[2], parent.getId())
                zones.append(new_reg)
                parent.addDistrict(new_reg)
                row = cursor.fetchone()
    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return zones


def get_regions():
    # Table is sar_region
    # Headers are id - name - number - info
    # example:
    # 1,Québec,0,YToxOntzOjExOiJkZXNjcmlwdGlvbiI7czo2OiJRdeliZWMiO30=
    regions = []
    try:
        print("Currently Importing Regions")
        for db, parent in PARENT_REGIONS.items():
            dbconfig = {
                "host": "localhost",
                "database": db,
                "user": "root",
                "password": "password"
            }
            conn = MySQLConnection(**dbconfig)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sar_region")

            row = cursor.fetchone()
            while row is not None:
                new_reg = Region(row[0], row[1], parent.getId())
                parent.addSub(new_reg)
                regions.append(new_reg)
                row = cursor.fetchone()
    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return regions


def get_units():
    # Table is sar_unit
    # Headers are id - name - number - srid (Region ID) - szid (Zone ID) - trainhours - utype - active - info
    # example:
    # 1,Haut du Port,48,1,4,0,0,1,asdadasd==
    units = []
    try:
        print("Currently Importing Units")
        for db, parent in PARENT_REGIONS.items():
            dbconfig = {
                "host": "localhost",
                "database": db,
                "user": "root",
                "password": "password"
            }
            conn = MySQLConnection(**dbconfig)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sar_unit")

            row = cursor.fetchone()
            while row is not None:
                if row[4] != 0:
                    # update_zone(parent.getDistrict(row[4]).id, parent.getSub(row[3]).id)
                    # new_reg = Unit(row[0], row[1], row[2], parent.getSub(row[3]).id, parent.getDistrict(row[4]).id,
                    #                row[5], row[6],
                    #                row[7], province[db])
                    new_reg = Unit(row[0], html.unescape(row[1]), row[2], row[3], row[4],
                                   row[5], row[6],
                                   row[7], province[db])
                    units.append(new_reg)
                    # parent.addUnit(new_reg)
                row = cursor.fetchone()
    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return units


def get_users():
    # Table is sar_unit
    # Headers are id - cid - usid1 - usid2 - usid3 - uname - psswrd - email (7) - Birthday (16)
    # example:
    # 1,Haut du Port,48,1,4,0,0,1,asdadasd==
    users = []
    try:
        print("Currently Importing Users")
        for db, parent in PARENT_REGIONS.items():
            dbconfig = {
                "host": "localhost",
                "database": db,
                "user": "root",
                "password": "password"
            }
            conn = MySQLConnection(**dbconfig)
            cursor = conn.cursor(dictionary=True)
            # cursor.execute("SELECT users.cid, users.email, users.birthdate, sar_person.suid, "
            #                " sar_person.first_name, sar_person.middle_name, "
            #                "sar_person.last_name, sar_person.address1, sar_person.address2, sar_person.city, "
            #                "sar_person.province, sar_person.country, sar_person.pcode, sar_person.active, sar_person.spsid, sar_person.number "
            #                "FROM users FULL OUTER JOIN sar_person ON users.cid=sar_person.uid")
            cursor.execute("SELECT * FROM users LEFT JOIN sar_person ON users.id=sar_person.uid "
                           "UNION ALL "
                           "SELECT * FROM users RIGHT JOIN sar_person ON users.id=sar_person.uid")

            row = cursor.fetchone()
            while row is not None:
                # userId, email, birthday, first_name, middle_name, last_name,
                #                  address1, address2, city, prov, country, postal_code, active, primary, region_id, status, number,
                #                  industry, mdate, info
                new_reg = User(row["cid"], row["email"], row["birthdate"], row["first_name"], row["middle_name"],
                               row["last_name"], row["address1"], row["address2"], row["city"], row["province"],
                               row["country"], row["pcode"], row["active"], row["suid"], parent.id, row["spsid"],
                               row["number"], row["industryid"], row["mdate"], row["info"], row["crew"], None)
                users.append(new_reg)
                # parent.getUnits(row[3]).users.append(new_reg)
                row = cursor.fetchone()
    except Error as e:
        print(e)

    finally:
        print("Done Importing Users")
        cursor.close()
        conn.close()
        return users


def get_regions_from_api(base):
    req = requests.get(URL + '/v2/regions?perPage=9000&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=true',
                       headers=HEADERS)
    regions_data = []
    res = req.json()
    if res["isSuccess"]:
        regions = res["data"]["results"]
        for region in regions:
            new_r = Region(region["regionId"], region["nameEN"], region["parentId"])
            for b in base:
                if b.id == int(region["parentId"]):
                    b.addSub(new_r)
            regions_data.append(new_r)
    return regions_data


def get_districts_from_api(base):
    req = requests.get(URL + '/v2/districts?perPage=9000&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=true',
                       headers=HEADERS)
    districts_data = []
    res = req.json()
    if res["isSuccess"]:
        districts = res["data"]["results"]
        for district in districts:
            new_z = Zone(district["districtId"], district["nameEN"], district["districtNo"], district["regionId"])
            for b in base:
                if b.getSub(district["regionId"]):
                    b.addDistrict(new_z)
            districts_data.append(new_z)
    return districts_data


def get_squadrons_from_api(base):
    req = requests.get(URL + '/v3/squadrons?perPage=9000&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=true',
                       headers=HEADERS)
    squadron_data = []
    res = req.json()
    if res["isSuccess"]:
        squadrons = res["data"]["results"]
        for squadron in squadrons:
            new_s = Unit(squadron.get("squadronId"), squadron.get("nameEN"), squadron.get("squadronNo", 0),
                         squadron["regionId"], squadron["districtId"], 0, 0,
                         squadron["isActive"], squadron["provinceState"])
            # for b in base:
            #     if b.getDistrict(squadron["districtId"]):
            #         b.addUnit(new_s)
            new_s.setRegion(base[0])
            squadron_data.append(new_s)
    return squadron_data


def get_users_from_api(count):
    req = requests.get(
        'https://api.ccga-stage.innovexa.cloud/authentication/v2/users?perPage=10000&page={}&sortOn=lastName&orderBy=asc&shouldExpandResults=false&attributeScope=basic&toCSV=false'.format(count),
        headers=HEADERS)
    users_data = []
    res = req.json()
    if res["isSuccess"]:
        users = res["data"]["results"]
        for user in users:
            new_s = User(user.get("uid"), user.get("email"), "",
                         user.get("givenName"), user.get("middleName", ""), user.get("lastName"),
                         user.get("addressLine1"),
                         user.get("addressLine2"), user.get("city"), "", "CA", user.get("postalCodeZip"),
                         user.get("gluuStatus"),
                         user.get("primarySquadron", None), user.get("regionId"), user.get("membershipType"), None,
                         None, None, None, None, user.get("squadronIDs"))
            users_data.append(new_s)
            if res["data"]["areMoreResultsAvailable"]:
                users_data = users_data + get_users_from_api(count+1)
    return users_data

def get_users_from_api_region(region):
    req = requests.get(
        'https://api.ccga-stage.innovexa.cloud/authentication/v2/users?q=regionId%3A{}'
        '&perPage=10000&page=1&sortOn=lastName&orderBy=asc&shouldExpandResults=false'
        '&attributeScope=basic&toCSV=false'.format(region),
        headers=HEADERS)
    users_data = []
    res = req.json()
    if res["isSuccess"]:
        users = res["data"]["results"]
        for user in users:
            new_s = User(user.get("uid"), user.get("email"), "",
                         user.get("givenName"), user.get("middleName", ""), user.get("lastName"),
                         user.get("addressLine1"),
                         user.get("addressLine2"), user.get("city"), "", "CA", user.get("postalCodeZip"),
                         user.get("gluuStatus", ""),
                         user.get("primarySquadron", None), user.get("regionId"), user.get("membershipType"), None,
                         None, None, None, None, user.get("squadronIDs"))
            users_data.append(new_s)
    return users_data




def sync_squadrons_with_old_id(new_units, old_units):
    units = {}
    print("New Units Size : {}".format(len(new_units)))
    print("Old Units Size : {}".format(len(old_units)))
    squad_list = []
    for old_unit in old_units:
        found = False
        for new_unit in new_units:
            if html.unescape(new_unit.name) == old_unit.name:
                found = True
                # update_active(new_unit, old_unit)
                new_unit.setOldId(old_unit.id)
                b = new_unit.region
                # s = b.getUnit(new_unit.id)
                # s.setOldId(old_unit.id)
                squad_list.append(str(new_unit.id))
                units["{}-{}".format(old_unit.id, b.id)] = new_unit
        if not found:
            print(old_unit.jsonfy())
    print("Updated Units Size : {}".format(len(units)))
    # print(squad_list)
    return units


def update_active(new_unit, old_unit):
    dump = {
        "isActive": bool(old_unit.active),
    }
    url = URL + UNIT_PATCH_URL + new_unit.id
    req = requests.patch(url, json.dumps(dump), headers=HEADERS)
    res = req.json()
    if not res["isSuccess"]:
        print("Error at primary for user with uid {}".format(new_unit.id))
        return -1
    else:
        return 1


def sync_units_with_squadron_id(new_users, old_users, units):
    errors = []
    not_found = []
    count = 0
    print("total number of new users: {}".format(len(new_users)))
    print("total number of old users: {}".format(len(old_users)))
    for old_user in old_users:
        found = False
        for new_user in new_users:
            if count >= 0:
                if new_user.email == old_user.email:
                    count += 1
                    print("{}/{}".format(count, len(old_users)))
                    found = True
                    url_primary_squad = URL + USER_SQUAD.format(new_user.userId)
                    unit = units.get("{}-{}".format(old_user.primary_unit, new_user.region_id))
                    remove = []
                    if unit is not None:
                        for el in new_user.squadronIDs:
                            if el != str(new_user.primary_unit):
                                remove.append(el)
                        body = {
                            "squadronsIdsToRemove": remove,
                            # "squadronIdsToAdd": [
                            #     str(unit.id)
                            # ],
                            # "primarySquadron": int(unit.id)
                        }
                        req = requests.patch(url_primary_squad, json.dumps(body), headers=HEADERS)
                        res = req.json()
                        # print(res)
                        if not res["isSuccess"]:
                            print("Error at primary for user with uid {}".format(new_user.userId))
                            errors.append({"data": new_user.jsonfy(), "message": res["message"]})
                    else:
                        errors.append({"data": new_user.jsonfy(),
                                           "message": "Unit {} was not found".format(old_user.primary_unit)})
                        break
        if not found:
            not_found.append({"data": old_user.jsonfy()})
            # numb, mes = add_user(old_user)
            # if numb == -1:
            #     errors.append({"data": old_user.jsonfy(), "message": mes})
    return errors, not_found


def sync_units_with_certifacts(new_users, old_users, units):
    errors = []
    not_found = []
    for old_user in old_users:
        found = False
        for new_user in new_users:
            if new_user.email == old_user.email:
                found = True
                if new_user.primary_unit is None:
                    url_primary_squad = URL + USER_SQUAD.format(new_user.userId)
                    unit = units.get("{}-{}".format(old_user.primary_unit, new_user.region_id))
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
                            print("Error at primary for user with uid {}".format(new_user.userId))
                            errors.append({"data": new_user.jsonfy(), "message": res["message"]})
                    else:
                        errors.append({"data": new_user.jsonfy(),
                                       "message": "Unit {} was not found".format(old_user.primary_unit)})
                break
        if not found:
            not_found.append({"data": old_user.jsonfy()})
            # numb, mes = add_user(old_user)
            # if numb == -1:
            #     errors.append({"data": old_user.jsonfy(), "message": mes})
    return errors, not_found


def sync_assets_with_squadron_id(new_assets, units):
    errors = []
    not_found = []
    for new_asset in new_assets:
        unit_name = new_asset['unitName']
        unit = units.get("{}-{}".format(new_asset['unitId'], new_asset['primaryRegionId']))
        if unit is not None:
            if unit.name == unit_name:
                numb = update_asset(new_asset, unit, new_asset['primaryRegionId'])
                if numb == -1:
                    errors.append({"data": new_asset})
    return errors, not_found
