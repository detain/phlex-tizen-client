<?php

return [
    'server' => [
        'name' => 'Phlex Media Server',
        'host' => '0.0.0.0',
        'port' => 8096,
        'context' => [],
    ],
    'worker' => [
        'count' => 'auto',
        'stdout_file' => '/var/log/phlex/stdout.log',
        'pid_file' => '/var/run/phlex/pid',
    ],
    'process' => [
        'reloadable' => true,
        'reuse_port' => true,
    ],
];
