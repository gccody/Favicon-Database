/// <reference types="@cloudflare/workers-types" />

import { FaviconFetcher } from './faviconFetcher';

interface Env {
  FAVICON_CACHE: KVNamespace;
  FAVICON_BUCKET: R2Bucket;
}

interface CachedFavicon {
  r2Key: string;
  contentType: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/favicon') {
      const targetUrl = url.searchParams.get('url');

      if (!targetUrl) {
        return new Response('Missing url parameter', { status: 400 });
      }

      // Check KV cache
      const cacheKey = `favicon:${targetUrl}`;
      const cached = await env.FAVICON_CACHE.get(cacheKey, 'json') as CachedFavicon | null;

      if (cached) {
        // Serve from R2
        const object = await env.FAVICON_BUCKET.get(cached.r2Key);
        if (object) {
          return new Response(object.body, {
            headers: {
              'Content-Type': cached.contentType,
              'Cache-Control': 'public, max-age=86400' // 24 hours
            }
          });
        }
      }

      try {
        // Get favicon URL
        const faviconResult = await FaviconFetcher.getFavicon(targetUrl);

        if (!faviconResult) {
          await env.FAVICON_CACHE.put(cacheKey, JSON.stringify(null), { expirationTtl: 3600 }); // Cache null for 1 hour
          return new Response('Favicon not found', { status: 404 });
        }

        // Download the image
        const imageResponse = await fetch(faviconResult.url);
        if (!imageResponse.ok) {
          await env.FAVICON_CACHE.put(cacheKey, JSON.stringify(null), { expirationTtl: 3600 });
          return new Response('Failed to download favicon', { status: 500 });
        }

        const imageData = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/x-icon';

        // Generate R2 key
        const r2Key = `favicon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Store in R2
        await env.FAVICON_BUCKET.put(r2Key, imageData, {
          httpMetadata: {
            contentType
          }
        });

        // Cache metadata in KV
        const cacheData: CachedFavicon = {
          r2Key,
          contentType
        };
        await env.FAVICON_CACHE.put(cacheKey, JSON.stringify(cacheData), { expirationTtl: 86400 }); // 24 hours

        // Serve the image
        return new Response(imageData, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400'
          }
        });

      } catch (error) {
        console.error('Error:', error);
        return new Response('Internal server error', { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  }
};