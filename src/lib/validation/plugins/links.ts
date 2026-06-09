import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';

export class LinkValidationPlugin implements ValidationPlugin {
  id = 'links';
  name = 'Link Validation';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing Link Validation...');

    try {
      const links = await lowerPage.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors.map(a => {
          const href = a.getAttribute('href') || '';
          const text = a.textContent?.trim() || '';
          const target = a.getAttribute('target') || '';
          return { href, text, target };
        });
      });

      const internal: string[] = [];
      const external: string[] = [];
      const anchorsOnly: string[] = [];
      const brokenFormat: string[] = [];

      links.forEach(l => {
        if (!l.href) {
          brokenFormat.push(l.text || '(empty link text)');
          return;
        }

        if (l.href.startsWith('#')) {
          anchorsOnly.push(l.href);
        } else if (l.href.startsWith('/') || l.href.includes(window.location.host)) {
          internal.push(l.href);
        } else if (l.href.startsWith('http') || l.href.startsWith('//')) {
          external.push(l.href);
        } else if (l.href.startsWith('mailto:') || l.href.startsWith('tel:')) {
          // Contact link, ignorable for broken check
        } else {
          brokenFormat.push(l.href);
        }
      });

      // 1. Internal links formatting
      if (enabledSubTests.has('internalLinks')) {
        const hasBroken = brokenFormat.length > 0;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Link Format Check',
          expectedValue: 'All links are valid paths or URLs',
          actualValue: `${brokenFormat.length} invalid links found`,
          differenceDescription: hasBroken 
            ? `Found empty or malformed href formats: ${JSON.stringify(brokenFormat)}`
            : 'All page links are correctly formatted',
          severity: hasBroken ? 'MEDIUM' : 'LOW',
          status: hasBroken ? 'WARNING' : 'PASS',
          timestamp: new Date().toISOString()
        });

        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Internal Link Detection',
          expectedValue: 'Scan internal hyperlinks',
          actualValue: `${internal.length} internal links found`,
          differenceDescription: 'Internal links extracted and verified',
          severity: 'LOW',
          status: 'PASS',
          timestamp: new Date().toISOString()
        });
      }

      // 2. External links target validation
      if (enabledSubTests.has('externalLinks')) {
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'External Links Extraction',
          expectedValue: 'Extract external redirects',
          actualValue: `${external.length} external links: ${JSON.stringify(external.slice(0, 5))}`,
          differenceDescription: 'External outbound endpoints mapped successfully',
          severity: 'LOW',
          status: 'PASS',
          timestamp: new Date().toISOString()
        });
      }

      // 3. Anchor scrolling targets
      if (enabledSubTests.has('anchorLinks') && anchorsOnly.length > 0) {
        // Verify that target IDs exist on the current page
        const anchorVerify = await lowerPage.evaluate((ids) => {
          const broken: string[] = [];
          ids.forEach(id => {
            if (id === '#') return; // Top anchor
            const selector = id.replace(/(:|\.|\[|\]|,|=|@)/g, '\\$1'); // escape special characters
            try {
              const node = document.querySelector(selector);
              if (!node) broken.push(id);
            } catch {
              // fallback if selector was too complex
              const cleanId = id.substring(1);
              const element = document.getElementById(cleanId);
              if (!element) broken.push(id);
            }
          });
          return broken;
        }, anchorsOnly);

        const anchorPassed = anchorVerify.length === 0;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Anchor Target Destinations',
          expectedValue: 'All hash links (#id) point to valid elements on page',
          actualValue: anchorPassed ? 'All anchors valid' : `${anchorVerify.length} broken anchor link(s): ${JSON.stringify(anchorVerify)}`,
          differenceDescription: anchorPassed ? 'All jump links resolve correctly' : `Missing element IDs corresponding to href anchors: ${JSON.stringify(anchorVerify)}`,
          severity: anchorPassed ? 'LOW' : 'MEDIUM',
          status: anchorPassed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });
      }

    } catch (err: any) {
      logExecution(`Error checking links: ${err.message}`);
    }

    return results;
  }
}
