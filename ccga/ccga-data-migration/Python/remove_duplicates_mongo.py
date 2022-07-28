from pymongo import *
from pprint import pprint

client = MongoClient('localhost', 27016)
DB = client['users_stage']
COL = DB['assets']
unique_field = {'assetTitle': '$assetTitle', 'unitId': '$unitId'}
cursor = DB['assets'].aggregate([{'$group': {'_id':unique_field, 'dups': { '$addToSet': "$_id" }, 'count': {'$sum': 1}}},
                        {'$match': {'count': {'$gt': 1}}}], allowDiskUse=True)

toRemove = []
items = list(cursor)
print(len(items))
count = 0
for item in items:
    for dup in item['dups'][1:]:
        count += 1
        print(count)
        test = COL.delete_many({"_id" : dup})
pprint(toRemove)
