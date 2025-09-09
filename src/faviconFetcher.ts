export interface FaviconResult {
  url: string;
  type?: string;
  source: 'direct' | 'html';
}

export class FaviconFetcher {
  static async getFavicon(url: string): Promise<FaviconResult | null> {
    try {
      const parsedUrl = new URL(url);
      if (this.isLocalIP(parsedUrl.hostname)) {
        return this.getDefaultFavicon();
      }
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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

  private static isLocalIP(hostname: string): boolean {
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    // Check if valid IPv4
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4Match) {
      return false;
    }

    const [_, a, b, c, d] = ipv4Match.map(Number);
    if (a > 255 || b > 255 || c > 255 || d > 255 || a < 0 || b < 0 || c < 0 || d < 0) {
      return false;
    }

    // Private IPv4 ranges
    if (a === 10 || a === 127) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }

    return false;
  }

  private static getDefaultFavicon(): FaviconResult {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#0078d4"/><text x="8" y="11" font-family="Arial" font-size="10" fill="white" text-anchor="middle" dominant-baseline="middle">?</text></svg>`;
    const base64Svg = Buffer.from(svgContent).toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;
    return {
      url: dataUrl,
      type: 'image/svg+xml',
      source: 'direct'
    };
  }
}