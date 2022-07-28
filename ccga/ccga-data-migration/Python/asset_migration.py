import datetime
import json
import phpserialize
import requests

from objects import *
from mysql.connector import MySQLConnection, Error

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

PARENT_REGIONS = {
    "ccga q": base[0],
    "pacific": base[1],
    "maritimes": base[2],
    "central_arctic": base[3],
    "nlcc": base[4]
}


def get_assets_from_db():
    assets = []
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
            cursor = conn.cursor()
            cursor.execute(
                "SELECT sar_vessel.id, sar_vessel.suid, sar_vessel.name, sar_vessel.info, sar_vessel.active, "
                "sar_vessel.value, sar_vessel.ais, sar_vessel.global, sar_vessel.lat, sar_vessel.lon, "
                "sar_vessel.mmsi, sar_vessel.asoffset, sar_vessel.hidden, sar_vessel.asdate, "
                "sar_vessel.idate, sar_vessel.odate, sar_vessel.srtid, sar_vessel_class.name, sar_vessel_type.name "
                "FROM sar_vessel, sar_vessel_class, sar_vessel_type "
                "WHERE sar_vessel.svcid = sar_vessel_class.id "
                "AND sar_vessel.svtid = sar_vessel_type.id")

            row = cursor.fetchone()
            while row is not None:
                new_reg = Asset(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10],
                                row[11], parent.id, row[12], row[13], row[14], row[15], row[16], row[17], row[18])
                assets.append(new_reg)
                parent.assets[row[0]] = new_reg
                row = cursor.fetchone()
    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return assets


def get_certificate_types():
    cert_types = []
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
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, `name`, expires, active, required, info FROM sar_cert_type")

            row = cursor.fetchone()
            # while row is not None:
            new_reg = CertTypes(row[0], row[1], row[2], row[3], row[4], row[5], parent.id)
                # cert_types.append(new_reg)
                # row = cursor.fetchone()
    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return cert_types

def get_images_from_db():
    images = []
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
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, iid, uid, cdate, object, property FROM images")

            row = cursor.fetchone()
            while row is not None:
                new_reg = Images(row[0], row[1], row[2], row[3], row[4], row[5], parent.id)
                images.append(new_reg)
                row = cursor.fetchone()
    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return images


def get_assets_from_api():
    url = "https://api.ccga-stage.innovexa.cloud/idc-user-api/assets/search"
    payload = {
        "filters": [
            "22", 22, "23", 23, "24", 24, "25", 25, "26"
        ],
        "perPage": 2000,
        "page": 1
    }
    req = requests.post(url, data=json.dumps(payload), headers=HEADERS)
    if req.status_code == 200:
        res = req.json()
        return res["data"]


def update_asset(asset, unit, reg, base=None):
    uid = asset["_id"]
    url = "https://api.ccga-stage.innovexa.cloud/idc-user-api/assets/update/{}".format(uid)
    if base is None:
        if unit is None:
            package = {
                'primaryRegionId': reg
            }
        else:
            package = {
                'unitId': unit.id,
                'primaryRegionId': reg
            }
    else:
        package = base
    req = requests.patch(url, data=json.dumps(package), headers=HEADERS)
    if req.status_code == 200:
        return 1
    else:
        print(req.json())
        return -1


def create_asset(asset, units):
    url = "https://api.ccga-stage.innovexa.cloud/idc-user-api/assets/create"
    quebec_resource_types = {
        1: "Embarcation Dédiée SAR",
        2: "Bateau d'Excursion",
        3: "Navire de Pêche",
        4: "Bateau Passagers",
        5: "Bateau de Transport",
        6: "Voilier",
        7: "Bateau Moteur Privé"
    }
    maritimes_resource_types = {
        1: "Fishing Vessel",
        2: "Pleasure ",
        3: "Fire Department",
        4: "Passenger Carrying",
        5: "Sailboat",
        6: "DRV",
        8: "FRC"
    }

    pacific_resource_types = {
        1: "DRV",
        2: "Owner/Op",
        3: "Co-Crew",
        4: "Relief"
    }
    central_resource_types = {
        1: "Commercial",
        2: "Private",
        3: "Community",
        4: "Loan",
        5: "CCGA Owned",
        6: "Fishing"
    }
    newf_resource_types = {
        1: "DRV",
        2: "Owner/Op",
        3: "Co-Crew",
        4: "Relief",
    }
    info = phpserialize.loads((asset.info))
    info = {k.decode('ISO-8859-1'): v for k, v in info.items()}
    address = {k.decode('ISO-8859-1'): v.decode('ISO-8859-1') for k, v in
               info.get('address', {}).items()}
    ais_string = 'No'
    if int(asset.ais) == 1:
        ais_string = 'rxOnly'
    elif int(asset.ais) == 2:
        ais_string = 'txRx'
    unit = units.get("{}-{}".format(asset.old_unit, asset.reg))
    if asset.reg == 22:
        resourceType = quebec_resource_types[asset.srtid]
    elif asset.reg == 23:
        resourceType = pacific_resource_types[asset.srtid]
    elif asset.reg == 24:
        resourceType = maritimes_resource_types[asset.srtid]
    elif asset.reg == 25:
        resourceType = central_resource_types[asset.srtid]
    else:
        resourceType = newf_resource_types[asset.srtid]
    # image_url = asset.uid
    # image =
    if unit is None:
        return -1, "Unit Doesn't exist"
    package = {
        "assetTitle": asset.name,
        "oldId": asset.uid,
        "unitName": "{} - {}".format(unit.number, unit.name),
        "unitId": unit.id,
        "aisEnabled": ais_string,
        "baseLocation": {
            "lat": info.get('lat', b'').decode('ISO-8859-1'),
            "lng": info.get('lon', b'').decode('ISO-8859-1')
        },
        "beam": info.get('beam', b'').decode('ISO-8859-1'),
        "capacity": info.get('capacity', b'').decode('ISO-8859-1'),
        "configuration": info.get('configuration', b'').decode('ISO-8859-1'),
        "cruisingSpeed": info.get('speed', b'').decode('ISO-8859-1'),
        "currentLocation": {
            "lat": asset.lat,
            "lng": asset.lon
        },
        "draft": info.get('draft', b'').decode('ISO-8859-1'),
        "endurance": info.get('endurance', b'').decode('ISO-8859-1'),
        "globalVessel": True if asset.global_status else False,
        "gt": info.get('gt', b'').decode('ISO-8859-1'),
        "inActiveFor": asset.asoffset,
        "loa": info.get('loa', b'').decode('ISO-8859-1'),
        "mmsi": asset.mmsi,
        "normalStatus": "Active" if asset.active else "InActive",
        "ownerAddress": {
            "ownerName": info.get('owner', b'').decode('ISO-8859-1'),
            "addressLine1": address.get('address1', ''),
            "city": address.get('city', ''),
            "country": address.get('country', ''),
            "postalCode": address.get('pcode', ''),
            "province": address.get('province', '')
        },
        "primaryContact": [
            {
                "phoneNumber": info.get('phone1', b'').decode('ISO-8859-1'),
                "name": info.get('name1', b'').decode('ISO-8859-1')
            },
            {
                "phoneNumber": info.get('phone2', b'').decode('ISO-8859-1'),
                "name": info.get('name2', b'').decode('ISO-8859-1'),
            }
        ],
        "registration": info.get('registration', b'').decode('ISO-8859-1'),
        "replacementValue": asset.value,
        "yearBuilt": info.get('year', b'').decode('ISO-8859-1'),
        "additionalInformation": info.get('description', b'').decode('ISO-8859-1'),
        "contactAdditionalInformation": info.get('contactInstructions', b'').decode('ISO-8859-1'),
        "fuelCapacity": info.get('fuel', b'').decode('ISO-8859-1'),
        "hidefromPublic": asset.hidden,
        "inServiceDate": str(asset.asdate) if asset.asdate else "",
        "outServiceDate": str(asset.odate) if asset.odate else "",
        "primaryRegionId": asset.reg,
        "reimbursementRateId": "5d4b0c8d6a524d76d7096925",
        "reimbursementRateName": "test",
        "resourceType": resourceType,
        "returnServiceDate": str(asset.idate) if asset.idate else "",
        "vesselClass": asset.vesselClass,
        "vesselType": asset.vesselType,
    }
    req = requests.post(url, data=json.dumps(package), headers=HEADERS)
    if req.status_code == 200:
        res = req.json()
        return 1, res["data"]
    else:
        print(req.json())
        return -1, str(req.json())


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
                    new_reg = Unit(row[0], row[1], row[2], row[3], row[4],
                                   row[5], row[6],
                                   row[7], b'')
                    units.append(new_reg)
                    # parent.addUnit(new_reg)
                row = cursor.fetchone()
    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return units


def sync_assets(api_assets, old_assets, units):
    errors = []
    not_found = []
    for old_asset in old_assets:
        found = False
        for api_asset in api_assets:
            if old_asset.name == api_asset['assetTitle']:
                old_id = api_asset.get('oldId', '')
                if old_id == '':
                    old_id = 0
                if int(old_asset.uid) == int(old_id):
                    found = True
                    info = phpserialize.loads((old_asset.info))
                    info = {k.decode('ISO-8859-1'): v for k, v in info.items()}
                    address = {k.decode('ISO-8859-1'): v.decode('ISO-8859-1') for k, v in
                               info.get('address', {}).items()}
                    ais_string = 'No'
                    if int(old_asset.ais) == 1:
                        ais_string = 'rxOnly'
                    elif int(old_asset.ais) == 2:
                        ais_string = 'txRx'
                    base = {
                        "aisEnabled": ais_string,
                        "baseLocation": {
                            "lat": info.get('lat', b'').decode('ISO-8859-1'),
                            "lng": info.get('lon', b'').decode('ISO-8859-1')
                        },
                        "beam": info.get('beam', b'').decode('ISO-8859-1'),
                        "capacity": info.get('capacity', b'').decode('ISO-8859-1'),
                        "configuration": info.get('configuration', b'').decode('ISO-8859-1'),
                        "cruisingSpeed": info.get('speed', b'').decode('ISO-8859-1'),
                        "currentLocation": {
                            "lat": old_asset.lat,
                            "lng": old_asset.lon
                        },
                        "draft": info.get('draft', b'').decode('ISO-8859-1'),
                        "endurance": info.get('endurance', b'').decode('ISO-8859-1'),
                        "globalVessel": True if old_asset.global_status else False,
                        "gt": info.get('gt', b'').decode('ISO-8859-1'),
                        "inActiveFor": old_asset.asoffset,
                        "loa": info.get('loa', b'').decode('ISO-8859-1'),
                        "mmsi": old_asset.mmsi,
                        "normalStatus": "Active" if old_asset.active else "InActive",
                        "ownerAddress": {
                            "ownerName": info.get('owner', b'').decode('ISO-8859-1'),
                            "addressLine1": address.get('address1', ''),
                            "city": address.get('city', ''),
                            "country": address.get('country', ''),
                            "postalCode": address.get('pcode', ''),
                            "province": address.get('province', '')
                        },
                        "primaryContact": [
                            {
                                "phoneNumber": info.get('phone1', b'').decode('ISO-8859-1'),
                                "name": info.get('name1', b'').decode('ISO-8859-1')
                            },
                            {
                                "phoneNumber": info.get('phone2', b'').decode('ISO-8859-1'),
                                "name": info.get('name2', b'').decode('ISO-8859-1'),
                            }
                        ],
                        "registration": info.get('registration', b'').decode('ISO-8859-1'),
                        "replacementValue": old_asset.value,
                        "yearBuilt": info.get('year', b'').decode('ISO-8859-1')
                    }
                    num = update_asset(api_asset, None, None, base)
                    if num == -1:
                        errors.append({"asset": old_asset.jsonfy(), "message": "Failed to Update"})
        if not found:
            num, mes = create_asset(old_asset, units)
            if num == -1:
                errors.append({"asset": old_asset.jsonfy(), "message": mes})
            not_found.append(old_asset)
    return errors, not_found


#
# regs = get_regions_from_api(base)
# zones = get_districts_from_api(base)
# units = get_squadrons_from_api(base)
# units_2 = get_units()
# updated = sync_squadrons_with_old_id(units, units_2)
# # assets_api = get_assets_from_api()
# assets_db = get_assets_from_db()
# f = open("JSON/assets.json", "r")
# assets_api = json.load(f)
# f.close()
# print(len(assets_db))
# print(len(assets_api))
# failed = []
# old_id = assets_api[0]
# for asset in assets_api:
#     # if int(asset["primaryRegionId"]) <= 20:
#     reg = int(asset["primaryRegionId"])
#     unit_id = asset["unitId"]
#     unit = None
#     num = update_asset(asset, unit, reg)
#     if num == -1:
#         failed.append(asset)


# with open("JSON/failed_assets.json", "w") as file:
#     json.dump(failed, file)
