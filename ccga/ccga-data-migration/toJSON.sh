set -e
# ES_OLD_HOST="http://15.223.11.122:9200" //Stage
ES_OLD_HOST="https://vpc-elastic-innovexa-cloud-7dzapozhob6lipfz7lqzlwzw3q.ca-central-1.es.amazonaws.com"

echo "$(elasticdump --input=$ES_OLD_HOST/users --output=cps-qa-users.json --type=data)"
~

