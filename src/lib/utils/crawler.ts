import { chromium } from 'playwright';

export interface SitemapParseResult {
  urls: string[];
  rawXml?: string;
  error?: string;
}

export class SitemapCrawler {
  static async fetchSitemapUrls(sitemapUrl: string): Promise<SitemapParseResult> {
    try {
      // Fetch via fetch API first
      const res = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebsiteMigrationValidator/1.0' },
        next: { revalidate: 0 } // disable caching
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch sitemap, status: ${res.status} ${res.statusText}`);
      }

      const text = await res.text();
      return this.parseSitemapXml(text);
    } catch (err: any) {
      console.warn(`Fetch sitemap failed for ${sitemapUrl}, attempting browser-based fetch:`, err);
      // Fallback: Use Playwright to load the sitemap (in case of Cloudflare/CORS block)
      let browser;
      try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(sitemapUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const text = await page.content();
        await browser.close();
        return this.parseSitemapXml(text);
      } catch (browserErr: any) {
        if (browser) await browser.close();
        return {
          urls: [],
          error: `Sitemap loading failed: ${err.message || err}. Browser fallback error: ${browserErr.message || browserErr}`
        };
      }
    }
  }

  static parseSitemapXml(xmlText: string): SitemapParseResult {
    const urls: string[] = [];
    // Regular expression to match <loc>...</loc> tags
    const locRegex = /<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi;
    let match;
    
    while ((match = locRegex.exec(xmlText)) !== null) {
      urls.push(match[1].trim());
    }

    if (urls.length === 0) {
      // Try a looser regex if standard sitemap namespace is missing
      const urlRegex = /https?:\/\/[^\s<>"]+/g;
      const allUrls = xmlText.match(urlRegex) || [];
      const xmlOrSitemapUrls = allUrls.filter(u => u.includes('.xml') || u.includes('/sitemap'));
      
      if (allUrls.length > 0) {
        // Return unique URLs excluding XML schemas or self-references if possible
        const unique = Array.from(new Set(allUrls)).filter(u => !u.endsWith('.xsd') && !u.endsWith('.dtd'));
        return { urls: unique, rawXml: xmlText };
      }

      return {
        urls: [],
        rawXml: xmlText,
        error: 'No URLs found in sitemap. Ensure it is a valid XML sitemap.'
      };
    }

    return {
      urls: Array.from(new Set(urls)),
      rawXml: xmlText
    };
  }

  static getRelativePath(urlStr: string): string {
    try {
      const url = new URL(urlStr);
      return url.pathname + url.search;
    } catch {
      // If parsing fails, try to return it as relative or return as-is
      return urlStr;
    }
  }

  static alignSitemaps(lowerUrls: string[], compareUrls: string[]): {
    matchedRelativePaths: string[];
    lowerOnly: string[];
    compareOnly: string[];
  } {
    const lowerMap = new Map<string, string>();
    const compareMap = new Map<string, string>();

    lowerUrls.forEach(url => {
      const rel = this.getRelativePath(url);
      lowerMap.set(rel, url);
    });

    compareUrls.forEach(url => {
      const rel = this.getRelativePath(url);
      compareMap.set(rel, url);
    });

    const matchedRelativePaths: string[] = [];
    const lowerOnly: string[] = [];
    const compareOnly: string[] = [];

    // Find matches and lower-only pages
    lowerMap.forEach((url, rel) => {
      if (compareMap.has(rel)) {
        matchedRelativePaths.push(rel);
      } else {
        lowerOnly.push(url);
      }
    });

    // Find compare-only pages
    compareMap.forEach((url, rel) => {
      if (!lowerMap.has(rel)) {
        compareOnly.push(url);
      }
    });

    return {
      matchedRelativePaths,
      lowerOnly,
      compareOnly
    };
  }
}
