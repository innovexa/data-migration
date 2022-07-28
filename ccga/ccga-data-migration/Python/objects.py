import base64

import phpserialize


class Region:
    # Need to be added to this table: using add_region()
    # Headers are region_id - name_en - name_fr - is_active - parent_id - color - timezone
    def __init__(self, uid, name, parent):
        self.id = uid
        self.name_en = name.strip()
        self.name_fr = name.strip()
        self.parent_id = parent
        self.old_id = uid
        self.sub_regions = {}
        self.districts = {}
        self.units = {}
        self.assets = {}

    def setId(self, uid):
        self.id = uid

    def getId(self):
        return self.id

    def addDistrict(self, dist):
        self.districts[dist.old_id] = dist

    def getDistrict(self, uid):
        if uid in self.districts:
            return self.districts[uid]
        else:
            return None

    def addSub(self, reg):
        self.sub_regions[reg.old_id] = reg

    def getSub(self, uid):
        if uid in self.sub_regions:
            return self.sub_regions[uid]
        else:
            return None

    def getUnit(self, uid):
        if uid in self.units:
            return self.units[uid]
        else:
            return None

    def getAsset(self, uid):
        if uid in self.assets:
            return self.assets[uid]
        else:
            return None

    def addUnit(self, unit):
        self.units[unit.old_id] = unit

    def json_districts(self):
        dists = []
        for k, dist in self.districts.items():
            dists.append(dist.jsonfy())
        return dists

    def json_units(self):
        units = []
        for k, unit in self.units.items():
            units.append(unit.jsonfy())
        return units

    def json_subs(self):
        subs = []
        for k, sub in self.sub_regions.items():
            subs.append(sub.jsonfy())
        return subs

    def jsonfy(self):
        return {
            "id": self.id,
            "name_en": self.name_en,
            "name_fr": self.name_fr,
            "parent_id": self.parent_id,
            "old_id": self.old_id,
            "sub_regions": self.json_subs(),
            "districts": self.json_districts(),
            "units": self.json_units()
        }


class Zone:
    # Need to be added to this table: using add_district()
    # Headers are district_id - name_en - name_fr - is_active - region_id - disctrict_no - color
    def __init__(self, id, name, number, region):
        self.id = id
        self.name = name.strip()
        self.number = number
        self.region = region
        self.old_id = id

    def setId(self, uid):
        self.id = uid

    def getId(self):
        return self.id

    def jsonfy(self):
        return {
            "id": self.id,
            "name": self.name,
            "region_id": self.region,
            "number": self.number,
            "old_id": self.old_id
        }


class Unit:
    # Need to be added to this table: using add_squadron()
    # Headers are name_en - name_fr - city - province_state - squadron_id - homepage - district_id - lat - lng - is_active - squadron_no - color
    def __init__(self, id, name, number, region_id, zone_id, trainhours, utype, active, prov):
        self.id = id
        self.name = name
        self.number = number
        self.region_id = region_id
        self.zone_id = zone_id
        self.trainhours = trainhours
        self.utype = utype
        self.active = active
        self.old_id = id
        self.province = prov
        self.users = []
        self.region = None

    def setId(self, uid):
        self.id = uid

    def setOldId(self, uid):
        self.old_id = uid

    def getUsers(self):
        json_users = []
        for user in self.users:
            json_users.append(user.jsonfy())
        return json_users

    def setRegion(self, reg):
        self.region = reg

    def jsonfy(self):
        return {
            "id": self.id,
            "name": self.name,
            "region_id": self.region_id,
            "number": self.number,
            "zone_id": self.zone_id,
            "active": self.active,
            "users": self.getUsers(),
            "old_id": self.old_id
        }


class User:
    def __init__(self, userId, email, birthday, first_name, middle_name, last_name,
                 address1, address2, city, prov, country, postal_code, active, primary, region_id, status, number,
                 industry, mdate, info, coxswain, squadronIds):
        self.userId = userId
        self.email = email.strip() if email else ""
        self.birthday = birthday
        self.first_name = first_name.strip() if first_name else ""
        self.middle_name = middle_name.strip() if middle_name else ""
        self.last_name = last_name.strip() if last_name else ""
        self.address1 = address1.strip() if address1 else ""
        self.address2 = address2.strip() if address2 else ""
        self.city = city.strip() if city else ""
        self.province = prov.strip() if prov else ""
        self.country = country.strip() if country else ""
        self.postal_code = postal_code.strip() if postal_code else ""
        self.active = active
        self.old_id = userId
        self.region_id = region_id
        self.primary_unit = primary
        self.status = status
        self.number = number
        self.industry = industry
        self.mdate = mdate
        self.info = info
        self.coxswain = coxswain
        self.squadronIDs = squadronIds

    def setId(self, userId):
        self.userId = userId

    def jsonfy(self):
        return {
            "userId": self.userId,
            "email": self.email,
            "first_name": self.first_name,
            "middle_name": self.middle_name,
            "last_name": self.last_name,
            "address1": self.address1,
            "address2": self.address2,
            "city": self.city,
            "country": self.country,
            "postal_code": self.postal_code,
            "active": self.active,
            "old_id": self.old_id,
            "region_id": self.region_id,
            "status": self.status,
            "primary_unit": self.primary_unit,
        }


class Asset:
    def __init__(self, uid, unit_id, name, info, active, value, ais, global_status, lat, lon, mmsi, asoffset, reg, hide,
                 asDate, idate, odate, srtid, vesselClass, vesselType):
        self.uid = uid
        self.old_unit = unit_id
        self.name = name
        self.info = base64.b64decode(info)
        self.info2 = info
        self.active = int(active)
        self.value = value
        self.ais = ais
        self.global_status = int(global_status)
        self.lat = lat
        self.lon = lon
        self.mmsi = mmsi
        self.asoffset = asoffset
        self.reg = reg
        self.asdate = asDate
        self.odate = odate
        self.idate = idate
        self.srtid = srtid
        self.hidden = hide
        self.vesselClass = vesselClass
        self.vesselType = vesselType

    def jsonfy(self):
        return {
            "uid": self.uid,
            "old_unit": self.old_unit,
            "name": self.name,
            "info": self.info2,
            "active": self.active,
            "value": self.value,
            "ais": self.ais,
            "global_status": self.lat,
            "lon": self.lon,
            "hidden": self.hidden,
            "mmsi": self.mmsi,
            "asoffset": self.asoffset,
            "vesselClass": self.vesselClass,
            "vesselType": self.vesselType,
            "reg": self.reg,
            "asdate": str(self.asdate),
            "odate": str(self.odate),
            "idate": (self.idate)
        }


class Images:
    def __init__(self, image_id, iid, uid, cdate, object, property, reg):
        self.image_id = image_id
        self.iid = iid
        self.uid = uid
        self.cdate = cdate
        self.object = object
        self.property = property
        self.reg = reg


class CertTypes:
    def __init__(self, uid, name, expires, active, required, info, region, old_id):
        self.uid = uid
        self.name = name
        self.expires = expires
        self.active = active
        self.required = required
        self.info = phpserialize.loads(base64.b64decode(info))
        self.region = region
        self.old_id = old_id
        bam = {k.decode('ISO-8859-1'): v for k, v in (self.info).items()}
        print(bam['lang'])
        # print(bam)


class TrainingLevel:
    def __init__(self, uid, nextTrainingLevel, name, active, info, region,
                 old_id):
        self.uid = uid
        self.nextTrainingLevel = nextTrainingLevel
        self.name = name
        self.active = active
        self.info = phpserialize.loads(base64.b64decode(info))
        self.region = region
        self.old_id = old_id


class TrainingItem:
    def __init__(self, uid, trainingLevel, signOffTrainingLevel,
                 signOffCertificate, name, optional, active, info, region, old_id):
        self.uid = uid
        self.trainingLevel = trainingLevel
        self.signOffTrainingLevel = signOffTrainingLevel
        self.signOffCertificate = signOffCertificate
        self.name = name
        self.active = active
        self.optional = optional
        self.info = phpserialize.loads(base64.b64decode(info))
        self.region = region
        self.old_id = old_id


class TrainingType:
    def __init__(self, uid, name, active, info, old_id):
        self.uid = uid
        self.name = name
        self.active = active
        self.info = phpserialize.loads(base64.b64decode(info))
        self.old_id = old_id


class TrainingCategory:
    def __init__(self, uid, name, info):
        self.uid = uid
        self.name = name
        self.info = phpserialize.loads(base64.b64decode(info))
