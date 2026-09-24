<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RequireBrowserOrigin
{
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->headers->get('Origin');
        $referer = $request->headers->get('Referer');
        if ($origin === null && $referer === null && $request->headers->get('Sec-Fetch-Site') !== 'cross-site') {
            return $next($request);
        }

        $candidate = $this->origin($origin ?? $referer ?? '');
        $allowed = array_filter([
            $this->origin((string) config('app.frontend_url')),
            $this->origin((string) config('app.url')),
        ]);
        // Local single-server development may use either loopback hostname.
        if (app()->environment('local') && in_array($request->getHost(), ['localhost', '127.0.0.1', '::1'], true)) {
            $allowed[] = $this->origin($request->getSchemeAndHttpHost());
        }
        if ($candidate === null || ! in_array($candidate, $allowed, true)) {
            throw new ApiException('Origin tidak diizinkan', 403);
        }

        return $next($request);
    }

    private function origin(string $url): ?string
    {
        $parts = parse_url($url);
        if (! is_array($parts) || isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }
        $scheme = strtolower($parts['scheme'] ?? '');
        $host = strtolower($parts['host'] ?? '');
        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            return null;
        }

        return $scheme.'://'.$host.':'.($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
    }
}
