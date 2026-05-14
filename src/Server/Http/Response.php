<?php

namespace Phlex\Server\Http;

class Response
{
    private array $headers = ['Content-Type' => 'application/json'];
    private int $statusCode = 200;
    private string $body = '';

    public function json(array $data, int $statusCode = 200): self
    {
        $this->body = json_encode($data);
        $this->statusCode = $statusCode;
        $this->headers['Content-Type'] = 'application/json';
        return $this;
    }

    public function getBody(): string
    {
        return $this->body;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getHeaders(): array
    {
        return $this->headers;
    }
}
