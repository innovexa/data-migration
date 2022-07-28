import base64
import json
from datetime import datetime

import requests

from CCGA_user_migration import STAGE, user_data_migration
from add_functions import add_user
from objects import Region
from zone_migration import get_regions_from_api, sync_units_with_squadron_id, sync_squadrons_with_old_id, get_units, \
    get_squadrons_from_api, get_districts_from_api, get_users, get_users_from_api, sync_assets_with_squadron_id, \
    USER_SQUAD, URL, HEADERS, phpserialize, get_users_from_api_region
from asset_migration import get_assets_from_db, sync_assets, get_certificate_types

old_regions = {
    4: 0,
    5: 1,
    6: 2,
    7: 3,
    8: 4
}

base = [
    Region(22, "Québec", 21),
    # Region(23, "Pacific", 21),
    # Region(24, "Maritimes", 21),
    # Region(25, "Central and Artic", 21),
    # Region(26, "NewFoundLand and Labrador", 21)
]

# All 5 global regions that need to be added.
PARENT_REGIONS = {
    "ccga q": base[0],
    # "pacific": base[0],
    # "maritimes": base[0],
    # "central_arctic": base[0],
    # "nlcc": base[0]
}
# for b in base:
#     numb = add_region(b)
#     if numb == -1:
#         print("ERROR WITH: " + b.name_en)
#     b.setId(numb)

# regs = get_regions()
regs = get_regions_from_api(base)
# for reg in regs:
# numb = add_region(reg)
# if numb == -1:
#     print("ERROR WITH: " + reg.name_en)
# reg.setId(numb)

# zones = get_zones()
zones = get_districts_from_api(base)
# for dist in zones:
# numb = add_district(dist)
# if numb == -1:
#     print("ERROR WITH: " + dist.name)
# dist.setId(numb)

units = get_squadrons_from_api(base)
units_2 = get_units()
updated = sync_squadrons_with_old_id(units, units_2)
# for unit in units:
# numb = add_squadron(unit)
# if numb == -1:
#     print("ERROR WITH: " + unit.name)
# unit.setId(numb)
#
#

users = get_users()
users_new = get_users_from_api_region(base[0].id)
errors, duplicates = user_data_migration(users, users_new, updated)
# bam, boom = sync_units_with_squadron_id(users_new, users, updated)

#
#
with open("JSON/user_errors_all.json", "w+") as file:
    file.write("[")
    for b in errors:
        print(b, file=file)
        file.write(",")
    file.write("]")

# with open("JSON/user_duplicates_all.json", "w+") as file:
#     file.write("[")
#     for b in duplicates:
#         print(b, file=file)
#         file.write(",")
#     file.write("]")

# with open("JSON/not_found_users.json", "w+") as f:
#     f.write("[")
#     for b in not_found:
#         print(b, file=f)
#         f.write(",")
#     f.write("]")

# cert_types = get_certificate_types()
# assets_db = get_assets_from_db()
# f = open("JSON/assets.json", "r")
# assets_api = json.load(f)
# f.close()
# asset_errors, not_found = sync_assets(assets_api, assets_db, updated)

# asset_errors, not_found = sync_assets_with_squadron_id(assets_api, updated)
# for user in users:
#     numb, mes = add_user(user)
#     if numb == -1:
#         user_errors.append({"data": user, "message": mes})
#         print("ERROR WITH: " + user.first_name)
#     user.setId(numb)
#
# with open("JSON/assets_errors.json", "w") as file:
#     file.write("[")
#     for b in asset_errors:
#         print(b, file=file)
#         file.write(",")
#     file.write("]")
#
# with open("JSON/assets_notfound.json", "w") as file:
#     file.write("[")
#     for asset in not_found:
#         json.dump(asset.jsonfy(), file)
#         file.write(",")
#     file.write("]")
# with open("user_migrations_stage.json", "w") as file:
#     file.write("[")
#     for unit in users:
#         json.dump(unit.jsonfy(), file)
#         file.write(",")
#     file.write("]")
