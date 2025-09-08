import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

export interface FaviconResult {
  url: string;
  type?: string;
  source: 'direct' | 'html';
}

export class FaviconScraper {
  /**
   * Get favicon from a website using multiple strategies
   * @param url The website URL to scrape favicon from
   * @returns Promise with favicon URL or null if not found
   */
  static async getFavicon(url: string): Promise<FaviconResult | null> {
    try {
      // Try direct favicon.ico first (most common)
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
      const hostnameParts = parsedUrl.hostname.split(".")
      if (hostnameParts.length > 2) {
        parsedUrl.hostname = hostnameParts.slice(-2).join(".");
        return await this.getFavicon(parsedUrl.toString());
      }

      return null;
    } catch (error) {
      console.error('Error fetching favicon:', error);
      return null;
    }
  }

  /**
   * Try to fetch favicon from domain/favicon.ico
   */
  private static async tryDirectFavicon(url: string): Promise<FaviconResult | null> {
    try {
      const parsedUrl = new URL(url);
      // Extract root domain by taking the last two parts (may not work for all TLDs)
      let faviconUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}/favicon.ico`;
      
      const response = await axios.get(faviconUrl, {
        timeout: 5000,
        validateStatus: (status) => status === 200,
      });

      if (response.status === 200 && response.headers['content-type']?.includes('image')) {
        return {
          url: faviconUrl,
          type: response.headers['content-type'],
          source: 'direct'
        };
      }
    } catch (error) {
      // Silently fail - we'll try other methods
    }
    return null;
  }

  /**
   * Scrape HTML to find favicon links in meta tags
   */
  private static async scrapeHtmlForFavicon(url: string): Promise<FaviconResult | null> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.status !== 200) {
        return null;
      }

      const $ = cheerio.load(response.data as string);
      const parsedUrl = new URL(url);

      // Look for various favicon link types
      const faviconSelectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
        'link[rel="apple-touch-icon-precomposed"]',
        'link[rel="mask-icon"]'
      ];

      for (const selector of faviconSelectors) {
        const element = $(selector).first();
        if (element.length) {
          const href = element.attr('href');
          if (href) {
            const faviconUrl = this.resolveUrl(href, parsedUrl);
            return {
              url: faviconUrl,
              type: element.attr('type') || undefined,
              source: 'html'
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error scraping HTML for favicon:', error);
      return null;
    }
  }

  /**
   * Resolve relative URLs to absolute URLs
   */
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