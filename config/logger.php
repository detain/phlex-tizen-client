<?php

return [
    'default' => 'file',
    'handlers' => [
        'file' => [
            'type' => 'rotating_file',
            'path' => '/var/log/phlex/app.log',
            'max_files' => 30,
            'level' => 'debug',
        ],
        'error' => [
            'type' => 'rotating_file',
            'path' => '/var/log/phlex/error.log',
            'max_files' => 30,
            'level' => 'error',
        ],
    ],
];
