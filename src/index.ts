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

const defaultSvg = `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
 <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22M12 2C9.49872 4.73835 8.07725 8.29203 8 12C8.07725 15.708 9.49872 19.2616 12 22M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22M2.50002 9H21.5M2.5 15H21.5" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

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

      // If cached is explicitly null (previously marked as not found), return default SVG
      // if (cached === null) {
      //   return new Response(defaultSvg, {
      //     status: 404,
      //     headers: {
      //       'Content-Type': 'image/svg+xml',
      //       'Cache-Control': 'public, max-age=60' // 1 hour
      //     }
      //   });
      // }

      try {
        // Get favicon URL
        const faviconResult = await FaviconFetcher.getFavicon(targetUrl);

        if (!faviconResult) {
          // await env.FAVICON_CACHE.put(cacheKey, JSON.stringify(null), { expirationTtl: 3600 }); // Cache null for 1 hour
          return new Response(defaultSvg, {
            status: 404,
            headers: {
              'Content-Type': 'image/svg+xml',
              'Cache-Control': 'public, max-age=3600' // 1 hour
            }
          });
        }

        // Download the image
        const imageResponse = await fetch(faviconResult.url);
        if (!imageResponse.ok) {
          await env.FAVICON_CACHE.put(cacheKey, JSON.stringify(null), { expirationTtl: 3600 });
          return new Response(defaultSvg, {
            status: 404,
            headers: {
              'Content-Type': 'image/svg+xml',
              'Cache-Control': 'public, max-age=3600' // 1 hour
            }
          });
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
        return new Response(defaultSvg, {
          status: 404,
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=3600' // 1 hour
          }
        });
      }
    }

    return new Response(defaultSvg, {
      status: 404,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600' // 1 hour
      }
    });
  }
};