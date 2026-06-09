import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';
import { createTestResultWithElement } from '../../utils/elementSelector';

interface DetailedElementStyle {
  selector: string;
  tagName: string;
  className: string;
  id: string;
  text: string;
  // Typography
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  lineHeight: string;
  letterSpacing: string;
  textTransform: string;
  textDecoration: string;
  textAlign: string;
  whiteSpace: string;
  wordBreak: string;
  wordWrap: string;
  overflow: string;
  textOverflow: string;
  // Colors
  color: string;
  backgroundColor: string;
  borderColor: string;
  opacity: string;
  // Spacing
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  gap: string;
  // Dimensions
  width: string;
  height: string;
  minWidth: string;
  minHeight: string;
  maxWidth: string;
  maxHeight: string;
  // Borders & Shadows
  borderRadius: string;
  borderWidth: string;
  boxShadow: string;
  textShadow: string;
  // Layout
  display: string;
  position: string;
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  alignContent: string;
  gridTemplateColumns: string;
  // Visual Effects
  transform: string;
  transition: string;
  animation: string;
  filter: string;
  backdropFilter: string;
  // Additional
  zIndex: string;
  visibility: string;
  cursor: string;
  pointerEvents: string;
}

export class UiComprehensivePlugin implements ValidationPlugin {
  id = 'ui-comprehensive';
  name = 'Comprehensive UI Testing';

  private async extractElementsWithStyles(page: any): Promise<DetailedElementStyle[]> {
    return page.evaluate(() => {
      const selectors = [
        // Navigation & Header
        'nav', 'header', 'nav h1', 'nav h2', 'nav h3', 'nav span', 'nav a',
        'header h1', 'header h2', 'header h3', 'header span', 'header a',
        // Sidebar
        'aside', 'aside a', 'aside div', '[class*="sidebar"]', '[class*="chat"]',
        // Main content
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'span', 'a', 'label', 'button',
        '[role="button"]', 'input', 'textarea', 'select',
        'div', 'section', 'article', 'footer',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
        // Common classes
        '[class*="nav"]', '[class*="header"]', '[class*="logo"]',
        '[class*="menu"]', '[class*="button"]', '[class*="icon"]',
        '[class*="text"]', '[class*="link"]'
      ];

      const results: DetailedElementStyle[] = [];
      const processed = new Set<string>();

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) continue;

        elements.forEach((el, index) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return;

          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          const key = `${selector}-${el.id || el.className || index}`;
          if (processed.has(key)) return;
          processed.add(key);

          const analysis: DetailedElementStyle = {
            selector,
            tagName: el.tagName.toLowerCase(),
            className: el.className,
            id: el.id,
            text: el.textContent?.substring(0, 50) || '',
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
            textTransform: style.textTransform,
            textDecoration: style.textDecoration,
            textAlign: style.textAlign,
            whiteSpace: style.whiteSpace,
            wordBreak: style.wordBreak,
            wordWrap: style.wordWrap,
            overflow: style.overflow,
            textOverflow: style.textOverflow,
            color: style.color,
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            opacity: style.opacity,
            paddingTop: style.paddingTop,
            paddingRight: style.paddingRight,
            paddingBottom: style.paddingBottom,
            paddingLeft: style.paddingLeft,
            marginTop: style.marginTop,
            marginRight: style.marginRight,
            marginBottom: style.marginBottom,
            marginLeft: style.marginLeft,
            gap: style.gap,
            width: style.width,
            height: style.height,
            minWidth: style.minWidth,
            minHeight: style.minHeight,
            maxWidth: style.maxWidth,
            maxHeight: style.maxHeight,
            borderRadius: style.borderRadius,
            borderWidth: style.borderWidth,
            boxShadow: style.boxShadow,
            textShadow: style.textShadow,
            display: style.display,
            position: style.position,
            flexDirection: style.flexDirection,
            flexWrap: style.flexWrap,
            justifyContent: style.justifyContent,
            alignItems: style.alignItems,
            alignContent: style.alignContent,
            gridTemplateColumns: style.gridTemplateColumns,
            transform: style.transform,
            transition: style.transition,
            animation: style.animation,
            filter: style.filter,
            backdropFilter: style.backdropFilter,
            zIndex: style.zIndex,
            visibility: style.visibility,
            cursor: style.cursor,
            pointerEvents: style.pointerEvents,
          };

          results.push(analysis);
        });
      }

      return results;
    });
  }

  private compareStyles(
    selector: string,
    expected: DetailedElementStyle,
    actual: DetailedElementStyle
  ): Array<{ property: string; expectedValue: string; actualValue: string; severity: string }> {
    const diffs: Array<{ property: string; expectedValue: string; actualValue: string; severity: string }> = [];

    // CRITICAL: Typography that affects text wrapping
    const criticalTypography = [
      'fontSize', 'fontFamily', 'fontWeight', 'lineHeight',
      'whiteSpace', 'wordBreak', 'wordWrap', 'textTransform',
      'letterSpacing', 'textAlign', 'width', 'maxWidth'
    ];

    // HIGH: Visual appearance
    const highProperties = [
      'color', 'backgroundColor', 'borderColor', 'borderRadius',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
      'height', 'minHeight', 'maxHeight', 'display', 'position',
      'flexDirection', 'justifyContent', 'alignItems', 'gap'
    ];

    // MEDIUM: Effects and interactions
    const mediumProperties = [
      'opacity', 'transform', 'transition', 'animation',
      'boxShadow', 'textShadow', 'filter', 'backdropFilter',
      'cursor', 'textOverflow', 'overflow', 'flexWrap'
    ];

    // Compare all properties
    const allKeys = new Set([
      ...Object.keys(expected),
      ...Object.keys(actual)
    ]);

    allKeys.forEach((key) => {
      if (['selector', 'tagName', 'className', 'id', 'text'].includes(key)) return;

      const exp = (expected as any)[key] || '';
      const act = (actual as any)[key] || '';

      // Normalize values for comparison
      const expNorm = exp.toString().replace(/\s+/g, ' ').trim();
      const actNorm = act.toString().replace(/\s+/g, ' ').trim();

      if (expNorm !== actNorm && expNorm && actNorm) {
        let severity = 'LOW';
        if (criticalTypography.includes(key)) severity = 'CRITICAL';
        else if (highProperties.includes(key)) severity = 'HIGH';
        else if (mediumProperties.includes(key)) severity = 'MEDIUM';

        diffs.push({
          property: key,
          expectedValue: exp,
          actualValue: act,
          severity
        });
      }
    });

    return diffs;
  }

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, comparePage, relativeUrl, logExecution } = context;

    logExecution('Executing Comprehensive UI Testing (Comparative Analysis)...');

    try {
      // Extract from both environments
      const lowerElements = await this.extractElementsWithStyles(lowerPage);
      const prodElements = await this.extractElementsWithStyles(comparePage);

      logExecution(`Lower env: ${lowerElements.length} elements | Prod env: ${prodElements.length} elements`);

      // Log sample elements found
      const navElements = lowerElements.filter(el => el.selector.includes('nav') || el.selector.includes('header'));
      const sidebarElements = lowerElements.filter(el => el.selector.includes('aside') || el.selector.includes('sidebar') || el.selector.includes('chat'));
      logExecution(`Found ${navElements.length} nav/header elements, ${sidebarElements.length} sidebar elements`);

      // Create a map for easier comparison (try multiple matching strategies)
      const prodMap = new Map<string, DetailedElementStyle>();
      const prodMapBySelector = new Map<string, DetailedElementStyle>();

      for (const el of prodElements) {
        // Primary key: tag + id
        if (el.id) {
          const key = `${el.tagName}-${el.id}`;
          prodMap.set(key, el);
        }
        // Secondary key: tag + className (first class)
        if (el.className) {
          const firstClass = el.className.split(' ')[0];
          const key = `${el.tagName}-${firstClass}`;
          prodMap.set(key, el);
        }
        // Selector-based
        prodMapBySelector.set(el.selector, el);
      }

      // Compare each element from lower environment
      for (const lowerEl of lowerElements) {
        let prodEl: DetailedElementStyle | undefined;

        // Try multiple matching strategies
        if (lowerEl.id) {
          const key = `${lowerEl.tagName}-${lowerEl.id}`;
          prodEl = prodMap.get(key);
        }

        if (!prodEl && lowerEl.className) {
          const firstClass = lowerEl.className.split(' ')[0];
          const key = `${lowerEl.tagName}-${firstClass}`;
          prodEl = prodMap.get(key);
        }

        if (!prodEl) {
          prodEl = prodMapBySelector.get(lowerEl.selector);
        }

        if (!prodEl) continue;

        const elementName = lowerEl.id
          ? `${lowerEl.tagName}#${lowerEl.id}`
          : lowerEl.className
            ? `${lowerEl.tagName}.${lowerEl.className.split(' ')[0]}`
            : lowerEl.tagName;

        const elementSelector = lowerEl.id
          ? `#${lowerEl.id}`
          : lowerEl.className
            ? `.${lowerEl.className.split(' ')[0]}`
            : lowerEl.selector;

        // Compare styles
        const diffs = this.compareStyles(lowerEl.selector, prodEl, lowerEl);

        if (diffs.length === 0) {
          // Styles match - report as PASS
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `${elementName} - Style Comparison`,
            expectedValue: 'Styles match Production',
            actualValue: 'Styles match Lower Environment',
            differenceDescription: `✅ All styles identical for ${elementName}`,
            severity: 'LOW',
            status: 'PASS',
            elementSelector,
          }));
        } else {
          // Report each difference
          for (const diff of diffs) {
            const severity = diff.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
            const status = severity === 'CRITICAL' ? 'FAIL' : severity === 'HIGH' ? 'WARNING' : 'WARNING';

            results.push(await createTestResultWithElement(lowerPage, {
              pageUrl: relativeUrl,
              category: this.name,
              subTest: `${elementName} - ${diff.property}`,
              expectedValue: `Prod: ${diff.expectedValue}`,
              actualValue: `Local: ${diff.actualValue}`,
              differenceDescription: `${diff.property} mismatch: Production has "${diff.expectedValue}" but Local has "${diff.actualValue}"`,
              severity,
              status,
              elementSelector,
            }));
          }
        }
      }

      // Check for missing elements (in prod but not in lower)
      const lowerIds = new Set<string>();
      const lowerClasses = new Set<string>();
      const lowerSelectors = new Set<string>();

      for (const el of lowerElements) {
        if (el.id) lowerIds.add(`${el.tagName}-${el.id}`);
        if (el.className) {
          const firstClass = el.className.split(' ')[0];
          lowerClasses.add(`${el.tagName}-${firstClass}`);
        }
        lowerSelectors.add(el.selector);
      }

      for (const prodEl of prodElements) {
        let found = false;

        if (prodEl.id && lowerIds.has(`${prodEl.tagName}-${prodEl.id}`)) {
          found = true;
        } else if (prodEl.className) {
          const firstClass = prodEl.className.split(' ')[0];
          if (lowerClasses.has(`${prodEl.tagName}-${firstClass}`)) {
            found = true;
          }
        } else if (lowerSelectors.has(prodEl.selector)) {
          found = true;
        }

        if (!found && (prodEl.selector.includes('nav') || prodEl.selector.includes('header') || prodEl.selector.includes('sidebar'))) {
          const elementName = prodEl.id ? `${prodEl.tagName}#${prodEl.id}` : `${prodEl.tagName}.${prodEl.className}`;
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Missing/Different Element - ${elementName}`,
            expectedValue: `Element ${elementName} present in Production`,
            actualValue: `Element ${elementName} NOT found in Local`,
            differenceDescription: `⚠️ Element exists in Production but missing/different in Local: ${elementName}`,
            severity: 'HIGH',
            status: 'WARNING',
            elementSelector: prodEl.selector,
          }));
        }
      }

      logExecution(`UI Comparative analysis completed. Found ${results.length} differences/checks`);
    } catch (err: any) {
      logExecution(`Error in comprehensive UI testing: ${err.message}`);
    }

    return results;
  }
}
