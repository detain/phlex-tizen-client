<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Phlex\Server\Core\Application;

// Load configuration
$configPath = __DIR__ . '/../config/server.php';
$app = new Application($configPath);
$app->run();
