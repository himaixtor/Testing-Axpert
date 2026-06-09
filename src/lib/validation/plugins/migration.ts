import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';

interface PageComparisonData {
  title: string;
  description: string;
  canonical: string;
  h1s: string[];
  mainTextLength: number;
  imagesCount: number;
  robots: string;
  schemaCount: number;
  ogTitle: string;
  domTags: Record<string, number>;
  components: {
    hasHero: boolean;
    hasFooter: boolean;
    hasNav: boolean;
    ctaCount: number;
    hasCarousel: boolean;
  };
}

export class MigrationValidationPlugin implements ValidationPlugin {
  id = 'migration';
  name = 'Migration & Regression Validation';

  private async extractPageData(page: any): Promise<PageComparisonData> {
    return page.evaluate(() => {
      const title = document.title;
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
      const h1s = Array.from(document.querySelectorAll('h1')).map(el => el.textContent?.trim() || '');
      const mainTextLength = document.querySelector('main, #content, body')?.textContent?.replace(/\s+/g, ' ').length || 0;
      const imagesCount = document.querySelectorAll('img').length;
      const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
      const schemaCount = document.querySelectorAll('script[type="application/ld+json"]').length;
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';

      // DOM Tag list count
      const tagList = ['div', 'section', 'article', 'header', 'footer', 'nav', 'button', 'form', 'input', 'a', 'p', 'ul', 'li'];
      const domTags: Record<string, number> = {};
      tagList.forEach(tag => {
        domTags[tag] = document.querySelectorAll(tag).length;
      });

      // Component checks
      const hasHero = !!document.querySelector('.hero, #hero, [class*="hero-banner"], section:first-of-type h1');
      const hasFooter = !!document.querySelector('footer, .footer, #footer');
      const hasNav = !!document.querySelector('nav, header, .header, #header');
      const ctaCount = document.querySelectorAll('.cta, button[class*="cta"], a[class*="cta"], .btn-primary, button[type="submit"]').length;
      const hasCarousel = !!document.querySelector('.carousel, .slider, .slideshow, [class*="swiper"], [class*="slick"]');

      return {
        title,
        description,
        canonical,
        h1s,
        mainTextLength,
        imagesCount,
        robots,
        schemaCount,
        ogTitle,
        domTags,
        components: {
          hasHero,
          hasFooter,
          hasNav,
          ctaCount,
          hasCarousel
        }
      };
    });
  }

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, comparePage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing Migration & Regression Validation...');

    let uatData: PageComparisonData;
    let prodData: PageComparisonData;

    try {
      logExecution('Extracting DOM comparison metrics from UAT (lower)...');
      uatData = await this.extractPageData(lowerPage);
      
      logExecution('Extracting DOM comparison metrics from Production (source of truth)...');
      prodData = await this.extractPageData(comparePage);
    } catch (err: any) {
      logExecution(`Error loading pages for comparative regression diff: ${err.message}`);
      results.push({
        pageUrl: relativeUrl,
        category: this.name,
        subTest: 'Page Load Comparison',
        expectedValue: 'Both UAT and Production pages loaded successfully',
        actualValue: 'Error loading page content for comparative diff',
        differenceDescription: `Page error encountered: ${err.message || err}`,
        severity: 'CRITICAL',
        status: 'FAIL',
        timestamp: new Date().toISOString()
      });
      return results;
    }

    // Helper function to compare strings
    const compareStrings = (uatVal: string, prodVal: string, name: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
      const match = uatVal.trim() === prodVal.trim();
      results.push({
        pageUrl: relativeUrl,
        category: this.name,
        subTest: `Content Match: ${name}`,
        expectedValue: prodVal ? `Prod: "${prodVal}"` : 'Missing in Prod',
        actualValue: uatVal ? `UAT: "${uatVal}"` : 'Missing in UAT',
        differenceDescription: match 
          ? `Value matches Production` 
          : `Discrepancy found. Production: "${prodVal}", UAT: "${uatVal}"`,
        severity: match ? 'LOW' : severity,
        status: match ? 'PASS' : 'FAIL',
        timestamp: new Date().toISOString()
      });
    };

    // 1. Content Comparison
    if (enabledSubTests.has('contentComparison')) {
      compareStrings(uatData.title, prodData.title, 'Meta Title Tag', 'HIGH');
      compareStrings(uatData.description, prodData.description, 'Meta Description Tag', 'MEDIUM');
      compareStrings(uatData.canonical, prodData.canonical, 'Rel Canonical Tag', 'HIGH');
      
      const prodH1 = prodData.h1s.join(' | ');
      const uatH1 = uatData.h1s.join(' | ');
      compareStrings(uatH1, prodH1, 'H1 Heading tags list', 'HIGH');

      // Image counts
      const imgDiff = uatData.imagesCount === prodData.imagesCount;
      results.push({
        pageUrl: relativeUrl,
        category: this.name,
        subTest: 'Image Asset Counts',
        expectedValue: `Production: ${prodData.imagesCount} images`,
        actualValue: `UAT: ${uatData.imagesCount} images`,
        differenceDescription: imgDiff 
          ? 'Image counts match Production' 
          : `Image count regression. Production has ${prodData.imagesCount} images, UAT has ${uatData.imagesCount}`,
        severity: 'MEDIUM',
        status: imgDiff ? 'PASS' : 'WARNING',
        timestamp: new Date().toISOString()
      });

      // Content size check (within 10% tolerance)
      const pctDiff = Math.abs(uatData.mainTextLength - prodData.mainTextLength) / (prodData.mainTextLength || 1) * 100;
      const contentPassed = pctDiff <= 10;
      results.push({
        pageUrl: relativeUrl,
        category: this.name,
        subTest: 'Main Content Word Volume',
        expectedValue: `Within 10% of Prod (${prodData.mainTextLength} chars)`,
        actualValue: `UAT: ${uatData.mainTextLength} chars (Diff: ${pctDiff.toFixed(1)}%)`,
        differenceDescription: contentPassed 
          ? 'Content word volume aligns with Production' 
          : `High content variation! Word length changed by ${pctDiff.toFixed(1)}% between environments. Review for missing paragraph texts.`,
        severity: 'MEDIUM',
        status: contentPassed ? 'PASS' : 'WARNING',
        timestamp: new Date().toISOString()
      });
    }

    // 2. SEO Comparison
    if (enabledSubTests.has('seoComparison')) {
      compareStrings(uatData.robots, prodData.robots, 'Robots directives tag', 'HIGH');
      compareStrings(uatData.ogTitle, prodData.ogTitle, 'Social og:title property', 'LOW');

      const schemaDiff = uatData.schemaCount === prodData.schemaCount;
      results.push({
        pageUrl: relativeUrl,
        category: this.name,
        subTest: 'Schema Tag Structures',
        expectedValue: `Production: ${prodData.schemaCount} JSON-LD schemas`,
        actualValue: `UAT: ${uatData.schemaCount} JSON-LD schemas`,
        differenceDescription: schemaDiff 
          ? 'Structured data tag count matches Production' 
          : `Metadata discrepancy. Production has ${prodData.schemaCount} schema tags, UAT has ${uatData.schemaCount}`,
        severity: 'MEDIUM',
        status: schemaDiff ? 'PASS' : 'WARNING',
        timestamp: new Date().toISOString()
      });
    }

    // 3. DOM Comparison (tag counts)
    if (enabledSubTests.has('domComparison')) {
      const tagsToCompare = ['div', 'button', 'form', 'a', 'p', 'input'];
      const differences: string[] = [];
      
      tagsToCompare.forEach(tag => {
        const prodCount = prodData.domTags[tag] || 0;
        const uatCount = uatData.domTags[tag] || 0;
        if (prodCount !== uatCount) {
          differences.push(`<${tag}> count difference: Prod = ${prodCount}, UAT = ${uatCount}`);
        }
      });

      const domPassed = differences.length === 0;
      results.push({
        pageUrl: relativeUrl,
        category: this.name,
        subTest: 'DOM Tree Structure Regression',
        expectedValue: 'Matching DOM tag counts',
        actualValue: domPassed ? 'Counts match' : `${differences.length} tag discrepancy/discrepancies`,
        differenceDescription: domPassed 
          ? 'Structural node counts match Production' 
          : `Structural regressions found in DOM layout tree: ${JSON.stringify(differences)}`,
        severity: 'MEDIUM',
        status: domPassed ? 'PASS' : 'WARNING',
        timestamp: new Date().toISOString()
      });
    }

    // 4. Component Comparison
    if (enabledSubTests.has('componentComparison')) {
      const components = [
        { key: 'hasHero' as const, name: 'Hero Banner Layout' },
        { key: 'hasFooter' as const, name: 'Footer Component' },
        { key: 'hasNav' as const, name: 'Main Navigation Header' },
        { key: 'hasCarousel' as const, name: 'Carousel Slider Widgets' }
      ];

      components.forEach(comp => {
        const prodVal = prodData.components[comp.key];
        const uatVal = uatData.components[comp.key];
        const compPassed = prodVal === uatVal;

        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: `Component: ${comp.name}`,
          expectedValue: prodVal ? 'Present in Prod' : 'Absent in Prod',
          actualValue: uatVal ? 'Present in UAT' : 'Absent in UAT',
          differenceDescription: compPassed
            ? 'Component structure matches Production'
            : `Possible component regression. Layout presence changed for component: ${comp.name}`,
          severity: 'HIGH',
          status: compPassed ? 'PASS' : 'FAIL',
          timestamp: new Date().toISOString()
        });
      });
    }

    return results;
  }
}
