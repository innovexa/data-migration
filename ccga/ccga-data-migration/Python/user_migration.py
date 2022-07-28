import requests
import json
import base64

GLU_URL = 'https://gluu.innovexa.cloud/'
ENCODING = 'YTA0OGUyMWUtODAwMy00NmExLWIxMjAtYWE5MWU5NTg3ZDFkOm56VHZFeWNHS2w1ZVc3MHlXV1dZdkl2MVVOTVgzWXNZMlB2V1ZzdGo='


# CCGA_ENCODING = 'N2Y2MGUyNWMtYWI2OC00MjVjLWJkMWUtZTMxMzA5ODJmODVkOllZcTNaNjFUTm9CeksyWVd0dlFMU1RFVFhQck5ZbHNEQUY1WHU2Umw='
# CCGA_STAGE_ENCODING = base64.b64encode('7f60e25c-ab68-425c-bd1e-e3130982f85d:YYq3Z61TNoBzK2YWtvQLSTETXPrNYlsDAF5Xu6Rl'.encode("utf-8"))
# BR_ENCODING = 'Yzk4Njk1NDMtZWE0Zi00OWQ0LThlNzItODI4YzdjMGQwMGYyOktXQmRCY0dFd0o5OFdwR1VmUFFYemJBbWhhdklESlFhZzFPTnZDR0Q='
# BR_PROD_ENCODING = base64.b64encode('c9869543-ea4f-49d4-8e72-828c7c0d00f2:KWBdBcGEwJ98WpGUfPQXzbAmhavIDJQag1ONvCGD'.encode("utf-8"))
# BR_ENCODING = 'Yzk4Njk1NDMtZWE0Zi00OWQ0LThlNzItODI4YzdjMGQwMGYyOktXQmRCY0dFd0o5OFdwR1VmUFFYemJBbWhhdklESlFhZzFPTnZDR0Q='
# BR_STAGE_ENCODING = base64.b64encode('a048e21e-8003-46a1-b120-aa91e9587d1d:nzTvEycGKl5eW70yWWWYvIv1UNMX3YsY2PvWVstj'.encode("utf-8"))


def login():
    url = '{}/oxauth/restv1/token'.format(GLU_URL)
    req = requests.post(url, headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic {}".format(ENCODING)
    }, data={"grant_type": "client_credentials"})
    res = req.json()
    print(res)
    return res["access_token"]


def check_token(token):
    if token is None:
        return login()
    url = '{}/oxauth/restv1/introspection'.format(GLU_URL)
    req = requests.post(url, headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic {}".format(ENCODING)
    }, data={
        "token": token,
        "response_as_jwt": False
    })
    res = req.json()
    if not res.get('active', False):
        return login()
    else:
        return token


def get_gluu_users():
    keep_going = True
    token = check_token(None)
    users = []
    count = 0

    while (keep_going):
        url = '{}/identity/restv1/scim/v2/Users/?count=200&startIndex={}&filter=userName co "ccga-stage"'.format(
            GLU_URL, 200 * count)
        count += 1
        print(count)
        token = check_token(token)
        req = requests.get(url, headers={
            "Authorization": 'Bearer {}'.format(token)
        })
        res = req.json()
        if len(res["Resources"]) is 0:
            keep_going = False
        else:
            users = users + [y['emails'][0]['value'] for y in res["Resources"]]
    return users


def delete_user(usrs):
    token = check_token(None)
    failed = []
    count = 0
    for usr in usrs:
        count += 1
        print(count)
        token = check_token(token)
        url = "{}/identity/restv1/scim/v2/Users/{}".format(GLU_URL, usr["id"])
        req = requests.delete(url, headers={
            "Authorization": 'Bearer {}'.format(token)
        })
        if req.status_code is 401:
            failed.append(usr)
    return failed


def activate(usrs):
    token = check_token(None)
    failed = []
    count = 0
    for usr in usrs:
        count += 1
        print(count)
        token = check_token(token)
        resp = requests.put(
            "https://gluu.innovexa.cloud/identity/restv1/scim/v2/Users/{}".format(usr["id"]),
            data=json.dumps({
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "active": True,
                "urn:ietf:params:scim:schemas:extension:gluu:2.0:User": {
                    'gluuStatus': 'active'
                }
            }), headers={
                'Authorization': 'Bearer ' + token,
                'content-type': 'application/json'})
        if resp.status_code != 200:
            print(resp.content)
            failed.append(usr)
    return failed


def create_user(uid, first, last, email):
    token = check_token(None)
    url = 'https://gluu.innovexa.cloud/identity/restv1/scim/v2/Users/'
    payload = {
        "userName": "{}-ccga-stage".format(uid),
        "password": "test",
        "preferredLanguage": "en",
        "name": {
            "familyName": last,
            "givenName": first
        },
        "emails": [{
            "value": email,
            "display": email
        }],
        "displayName": "{} {}".format(first, last)
    }
    resp = requests.post(url, data=json.dumps(payload), headers={
        'Authorization': 'Bearer ' + token,
        'content-type': 'application/json'})
    if resp.status_code != 201:
        print(resp.content)
        return -1, resp.content
    else:
        return 1, "fine"
