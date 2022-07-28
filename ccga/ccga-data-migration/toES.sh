set -e
# ES_NEW_HOST="http://15.223.11.122:9200" // Stage

ES_NEW_HOST="https://vpc-ccga-elastic-7u5oztsvajkmnnihtmj5abbr7m.ca-central-1.es.amazonaws.com/"
echo "$(elasticdump --input=/home/jason/ccga-stage-migration/ccga-stage/dev-units.json		--output=$ES_NEW_HOST     --type=data)"

