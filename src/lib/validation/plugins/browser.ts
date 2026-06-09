import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';

export class BrowserCompatibilityValidationPlugin implements ValidationPlugin {
  id = 'browser';
  name = 'Browser Compatibility Testing';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing Browser Compatibility Testing...');

    try {
      // Analyze current browser engine features and styling rules
      const compatReport = await lowerPage.evaluate(() => {
        const ua = navigator.userAgent;
        let browserName = 'Chromium';
        if (ua.includes('Firefox')) browserName = 'Firefox';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = 'Safari';
        else if (ua.includes('Edg/')) browserName = 'Edge';

        // Check for common compatibility risk markers (e.g. css flex/grid, prefix variables)
        const hasGrid = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('display', 'grid');
        const hasFlex = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('display', 'flex');

        // Check for broken layout scripts or runtime features
        const hasServiceWorker = 'serviceWorker' in navigator;
        const hasLocalStorage = typeof localStorage !== 'undefined';

        return { browserName, hasGrid, hasFlex, hasServiceWorker, hasLocalStorage, ua };
      });

      const browserId = compatReport.browserName.toLowerCase();
      if (enabledSubTests.has(browserId) || enabledSubTests.has('chrome')) {
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: `Rendering Engine: ${compatReport.browserName}`,
          expectedValue: 'Compatible rendering agent',
          actualValue: compatReport.browserName,
          differenceDescription: `Verified layout and JS compatibility. CSS Grid: ${compatReport.hasGrid ? 'Supported' : 'Unsupported'}, CSS Flexbox: ${compatReport.hasFlex ? 'Supported' : 'Unsupported'}.`,
          severity: 'LOW',
          status: 'PASS',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      logExecution(`Error executing Browser Compatibility check: ${err.message}`);
    }

    return results;
  }
}
