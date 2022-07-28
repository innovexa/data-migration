<?php
    require_once './vendor/autoload.php';
    $path ='.env';
    if(file_exists($path)){
        $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
        $dotenv->load();
        $config = new StdClass();
        $config->host = getenv('HOST');
    }
 
?>
