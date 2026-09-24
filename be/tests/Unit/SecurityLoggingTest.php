<?php

namespace Tests\Unit;

use App\Logging\RedactSensitiveData;
use Monolog\Handler\TestHandler;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;

final class SecurityLoggingTest extends TestCase
{
    public function test_log_message_context_and_exceptions_do_not_expose_credentials(): void
    {
        $handler = new TestHandler;
        $logger = new Logger('security', [$handler]);
        (new RedactSensitiveData)($logger);
        $logger->warning('Reset https://example.test/reset-password#token=private-token', [
            'password' => 'private-password',
            'exception' => new \RuntimeException('SQL contains private-password'),
            'nested' => ['authorization' => 'Bearer private-token'],
        ]);
        $record = $handler->getRecords()[0];
        $serialized = json_encode([$record->message, $record->context]);
        $this->assertStringNotContainsString('private-token', $serialized);
        $this->assertStringNotContainsString('private-password', $serialized);
        $this->assertSame(\RuntimeException::class, $record->context['exception']['class']);
    }
}
