import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';
import { createTestResultWithElement } from '../../utils/elementSelector';

export class ContentValidationPlugin implements ValidationPlugin {
  id = 'content';
  name = 'Content Validation';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing Content Validation...');

    // 1. Page Availability
    if (enabledSubTests.has('pageAvailability')) {
      try {
        const response = await lowerPage.evaluate(() => {
          return {
            status: window.performance.getEntriesByType('navigation')[0]
              ? (window.performance.getEntriesByType('navigation')[0] as any).responseStatus || 200
              : 200,
            title: document.title
          };
        });

        const status = response.status;
        const passed = status >= 200 && status < 400;

        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Page Availability',
          expectedValue: '2xx or 3xx HTTP Status',
          actualValue: `HTTP Status ${status}`,
          differenceDescription: passed ? 'Page loaded successfully' : `Unexpected HTTP status code: ${status}`,
          severity: passed ? 'LOW' : 'CRITICAL',
          status: passed ? 'PASS' : 'FAIL',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Page Availability',
          expectedValue: 'Page accessible',
          actualValue: 'Page crashed/unreachable',
          differenceDescription: `Error: ${err.message || err}`,
          severity: 'CRITICAL',
          status: 'FAIL',
          timestamp: new Date().toISOString()
        });
      }
    }

    // 2. Content Accuracy
    if (enabledSubTests.has('contentAccuracy')) {
      try {
        const accuracyData = await lowerPage.evaluate(() => {
          const h1s = Array.from(document.querySelectorAll('h1')).map(el => el.textContent?.trim() || '');
          const h2s = Array.from(document.querySelectorAll('h2')).map(el => el.textContent?.trim() || '');
          const h3s = Array.from(document.querySelectorAll('h3')).map(el => el.textContent?.trim() || '');
          const h4s = Array.from(document.querySelectorAll('h4')).map(el => el.textContent?.trim() || '');
          const images = Array.from(document.querySelectorAll('img')).map(el => el.getAttribute('src') || '');
          const footer = document.querySelector('footer')?.textContent?.trim() || '';
          
          return {
            title: document.title,
            h1Count: h1s.length,
            h1s,
            h2Count: h2s.length,
            h3Count: h3s.length,
            h4Count: h4s.length,
            imagesCount: images.length,
            hasFooter: footer.length > 0,
            footerLength: footer.length
          };
        });

        // Assertion: Standard page should have exactly one H1
        const h1Passed = accuracyData.h1Count === 1;
        results.push(await createTestResultWithElement(lowerPage, {
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'H1 Header Count',
          expectedValue: 'Exactly 1 H1 element',
          actualValue: `${accuracyData.h1Count} H1(s) found`,
          differenceDescription: h1Passed ? 'H1 tag structure is correct' : `Page has ${accuracyData.h1Count} H1 tags instead of 1. Titles: ${JSON.stringify(accuracyData.h1s)}`,
          severity: h1Passed ? 'LOW' : 'MEDIUM',
          status: h1Passed ? 'PASS' : 'WARNING',
          elementSelector: 'h1'
        }));

        // Assertion: Check page title
        const titlePassed = accuracyData.title.length > 0;
        results.push(await createTestResultWithElement(lowerPage, {
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Page Title',
          expectedValue: 'Non-empty page title',
          actualValue: accuracyData.title ? `Title: "${accuracyData.title}"` : 'Title is empty',
          differenceDescription: titlePassed ? 'Title tag is present and non-empty' : 'Page title is completely blank',
          severity: titlePassed ? 'LOW' : 'HIGH',
          status: titlePassed ? 'PASS' : 'FAIL',
          elementSelector: 'title'
        }));

        // Assertion: Images present
        const imagesPassed = accuracyData.imagesCount > 0;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Images Present',
          expectedValue: 'At least 1 image on the page',
          actualValue: `${accuracyData.imagesCount} images found`,
          differenceDescription: imagesPassed ? 'Images parsed successfully' : 'No images found on this page',
          severity: 'LOW',
          status: imagesPassed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error executing Content Accuracy check: ${err.message}`);
      }
    }

    // 3. Rich Content
    if (enabledSubTests.has('richContent')) {
      try {
        const richData = await lowerPage.evaluate(() => {
          const videos = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
          const accordions = document.querySelectorAll('[class*="accordion"], [id*="accordion"], details').length;
          const tabs = document.querySelectorAll('[class*="tab"], [id*="tab"], [role="tab"]').length;

          return { videos, accordions, tabs };
        });

        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Rich Content Detection',
          expectedValue: 'Detect rich widgets (videos, accordions, tabs)',
          actualValue: `Videos: ${richData.videos}, Accordions: ${richData.accordions}, Tabs: ${richData.tabs}`,
          differenceDescription: 'Rich content structure parsed',
          severity: 'LOW',
          status: 'PASS',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error executing Rich Content check: ${err.message}`);
      }
    }

    return results;
  }
}
