# CCGA Migration Scripts

*This repo contains migration scripts for Regions, Zones, Units, Users and Assets*

## Running the Migration Script
###Setup:

- Create 5 different regions using the `authentication` api
- Take note of their region ID and update the `base` object in all files.
- Make sure that the database names and the `PARENT_REGIONS` object have the same names.

###objects.py

Contains Objects to manipulate CCGA Data including:
- Regions
- Zones
- Squadrons
- Users
- Assets
- Images
- Certificate Types
- Training Levels
- Training Item
- Training Type
- TrainingCategory


###add_functions.py
Contains Function to create Objects into system.

###CCGA_user_migration.py
Contains Functions to Migrate Users, Edit their details and set their squadrons.

###asset_migration.py
Contains Functions to Migrate Assets and their pictures.

###forms_migration.py
Contains Functions to edit elastic documents in bulk


To run the migration script, install all the requirements from `requirements.txt` and then just run `running.py`

##Examples:
####Adding Regions
```python
regs = get_regions()
for reg in regs:
numb = add_region(reg)
if numb == -1:
    print("ERROR WITH: " + reg.name_en)
reg.setId(numb)
```

####Adding Zones
```python
zones = get_zones()
for dist in zones:
numb = add_district(dist)
if numb == -1:
    print("ERROR WITH: " + dist.name)
dist.setId(numb)
```

####Adding Squadrons
```python
units = get_units()
for unit in units:
numb = add_squadron(unit)
if numb == -1:
    print("ERROR WITH: " + unit.name)
unit.setId(numb)
```

###Syncing Squadrons in API with Squadrons in DB
```python
units = get_squadrons_from_api(base)
units_2 = get_units()
updated = sync_squadrons_with_old_id(units, units_2)
```

###Creating Users in the System, Syncing them with users from the DB and Editing Users
```python
users = get_users()
users_new = get_users_from_api_region(base[0].id)
errors, duplicates = user_data_migration(users, users_new, updated)
```




###To Run an asset migration
```python
regs = get_regions_from_api(base)
zones = get_districts_from_api(base)
units = get_squadrons_from_api(base)
units_2 = get_units()
updated = sync_squadrons_with_old_id(units, units_2)
assets_api = get_assets_from_api()
for asset in assets_api:
    # if int(asset["primaryRegionId"]) <= 20:
    reg = int(asset["primaryRegionId"])
    unit_id = asset["unitId"]
    unit = updated.get('{}-{}'.format(old_user.primary_unit, old_user.region_id))
    num = create_asset(asset, unit, reg)
```

###To Run SAR Migration
To run the migration script, install all the requirements from `requirements.txt` and then just run `sar_migration.py`


### Code to run before any migration (after creating Regions, Districts/Zones and Units)
```python
regs = get_regions_from_api(base)
zones = get_districts_from_api(base)
units = get_squadrons_from_api(base)
units_2 = get_units()
updated = sync_squadrons_with_old_id(units, units_2)
```