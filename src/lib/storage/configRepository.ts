import fs from 'fs';
import path from 'path';

export interface SubTestCase {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

export interface TestCategoryConfig {
  id: string;
  name: string;
  enabled: boolean;
  subTests: SubTestCase[];
}

export interface AppConfig {
  categories: TestCategoryConfig[];
}

const DEFAULT_CONFIG: AppConfig = {
  categories: [
    {
      id: 'content',
      name: 'Content Validation',
      enabled: true,
      subTests: [
        { id: 'pageAvailability', name: 'Page Availability (404/Broken routes check)', enabled: true, description: 'All pages accessible, no unexpected 404, no broken routes' },
        { id: 'contentAccuracy', name: 'Content Accuracy (Meta titles, headers, footers)', enabled: true, description: 'Page titles, H1-H4, main content, footer, images present' },
        { id: 'richContent', name: 'Rich Content (Videos, tabs, accordions)', enabled: true, description: 'Videos load, embedded content load, accordions and tabs work' }
      ]
    },
    {
      id: 'seo',
      name: 'SEO Validation',
      enabled: true,
      subTests: [
        { id: 'metaInformation', name: 'Meta Information (Tags, descriptions, canonical)', enabled: true, description: 'Title tag, meta description, canonical URL, robots meta' },
        { id: 'searchEngineElements', name: 'Search Engine Elements (Sitemap, robots.txt, OG)', enabled: true, description: 'XML sitemap, robots.txt, structured data, Open Graph, Twitter cards' },
        { id: 'urlValidation', name: 'URL Validation (Redirects, formats)', enabled: true, description: 'URL format, redirect validation, URL consistency' }
      ]
    },
    {
      id: 'functional',
      name: 'Functional Testing',
      enabled: true,
      subTests: [
        { id: 'navigation', name: 'Navigation (Menu, Footer, Breadcrumbs)', enabled: true, description: 'Main menu, footer menu, breadcrumbs' },
        { id: 'forms', name: 'Forms (Submission & responses)', enabled: true, description: 'Form submission, validation, success, and error messages' },
        { id: 'search', name: 'Search & Filters', enabled: true, description: 'Search functionality, filters, sorting' },
        { id: 'authentication', name: 'Authentication (Login, Logout)', enabled: true, description: 'Login, logout, registration, password reset' }
      ]
    },
    {
      id: 'links',
      name: 'Link Validation',
      enabled: true,
      subTests: [
        { id: 'internalLinks', name: 'Internal Links', enabled: true, description: 'Broken links, incorrect links' },
        { id: 'externalLinks', name: 'External Links', enabled: true, description: 'Reachability, target validation' },
        { id: 'anchorLinks', name: 'Anchor Links', enabled: true, description: 'Correct scrolling, correct destination' }
      ]
    },
    {
      id: 'performance',
      name: 'Performance Testing',
      enabled: true,
      subTests: [
        { id: 'coreMetrics', name: 'Core Web Vitals (FCP, LCP, CLS, TTI)', enabled: true, description: 'Page Load Time, FCP, LCP, CLS, TTI' },
        { id: 'assets', name: 'Asset Optimization (Images, lazy loading)', enabled: true, description: 'Image optimization, CSS/JS optimization, lazy loading' }
      ]
    },
    {
      id: 'responsive',
      name: 'Responsive Testing',
      enabled: true,
      subTests: [
        { id: 'desktop', name: 'Desktop Layouts (1920x1080, 1366x768)', enabled: true, description: 'Desktop resolution UI check' },
        { id: 'tablet', name: 'Tablet Layouts (1024x768, 768x1024)', enabled: true, description: 'Tablet resolution UI check' },
        { id: 'mobile', name: 'Mobile Layouts (iPhone, Android)', enabled: true, description: 'Mobile viewports, layout, menus, forms, and overflow check' }
      ]
    },
    {
      id: 'browser',
      name: 'Browser Compatibility Testing',
      enabled: true,
      subTests: [
        { id: 'chrome', name: 'Google Chrome', enabled: true, description: 'Validate layout consistency, JS and CSS rendering in Chromium' },
        { id: 'firefox', name: 'Mozilla Firefox', enabled: true, description: 'Validate layout consistency, JS and CSS rendering in Firefox' },
        { id: 'edge', name: 'Microsoft Edge', enabled: true, description: 'Validate layout consistency, JS and CSS rendering in Edge' },
        { id: 'safari', name: 'Apple Safari', enabled: true, description: 'Validate layout consistency, JS and CSS rendering in WebKit' }
      ]
    },
    {
      id: 'accessibility',
      name: 'Accessibility Testing',
      enabled: true,
      subTests: [
        { id: 'keyboardNavigation', name: 'Keyboard Navigation', enabled: true, description: 'Tab order, focus visibility' },
        { id: 'screenReader', name: 'Screen Reader Readiness', enabled: true, description: 'Alt text, labels, heading hierarchy' },
        { id: 'wcag', name: 'WCAG Compliance (Contrast, ARIA)', enabled: true, description: 'Color contrast, ARIA labels, landmarks' }
      ]
    },
    {
      id: 'security',
      name: 'Security Validation',
      enabled: true,
      subTests: [
        { id: 'https', name: 'HTTPS & SSL Checks', enabled: true, description: 'SSL active, mixed content checks' },
        { id: 'securityHeaders', name: 'Security Headers', enabled: true, description: 'CSP, HSTS, X-Frame-Options, X-Content-Type-Options' },
        { id: 'forms', name: 'Form Security (XSS, CSRF)', enabled: true, description: 'XSS detection, input sanitization, CSRF indicators' }
      ]
    },
    {
      id: 'analytics',
      name: 'Analytics & Tracking Validation',
      enabled: true,
      subTests: [
        { id: 'trackingDetection', name: 'Tracking Scripts (GA4, GTM, Cookies)', enabled: true, description: 'Google Analytics, Tag Manager, Conversion events, cookie consent' }
      ]
    },
    {
      id: 'migration',
      name: 'Migration & Regression Validation',
      enabled: true,
      subTests: [
        { id: 'urlComparison', name: 'URL Comparison', enabled: true, description: 'Missing pages, extra pages, duplicate pages' },
        { id: 'contentComparison', name: 'Content Comparison', enabled: true, description: 'Compare Title, Description, Canonical, H1, Content, Images' },
        { id: 'seoComparison', name: 'SEO Tag Comparison', enabled: true, description: 'Schema, Robots, Open Graph' },
        { id: 'domComparison', name: 'DOM Tree Structure Comparison', enabled: true, description: 'Missing/extra nodes, structural differences' },
        { id: 'componentComparison', name: 'Reusable Component Comparison', enabled: true, description: 'Hero banner, rich text, CTA blocks, footer, etc.' }
      ]
    },
    {
      id: 'errorMonitoring',
      name: 'Error Monitoring',
      enabled: true,
      subTests: [
        { id: 'negativeTesting', name: 'Negative Test Scenarios', enabled: true, description: 'Invalid URLs, invalid input, empty searches, missing parameters' },
        { id: 'errorHandling', name: 'Error Handling & Crashes', enabled: true, description: 'Check error pages, graceful handling, console errors, network failures' }
      ]
    },
    {
      id: 'ui',
      name: 'UI Testing',
      enabled: true,
      subTests: [
        { id: 'typography', name: 'Typography Comparison', enabled: true, description: 'Fonts, weight, size, style, line height, letter spacing, alignment' },
        { id: 'colors', name: 'Colors Comparison', enabled: true, description: 'Text, bg, border, button, hover state, link, icon colors' },
        { id: 'images', name: 'Image Dimensions & Alt Text', enabled: true, description: 'Presence, size, cropping, alignment, quality, responsiveness' },
        { id: 'buttons', name: 'Button Styling Details', enabled: true, description: 'Colors, border radius, hover/active/disabled states, alignment' }
      ]
    },
    {
      id: 'visual-comprehensive',
      name: '🎬 VISUAL COMPREHENSIVE (BackstopJS + Applitools + Percy + Chromatic)',
      enabled: true,
      subTests: [
        { id: 'backstopjs', name: 'BackstopJS - Pixel Perfect Comparison', enabled: true, description: 'Pixel-level visual differences, text wrapping, spacing, colors' },
        { id: 'applitools', name: 'Applitools Eyes - AI Visual Testing', enabled: true, description: 'AI-powered visual differences, layout changes, font rendering' },
        { id: 'percy', name: 'Percy - Cloud Regression', enabled: true, description: 'Cloud-based visual regression, baseline management, PR integration' },
        { id: 'chromatic', name: 'Chromatic - Component Testing', enabled: true, description: 'Component-level visual changes, theme variations, breakpoints' }
      ]
    }
  ]
};

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export class ConfigRepository {
  static getConfig(): AppConfig {
    ensureDataDir();
    if (!fs.existsSync(CONFIG_PATH)) {
      this.saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }

    try {
      const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(content) as AppConfig;
      // Merge with default config to ensure new tests aren't missing
      const mergedCategories = DEFAULT_CONFIG.categories.map(defaultCat => {
        const parsedCat = parsed.categories?.find(c => c.id === defaultCat.id);
        if (!parsedCat) return defaultCat;
        
        const mergedSubTests = defaultCat.subTests.map(defaultSub => {
          const parsedSub = parsedCat.subTests?.find(s => s.id === defaultSub.id);
          return parsedSub ? { ...defaultSub, enabled: parsedSub.enabled } : defaultSub;
        });

        return {
          ...defaultCat,
          enabled: parsedCat.enabled !== undefined ? parsedCat.enabled : defaultCat.enabled,
          subTests: mergedSubTests
        };
      });
      return { categories: mergedCategories };
    } catch (error) {
      console.error('Failed to parse config, resetting to default:', error);
      this.saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
  }

  static saveConfig(config: AppConfig): void {
    ensureDataDir();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  }

  static toggleSubTest(categoryId: string, subTestId: string, enabled: boolean): AppConfig {
    const config = this.getConfig();
    const category = config.categories.find(c => c.id === categoryId);
    if (category) {
      const subTest = category.subTests.find(s => s.id === subTestId);
      if (subTest) {
        subTest.enabled = enabled;
      }
    }
    this.saveConfig(config);
    return config;
  }

  static toggleCategory(categoryId: string, enabled: boolean): AppConfig {
    const config = this.getConfig();
    const category = config.categories.find(c => c.id === categoryId);
    if (category) {
      category.enabled = enabled;
      // Also toggle all sub-tests in this category
      category.subTests.forEach(s => {
        s.enabled = enabled;
      });
    }
    this.saveConfig(config);
    return config;
  }
}
