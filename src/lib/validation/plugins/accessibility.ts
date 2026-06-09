import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';

export class AccessibilityValidationPlugin implements ValidationPlugin {
  id = 'accessibility';
  name = 'Accessibility Testing';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing Accessibility Testing...');

    // 1. Alt text & labels (Screen Reader)
    if (enabledSubTests.has('screenReader')) {
      try {
        const screenReaderAudit = await lowerPage.evaluate(() => {
          const images = Array.from(document.querySelectorAll('img'));
          const missingAlt = images.filter(img => !img.hasAttribute('alt') || img.getAttribute('alt')?.trim() === '');
          
          const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
          const missingLabels = inputs.filter(input => {
            const id = input.getAttribute('id');
            const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
            const hasAria = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
            return !hasLabel && !hasAria;
          });

          // Headings order check
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => parseInt(h.tagName[1]));
          const headingFailures: string[] = [];
          for (let i = 1; i < headings.length; i++) {
            if (headings[i] - headings[i - 1] > 1) {
              headingFailures.push(`h${headings[i - 1]} followed by h${headings[i]}`);
            }
          }

          return {
            totalImages: images.length,
            missingAltCount: missingAlt.length,
            missingAltSources: missingAlt.slice(0, 3).map(img => img.getAttribute('src') || '(no src)'),
            totalInputs: inputs.length,
            missingLabelCount: missingLabels.length,
            headingFailures
          };
        });

        // Alt text checks
        const altPassed = screenReaderAudit.missingAltCount === 0;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Image Alt Text',
          expectedValue: 'All images have alt text',
          actualValue: `${screenReaderAudit.missingAltCount} of ${screenReaderAudit.totalImages} images missing alt text`,
          differenceDescription: altPassed 
            ? 'All image elements define alt text descriptive labels' 
            : `Images missing alt tags (affects screen readers): ${JSON.stringify(screenReaderAudit.missingAltSources)}`,
          severity: 'MEDIUM',
          status: altPassed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });

        // Heading hierarchy checks
        const hierarchyPassed = screenReaderAudit.headingFailures.length === 0;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Heading Hierarchy Levels',
          expectedValue: 'Logical sequential headings (no skipped levels)',
          actualValue: hierarchyPassed ? 'Heading hierarchy is correct' : `Skipped headings found: ${JSON.stringify(screenReaderAudit.headingFailures)}`,
          differenceDescription: hierarchyPassed ? 'Headings nesting structure is semantic' : 'Skipped heading levels break screen reader navigation structure',
          severity: 'LOW',
          status: hierarchyPassed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error checking screen reader compatibility: ${err.message}`);
      }
    }

    // 2. Keyboard Navigation
    if (enabledSubTests.has('keyboardNavigation')) {
      try {
        const keyboardAudit = await lowerPage.evaluate(() => {
          const focusable = Array.from(document.querySelectorAll('a, button, input, select, textarea, [tabindex]'));
          const negativeTabIndex = focusable.filter(el => {
            const index = el.getAttribute('tabindex');
            return index !== null && parseInt(index) < 0;
          }).length;

          return {
            focusableCount: focusable.length,
            negativeTabIndex
          };
        });

        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Tab Index Focusable Elements',
          expectedValue: 'Zero elements with negative tab indices unless intentionally hidden',
          actualValue: `${keyboardAudit.negativeTabIndex} items hidden from keyboard tab order`,
          differenceDescription: 'Interactive selectors parsed for keyboard navigation path',
          severity: 'LOW',
          status: 'PASS',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error checking keyboard navigation: ${err.message}`);
      }
    }

    // 3. WCAG Standards landmarks
    if (enabledSubTests.has('wcag')) {
      try {
        const landmarks = await lowerPage.evaluate(() => {
          const main = document.querySelectorAll('main').length;
          const nav = document.querySelectorAll('nav').length;
          const header = document.querySelectorAll('header').length;
          const footer = document.querySelectorAll('footer').length;

          return { main, nav, header, footer };
        });

        const landmarksPassed = landmarks.main === 1;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'WCAG Page Landmark Structures',
          expectedValue: 'Exactly 1 <main> tag',
          actualValue: `${landmarks.main} <main> tag(s) found`,
          differenceDescription: landmarksPassed 
            ? 'Semantic page structure is defined' 
            : 'Page should contain exactly 1 <main> element for screen reader landmark support',
          severity: 'MEDIUM',
          status: landmarksPassed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error checking WCAG landmarks: ${err.message}`);
      }
    }

    return results;
  }
}
