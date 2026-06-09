import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';
import { createTestResultWithElement } from '../../utils/elementSelector';

export class SeoValidationPlugin implements ValidationPlugin {
  id = 'seo';
  name = 'SEO Validation';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing SEO Validation...');

    // 1. Meta Information
    if (enabledSubTests.has('metaInformation')) {
      try {
        const meta = await lowerPage.evaluate(() => {
          const title = document.querySelector('title')?.textContent || '';
          const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
          const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
          const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
          
          return { title, description, canonical, robots };
        });

        // Title length suggestion (50-60 characters)
        const titleLen = meta.title.length;
        const titlePassed = titleLen >= 10 && titleLen <= 70;
        results.push(await createTestResultWithElement(lowerPage, {
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Meta Title Length',
          expectedValue: 'Title length between 10 and 70 characters',
          actualValue: `${titleLen} chars ("${meta.title}")`,
          differenceDescription: titlePassed ? 'Length is within SEO guidelines' : 'Title tag is either too short or too long for ideal search engine snippets',
          severity: 'LOW',
          status: titlePassed ? 'PASS' : 'WARNING',
          elementSelector: 'title'
        }));

        // Meta description length suggestion (120-160 characters)
        const descLen = meta.description.length;
        const descPassed = descLen >= 50 && descLen <= 165;
        results.push(await createTestResultWithElement(lowerPage, {
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Meta Description Length',
          expectedValue: 'Description length between 50 and 165 characters',
          actualValue: `${descLen} chars ("${meta.description.slice(0, 30)}...")`,
          differenceDescription: descPassed ? 'Length matches recommendations' : 'Description is outside the standard length guidelines (50-165)',
          severity: 'LOW',
          status: descPassed ? 'PASS' : 'WARNING',
          elementSelector: 'meta[name="description"]'
        }));

        // Canonical URL presence
        const canonicalPassed = meta.canonical.length > 0;
        results.push(await createTestResultWithElement(lowerPage, {
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Canonical Link',
          expectedValue: 'Rel canonical element present',
          actualValue: meta.canonical ? `Canonical: "${meta.canonical}"` : 'Missing canonical link tag',
          differenceDescription: canonicalPassed ? 'Canonical tag exists' : 'Canonical tags are required to prevent duplicate content indexation issues',
          severity: canonicalPassed ? 'LOW' : 'HIGH',
          status: canonicalPassed ? 'PASS' : 'FAIL',
          elementSelector: 'link[rel="canonical"]'
        }));
      } catch (err: any) {
        logExecution(`Error executing SEO Meta check: ${err.message}`);
      }
    }

    // 2. Search Engine Elements
    if (enabledSubTests.has('searchEngineElements')) {
      try {
        const seoElements = await lowerPage.evaluate(() => {
          const schema = document.querySelectorAll('script[type="application/ld+json"]').length;
          
          const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
          const ogType = document.querySelector('meta[property="og:type"]')?.getAttribute('content') || '';
          const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
          
          const twitterCard = document.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || '';

          return {
            schemaCount: schema,
            hasOgTitle: ogTitle.length > 0,
            hasOgType: ogType.length > 0,
            hasOgImage: ogImage.length > 0,
            hasTwitterCard: twitterCard.length > 0
          };
        });

        // Verify Schema
        const schemaPassed = seoElements.schemaCount > 0;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Structured Schema Data',
          expectedValue: 'At least 1 application/ld+json script',
          actualValue: `${seoElements.schemaCount} schema structures detected`,
          differenceDescription: schemaPassed ? 'JSON-LD schema structured data present' : 'No structured metadata schema found',
          severity: 'LOW',
          status: schemaPassed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });

        // Verify Open Graph
        const ogPassed = seoElements.hasOgTitle && seoElements.hasOgType;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Open Graph (OG) Tags',
          expectedValue: 'og:title and og:type headers present',
          actualValue: ogPassed ? 'OG tags found' : 'Some core OG tags (og:title, og:type) are missing',
          differenceDescription: ogPassed ? 'Social share tags are properly defined' : 'Missing social graph attributes',
          severity: 'LOW',
          status: ogPassed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error executing SEO elements check: ${err.message}`);
      }
    }

    // 3. URL Validation
    if (enabledSubTests.has('urlValidation')) {
      // Check for lowercase and clean characters in URL
      const cleanUrlPattern = /^[a-z0-9\-\/\.\?\&\=\_]+$/i;
      const isClean = cleanUrlPattern.test(relativeUrl);
      results.push({
        pageUrl: relativeUrl,
        category: this.name,
        subTest: 'URL Structure Consistency',
        expectedValue: 'Clean, lowercase, search-friendly relative URL paths',
        actualValue: relativeUrl,
        differenceDescription: isClean ? 'URL format is clean and optimized' : 'URL contains uppercase letters or special characters that might affect SEO indexing consistency',
        severity: 'LOW',
        status: isClean ? 'PASS' : 'WARNING',
        timestamp: new Date().toISOString()
      });
    }

    return results;
  }
}
