<?php
ini_set("memory_limit", "-1");
ini_set('max_execution_time', 1000);
require_once './vendor/autoload.php';
use GuzzleHttp\Client;
include 'config.php';
use Dash\Dash;
define('HOST', $config->host);
function getZoneInfo($squadronId){
    try{
        $client = new Client();
        $regionReq = $client->request('GET', HOST.'/authentication/v2/squadrons?q=squadronId:'.$squadronId.'&shouldExpandResults=true');
        $regionRes = json_decode($regionReq->getBody(), TRUE);
        if ($regionRes['isSuccess']) {
            return array( "zoneId" =>   (int)$regionRes['data']['results'][0]['districtId'], "zoneName" => (string)$regionRes['data']['results'][0]['districtNameEN']);

        } else {
            return  0;
        }
    } catch(Exception $ex) {
        echo "Exception in getZoneId ". $ex->getMessage();
        return  0;
    }

}

function flatten(array $array) {
    $return = array();
    array_walk_recursive($array, function($a) use (&$return) { $return[] = $a; });
    return $return;
}

function returnRegionId($region){
    switch ($region) {
        case 'ccgaca':
            return 7;
        case 'ccgam':
            return 6;
        case 'ccgap':
            return 5;
        case 'ccgaq':
            return 4;
    }
}

function fetchNameFromDB($id, $database, $table){
    $db = new MysqliDb ('192.81.56.62', 'innovexa', 'inno@123!', $database);
    $db->where('id', $id);
    $tables = $db->getOne($table);
    if($tables){
        return $tables['name'];
    }else{
        return null;
    }
}

function fetchSarPersonFromDB($id, $database, $table) {
    $db = new MysqliDb ('192.81.56.62', 'innovexa', 'inno@123!', $database);
    $db->where('id', $id);
    $tables = $db->getOne($table);
    if($tables){
        return $tables;
    }else{
        return null;
    }
}


function fetchKeyByValue($value,$org){
    $url_en = urlencode($value);
    $response = file_get_contents(HOST."/dashboard/meta/getMetaData?q=value%3A%22$url_en%22%20orgId%3A$org");
    try{
        $data = json_decode($response);
        if($data->isSuccess && $data->data->resultsTotal == 1){
            return $data->data->results[0]->id;
        }else{
            return null;
        }
    } catch (Exception $e){
        print_r($e);
    }
}

function fetchKeyByValuePollution($value,$org){
    $url_en = urlencode($value);
    $response = file_get_contents(HOST."/dashboard/meta/getMetaData?q=value%3A%22$url_en%22%20key%3A%22SAR_INCIDENT%22%20type%3A%22POLLUTION%22%20orgId%3A$org");
    try{
        $data = json_decode($response);
        if($data->isSuccess && $data->data->resultsTotal == 1){
            return $data->data->results[0]->id;
        }else{
            return null;
        }
    } catch (Exception $e){
        print_r($e);
    }
}

function fetchKeyByValueType($value,$org, $type){
    $url_en = urlencode($value);
    $url = HOST."/dashboard/meta/getMetaData?q=key%3A%22SAR_INCIDENT%22%20type%3A%22$type%22%20orgId%3A$org%20value:$url_en";
    $response = file_get_contents($url);
    try{
        $data = json_decode($response);
        if($data->isSuccess && $data->data->resultsTotal == 1){
            return $data->data->results[0]->id;
        }else{
            return null;
        }
    } catch (Exception $e){
        echo "Exception for getMetaData ". $e->getMessage();
    }
}

function returnDanger($key){
    $array = array(
        '1' => 'Immediate Danger',
        '2' => 'Potential Danger' ,
        '3' => 'No Danger' ,
        '4' => 'False Alarm or Hoax'
    );
    return $array[$key];
}

function returnPolution($key){
    $pollution = array(
        0 =>  'none',
        1 => 'A Factor',
        2 => 'Primary Concern'

    );
    return $pollution[$key];
}
function createSubmission($data){
    try{
        $client = new Client();
        $d = array();
        $d['data'] = $data;
        $r = $client->request('POST', HOST.'/workflow/forms/sarform/submission', [
            'body' => json_encode($d),
            'headers' => [
                'Content-Type'     => 'application/json'
            ]
        ]);
        $res = json_decode($r->getBody(), true);
        if($r->getStatusCode() === 201) {
            echo "Submission was created sucessfully.  \n";
            file_put_contents("mission_success.txt", json_encode($res), FILE_APPEND | LOCK_EX);
            file_put_contents("mission_success.txt", "\r\n", FILE_APPEND | LOCK_EX);
        } else {
            echo "Submission creation failed. \n";
            file_put_contents("mission_failed.txt", json_encode($data), FILE_APPEND | LOCK_EX);
            file_put_contents("mission_failed.txt", "\r\n", FILE_APPEND | LOCK_EX);
        }

    }catch (Exception $e){
       echo "Submission creation Exception ". $e->getMessage(). "\n";
    }
}

function mission_log($data){
    $temp = array();
    $main = array();
    foreach($data as $d) {
        if (!empty($d['time'] && !empty($d['description']))) {
            $temp['time'] = $d['time'];
            $temp['desc'] = mb_convert_encoding($d['description'], 'UTF-8');
            array_push($main, $temp);
        }
    }
    return $main;
}
function getUnitName($id) {
    $db = new MysqliDb ('ccga-dev-k8.cx0ep9ygxsma.ca-central-1.rds.amazonaws.com', 'ccga_dev', 'x2oYAR2X6D19', 'authentication');
    $db->where('squadron_id', $id, '=');
    $squadrons = $db->getOne('squadron');
    return $squadrons['name_en'];
}
//$databases = ['ccgaca','ccgap','ccgam','ccgan','ccgaq'];
$databases= ['ccgaca'];
$client = new Client();
foreach($databases as $database){
    $db = new MysqliDb ('192.81.56.62', 'innovexa', 'inno@123!', $database);
    $incidents = $db->rawQuery('select * from sar_incident limit 1000');
    $i = 0;
    foreach($incidents as $incident){
        $data = array();
        $orgId = returnRegionId($database);
        if($incident['title']){
            $data['incidentTitle'] = $incident['title'];
            $data['isMigrate'] = true;
            $data['designationNumber'] = $incident['number'];
            $data['Supplement'] = $incident['supplement'];
            $data['refId'] = $incident['id'];
            $file = returnSquadronFileName($database);
    
            $fileContent = file_get_contents($file);
            $f = json_decode($fileContent);
            $oldUnitId = (int)$incident['suid'];
            $oldUnitId2 = (int)$incident['suid2'];
            $oldUnitId3 = (int)$incident['suid3'];
            $oldUnitId4 = (int)$incident['suid4'];
            $newUnitId = 0;
            $newUnitId2 = 0;
            $newUnitId3 = 0;
            $newUnitId4 = 0;
            $finalUnits = array();
            $unitName = "";
            foreach ($f as $fileContents) {
                if ($oldUnitId == $fileContents->oldId) {
                    $newUnitId = $fileContents->squadronId;
                    $unitName = $fileContents->name;
                }
                if($oldUnitId2 == $fileContents->oldId) {
                    $newUnitId2 = $fileContents->squadronId;
                }
                if($oldUnitId3 == $fileContents->oldId) {
                    $newUnitId3 = $fileContents->squadronId;
                }
                if($oldUnitId4 == $fileContents->oldId) {
                    $newUnitId4 = $fileContents->squadronId;
                }
            }
            if($newUnitId2 != 0) {
                array_push($finalUnits, $newUnitId2);
            }
            if($newUnitId3 != 0) {
                array_push($finalUnits, $newUnitId3);
            }
            if($newUnitId4 != 0) {
                array_push($finalUnits, $newUnitId4);
            }
            $zoneInfo = getZoneInfo($newUnitId);
            $data['regionId'] = getRegionId($newUnitId);
            $data['primaryRegionId'] = $data['regiond'];
            $data['zoneId']=   $zoneInfo['zoneId'];
            $data['zoneName']= $zoneInfo['zoneName'];
            $data['migrated'] = true;
            $data['unitId'] = $newUnitId;
            $assetUsed = fetchNameFromDB($incident['svid'],$database, 'sar_vessel');
            $assetId = $incident['svid'];
            //$assetResp = $client->request('GET', HOST.'/assets/v1/asset/'.$assetId);
            $assetFilters = new StdClass();
            $assetFilters->field='oldId';
            $assetFilters->filterType='text';
            $assetFilters->type='equals';
            $assetFilters->filter=$assetId;
            $assetFilterBody =  new StdClass();
            $assetFilterBody->filters = array($assetFilters);
            $assetFilterBody->perPage =  1;
            $assetFilterBody->page =  1;
            $assetFilterBody->source =  array("assetTitle","reimbursementRate");
            $assetResponse = $client->request('POST', HOST.'/idc-user-api/formSubmissions/search/editvessel?skipauth=true', [
                'body' => json_encode($assetFilterBody),
                'headers' => [
                    'Content-Type'     => 'application/json'
                ]
            ]); 
            $assetData  = json_decode($assetResponse->getBody(), true);  
            $assetResp =  Dash::get($assetData,'data.0');
            $reImbursementRateId= Dash::get($assetResp ,'reimbursementRate');
            $newAssetId =  Dash::get($assetResp ,'_id');     
            $rateReq = $client->request('GET', HOST.'/idc-user-api/rates/searchRate?skipauth=true&expenseType=Global.Mission&reportDate=2020-10-21&rateID='.$reImbursementRateId);
            $rateResp = json_decode($rateReq->getBody(), true);
            $coxswainId = $incident['m_spid'];
            $coxwain = fetchSarPersonFromDB($coxswainId, $database, 'sar_person');
            $uid = getUidFromName($coxwain['first_name'], $coxwain['last_name']);
            $data['uid'] = $uid['uid'];
            $data['SubmittedBy'] = $coxwain['first_name']." ".$coxwain['last_name'];
            $data['issueType'] = "SAR";
            $data['issueStatus'] = $incident['closded'] ==1 ? 'closed':'notcomplete';
            $data['participatingUnit'] = [
                'unitArr' => [[
                    'selectedAssetsAndCoxwain' => [
                        [
                            'rate' => (string)$rateResp['data']['results'][0]['amount'],
                            'asset' => [
                                'id' =>$newAssetId,
                                'assetTitle' => $assetUsed,
                                'unitId' => $newUnitId,
                                'reimbursementRate' => $reImbursementRateId
                            ],
                            'coxwain' => [
                                [
                                    'uid' => $uid['uid'],
                                    'givenName' => $coxwain['first_name'],
                                    'lastName' => $coxwain['last_name'],
                                    'regionId' => $data['regionId'],
                                    'primarySquadron' => $uid['primarySquadron'],
                                    'fullName' => $coxwain['first_name']." ".$coxwain['last_name']
                                ]
                            ]
                        ]
                    ],
                    'allSelectedPersonnel' => [
    
                    ],
                    'allSelectedPersonnelOnLand' => [],
                    'label' => getUnitName($newUnitId),
                    'value' => $newUnitId
                    ]],
                    'flattenAllPersonnel' => '',
                    'flattenUnits' => getUnitName($newUnitId),
                    'flattenAssets' => $assetUsed,
                    'flattenCoxwains' => $coxwain['first_name']." ".$coxwain['last_name'],
                    'additional' => [
    
                    ],
                    'flattenAdditional' => ''
                ];
            $tables = getUidFromIncidentTable($database, $incident['id']);
            $otherUnitPersonel = [];
            $names = '';
            $otherNames = '';
            foreach ($tables as $per) {
                if($per['spid'] !== $incident['m_spid']) {
                    $person = fetchSarPersonFromDB($per['spid'], $database, 'sar_person');
                    $uid = getUidFromName($person['first_name'], $person['last_name']);
                    $names .= $uid['givenName']." ".$uid['lastName'].",";
                    $asset = array(
                        'asset' => [
                            'id' =>$newAssetId,
                            'assetTitle' => $assetUsed,
                            'unitId' => $newUnitId,
                            'reimbursementRate' => $reImbursementRateId
                        ]
                    );
                    if($oldUnitId2 == (int)$person['suid']) {
                        $otherNames .= $uid['givenName']." ".$uid['lastName'].",";
                        $personnel = array(
                            'personnel' => [
                                'uid' => $uid['uid'],
                                'givenName' => $uid['givenName'],
                                'lastName' => $uid['lastName'],
                                'regionId' => $data['regionId'],
                                'primarySquadron' => $uid['primarySquadron'],
                                'fullName' => $uid['givenName']." ".$uid['lastName']
                            ],
                            'asset' => [
                                'id' =>$newAssetId,
                                'assetTitle' => $assetUsed,
                                'unitId' => $newUnitId,
                                'reimbursementRate' => $reImbursementRateId
                            ]
                        );
                        array_push($data['participatingUnit']['additional'], $personnel);
                    } else {
                        $personnel = array(
                            'personnel' => [
                                'uid' => $uid['uid'],
                                'givenName' => $uid['givenName'],
                                'lastName' => $uid['lastName'],
                                'regionId' => $data['regionId'],
                                'primarySquadron' => $uid['primarySquadron'],
                                'fullName' => $uid['givenName']." ".$uid['lastName']
                            ],
                            'asset' => [
                                'id' =>$newAssetId,
                                'assetTitle' => $assetUsed,
                                'unitId' => $newUnitId,
                                'reimbursementRate' => $reImbursementRateId
                            ]
                        );
                        array_push($data['participatingUnit']['unitArr'][0]['allSelectedPersonnel'], $personnel);
                    }
    
                }
            }
            $data['participatingUnit']['flattenAllPersonnel'] = $names;
            $data['participatingUnit']['flattenAdditional'] = $otherNames;
            \Moment\Moment::setDefaultTimezone('EST');
            $data['timeline'] = new StdClass();
            $m = new \Moment\Moment($incident['pag_date']);
            $data['timeline']->incidentDate =  $m->format('YYYY-MM-DD[T]HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $data['dateCreated'] = $data['timeline']->incidentDate;
            $data['timeline']->methodDate =  $m->format('YYYY-MM-DD[T]HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $data['timeline']->methodTime = $m->format('HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $t = new \Moment\Moment($incident['tsk_date']);
            $data['timeline']->taskedDate = $t->format('YYYY-MM-DD[T]HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $data['timeline']->taskedTime = $t->format('HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $d = new \Moment\Moment($incident['dep_date']);
            $data['timeline']->departureDate = $d->format('YYYY-MM-DD[T]HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $data['timeline']->departureTime = $d->format('HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $end = new \Moment\Moment($incident['stp_date']);
            $data['timeline']->opEndedDate = $end->format('YYYY-MM-DD[T]HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $data['timeline']->opEndedTime = $end->format('HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $onScene = new \Moment\Moment($incident['arr_date']);
            $data['timeline']->onSceneDate = $onScene->format('YYYY-MM-DD[T]HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $data['timeline']->onSceneTime = $onScene->format('HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $retToBase = new \Moment\Moment($incident['rtb_date']);
            $data['timeline']->returnToBaseDate = $retToBase->format('YYYY-MM-DD[T]HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $data['timeline']->returnToBaseTime = $retToBase->format('HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $t = explode('.', $incident['off_time'], -1);
            $firstCall = true;
            foreach($t as $time) {
                $timeToSend = sprintf("%02d", $time);
                if(count($t) <= 1) {
                    $timeToSend1 = $timeToSend.':'.$timeToSend;
                } else {
                    if($firstCall) {
                        $firstTime = $timeToSend;
                        $firstCall = false;
                    }
                    $timeToSend2 = $firstTime.':'.$timeToSend;
                }
            }
            $data['timeline']->timeOffTaskTime = isset($timeToSend1) ? $timeToSend1.':00.000+00:00' : (isset($timeToSend2) ? $timeToSend2.':00.000+00:00' : '00:00:00.000+00:00');
            $retToNormal = new \Moment\Moment($incident['rno_date']);
            $data['timeline']->returnToNormalDate = $retToNormal->format('YYYY-MM-DD[T]HH:mm:ss.000Z', new \Moment\CustomFormats\MomentJs());
            $data['timeline']->returnToNormalTime = $retToNormal->format('H:i:s.vP');
            $data['timeline']->method = getPaged($incident['advised']);
            $data['timeline']->departure = getDeparted($incident['depart_type']);
            $data['timeline']->scene = getOnScene($incident['on_scene']);
            $data['map'] = new StdClass();
            $data['map']->lat = $incident['lat'];
            $data['map']->lng = $incident['lon'];
            // classification
            $data['classification'] = returnDanger($incident['distress']);
            // type
            $data['Type'] = fetchNameFromDB($incident['sitid'],$database, 'sar_incident_type');
            // alert type
            $data['AlertType'] = fetchNameFromDB($incident['siatid'],$database, 'sar_incident_alerttype');
            //primary_cause
            $data['CausesClassification'] = fetchNameFromDB($incident['sicid'],$database, 'sar_incident_cause');
            // secondry cause
            $causearray = array();
            if($incident['sicid2'] != 0){
                array_push($causearray, fetchNameFromDB($incident['sicid2'],$database, 'sar_incident_cause'));
            }
    
            if($incident['sicid3'] != 0){
                array_push($causearray, fetchNameFromDB($incident['sicid3'],$database, 'sar_incident_cause'));
            }
            $data['Detection'] = fetchNameFromDB($incident['sidid'],$database, 'sar_incident_detection');
            $data['Action'] = fetchNameFromDB($incident['siaid'],$database, 'sar_incident_action');
            $data['Pollution'] = returnPolution($incident['polution']);
            $data['CommercialAssistance'] = getAssistance($incident['comassist']);
            $data['Speed'] = (string)$incident['windspeed'];
            $data['Direction'] = strtolower($incident['winddir']);
            $addData = unserialize(base64_decode($incident['info']));
            $data['AirTemperature'] = !empty($addData['airtemp']) ? $addData['airtemp'] : 0;
            $data['Current'] = $addData['current'];
            $data['Seas'] = $incident['seas'];
            $closedDate= new \Moment\Moment($incident['cdate']);
            $data['closedDate'] = $closedDate->format('Y-m-d\TH:i:s.v\Z');
            $data['SeaTemp'] = !empty($addData['seatemp']) ? $addData['seatemp'] : 0;
            $data['Tide'] = strtolower($addData['tide']);
            $data['Visibility'] = $incident['visibility'];
            $data['WeatherDescription'] = mb_convert_encoding($addData['weather'], 'UTF-8');
            $data['Total'] = is_numeric($incident['pob']) && $incident['pob'] > 0 ?  (int)$incident['pob'] : 0;
            $data['Assisted'] = is_numeric($incident['passisted']) && $incident['passisted'] > 0 ?  (int)$incident['passisted'] : 0;
            $data['Saved'] = is_numeric($incident['psaved']) && $incident['psaved'] > 0  ?  (int)$incident['psaved'] : 0;
            $data['Missing'] = is_numeric($incident['pmissing']) && $incident['pmissing'] > 0 ?  (int)$incident['pmissing'] : 0;
            $data['Lost'] = is_numeric($incident['plost']) && $incident['plost'] > 0 ?  (int)$incident['plost'] : 0;
            $data['VesselName'] = mb_convert_encoding($addData['assist_vessel']['name'], 'UTF-8');
            $data['VesselType'] = fetchNameFromDB($addData['assist_vessel']['svcid'], $database, 'sar_vessel_class');
            $data['Registration'] = mb_convert_encoding($addData['assist_vessel']['license'], 'UTF-8');
            $data['Nationality'] = 'CA';
            if(!empty($addData['tow']['distance'])) {
                $data['EscortDist'] = mb_convert_encoding($addData['tow']['distance'], 'UTF-8');
                $data['WasTowingInvolvedIntheIncident'] = "yes";
            } else {
                $data['WasTowingInvolvedIntheIncident'] = "no";
            }
            if(!empty($addData['tow']['time']) && ($addData['tow']['time'] !== "0" || $addData['tow']['time'] !== 0)) {
                $t = explode(':', $addData['tow']['time'], -1);
                $firstCall = true;
                foreach($t as $time) {
                    $timeToSend = sprintf("%02d", $time);
                    if(count($t) <= 1) {
                        $timeToSend1 = $timeToSend.':'.$timeToSend;
                    } else {
                        if($firstCall) {
                            $firstTime = $timeToSend;
                            $firstCall = false;
                        }
                        $timeToSend2 = $firstTime.':'.$timeToSend;
                    }
                }
                $data['EscortTime'] = isset($timeToSend1) ? $timeToSend1.':00.000+00:00' : (isset($timeToSend2) ? $timeToSend2.':00.000+00:00' : '00:00:00.000+00:00');
            }
            if (!empty($addData['dhtrboats']) && ($addData['dhtrboats'] !== "0" || $addData['dhtrboats'] !== 0)) {
                $t = explode(':', $addData['tow']['time'], -1);
                $firstCall = true;
                foreach($t as $time) {
                    $timeToSend = sprintf("%02d", $time);
                    if(count($t) <= 1) {
                        $timeToSend1 = $timeToSend.':'.$timeToSend;
                    } else {
                        if($firstCall) {
                            $firstTime = $timeToSend;
                            $firstCall = false;
                        }
                        $timeToSend2 = $firstTime.':'.$timeToSend;
                    }
                }
                $data['DaughterBoatTime'] = isset($timeToSend1) ? $timeToSend1.':00.000+00:00' : (isset($timeToSend2) ? $timeToSend2.':00.000+00:00' : '00:00:00.000+00:00');
            }
            $data['Loa'] = !empty($addData['assist_vessel']['loa']) && is_numeric($addData['assist_vessel']['loa']) && $addData['assist_vessel']['loa'] > 0  ? (int)$addData['assist_vessel']['loa'] : 0;
            $data['Gt'] = !empty($addData['assist_vessel']['gt']) && is_numeric($addData['assist_vessel']['gt']) && $addData['assist_vessel']['gt'] > 0 ?  (int)$addData['assist_vessel']['gt'] : 0;
            $data['Value'] = mb_convert_encoding($addData['assist_vessel']['value'], 'UTF-8');
            $data['Draft'] = !empty($addData['assist_vessel']['draft']) && is_numeric($addData['assist_vessel']['draft']) ?  (int)$addData['assist_vessel']['draft'] : 0;
            $data['VesselNotes'] = mb_convert_encoding($addData['assist_vessel']['notes'], 'UTF-8');
            $data['MasterName'] = !empty($addData['assist_vessel']['master']) ? $addData['assist_vessel']['master'] : '';
            $data['OwnerIfDifferent'] = mb_convert_encoding($addData['assist_vessel']['owner'], 'UTF-8');
            $data['Address'] = !empty($addData['assist_vessel']['address1']) ? $addData['assist_vessel']['address1'] : (!empty($addData['assist_vessel']['address2']) ? $addData['assist_vessel']['address1']." ".$addData['assist_vessel']['address2'] : '');
            $data['Email'] = mb_convert_encoding($addData['assist_vessel']['email'], 'UTF-8');
            $data['Gender'] = mb_convert_encoding($addData['assist_vessel']['sex'], 'UTF-8');
            $data['Certified'] = $addData['assist_vessel']['pcoc'];
    
            $data['Age'] = !empty($addData['assist_vessel']['age']) ?  mb_convert_encoding($addData['assist_vessel']['age'], 'UTF-8') : 0;
            $data['Telephone'] = mb_convert_encoding($addData['assist_vessel']['telephone1'], 'UTF-8');
            $data['missionlog'] = mission_log($addData['events']);
            $data['MissionLogDescription'] = mb_convert_encoding($addData['description'], 'UTF-8');
            $db->where('object','sar_incident');
            $db->where('iid', $incident['id']);
            $results = $db->get('images');
            $files = array();
            foreach($results as $result) {
                $fileName = $result['filename'];
                $ext = explode('.', $fileName);
                $awsurl = getAwsUrl($database)."$fileName";
                $content = file_get_contents($awsurl);
                $extension = isset($ext[1]) ? $ext[1] : "";
                if(!empty($fileName) && !empty($content))
                {
                    try
                    {
                        $client = new Client();
                        $response = $client->post(
                            HOST.'/uploader/upload/ccga-test', [
                                'multipart' => [
                                    [
                                        'name' => 'file',
                                        'contents' => $content,
                                        'filename' => $fileName
                                    ]
                                ]
                            ]
                        );
                        $r = json_decode($response->getBody(), TRUE);
    
                        if ($r['isSuccess'])
                        {
                            $obj = new StdClass();
                            $url = $r['data']['success'][0];
                            $obj->url = $url;
                            $obj->isImage = true;
                            array_push($files, $obj);
                            error_log("Successfully inserted file in AWS \n");
                            file_put_contents("sar_incident_success.txt", json_encode($r), FILE_APPEND | LOCK_EX);
                            file_put_contents("sar_incident_success.txt", "\r\n", FILE_APPEND | LOCK_EX);
                        } else
                        {
                            file_put_contents(
                                "sar_incident_fail.txt", json_encode($r),
                                FILE_APPEND | LOCK_EX
                            );
                            file_put_contents("sar_incident_fail.txt", "\r\n", FILE_APPEND | LOCK_EX);
                            $data['imageUrl'] = '';
                        }
                    } catch (Exception $e)
                    {
                        error_log("Printing Exception for image upload ". json_encode($e));
                    }
                } else {
                    $data['imageUrl'] = '';
                }
            }
            $data['fileUpload'] = $GLOBALS['files'];
            createSubmission($data);
        }

    }
}
function getUidFromName($fname, $lname) {
    try {
        $client = new Client();
        $req = $client->request('GET', HOST.'/authentication/v2/users?q=givenName:'.$fname.' lastName:'.$lname.'&perPage=50&shouldExpandResults=true&attributeScope=basic&toCSV=false');
        $resp = json_decode($req->getBody(), true);
        if($resp['isSuccess'] && $resp['data']['resultsTotal'] > 0) {
            return $resp['data']['results'][0];
        } else {
            return false;
        }
    } catch(Exception $ex) {
        echo "Exception for authentication api ". $ex->getMessage();
        return false;
    }
}
function returnSquadronFileName($db) {
    switch($db) {
        case 'ccgaca' :
            return 'central_squadron.json';
            break;
        case 'ccgam' :
            return 'maritime_squadron.json';
            break;
        case 'ccgap' :
            return 'pacific_squadron.json';
            break;
        case 'ccgaq' :
            return 'quebec_squadron.json';
            break;
        default:
            return '';
    }
}
function getAgency($id, $database) {
    $db = new MysqliDb ('192.81.56.62', 'innovexa', 'inno@123!', $database);
    $data = $db->rawQuery(
        'select so.name from sar_incident_oagency_xref ox INNER JOIN sar_oagency so ON ox.soaid = so.id
                WHERE ox.siid = ?', Array($id)
    );
    return $data;
}
function  getUidFromIncidentTable($database, $id) {
    $db = new MysqliDb ('192.81.56.62', 'innovexa', 'inno@123!', $database);
   $data = $db->rawQuery(
        'select  p.spid, per.first_name, per.last_name, per.suid from sar_incident_person_xref p
              INNER JOIN sar_incident i ON i.id = p.siid
              INNER JOIN sar_person per ON p.spid = per.id
              WHERE p.siid = ?', Array($id)
    );
    return $data;
}
function fetchIdFromDB($name) {
    $db = new MysqliDb ('ccga-dev-k8.cx0ep9ygxsma.ca-central-1.rds.amazonaws.com', 'ccga_dev', 'x2oYAR2X6D19', 'assets');
    $db->where('name', $name, 'LIKE');
    $asset = $db->getOne('assets');
    return $asset['id'];
}
function getPcoc($id) {
    switch ($id) {
        case 'No' :
            return 'no';
            break;
        case 'Yes' :
            return 'yes';
            break;
        case 'ukwn' :
            return 'unknown';
            break;
        default:
            return false;
            break;
    }
}
function getAssistance($id) {
    switch ($id) {
        case 0 :
            return 'none';
            break;
        case 1 :
            return 'notAvailable';
            break;
        case 2 :
            return 'acceptedHandoffTo';
            break;
        case 3 :
            return 'acceptedTookOverFrom';
            break;
        case 4 :
            return 'acceptedJoint';
            break;
        case 5 ;
            return 'declined';
            break;
        default :
            return false;
            break;
    }
}
function getPaged($id) {
    switch ($id) {
        case 0 :
            return 'Paged';
            break;
        case 1 :
            return 'VHF/Cell(Underway)';
            break;
        case 2 :
            return 'Sighted/Self';
            break;
        default:
            return false;
            break;
    }
}
function getDeparted($id) {
    switch ($id) {
        case 0 :
            return 'Departed';
            break;
        case 1 :
            return 'Stood Down';
            break;
        default :
            return false;
            break;
    }
}
function getOnScene($id) {
    switch ($id) {
        case 0 :
            return 'On-Scene';
            break;
        case 1 :
            return 'Stood-Down';
            break;
        default:
            return false;
            break;
    }
}
function getAwsUrl($region){
    switch ($region) {
        case 'ccgaca':
            return "https://ccgaca.s3.amazonaws.com/images/SAR/";
            break;
        case 'ccgam':
            return "http://www.ccga-m.ca/images/SAR/";
            break;
        case 'ccgap':
            return "https://ccgapacific.s3.amazonaws.com/images/SAR/";
            break;
        case 'ccgaq':
            return "https://gcacquebec.s3.amazonaws.com/images/SAR/";
            break;
    }
}
function getRegionId($squadronId) {
    try{
        $client = new Client();
        $regionReq = $client->request('GET', HOST.'/authentication/v2/squadrons?q=squadronId:'.$squadronId.'&shouldExpandResults=true');
        $regionRes = json_decode($regionReq->getBody(), TRUE);
        if ($regionRes['isSuccess']) {
            return (int)$regionRes['data']['results'][0]['regionId'];
        } else {
            return  0;
        }
    } catch(Exception $ex) {
        echo "Exception in getRegionId ". $ex->getMessage();
        return  0;
    }
}

