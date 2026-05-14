<?php

namespace Phlex\Server\Core;

use Workerman\Worker;

class Application
{
    private string $configPath;
    private array $config;

    public function __construct(string $configPath)
    {
        $this->configPath = $configPath;
        $this->config = include $configPath;
    }

    public function run(): void
    {
        $serverConfig = $this->config['server'];

        $worker = new Worker("http://{$serverConfig['host']}:{$serverConfig['port']}");
        $worker->onMessage = [$this, 'handleRequest'];

        Worker::runAll();
    }

    public function handleRequest($connection, $request): void
    {
        $response = new \Phlex\Server\Http\Response();
        $response->json(['status' => 'ok', 'message' => 'Phlex Media Server running']);
        $connection->send($response);
    }
}
