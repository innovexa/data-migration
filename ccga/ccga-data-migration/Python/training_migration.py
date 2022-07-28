import requests
import json
from mysql.connector import MySQLConnection, Error


from objects import *

base = [
    Region(22, "Québec", 21),
    Region(23, "Pacific", 21),
    Region(24, "Maritimes", 21),
    Region(25, "Central and Artic", 21),
    Region(26, "NewFoundLand and Labrador", 21)
]

PARENT_REGIONS = {
    "ccga q": base[0],
    "pacific": base[0],
    "maritimes": base[0],
    "central_artic": base[0],
    "nlcc": base[0]
}

def get_certification_types():
    certs = []
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
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM sar_cert_type")

            row = cursor.fetchone()
            while row is not None:
                new_cert = CertTypes(row.id, row.name, row.expires, row.active, row.required, row.info, parent.id, row.id)
                certs.append(new_cert)
                row = cursor.fetchone()
    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return certs

def get_trainingLevel_types():
    trainingLevels = []
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
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM sar_cert_type")

            row = cursor.fetchone()
            while row is not None:
                new_cert = TrainingLevel(row.id, row.name, row.expires, row.active, row.required, row.info, parent.id, row.id)
                trainingLevels.append(new_cert)
                row = cursor.fetchone()
    except Error as e:
        print(e)

    finally:
        cursor.close()
        conn.close()
        return trainingLevels
