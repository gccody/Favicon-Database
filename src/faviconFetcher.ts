export interface FaviconResult {
  url: string;
  type?: string;
  source: 'direct' | 'html';
}

export class FaviconFetcher {
  static async getFavicon(url: string): Promise<FaviconResult | null> {
    try {
      // Try direct favicon.ico first
      const directFavicon = await this.tryDirectFavicon(url);
      if (directFavicon) {
        return directFavicon;
      }

      // If direct favicon fails, try scraping HTML for favicon links
      const htmlFavicon = await this.scrapeHtmlForFavicon(url);
      if (htmlFavicon) {
        return htmlFavicon;
      }

      const parsedUrl = new URL(url);
      const hostnameParts = parsedUrl.hostname.split('.');
      if (hostnameParts.length > 2) {
        parsedUrl.hostname = hostnameParts.slice(-2).join('.');
        return await this.getFavicon(parsedUrl.toString());
      }

      return null;
    } catch (error) {
      console.error('Error fetching favicon:', error);
      return null;
    }
  }

  private static async tryDirectFavicon(url: string): Promise<FaviconResult | null> {
    try {
      const parsedUrl = new URL(url);
      const faviconUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}/favicon.ico`;

      const response = await fetch(faviconUrl, {
        method: 'HEAD', // Use HEAD to check if exists without downloading
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.ok && response.headers.get('content-type')?.includes('image')) {
        return {
          url: faviconUrl,
          type: response.headers.get('content-type') || undefined,
          source: 'direct'
        };
      }
    } catch (error) {
      // Silently fail
    }
    return null;
  }

  private static async scrapeHtmlForFavicon(url: string): Promise<FaviconResult | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      const parsedUrl = new URL(url);

      // Simple regex to find favicon links
      const faviconSelectors = [
        /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
        /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
        /<link[^>]*rel=["']apple-touch-icon-precomposed["'][^>]*href=["']([^"']+)["'][^>]*>/gi
      ];

      for (const regex of faviconSelectors) {
        const match = regex.exec(html);
        if (match && match[1]) {
          const href = match[1];
          const faviconUrl = this.resolveUrl(href, parsedUrl);
          return {
            url: faviconUrl,
            source: 'html'
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error scraping HTML for favicon:', error);
      return null;
    }
  }

  private static resolveUrl(href: string, baseUrl: URL): string {
    try {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return href;
      }
      if (href.startsWith('//')) {
        return `${baseUrl.protocol}${href}`;
      }
      if (href.startsWith('/')) {
        return `${baseUrl.origin}${href}`;
      }
      return `${baseUrl.origin}/${href}`;
    } catch (error) {
      return href;
    }
  }
}