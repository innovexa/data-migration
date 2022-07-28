import base64
import html
from datetime import datetime
from pprint import pprint

import pandas
import phpserialize
import requests
import json
from mysql.connector import MySQLConnection, Error
import csv

from add_functions import add_user
from user_migration import get_gluu_users, create_user

DEV = 'https://api.ccga-dev.innovexa.cloud'
STAGE = 'https://api.ccga-stage.innovexa.cloud'


def getRegionUsers(uid):
    url = "https://api.ccga-stage.innovexa.cloud/authentication/v2/users?q=regionId:{}&perPage=10000" \
          "&page=1&sortOn=uid&orderBy=asc&shouldExpandResults=false&attributeScope=basic".format(uid)
    headers = {'Content-type': 'application/json'}
    req = requests.get(url, headers=headers)
    if req.status_code != 200:
        return {"error": "squad", "message": req.status_code}
    res = req.json()
    if res["isSuccess"]:
        data_user = res["data"]
        data = data_user["results"]
        df = pandas.DataFrame(data)
        df.to_csv('martimes_users.csv', encoding='utf-8', index=False)
        with open('JSON/martimes_users.json', 'w') as outfile:
            json.dump(data, outfile)


def getUsers():
    f = open("JSON/migration_errors.json", "r")
    data = json.load(f)
    users = data["users"]
    user_data = []
    for row in users:
        user_data.append(row["_source"])
    f.close()
    return user_data


def getLastUid():
    try:
        dbconfig = {
            "host": "localhost",
            "database": "authentication",
            "user": "root",
            "password": "password"
        }
        conn = MySQLConnection(**dbconfig)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM gluu_user ORDER BY `uid` DESC LIMIT 1")

        row = cursor.fetchone()
        return row[0]

    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()


def addUser(data):
    try:
        url = 'https://api.ccga-stage.innovexa.cloud/authentication/v2/' \
              'users?q=email:{}&perPage=30&page=1&sortOn=uid&orderBy=asc&' \
              'shouldExpandResults=false&attributeScope=basic&toCSV=false'.format(data["email"])
        headers = {'Content-type': 'application/json'}
        req = requests.get(url, json.dumps(data), headers=headers)
        if req.status_code != 200:
            return {"error": "squad", "message": req.status_code, "data": data}
        res = req.json()
        if res["isSuccess"]:
            data_user = res["data"]
            if data_user["resultsTotal"] == 1:
                res = data_user["results"][0]
                uid = res["uid"]
                primary = data.get("primarySquadron", None)
                if primary is None:
                    return {"error": "squad", "id": uid, "message": "No SquadronIds"}
                if uid is None:
                    return {"error": "squad", "id": uid, "message": "No Uid"}
                squads = data["squadronIDs"]
                package = {
                    "squadronIdsToAdd": squads,
                    "primarySquadron": int(primary)
                }
                url_patch = 'https://api.ccga-stage.innovexa.cloud/authentication/v2/user/{}/squadrons'.format(uid)
                squad = requests.patch(url_patch, json.dumps(package), headers=headers)
                res_squad = squad.json()
                if not res_squad["isSuccess"]:
                    return {"error": "squad", "id": uid, "message": res_squad["message"], "data": res_squad["data"]}
                else:
                    return None
        else:
            return {"error": "create", "user": data, "message": res["message"]}
    except KeyError as e:
        print("key error with {}".format(data))
        print(e)
        return {"error": "create", "user": data}


def removeSquadrons(user):
    url = 'https://api.ccga-stage.innovexa.cloud/authentication/v2/user/{}/squadrons'.format(user.userId)
    headers = {'Content-type': 'application/json'}
    squads = user.squadronIDs
    package = {
        "squadronsIdsToRemove": squads
    }
    req = requests.patch(url, json.dumps(package), headers=headers)

    squadron = open('JSON/squad_failure.txt', 'w')
    if req.status_code != 200:
        print(req.status_code)
        print(url)
    res = req.json()
    if not res["isSuccess"]:
        squadron.write(json.dumps(res) + "\n")


def deleteSquadrons():
    url = 'https://api.ccga-stage.innovexa.cloud/authentication/v3/squadrons?q=regionId%3A14&perPage=82' \
          '&page=1&sortOn=nameEN&orderBy=asc&shouldExpandResults=false'
    headers = {'Content-type': 'application/json'}
    req = requests.get(url, headers=headers)
    if req.status_code != 200:
        return {"error": "squad", "message": req.status_code}
    res = req.json()
    if res["isSuccess"]:
        print(res[""])
        squads = res["data"]["results"]
        for squad in squads:
            url_2 = 'https://api.ccga-stage.innovexa.cloud/dashboard/task/deleteSquadron/' \
                    'squadrons/{}'.format(squad["squadronId"])
            headers = {
                'Content-type': 'application/json',
                'Authorization': 'Bearer b25263de-90e2-43e9-8ea6-e719c2a65857'
            }
            req = requests.post(url_2, headers=headers)
            res = req.json()
            print(res)


def set_user_squadron(unit, uid):
    if unit is not None:
        body = {
            "squadronIdsToAdd": [
                str(unit.id)
            ],
            "primarySquadron": int(unit.id)
        }
        req = requests.patch('{}/authentication/v2/user/{}/squadrons'.format(STAGE, uid), json.dumps(body),
                             headers={'Content-type': 'application/json'})
        res = req.json()
        if not res["isSuccess"]:
            print("Error at primary for user with uid {}".format(uid))
            return -1, res["message"]
    else:
        return -1, "Unit Id was None"
    return uid, "DONE"

# Deprecated
def create_user_no_email(user, region, membership, units):
    info = phpserialize.loads(base64.b64decode(user.info))
    url = '{}/authentication/v2/migration/_createImportUser'.format(STAGE)
    info_decoded = {k.decode('ISO-8859-1'): v for k, v in info.items()}
    phone = []
    phone1 = ""
    phone2 = ""
    if 'phone1' in info_decoded:
        if info_decoded['phone1'].decode('ISO-8859-1') != '':
            phone.append(info_decoded['phone1'].decode('ISO-8859-1'))
    if 'phone2' in info_decoded:
        if info_decoded['phone2'].decode('ISO-8859-1') != '':
            phone.append(info_decoded['phone2'].decode('ISO-8859-1'))
    if 'phone3' in info_decoded:
        if info_decoded['phone3'].decode('ISO-8859-1') != '':
            phone.append(info_decoded['phone3'].decode('ISO-8859-1'))
    if 'phone4' in info_decoded:
        if info_decoded['phone4'].decode('ISO-8859-1') != '':
            phone.append(info_decoded['phone3'].decode('ISO-8859-1'))
    if len(phone) >= 2:
        phone1 = phone[0]
        phone2 = phone[1]
    elif len(phone) == 1:
        phone1 = phone[0]
        phone2 = ""
    province = get_province(user)

    uid = getLastUid() + 1
    unit = units.get('{}-{}'.format(user.primary_unit, region))
    payload = {
        "uid": str(uid),
        "givenName": user.first_name,
        "lastName": user.last_name,
        "homePhoneNumber": phone1,
        "workPhoneNumber": phone2,
        "middleName": user.middle_name,
        "addressLine1": user.address1,
        "addressLine2": user.address2,
        "city": user.city,
        "postalCodeZip": user.postal_code,
        "country": user.country if user.country and user.country != '' else "CA",
        "memberId": user.industry if user.industry and user.industry != '' else None,
        "regionId": region,
        "gluuStatus": "inactive"
    }
    if province != '':
        payload["provinceState"] = province
    req = requests.post(url, json.dumps(payload), headers={'Content-type': 'application/json'})
    if req.status_code == 200:
        res = req.json()
        if res['isSuccess']:
            print("Setting User Squadron")
            return set_user_squadron(unit, uid)
        else:
            return -1, "Error can't migrate user"
    return -1, "Error can't migrate user"


def get_new_email():
    uid = getLastUid() + 1
    return "{}@ccga-imported-user.com".format(uid)


def get_province(user):
    province = ""
    if user.province is None:
        return province
    if user.province.lower() == 'ab' or user.province.lower() == 'alberta':
        province = "AB"
    elif user.province.lower() == 'british columbia' or user.province.lower() == 'bc' or user.province.lower() == 'colombie-britannique':
        province = "BC"
    elif user.province.lower() == 'mb' or user.province.lower() == 'manitoba':
        province = "MB"
    elif user.province.lower() == 'new brunswick' or user.province.lower() == 'nouveau-brunswick' or user.province.lower() == 'nb':
        province = "NB"
    elif user.province.lower() == 'nouvelle-écosse' or user.province.lower() == 'ns' or user.province.lower() == 'nova scotia':
        province = "NS"
    elif user.province.lower() == 'ontario' or user.province.lower() == 'ont' or user.province.lower() == 'on':
        province = "ON"
    elif user.province.lower() == "qc" or user.province.lower() == "québec" \
            or user.province.lower() == "quebec" or user.province.lower() == 'qc.':
        province = "QC"
    elif user.province.lower() == 'saskatchewan' or user.province.lower() == 'saskatchewan' or user.province.lower() == 'sk':
        province = "SK"
    elif user.province.lower() == 'newfoundland and labrador' or user.province.lower() == 'nl' or user.province.lower() == "terre-neuve-et-labrador":
        province = "NL"
    elif user.province.lower() == 'northwest territories' or user.province.lower() == 'nt' or user.province.lower() == "territoires du nord-ouest":
        province = "NT"
    elif user.province.lower() == 'nunavut' or user.province.lower() == 'nu':
        province = "NU"
    elif user.province.lower() == 'prince edward island' or user.province.lower() == 'pe' or user.province.lower() == "île-du-prince-édouard":
        province = "PE"
    elif user.province.lower() == 'yukon' or user.province.lower() == 'yt':
        province = "YT"
    return province


def get_membership_type(user):
    types = ['NON_MEMBER', 'ASSOCIATE', 'ASSOCIATE_LIFE', 'REGULAR_LIFE', 'FORMER_ASSOCIATE', 'REGULAR',
             'FORMER_JUNIOR', 'REGULAR_LADY', 'HONORARY']


def update_user_details(user, region, new_user_id, info):
    url_update = "https://api.ccga-stage.innovexa.cloud/authentication/v2/user/{}/simpleAttributes".format(
        new_user_id
    )

    province = get_province(user)
    payload = {
        "givenName": user.first_name.strip(),
        "lastName": user.last_name.strip(),
        "preferredLanguage": "en",
        "middleName": user.middle_name.strip(),
        "addressLine1": user.address1.strip(),
        "addressLine2": user.address2.strip(),
        "city": html.unescape(user.city),
        "postalCodeZip": user.postal_code,
        "country": "CA",
        "membershipType": "REGULAR_LIFE",
        "profileType": "MEMBER",
        "regionId": region,
        "active": bool(user.active),
    }
    # if province != '':
    #     payload["provinceState"] = province,
    if info.get("phone1", b'').decode('ISO-8859-1') != '':
        payload['homePhoneNumber'] = info.get("phone1").decode('ISO-8859-1')
    if info.get("phone2", b'').decode('ISO-8859-1') != '':
        payload['workPhoneNumber'] = info.get("phone2").decode('ISO-8859-1')
    if info.get("phone4", b'').decode('ISO-8859-1') != '':
        payload['primaryFax'] = info.get("phone4").decode('ISO-8859-1')
    if info.get("occupation", b'').decode('ISO-8859-1') != '':
        payload['jobTitle'] = info.get("occupation").decode('ISO-8859-1')
    if user.birthday != '' and user.birthday is not None:
        payload['birthdate'] = user.birthday.strftime("%Y-%m-%d")
    if user.mdate != '' and user.mdate is not None:
        payload['memberDate'] = user.mdate.strftime("%Y-%m-%d")
    req = requests.patch(url_update, json.dumps(payload), headers={'Content-type': 'application/json'})
    if req.status_code != 200:
        return -1, "Response not 200"
    res = req.json()
    if res['isSuccess']:
        return 1, "Success"
    else:
        return -1, res["message"]


def update_admin_settings(old_user, new_user, info):
    headers = {'Content-type': 'application/json'}
    url_settings = 'https://api.ccga-stage.innovexa.cloud/idc-user-api/adminSetting/update/{}'.format(
        new_user.userId)

    old_user_number = int(old_user.number) if old_user.number.isdigit() else None

    # Admin Settings Object
    admin_settings = {
        "uid": new_user.userId,
        "number": old_user_number,
        "cdn": old_user.industry,
        "membershipJoinDate": str(old_user.mdate),
        "recordStatusInfo": {
            "adminStatus": '',
            "status": old_user.status,
            "type": old_user.coxswain,
            "note": ''
        },
        "notes": info.get("notes", b'').decode('ISO-8859-1'),
        "restrictedNotes": info.get("adminnotes", b'').decode('ISO-8859-1')
    }

    # Converting Date Object in format 00000000000000 to datatime object
    if info.get("record_check", b'').decode('ISO-8859-1') != '00000000000000' and info.get(
            "record_check", b'').decode('ISO-8859-1') != '':
        admin_settings['recordStatusInfo']['record_check_date'] = datetime.strptime(
            info.get("record_check", b'').decode('ISO-8859-1'), '%Y%m%d%H%M%S').strftime(
            "%m/%d/%Y, %H:%M:%S")
    if info.get("iddate", b'').decode('ISO-8859-1') != '00000000000000' and info.get("iddate",
                                                                                     b'').decode(
        'ISO-8859-1') != '':
        admin_settings['datePhotoIssued'] = datetime.strptime(
            info.get("iddate", b'').decode('ISO-8859-1'), '%Y%m%d%H%M%S').strftime(
            "%m/%d/%Y, %H:%M:%S")

    # Submitting Post Request
    req = requests.post(url_settings, json.dumps(admin_settings), headers=headers)
    if req.status_code != 200:
        return -1, "Can't Save Settings"
    else:
        return 1, "Success"


def update_user_contact(new_user, info):
    headers = {'Content-type': 'application/json'}
    url_contact = 'https://api.ccga-stage.innovexa.cloud/idc-user-api/contact/' \
                  'updateForUser/{}/user'.format(new_user.userId)
    contact_settings = []

    # Getting Phone Numbers
    if info.get("phone1", b'').decode('ISO-8859-1') != '':
        contact_settings.append({
            "type": "Home",
            "phoneNumber": info.get("phone1").decode('ISO-8859-1'),
            "privacy": "Private"
        })
    if info.get("phone2", b'').decode('ISO-8859-1') != '':
        contact_settings.append({
            "type": "Work",
            "phoneNumber": info.get("phone2").decode('ISO-8859-1'),
            "privacy": "Private"
        })
    if info.get("phone3", b'').decode('ISO-8859-1') != '':
        contact_settings.append({
            "type": "Mobile",
            "phoneNumber": info.get("phone3").decode('ISO-8859-1'),
            "privacy": "Private"
        })
    if info.get("phone4", b'').decode('ISO-8859-1') != '':
        contact_settings.append({
            "type": "Fax",
            "phoneNumber": info.get("phone4").decode('ISO-8859-1'),
            "privacy": "Private"
        })

    # Submitting Post Request
    req = requests.post(url_contact, json.dumps(contact_settings), headers=headers, timeout=3)
    if req.status_code != 200:
        return -1, "Can't Save Contacts"
    else:
        return 1, "Success"


def update_user_emergency(new_user, emergency_contact):
    headers = {'Content-type': 'application/json'}
    url_emergency = 'https://api.ccga-stage.innovexa.cloud/idc-user-api/contact/' \
                    'updateForUser/{}/emergency'.format(new_user.userId)

    # Getting Emergency Settings from Info
    emergency_settings = [
        {
            "name": emergency_contact.get('name', ''),
            "phoneNumber": emergency_contact.get('phone', ''),
            "relation": emergency_contact.get('relationship', '')
        }
    ]

    # Submitting Post request
    req = requests.post(url_emergency, json.dumps(emergency_settings), headers=headers, timeout=3)
    if req.status_code != 200:
        return -1, "Can't Save Emergency"
    else:
        return 1, "Success"


def update_user_address(new_user, old_user):
    headers = {'Content-type': 'application/json'}
    url_address = 'https://api.ccga-stage.innovexa.cloud/idc-user-api/address/' \
                  'updateForUser/{}/user'.format(new_user.userId)

    # Getting Address Setting, default type is Home
    address_settings = [
        {
            "addressLine1": old_user.address1,
            "addressLine2": old_user.address2,
            "city": old_user.city,
            "province": old_user.province,
            "country": old_user.country,
            "postalCode": old_user.postal_code,
            "type": "Home"
        }
    ]
    req = requests.post(url_address, json.dumps(address_settings), headers=headers)
    if req.status_code != 200:
        return -1, "Can't Save Address"
    else:
        return 1, "Success"


def user_data_migration(users, users_new, updated):
    user_errors = []
    duplicate_users = []
    count = 1
    headers = {'Content-type': 'application/json'}
    total_users = len(users)
    for old_user in users:
        found = False
        print("{}/{}".format(count, total_users))
        count += 1
        if old_user.email is not None and old_user.email != '':
            for new_user in users_new:
                if old_user.email == new_user.email and old_user.region_id == new_user.region_id:
                    # if old_user.email.strip() not in current_users:
                    #     res, error = create_user(new_user.userId, old_user.first_name, old_user.last_name,
                    #                              old_user.email.strip())
                    #     if res == -1:
                    #         mes.append(error)
                    found = True
                    try:
                        mes = []
                        # Getting User's Info
                        if old_user.info != None:
                            info_decoded = phpserialize.loads(base64.b64decode(old_user.info))
                            info = {k.decode('ISO-8859-1'): v for k, v in info_decoded.items()}
                            emergency_contact = {k.decode('ISO-8859-1'): v.decode('ISO-8859-1') for k, v in
                                                 info["econtact"].items()}
                        else:
                            info = {}
                            emergency_contact = {}

                        # Get Old User's Unit
                        print("Getting Old User's Unit")
                        unit = updated.get('{}-{}'.format(old_user.primary_unit, old_user.region_id))

                        print("Delete Old Squads")
                        removeSquadrons(new_user)
                        # Update User Details
                        # print("Updating User's details")
                        # num, error = update_user_details(old_user, old_user.region_id, new_user.userId, info)
                        # if num == -1:
                        #     mes.append(error)

                        # Update user squadron
                        # print("Setting squadron")
                        num, error = set_user_squadron(unit, new_user.userId)
                        if num == -1:
                            mes.append(error)

                        # Update User's Settings
                        # print("Setting Admin Settings")
                        # num, error = update_admin_settings(old_user, new_user, info)
                        # if num == -1:
                        #     mes.append(error)

                        # Update User's Contact Info
                        # num, error = update_user_contact(new_user, info)
                        # if num == -1:
                        #     mes.append(error)
                        #
                        # Update User's Emergency Contact Info
                        # num, error = update_user_emergency(new_user, emergency_contact)
                        # if num == -1:
                        #     mes.append(error)
                        #
                        # # Address
                        # num, error = update_user_address(new_user, old_user)
                        # if num == -1:
                        #     mes.append(error)

                        if len(mes) > 0:
                            user_errors.append({"data": new_user.jsonfy(), "message": mes})
                        break
                    except Exception as ex:
                        print(ex)
                        user_errors.append({"data": old_user.jsonfy(),
                                            "message": "TimedOut"})
                # else:
                #     duplicate_users.append(old_user.email)
            if not found:
                print("User with email {} Not Found in region {}, creating new User".format(old_user.email,
                                                                                            old_user.region_id))
                res, m = add_user(old_user, updated)
                print("Creating User with old id {} and region {}".format(old_user.old_id, old_user.region_id))
                if res == -1:
                    user_errors.append({"data": old_user.jsonfy(),
                                        "message": m})
        else:
            old_user.email = get_new_email()
            print("User's email is '{}' creating user with no email".format(old_user.email))
            num, error = add_user(old_user, updated)

            if num == -1:
                user_errors.append({"data": old_user.jsonfy(), "message": error})

    return user_errors, duplicate_users

# f = open("martimes_users.json", "r")
# users = json.load(f)
# for user in users:
#     removeSquadrons(user)
# data = getUsers()
# squad = []
# create = []
# squadron = open('squad_failure.txt', 'w')
# count = 0
# creation = open('create_failure.txt', 'w')
# for row in data:
#     print(count)
#     count += 1
#     res = addUser(row)
#     if res is None:
#         pass
#     elif res["error"] == "squad":
#         squadron.write(json.dumps(res) + "\n")
#     elif res["error"] == "create":
#         creation.write(json.dumps(res) + "\n")
# getRegionUsers(6)
