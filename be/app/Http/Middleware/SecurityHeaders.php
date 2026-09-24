<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $scriptSrc = "'self' https://challenges.cloudflare.com";
        $contentType = (string) $response->headers->get('Content-Type');
        $content = $response->getContent();
        if (str_contains($contentType, 'text/html') && is_string($content)) {
            // data-src is metadata for SystemJS, not an external script src.
            preg_match_all('/<script(?![^>]*\ssrc\s*=)[^>]*>(.*?)<\/script>/is', $content, $matches);
            foreach ($matches[1] as $inlineScript) {
                if (trim($inlineScript) === '') {
                    continue;
                }
                $scriptSrc .= " 'sha256-".base64_encode(hash('sha256', $inlineScript, true))."'";
            }
        }
        $csp = "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src {$scriptSrc}; connect-src 'self'; frame-src https://challenges.cloudflare.com";

        $response->headers->set('Content-Security-Policy', $csp);
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $response->headers->set('Cross-Origin-Resource-Policy', 'same-origin');
        if ($request->is('api/*')) {
            $response->headers->set('Cache-Control', 'private, no-store');
        }
        if (app()->isProduction()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
