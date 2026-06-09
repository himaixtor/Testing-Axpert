import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';
import fs from 'fs';
import path from 'path';

interface ElementStyle {
  selector: string;
  tag: string;
  id: string;
  classes: string;
  styles: Record<string, string>;
}

export class VisualComprehensivePlugin implements ValidationPlugin {
  id = 'visual-comprehensive';
  name = '🎬 VISUAL COMPREHENSIVE (BackstopJS + Applitools + Percy + Chromatic)';

  private screenshotsDir = path.join(process.cwd(), 'public/visual-test-screenshots');

  private ensureScreenshotsDir() {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  /**
   * Capture screenshot of a specific element
   */
  private async captureElementScreenshot(
    page: any,
    selector: string,
    filename: string,
    logExecution: (msg: string) => void
  ): Promise<string | null> {
    try {
      this.ensureScreenshotsDir();

      // Try to get element
      const element = await page.$(selector);
      if (!element) {
        return null;
      }

      // Get element box
      const box = await element.boundingBox();
      if (!box) {
        return null;
      }

      // Add padding for better context
      const padding = 10;
      const screenshotPath = path.join(this.screenshotsDir, filename);

      await page.screenshot({
        path: screenshotPath,
        clip: {
          x: Math.max(0, box.x - padding),
          y: Math.max(0, box.y - padding),
          width: Math.min(page.viewportSize().width, box.width + padding * 2),
          height: Math.min(page.viewportSize().height, box.height + padding * 2)
        }
      });

      // Return relative path for storage
      return `/visual-test-screenshots/${filename}`;
    } catch (err: any) {
      logExecution(`⚠️  Could not capture screenshot for ${selector}: ${err.message}`);
      return null;
    }
  }

  /**
   * Extract all computed styles from visible page elements
   */
  private async extractAllStyles(page: any, includeHidden: boolean = false): Promise<ElementStyle[]> {
    try {
      const styles = await page.evaluate((includeHidden: boolean) => {
        // Common components to skip (headers, footers, sticky bars, etc.)
        const commonComponentSelectors = [
          'header', 'footer', 'nav', '.navbar', '.header', '.footer',
          '.sticky', '.fixed-top', '.fixed-bottom', '.modal-backdrop',
          '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
          '.skip-link', '.breadcrumb', '.pagination', '.sidebar',
          '.sidenav', '.hamburger', '.menu', '.topbar', '.bottom-bar',
          'aside', '.aside', '.offcanvas'
        ];

        const isCommonComponent = (el: any): boolean => {
          return commonComponentSelectors.some(selector => {
            if (selector.startsWith('[')) {
              return el.matches(selector);
            }
            if (selector.startsWith('.')) {
              return el.classList.contains(selector.substring(1));
            }
            return el.tagName.toLowerCase() === selector;
          });
        };

        // Helper function to check if element is truly hidden
        const isElementHidden = (el: any): boolean => {
          const computed = window.getComputedStyle(el);
          const classList = (el.className || '').toLowerCase();

          // Direct display/visibility/opacity checks
          if (computed.display === 'none') return true;
          if (computed.visibility === 'hidden') return true;
          if (computed.opacity === '0') return true;

          // Check for aria-hidden attribute
          if (el.getAttribute('aria-hidden') === 'true') return true;

          // Check for specific hidden class names
          const hiddenClasses = ['sr-only', 'hide-accessible', 'navbar-toggler-icon', 'visually-hidden', 'screen-reader-only', 'sr-only-focusable', 'hidden-', 'hide-text'];
          if (hiddenClasses.some(cls => classList.includes(cls))) {
            return true;
          }

          // Check for text-indent: -9999px
          const textIndent = parseInt(computed.textIndent);
          if (textIndent < -1000) return true;

          // Check for clip/clip-path
          if (computed.clip && computed.clip !== 'auto' && computed.clip.includes('0,0,0,0')) return true;
          if (computed.clipPath && computed.clipPath !== 'none') {
            if (computed.clipPath.includes('polygon(0') || computed.clipPath === 'inset(0)') return true;
          }

          // Check for off-screen positioning
          if (computed.position === 'absolute') {
            const left = computed.left;
            const top = computed.top;
            if (left !== 'auto' && parseInt(left) < -100) return true;
            if (top !== 'auto' && parseInt(top) < -100) return true;
          }

          // Check for zero dimensions
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) {
            return true;
          }

          return false;
        };

        // Helper function to get element selector
        const getSelector = (el: any): string => {
          if (el.id) return `#${el.id}`;

          const path: string[] = [];
          let current = el;

          while (current && current.parentElement) {
            let selector = current.tagName.toLowerCase();

            if (current.id) {
              selector += `#${current.id}`;
              path.unshift(selector);
              break;
            }

            const siblings = current.parentElement.querySelectorAll(selector);
            if (siblings.length > 1) {
              const index = Array.from(siblings).indexOf(current) + 1;
              selector += `:nth-of-type(${index})`;
            }

            path.unshift(selector);
            current = current.parentElement;
          }

          return path.join(' > ');
        };

        const elements: any[] = [];
        const allElements = document.querySelectorAll('*');

        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i];

          // Skip non-visual elements
          if (['SCRIPT', 'STYLE', 'META', 'LINK', 'NOSCRIPT'].includes(el.tagName)) continue;

          // Skip common components
          if (isCommonComponent(el)) continue;

          // Get computed styles ONCE per element
          const computed = window.getComputedStyle(el);

          // Use comprehensive hidden detection
          const hidden = isElementHidden(el);

          // Skip hidden elements if includeHidden is false
          if (!includeHidden && hidden) continue;

          // Capture elements that are visible or if we're including hidden
          if (!hidden || includeHidden) {
            elements.push({
              selector: getSelector(el),
              tag: el.tagName.toLowerCase(),
              id: el.id || '',
              classes: el.className || '',
              styles: {
                // Typography
                fontFamily: computed.fontFamily,
                fontSize: computed.fontSize,
                fontWeight: computed.fontWeight,
                fontStyle: computed.fontStyle,
                lineHeight: computed.lineHeight,
                letterSpacing: computed.letterSpacing,
                textTransform: computed.textTransform,
                textAlign: computed.textAlign,
                textDecoration: computed.textDecoration,

                // Colors
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                borderColor: computed.borderColor,
                borderTopColor: computed.borderTopColor,
                borderRightColor: computed.borderRightColor,
                borderBottomColor: computed.borderBottomColor,
                borderLeftColor: computed.borderLeftColor,
                textDecorationColor: computed.textDecorationColor,

                // Spacing
                paddingTop: computed.paddingTop,
                paddingRight: computed.paddingRight,
                paddingBottom: computed.paddingBottom,
                paddingLeft: computed.paddingLeft,
                marginTop: computed.marginTop,
                marginRight: computed.marginRight,
                marginBottom: computed.marginBottom,
                marginLeft: computed.marginLeft,
                gap: computed.gap,
                rowGap: computed.rowGap,
                columnGap: computed.columnGap,
                wordSpacing: computed.wordSpacing,

                // Layout
                display: computed.display,
                position: computed.position,
                width: computed.width,
                height: computed.height,
                minWidth: computed.minWidth,
                minHeight: computed.minHeight,
                maxWidth: computed.maxWidth,
                maxHeight: computed.maxHeight,
                overflow: computed.overflow,
                overflowX: computed.overflowX,
                overflowY: computed.overflowY,
                flexDirection: computed.flexDirection,
                flexWrap: computed.flexWrap,
                justifyContent: computed.justifyContent,
                alignItems: computed.alignItems,
                gridTemplateColumns: computed.gridTemplateColumns,

                // Borders
                borderTopWidth: computed.borderTopWidth,
                borderRightWidth: computed.borderRightWidth,
                borderBottomWidth: computed.borderBottomWidth,
                borderLeftWidth: computed.borderLeftWidth,
                borderStyle: computed.borderStyle,
                borderTopLeftRadius: computed.borderTopLeftRadius,
                borderTopRightRadius: computed.borderTopRightRadius,
                borderBottomLeftRadius: computed.borderBottomLeftRadius,
                borderBottomRightRadius: computed.borderBottomRightRadius,

                // Visual Effects
                opacity: computed.opacity,
                boxShadow: computed.boxShadow,
                textShadow: computed.textShadow,
                filter: computed.filter,
                backdropFilter: computed.backdropFilter,

                // Positioning
                top: computed.top,
                right: computed.right,
                bottom: computed.bottom,
                left: computed.left,
                zIndex: computed.zIndex,

                // Background
                backgroundImage: computed.backgroundImage,
                backgroundSize: computed.backgroundSize,
                backgroundPosition: computed.backgroundPosition,
                backgroundRepeat: computed.backgroundRepeat,
                backgroundAttachment: computed.backgroundAttachment,

                // Visibility
                visibility: computed.visibility,
                pointerEvents: computed.pointerEvents,
                cursor: computed.cursor
              }
            });
          }
        }

        return elements;
      }, includeHidden);

      return styles;
    } catch (err: any) {
      console.error('Failed to extract styles:', err);
      return [];
    }
  }

  private normalizeColor(color: string): string {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return 'TRANSPARENT';
    }

    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
    if (rgbaMatch) {
      const opacity = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
      if (opacity === 0) return 'TRANSPARENT';
      if (opacity === 1) {
        return `rgb(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]})`;
      }
      return color;
    }

    return color;
  }

  private isColorProperty(prop: string): boolean {
    return prop.toLowerCase().includes('color');
  }

  private getSeverity(prop: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const critical = [
      'display', 'visibility', 'opacity', 'position',
      'width', 'height', 'overflow', 'backgroundColor'
    ];

    const high = [
      'fontSize', 'fontWeight', 'color', 'padding',
      'margin', 'borderRadius', 'boxShadow', 'top',
      'right', 'bottom', 'left'
    ];

    if (critical.includes(prop)) return 'CRITICAL';
    if (high.includes(prop)) return 'HIGH';
    if (prop.includes('font') || prop.includes('letter') || prop.includes('word')) return 'MEDIUM';
    return 'LOW';
  }

  private getCategory(prop: string): string {
    if (prop.includes('font') || prop.includes('text') || prop.includes('letter') || prop.includes('line') || prop.includes('word') || prop === 'textAlign') {
      return 'Typography';
    }
    if (this.isColorProperty(prop)) return 'Colors';
    if (prop.includes('padding') || prop.includes('margin') || prop.includes('gap')) return 'Spacing';
    if (prop.includes('border') && !prop.includes('Color')) return 'Borders';
    if (prop.includes('shadow') || prop === 'filter' || prop === 'backdropFilter') return 'Visual Effects';
    if (prop.includes('background')) return 'Background';
    if (
      prop === 'display' || prop === 'position' ||
      prop.includes('flex') || prop.includes('grid') ||
      prop === 'width' || prop === 'height' ||
      prop === 'minWidth' || prop === 'maxWidth' ||
      prop === 'minHeight' || prop === 'maxHeight' ||
      prop.includes('overflow')
    ) {
      return 'Layout';
    }
    if (prop === 'opacity' || prop === 'visibility' || prop === 'pointerEvents') return 'Visibility';
    if (prop === 'top' || prop === 'right' || prop === 'bottom' || prop === 'left' || prop === 'zIndex') {
      return 'Positioning';
    }
    return 'Visual Properties';
  }

  private formatName(prop: string): string {
    return prop
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private async compareAndGenerateResults(
    lowerElements: ElementStyle[],
    prodElements: ElementStyle[],
    relativeUrl: string,
    viewportName: string,
    viewportWidth: number,
    lowerPage: any,
    logExecution: (msg: string) => void
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Build map of elements by selector
    const lowerMap = new Map(lowerElements.map(el => [el.selector, el]));
    const prodMap = new Map(prodElements.map(el => [el.selector, el]));

    // Get all unique selectors
    const allSelectors = new Set([...lowerMap.keys(), ...prodMap.keys()]);

    // Track components with differences per selector (for deduplication)
    const componentDifferences: Map<string, boolean> = new Map();

    for (const selector of allSelectors) {
      const lowerEl = lowerMap.get(selector);
      const prodEl = prodMap.get(selector);

      // Skip if element missing in one environment (don't report presence differences)
      if (!lowerEl || !prodEl) {
        continue;
      }

      // Compare all properties
      const allProps = new Set([
        ...Object.keys(lowerEl.styles),
        ...Object.keys(prodEl.styles)
      ]);

      let selectorHasDifferences = false;

      for (const prop of allProps) {
        const lowerVal = lowerEl.styles[prop] || '';
        const prodVal = prodEl.styles[prop] || '';

        // Skip empty values
        if (!lowerVal && !prodVal) continue;

        // Normalize for comparison
        let lowerComp = lowerVal;
        let prodComp = prodVal;

        if (this.isColorProperty(prop)) {
          lowerComp = this.normalizeColor(lowerVal);
          prodComp = this.normalizeColor(prodVal);
        }

        // Skip if match
        if (lowerComp === prodComp) continue;
        if (!lowerComp || !prodComp) continue;

        selectorHasDifferences = true;

        // Generate filename for screenshot
        const sanitizedSelector = selector.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
        const timestamp = Date.now();
        const screenshotFilename = `${sanitizedSelector}_${viewportName.replace(/[^\w]/g, '_')}_${timestamp}.png`;

        // Capture screenshot of the element with difference
        const screenshotUrl = await this.captureElementScreenshot(
          lowerPage,
          selector,
          screenshotFilename,
          logExecution
        );

        // Generate test result for this difference
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: `${this.getCategory(prop)}: ${this.formatName(prop)}`,
          expectedValue: prodVal,
          actualValue: lowerVal,
          differenceDescription: `${this.formatName(prop)} mismatch - Production: ${prodVal}, UAT: ${lowerVal}`,
          severity: this.getSeverity(prop),
          status: 'WARNING',
          elementSelector: selector,
          elementId: lowerEl.id,
          elementClass: lowerEl.classes,
          elementTag: lowerEl.tag,
          viewportName: viewportName,
          viewportWidth: viewportWidth,
          screenshotUrl: screenshotUrl || undefined,
          timestamp: new Date().toISOString()
        });
      }

      // Track if this component has differences
      if (selectorHasDifferences) {
        componentDifferences.set(selector, true);
      }
    }

    return results;
  }

  private allViewports = [
    { name: '🖥️ Desktop', width: 1440, height: 900 },
    { name: '📑 Tablet', width: 768, height: 1024 },
    { name: '📱 Mobile', width: 375, height: 667 }
  ];

  private getActiveViewports(
    testDesktop: boolean = true,
    testTablet: boolean = true,
    testMobile: boolean = true
  ) {
    return this.allViewports.filter((vp, idx) => {
      if (idx === 0) return testDesktop;
      if (idx === 1) return testTablet;
      if (idx === 2) return testMobile;
      return true;
    });
  }

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const { lowerPage, comparePage, logExecution, relativeUrl } = context;

    const testDesktop = (context as any).testDesktop !== false;
    const testTablet = (context as any).testTablet !== false;
    const testMobile = (context as any).testMobile !== false;
    const hiddenComponentOption = (context as any).hiddenComponentOption || 'avoid';
    const includeHidden = hiddenComponentOption === 'with';

    const viewports = this.getActiveViewports(testDesktop, testTablet, testMobile);

    logExecution('╔════════════════════════════════════════╗');
    logExecution('║  COMPREHENSIVE VISUAL ANALYSIS (DEEP)  ║');
    logExecution(`║  Testing ${viewports.length} viewports selected`);
    logExecution('╚════════════════════════════════════════╝');

    const allResults: TestResult[] = [];

    try {
      for (const viewport of viewports) {
        logExecution(`\n📐 Testing ${viewport.name} (${viewport.width}px)`);

        await lowerPage.setViewportSize({ width: viewport.width, height: viewport.height });
        await comparePage.setViewportSize({ width: viewport.width, height: viewport.height });

        logExecution(`  📊 Phase 1: Extracting styles from Lower Environment...`);
        const lowerStyles = await this.extractAllStyles(lowerPage, includeHidden);
        logExecution(`  ✓ Extracted ${lowerStyles.length} elements from UAT`);

        logExecution(`  📊 Phase 2: Extracting styles from Production Environment...`);
        const prodStyles = await this.extractAllStyles(comparePage, includeHidden);
        logExecution(`  ✓ Extracted ${prodStyles.length} elements from Production`);

        logExecution(`  🔍 Phase 3: Comparing CSS properties...`);
        const results = await this.compareAndGenerateResults(
          lowerStyles,
          prodStyles,
          relativeUrl,
          viewport.name,
          viewport.width,
          lowerPage,
          logExecution
        );

        allResults.push(...results);
        logExecution(`  ✓ Found ${results.length} differences on ${viewport.name}`);
      }

      logExecution('\n📊 Summary by Viewport:');
      for (const viewport of viewports) {
        const viewportResults = allResults.filter(r => r.viewportWidth === viewport.width);
        logExecution(`  ${viewport.name}: ${viewportResults.length} differences`);
      }

      const categorySummary: Record<string, number> = {};
      allResults.forEach(r => {
        if (r.subTest) {
          const cat = r.subTest.split(':')[0];
          categorySummary[cat] = (categorySummary[cat] || 0) + 1;
        }
      });

      logExecution('\n📈 Difference Summary by Category:');
      Object.entries(categorySummary).forEach(([cat, count]) => {
        logExecution(`  • ${cat}: ${count} differences`);
      });

      logExecution('\n╔════════════════════════════════════════╗');
      logExecution(`║  Total Differences Found: ${allResults.length}`);
      logExecution(`║  Hidden Components: ${hiddenComponentOption === 'avoid' ? 'Avoided ✓' : 'Included'}`);
      logExecution('║  Status: Analysis Complete');
      logExecution('╚════════════════════════════════════════╝\n');

      return allResults;
    } catch (err: any) {
      logExecution(`❌ Error during visual analysis: ${err.message}`);
      return [];
    }
  }
}
