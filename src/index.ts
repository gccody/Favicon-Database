/// <reference types="@cloudflare/workers-types" />

import { FaviconFetcher } from './faviconFetcher';

const defaultSvg = `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
 <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22M12 2C9.49872 4.73835 8.07725 8.29203 8 12C8.07725 15.708 9.49872 19.2616 12 22M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22M2.50002 9H21.5M2.5 15H21.5" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/favicon') {
      const targetUrl = url.searchParams.get('url');

      if (!targetUrl) {
        return new Response('Missing url parameter', { status: 400 });
      }

      try {
        // Get favicon URL
        const faviconResult = await FaviconFetcher.getFavicon(targetUrl);

        if (!faviconResult) {
          // Redirect to not found SVG
          return new Response(null, {
          status: 302,
          headers: {
            'Location': `${url.origin}/notfound.svg`,
            'Cache-Control': 'public, max-age=1,209,600', // Cache the redirect for 14 days
          }
        });
        }

        // Redirect to the discovered favicon URL with cache headers
        return new Response(null, {
          status: 302,
          headers: {
            'Location': faviconResult.url,
            'Cache-Control': 'public, max-age=31,536,000', // Cache the redirect for 365 days
          }
        });

      } catch (error) {
        console.error('Error:', error);
        return Response.redirect(`${url.origin}/notfound.svg`, 302);
      }
    }

    if (url.pathname === '/notfound.svg') {
      return new Response(defaultSvg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=31,536,000' // 365 days
        }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};
