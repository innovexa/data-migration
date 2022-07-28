import base64
import json

import requests
from mysql.connector import MySQLConnection, Error
from urllib3.connectionpool import xrange
from datetime import datetime, timedelta

from CCGA_user_migration import create_user_no_email
from asset_migration import create_asset
from zone_migration import *

HEADERS = {'Content-type': 'application/json'}

DEV = 'https://api.ccga-dev.innovexa.cloud'
STAGE = 'https://api.ccga-stage.innovexa.cloud'

base = [
    Region(22, "Québec", 21),
    Region(23, "Pacific", 21),
    Region(24, "Maritimes", 21),
    Region(25, "Central and Artic", 21),
    Region(26, "NewFoundLand and Labrador", 21)
]

PARENT_REGIONS = {
    "ccga q": base[0],
    "pacific": base[1],
    "maritimes": base[2],
    "central_arctic": base[3],
    "nlcc": base[4]
}


def set_default(obj):
    if isinstance(obj, set):
        return list(obj)
    raise TypeError


def get_zone_info(squad_id):
    url = STAGE + '/authentication/v2/squadrons?q=squadronId:{}&shouldExpandResults=true'.format(str(squad_id))
    req = requests.get(url, HEADERS)
    res = req.json()
    if res["isSuccess"]:
        res_data = res["data"]
        if res_data['resultsTotal'] == 1:
            res_data = res_data['results'][0]
            return [res_data['districtId'], res_data['districtNameEN']]
    else:
        return 0


def flatten(arr):
    flat_list = []
    for sublist in arr:
        for item in sublist:
            flat_list.append(item)
    return flat_list


def fetch_something_from_DB(uid, db, table):
    try:
        dbconfig = {
            "host": "localhost",
            "database": db,
            "user": "root",
            "password": "password"
        }
        conn = MySQLConnection(**dbconfig)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM {} WHERE `id` = {}".format(table, uid))

        row = cursor.fetchone()

    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return row


def get_asset_from_db(uid, db):
    try:
        dbconfig = {
            "host": "localhost",
            "database": db,
            "user": "root",
            "password": "password"
        }
        conn = MySQLConnection(**dbconfig)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT sar_vessel.id, sar_vessel.suid, sar_vessel.name, sar_vessel.info, sar_vessel.active, "
            "sar_vessel.value, sar_vessel.ais, sar_vessel.global, sar_vessel.lat, sar_vessel.lon, "
            "sar_vessel.mmsi, sar_vessel.asoffset, sar_vessel.hidden, sar_vessel.asdate, "
            "sar_vessel.idate, sar_vessel.odate, sar_vessel.srtid, sar_vessel_class.name, sar_vessel_type.name "
            "FROM sar_vessel, sar_vessel_class, sar_vessel_type "
            "WHERE sar_vessel.id = {} "
            "AND sar_vessel.svcid = sar_vessel_class.id "
            "AND sar_vessel.svtid = sar_vessel_type.id".format(uid))

        row = cursor.fetchone()
        new_reg = Asset(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10],
                        row[11], parent.id, row[12], row[13], row[14], row[15], row[16], row[17], row[18])

    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return new_reg


def create_submission(data):
    url = "{}/workflow/forms/sarform/submission".format(STAGE)
    req = requests.post(url, data=json.dumps(data), headers=HEADERS)
    res = req.json()
    if req.status_code == 201:
        return 1, "SUCCESS"
    else:
        return -1, res["Errors"]


def mission_log(data):
    main = []
    for key, d in data.items():
        temp = {}
        data_decoded = {k.decode('ISO-8859-1'): v.decode('ISO-8859-1') for k, v in d.items()}
        if data_decoded['time'] and data_decoded["description"]:
            temp["time"] = data_decoded["time"]
            temp["desc"] = data_decoded["description"]
            main.append(temp)
    return main


def get_unit_name(id):
    url = "{}/authentication/v2/squadron/{}".format(STAGE, id)
    req = requests.get(url, headers=HEADERS)
    res = req.json()
    if res["isSuccess"]:
        return res["name_en"]
    else:
        return None


def get_uid_from_email(email):
    url = "{}/authentication/v2/users?q=email:{}&perPage=50&shouldExpandResults=true&attributeScope=basic&toCSV=false".format(
        STAGE, email
    )
    req = requests.get(url, headers=HEADERS)
    res = req.json()
    if res['isSuccess'] and res['data']['resultsTotal'] > 0:
        return res['data']['results'][0]
    else:
        return None


def get_user_from_name(first, last):
    url = "{}/authentication/v2/users?q=givenName%3A%22{}%22lastName%3A%22{}%22&perPage=8870&page=1&sortOn=uid&" \
          "orderBy=asc&shouldExpandResults=false&attributeScope=basic&toCSV=false".format(STAGE, first, last)
    req = requests.get(url, headers=HEADERS)
    res = req.json()
    if res['isSuccess'] and res['data']['resultsTotal'] > 0:
        return res['data']['results'][0]
    else:
        return None


def get_agency(uid, db):
    try:
        dbconfig = {
            "host": "localhost",
            "database": db,
            "user": "root",
            "password": "password"
        }
        conn = MySQLConnection(**dbconfig)
        cursor = conn.cursor()
        cursor.execute("select so.name from sar_incident_oagency_xref ox "
                       "INNER JOIN sar_oagency so ON ox.soaid = so.id "
                       "WHERE ox.siid = {}".format(uid))

        row = cursor.fetchone()

    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return row


def get_uid_from_incident(uid, db):
    incidents = []
    try:
        dbconfig = {
            "host": "localhost",
            "database": db,
            "user": "root",
            "password": "password"
        }
        conn = MySQLConnection(**dbconfig)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT  p.spid, per.first_name, per.last_name, per.suid FROM sar_incident_person_xref p "
                       "INNER JOIN sar_incident i ON i.id = p.siid "
                       "INNER JOIN sar_person per ON p.spid = per.id "
                       "WHERE p.siid =  {}".format(uid))

        row = cursor.fetchone()
        while row is not None:
            incidents.append(row)
            row = cursor.fetchone()

    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return incidents


def get_assets_from_api():
    assets = {}
    url = "https://api.ccga-stage.innovexa.cloud/idc-user-api/assets/search"
    payload = {
        "filters": [
            {
                "field": "primaryRegionId",
                "filterType": "set",
                "values": [
                    22, "22", 23, "23", 24, "24", 25, "25", 26, "26", 27, "27"
                ]
            }
        ],
        "perPage": 2000,
        "page": 1
    }
    req = requests.post(url, data=json.dumps(payload), headers=HEADERS)
    if req.status_code == 200:
        res = req.json()
        for d in res["data"]:
            assets["{}-{}".format(d["oldId"], d["primaryRegionId"])] = d
        return assets


def get_danger(number):
    dangers = {
        '1': 'Immediate Danger',
        '2': 'Potential Danger',
        '3': 'No Danger',
        '4': 'False Alarm or Hoax'
    }
    return dangers[str(number)]


def get_pollution(number):
    pollutions = [
        None,
        'A Factor',
        'Primary Concern'
    ]
    return pollutions[number]


def get_assistance(uid):
    if uid == 0:
        return 'none'
    elif uid == 1:
        return 'notAvailable'
    elif uid == 2:
        return 'acceptedHandoffTo'
    elif uid == 3:
        return 'acceptedTookOverFrom'
    elif uid == 4:
        return 'acceptedJoint'
    elif uid == 5:
        return 'declined'
    else:
        return False


def get_paged(uid):
    if uid == 0:
        return 'Paged'
    elif uid == 1:
        return 'VHF/Cell(Underway)'
    elif uid == 2:
        return 'Sighted/Self'
    else:
        return False


def get_departed(uid):
    if uid == 0:
        return 'Departed'
    elif uid == 1:
        return 'Stood Down'
    else:
        return False


def get_on_scene(uid):
    if uid == 0:
        return 'On-Scene'
    elif uid == 1:
        return 'Stood-Down'
    else:
        return False


def getAwsUrl(db):
    if db == 'central_arctic':
        return "https://ccgaca.s3.amazonaws.com/images/SAR/{}"
    if db == 'maritimes':
        return "http://www.ccga-m.ca/images/SAR/{}"
    if db == 'pacific':
        return "https://ccgapacific.s3.amazonaws.com/images/SAR/{}"
    if db == 'ccga q':
        return "https://gcacquebec.s3.amazonaws.com/images/SAR/{}"


def getImages(db, uid):
    images = []
    try:
        dbconfig = {
            "host": "localhost",
            "database": db,
            "user": "root",
            "password": "password"
        }
        conn = MySQLConnection(**dbconfig)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM images WHERE `object` = 'sar_incident' AND"
                       " `iid` =  {}".format(uid))

        row = cursor.fetchone()
        while row is not None:
            images.append(row)
            row = cursor.fetchone()

    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return images


def uploadAttachment(db, file):
    file_name = file['filename']
    extension = file_name.split('.')[1]
    url = getAwsUrl(db).format(file_name)
    attachment = requests.get(url)
    url_uploader = '{}/uploader/upload/ccga-test'.format(STAGE)
    f = open('./temp.{}'.format(extension), 'wb+')
    f.write(attachment.content)
    files = {'file': (file_name, f, attachment.headers.get('Content-Type'))}
    req = requests.post(url_uploader, files=files)
    if req.status_code == 200:
        res = req.json()
        if res['isSuccess']:
            uploaded = res['data']
            return uploaded['success'][0]
        else:
            return -1
    else:
        return -1


regs = get_regions_from_api(base)
zones = get_districts_from_api(base)
units = get_squadrons_from_api(base)
units_2 = get_units()
updated = sync_squadrons_with_old_id(units, units_2)
assets = get_assets_from_api()
errors = []
try:
    for db, parent in PARENT_REGIONS.items():
        incidents = []
        dbconfig = {
            "host": "localhost",
            "database": db,
            "user": "root",
            "password": "password"
        }
        conn = MySQLConnection(**dbconfig)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM sar_incident")

        incidents = cursor.fetchall()
        # while row is not None:
        #     incidents.append(row)
        #     row = cursor.fetchone()

        org_id = parent.id
        errors = []
        for incident in incidents:
            try:
                old_unit_1 = updated.get("{}-{}".format(incident['suid'], org_id))
                if incident['suid2'] != 0:
                    old_unit_2 = updated.get("{}-{}".format(incident['suid2'], org_id))
                if incident['suid3'] != 0:
                    old_unit_3 = updated.get("{}-{}".format(incident['suid3'], org_id))
                if incident['suid4'] != 0:
                    old_unit_4 = updated.get("{}-{}".format(incident['suid4'], org_id))
                addData_encoded = phpserialize.loads(base64.b64decode(incident['info']))
                addData = {k.decode('ISO-8859-1'): v for k, v in addData_encoded.items()}
                assisted_vessel_encoded = addData['assist_vessel']
                assisted_vessel = {k.decode('ISO-8859-1'): v for k, v in assisted_vessel_encoded.items()}
                zone_info = get_zone_info(old_unit_1.id)
                asset_used = get_asset_from_db(incident['svid'], db)
                asset_get = assets.get("{}-{}".format(asset_used.uid, org_id))
                agency = get_agency(incident['id'], db)
                images = getImages(db, incident['id'])
                images_data = []
                for image in images:
                    url_image = uploadAttachment(db, image)
                    if url_image != -1:
                        images_data.append({'url': url_image, 'isImage': True})
                    else:
                        errors.append({"Error": "Image Upload Error", "SAR": incident})
                if asset_get is None:
                    num, asset_get = create_asset(asset_used, updated)
                    if num == -1:
                        errors.append({"Error": "Asset Error", "SAR": "{}".format(incident)})
                rateReq = requests.get(
                    "{}/idc-user-api/rates/searchRate?expenseType=Global.Mission&reportDate=2019-10-21&rateID={}".format(
                        STAGE, asset_get['reimbursementRateId']))
                rateResp = rateReq.json()
                coxwainId = incident['m_spid']
                cox = fetch_something_from_DB(coxwainId, db, 'users')
                if cox is None:
                    temp_cox = fetch_something_from_DB(coxwainId, db, 'sar_person')
                    person_cox = get_user_from_name(temp_cox['first_name'], temp_cox['last_name'])
                    if person_cox is None:
                        mem_stat = fetch_something_from_DB(temp_cox['spsid'], db, 'sar_person_status')
                        created, mes = create_user_no_email(temp_cox, parent.id, mem_stat, updated)
                        person_cox = get_user_from_name(temp_cox['first_name'], temp_cox['last_name'])

                else:
                    person_cox = get_uid_from_email(cox["email"])

                additional_Units = []
                allSelectedPersonnel = []
                tables = get_uid_from_incident(incident["id"], db)
                otherUnitPersonel = []
                names = ''
                other_names = ''
                for table in tables:
                    if table['spid'] != incident['m_spid']:
                        person_data = fetch_something_from_DB(table['spid'], db, 'users')
                        if person_data is None:
                            temp_person = fetch_something_from_DB(table['spid'], db, 'sar_person')
                            person_data = get_user_from_name(temp_person['first_name'], temp_person['last_name'])
                            if person_data is None:
                                mem_stat = fetch_something_from_DB(table['spid'], db, 'sar_person_status')
                                created, mes = create_user_no_email(temp_person, parent.id, mem_stat, updated)
                                person_data = get_user_from_name(temp_cox['first_name'], temp_cox['last_name'])
                        else:
                            person_data = get_uid_from_email(person_data["email"])
                        names += "{} {},".format(person_data["givenName"], person_data["lastName"])
                        asset_t = {
                            'asset': {
                                'id': asset_get.get("id"),
                                "assetTitle": asset_get.get("assetTitle"),
                                "unitId": asset_get.get("unitId"),
                                "reimbursementRate": asset_get.get("reimbursementRateId")
                            }
                        }
                        personnel = {
                            'personnel': {
                                "uid": person_data["uid"],
                                "givenName": person_data["givenName"],
                                "lastName": person_data["lastName"],
                                "regionId": person_data["regionId"],
                                "primarySquadron": person_data["primarySquadron"],
                                "fullName": "{} {}".format(person_data["givenName"], person_data["lastName"])
                            },
                            'asset': asset_t
                        }
                        if (incident['suid2'] != 0 and old_unit_2.id == person_data["primarySquadron"]):
                            other_names += "{} {},".format(person["givenName"], person["lastName"])
                            additional_Units.append(personnel)
                        else:
                            allSelectedPersonnel.append(personnel)
                unitArr = [
                    {"selectedAssetsAndCoxwain": [
                        {
                            "rate": rateResp['data']['results'][0]['amount'],
                            "asset": {
                                "id": asset_get.get("id"),
                                "assetTitle": asset_get.get("assetTitle"),
                                "unitId": asset_get.get("unitId"),
                                "reimbursementRate": asset_get.get("reimbursementRateId")
                            },
                            "coxwain": [
                                {
                                    "uid": person_cox["uid"],
                                    "givenName": person_cox["givenName"],
                                    "lastName": person_cox["lastName"],
                                    "regionId": person_cox["regionId"],
                                    "primarySquadron": person_cox["primarySquadron"],
                                    "fullName": "{} {}".format(person_cox["givenName"], person_cox["lastName"])
                                }
                            ]
                        }
                    ],
                        "allSelectedPersonnel": allSelectedPersonnel,
                        "allSelectedPersonnelOnLand": [],
                        "label": old_unit_1.name,
                        "value": old_unit_1.id}
                ]
                first_time_off, second_time_off = None, None
                if int(incident.get('off_time')) != 0:
                    time_off = str(incident.get('off_time')).split('.')
                    first_time_off = incident['mdate']
                    second_time_off = first_time_off + datetime.timedelta(hours=time_off[0], minutes=time_off[1])
                issue_status = 'notcomplete'
                if incident['submitted']:
                    issue_status = 'submitted'
                if incident['closed']:
                    issue_status = 'closed'
                if addData.get('dhtrboats', None) != None and addData['dhtrboats'].decode('ISO-8859-1') != '':
                    if int(addData['dhtrboats'].decode('ISO-8859-1')) != 0:
                        for t in addData['tow']:
                            firstCall = True
                            timeToSend = "{:02d}".format(t)
                towDetails = {k.decode('ISO-8859-1'): v.decode('ISO-8859-1') for k, v in addData['tow'].items()}
                escortDist = towDetails['distance']
                escortTime = towDetails['time']
                causeArray = []
                if incident['sicid2'] != 0:
                    causeArray.append(fetch_something_from_DB(incident['sicid2'], db, 'sar_incident_cause')['name'])

                if incident['sicid3'] != 0:
                    causeArray.append(fetch_something_from_DB(incident['sicid3'], db, 'sar_incident_cause')['name'])
                data = {
                    "alertType": fetch_something_from_DB(incident['siatid'], db, 'sar_incident_alerttype')['name'],
                    "certification": [],
                    "classification": get_danger(incident['distress']),
                    "contactCountry": "CA",
                    "daughterBoatTime": "",
                    "escortDist": escortDist,
                    "escortTime": escortTime,
                    "fileUpload": [],
                    "firstAid": "",
                    "flattenOtherCause": "",
                    "flattenOtherResources": agency,
                    "flattenTaskingAuthority": "",
                    "flattenfileUpload": "",
                    "garScore": "",
                    "grossTonnage": "",
                    "incidentTitle": incident['title'],
                    "issueStatus": issue_status,
                    "issueType": "SAR",
                    "map": {
                        "lng": incident['lon'],
                        "lat": incident['lat']
                    },
                    "notes": addData['description'].decode('ISO-8859-1'),
                    "operationType": "",
                    "otherCause": causeArray,
                    "otherResource": [],
                    "participatingUnit": {
                        "unitArr": unitArr,
                        'flattenAllPersonnel': names,
                        'flattenUnits': old_unit_1.name,
                        'flattenAssets': asset_get['assetTitle'],
                        'flattenCoxwains': "{} {}".format(person_cox["givenName"], person_cox["lastName"]),
                        'additional': additional_Units,
                        'flattenAdditional': other_names
                    },
                    "primaryCause": "",
                    "primaryRegionId": parent.id,
                    "regionName": parent.name_en,
                    "reimbursementNote": {"String"},
                    "resourceAdditionalInfo": "",
                    "seaCurrent": addData['current'].decode('ISO-8859-1'),
                    "status": "Active",
                    "submittedBy": {
                        "lastName": person_cox["lastName"],
                        "firstName": person_cox["givenName"],
                        "uid": person_cox["uid"]
                    },
                    "syncToProd": True,
                    "taskingAuthority": [
                    ],
                    "timeline": {
                        "incidentDate": str(incident['pag_date']),
                        "method": get_paged(incident['advised']),
                        "methodDate": str(incident['pag_date']),
                        "taskedDate": str(incident['tsk_date']),
                        "departure": get_departed(incident['depart_type']),
                        "departureDate": str(incident['dep_date']),
                        "scene": get_on_scene(incident['on_scene']),
                        "onSceneDate": str(incident['arr_date']),
                        "opEndedDate": str(incident['stp_date']),
                        "returnToBaseDate": str(incident['rtb_date']),
                        "returnToNormalDate": str(incident['rno_date']),
                        "timeOffFromDate": str(first_time_off) if first_time_off else None,
                        "timeOffToDate": str(second_time_off) if second_time_off else None,
                        "calculatedTime": "",
                        "timezoneOverride": str(incident['pag_date'])
                    },
                    "unitName": old_unit_1.name,
                    "vesselCountry": "CA",
                    "vesselLoa": {
                        "value": assisted_vessel['loa'].decode('ISO-8859-1') if assisted_vessel['loa'].decode(
                            'ISO-8859-1') else 0
                    },
                    "vesselRegistration": assisted_vessel['license'].decode('ISO-8859-1'),
                    "vesselValue": assisted_vessel['value'].decode('ISO-8859-1'),
                    "wasTowingInvolved": True if escortDist else False,
                    "windDirection": incident['winddir'],
                    "windSpeed": str(incident['windspeed']),
                    ############################
                    "isMigrated": True,
                    "designationNumber": incident["number"],
                    "supplement": incident['supplement'],
                    "refId": incident['id'],
                    "regionId": old_unit_1.region_id,
                    "zoneId": zone_info[0],
                    "zoneName": zone_info[1],
                    "migrated": True,
                    "unitId": old_unit_1.id,
                    'detection': fetch_something_from_DB(incident['sidid'], db, 'sar_incident_detection')['name'],
                    'action': fetch_something_from_DB(incident['siaid'], db, 'sar_incident_action')['name'],
                    'pollution': get_pollution(incident['polution']),
                    'commercialAssistance': get_assistance(incident['comassist']),
                    'speed': incident['windspeed'],
                    'direction': incident['winddir'].lower(),
                    'airTemperature': addData.get('airtemp', b'0').decode('ISO-8859-1'),
                    'current': addData['current'].decode('ISO-8859-1'),
                    'seas': incident['seas'],
                    'closedDate': str(incident['cdate']),
                    'seaTemp': addData.get('seatemp', b'0').decode('ISO-8859-1'),
                    'tide': addData.get('tide', 0).lower().decode('ISO-8859-1'),
                    'visibility': incident['visibility'],
                    'weatherDescription': addData.get('weather', b'').decode('ISO-8859-1'),
                    'total': int(incident['pob']) if incident['pob'] > 0 else 0,
                    'assisted': int(incident['passisted']) if incident['passisted'] > 0 else 0,
                    'saved': int(incident['psaved']) if incident['psaved'] > 0 else 0,
                    'missing': int(incident['pmissing']) if incident['pmissing'] > 0 else 0,
                    'lost': int(incident['plost']) if incident['plost'] > 0 else 0,
                    'vesselName': (assisted_vessel['name']).decode('ISO-8859-1'),
                    'vesselType':
                        fetch_something_from_DB(assisted_vessel['svcid'].decode('ISO-8859-1'), db, 'sar_vessel_class')[
                            'name'],
                    'registration': (assisted_vessel['license']).decode('ISO-8859-1'),
                    'nationality': 'CA',
                    'loa': assisted_vessel['loa'].decode('ISO-8859-1') if assisted_vessel['loa'].decode(
                        'ISO-8859-1') else 0,
                    'gt': assisted_vessel['gt'].decode('ISO-8859-1') if assisted_vessel['gt'].decode(
                        'ISO-8859-1') else 0,
                    'value': (assisted_vessel['value']).decode('ISO-8859-1'),
                    "draft": {"value": assisted_vessel['draft'].decode('ISO-8859-1') if assisted_vessel['draft'].decode(
                        'ISO-8859-1') else 0},
                    'vesselNotes': (assisted_vessel['notes']).decode('ISO-8859-1'),
                    'contactPersonName': assisted_vessel['master'].decode('ISO-8859-1') if assisted_vessel[
                        'master'].decode(
                        'ISO-8859-1') else '',
                    'contactPersonOwner': assisted_vessel['owner'].decode('ISO-8859-1'),
                    'contactAddress': "{} {}".format(assisted_vessel.get('address1', '').decode('ISO-8859-1'),
                                                     assisted_vessel.get('address2', '').decode('ISO-8859-1')),
                    'contactEmail': (assisted_vessel.get('email', b'')).decode('ISO-8859-1'),
                    'contactGender': (assisted_vessel['sex']).decode('ISO-8859-1'),
                    'contactCertified': assisted_vessel['pcoc'].decode('ISO-8859-1'),
                    'contactAge': (assisted_vessel['age']).decode('ISO-8859-1'),
                    'contactTelephone': (assisted_vessel['telephone1']).decode('ISO-8859-1'),
                    'missionlog': mission_log(addData['events']),
                    'missionLogDesc': (addData['description'].decode('ISO-8859-1')),
                    "dateCreated": str(incident['cdate'])
                }
                url = "https://api.ccga-stage.innovexa.cloud/idc-user-api/sarform/create"
                req = requests.post(url, data=json.dumps(data, default=set_default), headers=HEADERS)
                if req.status_code == 200:
                    res = req.json()
                else:
                    res = req.json()
                    errors.append({"Error": res["Errors"], "SAR": incident})
            except:
                errors.append({"Error": "Failed SAR", "SAR": incident})
        with open("stage_sar.json", "w") as file:
            file.write("[")
            for unit in errors:
                json.dump(unit, file)
                file.write(",")
            file.write("]")
except Error as e:
    print(e)

finally:
    cursor.close()
    conn.close()
