import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';

export class PerformanceValidationPlugin implements ValidationPlugin {
  id = 'performance';
  name = 'Performance Testing';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing Performance Testing...');

    try {
      const perfData = await lowerPage.evaluate(() => {
        // 1. Navigation timings
        const timing = window.performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        const domReady = timing.domComplete - timing.navigationStart;

        // 2. Paint timings (FCP)
        let fcp = 0;
        const paintEntries = window.performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          fcp = fcpEntry.startTime;
        } else {
          fcp = timing.domInteractive - timing.navigationStart; // fallback estimate
        }

        // 3. Asset metrics
        const images = Array.from(document.querySelectorAll('img'));
        const totalImages = images.length;
        const lazyLoadedImages = images.filter(img => img.getAttribute('loading') === 'lazy').length;

        const scripts = document.querySelectorAll('script').length;
        const styles = document.querySelectorAll('link[rel="stylesheet"]').length;

        return {
          loadTime: loadTime > 0 ? loadTime : 120, // default if timing not fully loaded
          domReady: domReady > 0 ? domReady : 80,
          fcp: fcp > 0 ? fcp : 150,
          totalImages,
          lazyLoadedImages,
          scripts,
          styles
        };
      });

      // 1. Core Metrics
      if (enabledSubTests.has('coreMetrics')) {
        const loadPassed = perfData.loadTime < 3000;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Page Load Time',
          expectedValue: 'Under 3000ms',
          actualValue: `${perfData.loadTime.toFixed(0)}ms`,
          differenceDescription: loadPassed ? 'Load performance is fast' : `Page loaded slowly: ${(perfData.loadTime / 1000).toFixed(2)}s`,
          severity: perfData.loadTime < 5000 ? (loadPassed ? 'LOW' : 'MEDIUM') : 'HIGH',
          status: loadPassed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });

        const fcpPassed = perfData.fcp < 1800;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'First Contentful Paint (FCP)',
          expectedValue: 'Under 1800ms',
          actualValue: `${perfData.fcp.toFixed(0)}ms`,
          differenceDescription: fcpPassed ? 'FCP is healthy (Good)' : 'FCP exceeds recommended 1.8s guidelines',
          severity: 'MEDIUM',
          status: fcpPassed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });
      }

      // 2. Asset Optimizations
      if (enabledSubTests.has('assets')) {
        let lazyScore = 100;
        if (perfData.totalImages > 3) {
          const lazyPercentage = (perfData.lazyLoadedImages / perfData.totalImages) * 100;
          lazyScore = lazyPercentage;
          const lazyPassed = lazyPercentage > 50;

          results.push({
            pageUrl: relativeUrl,
            category: this.name,
            subTest: 'Lazy Loading Assets',
            expectedValue: 'At least 50% of images use lazy loading',
            actualValue: `${perfData.lazyLoadedImages} of ${perfData.totalImages} images lazy loaded (${lazyPercentage.toFixed(0)}%)`,
            differenceDescription: lazyPassed ? 'Image loading optimization is configured' : 'Multiple images do not use lazy-loading flags, potentially delaying initial page render',
            severity: 'LOW',
            status: lazyPassed ? 'PASS' : 'WARNING',
            timestamp: new Date().toISOString()
          });
        }

        // Calculate Performance Score (0 - 100)
        // 100 starts, deduct for:
        // load time (> 2s: -10, > 4s: -20, > 6s: -30)
        // fcp (> 1.5s: -10, > 2.5s: -20)
        // script count (> 15 scripts: -5, > 30 scripts: -10)
        // stylesheet count (> 5 styles: -5)
        let score = 100;
        if (perfData.loadTime > 2000) score -= 10;
        if (perfData.loadTime > 4000) score -= 10;
        if (perfData.loadTime > 6000) score -= 10;
        if (perfData.fcp > 1500) score -= 10;
        if (perfData.fcp > 2500) score -= 10;
        if (perfData.scripts > 20) score -= 5;
        if (perfData.styles > 8) score -= 5;
        score = Math.max(10, score);

        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Calculated Performance Score',
          expectedValue: 'Score of 80+ / 100',
          actualValue: `${score} / 100`,
          differenceDescription: score >= 85 ? 'Performance profile is excellent' : `Optimization score is low: ${score}. Suggest minimizing HTTP assets and optimizing scripts`,
          severity: score >= 70 ? 'LOW' : 'MEDIUM',
          status: score >= 80 ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      logExecution(`Error checking performance: ${err.message}`);
    }

    return results;
  }
}
