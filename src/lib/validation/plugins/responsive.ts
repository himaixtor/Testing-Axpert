import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';

export class ResponsiveValidationPlugin implements ValidationPlugin {
  id = 'responsive';
  name = 'Responsive Testing';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing Responsive Testing...');

    const viewports = [
      { category: 'desktop', name: 'Desktop Full HD', width: 1920, height: 1080 },
      { category: 'desktop', name: 'Desktop Standard', width: 1366, height: 768 },
      { category: 'tablet', name: 'Tablet Landscape', width: 1024, height: 768 },
      { category: 'tablet', name: 'Tablet Portrait', width: 768, height: 1024 },
      { category: 'mobile', name: 'Mobile iPhone', width: 375, height: 667 },
      { category: 'mobile', name: 'Mobile Android', width: 360, height: 740 }
    ];

    for (const vp of viewports) {
      if (!enabledSubTests.has(vp.category)) {
        continue;
      }

      try {
        logExecution(`Resizing viewport to ${vp.name} (${vp.width}x${vp.height})...`);
        await lowerPage.setViewportSize({ width: vp.width, height: vp.height });
        
        // Wait a small moment for layout to settle
        await lowerPage.waitForTimeout(100);

        // Check horizontal overflow
        const overflowResult = await lowerPage.evaluate(() => {
          const docWidth = document.documentElement.scrollWidth;
          const bodyWidth = document.body.scrollWidth;
          const viewWidth = window.innerWidth;
          
          const maxScroll = Math.max(docWidth, bodyWidth);
          const hasOverflow = maxScroll > viewWidth + 1; // 1px tolerance

          // Find specific overflowing elements if any
          let overflowingSelector = '';
          if (hasOverflow) {
            const allElements = Array.from(document.querySelectorAll('body *'));
            const badEl = allElements.find(el => {
              const rect = el.getBoundingClientRect();
              return rect.right > viewWidth + 1;
            });
            if (badEl) {
              overflowingSelector = badEl.tagName.toLowerCase() + 
                (badEl.id ? `#${badEl.id}` : '') + 
                (badEl.className ? `.${badEl.className.trim().split(/\s+/).join('.')}` : '');
            }
          }

          return { hasOverflow, scrollWidth: maxScroll, viewWidth, overflowingSelector };
        });

        const passed = !overflowResult.hasOverflow;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: `${vp.name} Layout (${vp.width}px)`,
          expectedValue: `No horizontal scroll (ScrollWidth <= ${vp.width}px)`,
          actualValue: `ScrollWidth = ${overflowResult.scrollWidth}px`,
          differenceDescription: passed
            ? `Layout renders correctly at ${vp.width}px width`
            : `Horizontal overflow detected. Overflowing element: "${overflowResult.overflowingSelector}". This causes unwanted horizontal scrolling.`,
          severity: vp.category === 'mobile' ? 'HIGH' : 'MEDIUM',
          status: passed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });

      } catch (err: any) {
        logExecution(`Error testing viewport ${vp.name}: ${err.message}`);
      }
    }

    // Reset viewport to default at end of test
    try {
      await lowerPage.setViewportSize({ width: 1280, height: 800 });
    } catch {}

    return results;
  }
}
