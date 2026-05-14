<?php

namespace Phlex\Tests\Unit\Server\Core;

use PHPUnit\Framework\TestCase;
use Phlex\Server\Core\Application;

class ApplicationTest extends TestCase
{
    public function testApplicationCanBeInstantiated(): void
    {
        $configPath = __DIR__ . '/../../../../config/server.php';
        $app = new Application($configPath);

        $this->assertInstanceOf(Application::class, $app);
    }
}
