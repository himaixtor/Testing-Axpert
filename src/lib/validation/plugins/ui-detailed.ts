import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';
import { createTestResultWithElement } from '../../utils/elementSelector';

export class UiDetailedPlugin implements ValidationPlugin {
  id = 'ui-detailed';
  name = 'UI Details Comparison';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, comparePage, relativeUrl, logExecution } = context;

    logExecution('Starting UI Details Comparison...');

    try {
      // Get all headings, paragraphs, buttons, and divs from BOTH pages
      const lowerElements = await lowerPage.evaluate(() => {
        const elements: any[] = [];

        // H1-H6
        document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, button, a, nav, header, aside, [class*="nav"], [class*="header"], [class*="sidebar"]').forEach((el, idx) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none') return;

          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          elements.push({
            tag: el.tagName.toLowerCase(),
            id: el.id,
            className: el.className,
            text: (el.textContent || '').substring(0, 30),
            fontSize: style.fontSize,
            fontFamily: style.fontFamily,
            fontWeight: style.fontWeight,
            color: style.color,
            backgroundColor: style.backgroundColor,
            padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
            margin: `${style.marginTop} ${style.marginRight} ${style.marginBottom} ${style.marginLeft}`,
            width: style.width,
            height: style.height,
            display: style.display,
            overflow: style.overflow,
            whiteSpace: style.whiteSpace,
            wordBreak: style.wordBreak,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
            textAlign: style.textAlign,
            borderRadius: style.borderRadius,
            border: style.border,
            boxShadow: style.boxShadow,
            gap: style.gap,
            flexWrap: style.flexWrap,
            justifyContent: style.justifyContent,
            alignItems: style.alignItems,
          });
        });

        return elements;
      });

      const prodElements = await comparePage.evaluate(() => {
        const elements: any[] = [];

        document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, button, a, nav, header, aside, [class*="nav"], [class*="header"], [class*="sidebar"]').forEach((el, idx) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none') return;

          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          elements.push({
            tag: el.tagName.toLowerCase(),
            id: el.id,
            className: el.className,
            text: (el.textContent || '').substring(0, 30),
            fontSize: style.fontSize,
            fontFamily: style.fontFamily,
            fontWeight: style.fontWeight,
            color: style.color,
            backgroundColor: style.backgroundColor,
            padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
            margin: `${style.marginTop} ${style.marginRight} ${style.marginBottom} ${style.marginLeft}`,
            width: style.width,
            height: style.height,
            display: style.display,
            overflow: style.overflow,
            whiteSpace: style.whiteSpace,
            wordBreak: style.wordBreak,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
            textAlign: style.textAlign,
            borderRadius: style.borderRadius,
            border: style.border,
            boxShadow: style.boxShadow,
            gap: style.gap,
            flexWrap: style.flexWrap,
            justifyContent: style.justifyContent,
            alignItems: style.alignItems,
          });
        });

        return elements;
      });

      logExecution(`Found ${lowerElements.length} elements on Lower env, ${prodElements.length} on Production`);

      // Simple comparison: match by ID/class/text and compare
      for (let i = 0; i < Math.min(lowerElements.length, prodElements.length); i++) {
        const lower = lowerElements[i];
        const prod = prodElements[i];

        const elementId = lower.id || lower.className || lower.tag;
        const elementSelector = lower.id ? `#${lower.id}` : `.${lower.className?.split(' ')[0]}` || lower.tag;

        // Check if tags are different
        if (lower.tag !== prod.tag) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Tag Mismatch - ${elementId}`,
            expectedValue: `Production: <${prod.tag}>`,
            actualValue: `Local: <${lower.tag}>`,
            differenceDescription: `HTML tag is different: Prod uses <${prod.tag}> but Local uses <${lower.tag}>`,
            severity: 'HIGH',
            status: 'WARNING',
            elementSelector,
          }));
        }

        // Check typography
        if (lower.fontSize !== prod.fontSize) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Font Size - ${elementId}`,
            expectedValue: prod.fontSize,
            actualValue: lower.fontSize,
            differenceDescription: `Font size mismatch: Prod=${prod.fontSize}, Local=${lower.fontSize}`,
            severity: 'MEDIUM',
            status: 'WARNING',
            elementSelector,
          }));
        }

        if (lower.fontFamily !== prod.fontFamily) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Font Family - ${elementId}`,
            expectedValue: prod.fontFamily,
            actualValue: lower.fontFamily,
            differenceDescription: `Font family changed: Prod=${prod.fontFamily}, Local=${lower.fontFamily}`,
            severity: 'MEDIUM',
            status: 'WARNING',
            elementSelector,
          }));
        }

        // Check text wrapping properties (CRITICAL)
        if (lower.whiteSpace !== prod.whiteSpace) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Text Wrapping (white-space) - ${elementId}`,
            expectedValue: prod.whiteSpace,
            actualValue: lower.whiteSpace,
            differenceDescription: `Text wrapping different: Prod=${prod.whiteSpace}, Local=${lower.whiteSpace}. This causes text to wrap/break differently!`,
            severity: 'CRITICAL',
            status: 'FAIL',
            elementSelector,
          }));
        }

        if (lower.wordBreak !== prod.wordBreak) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Word Break - ${elementId}`,
            expectedValue: prod.wordBreak,
            actualValue: lower.wordBreak,
            differenceDescription: `Word break property different: Prod=${prod.wordBreak}, Local=${lower.wordBreak}`,
            severity: 'CRITICAL',
            status: 'FAIL',
            elementSelector,
          }));
        }

        // Check spacing (CRITICAL for layout)
        if (lower.padding !== prod.padding) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Padding - ${elementId}`,
            expectedValue: prod.padding,
            actualValue: lower.padding,
            differenceDescription: `Padding mismatch: Prod=${prod.padding}, Local=${lower.padding}`,
            severity: 'HIGH',
            status: 'WARNING',
            elementSelector,
          }));
        }

        if (lower.margin !== prod.margin) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Margin - ${elementId}`,
            expectedValue: prod.margin,
            actualValue: lower.margin,
            differenceDescription: `Margin mismatch: Prod=${prod.margin}, Local=${lower.margin}`,
            severity: 'HIGH',
            status: 'WARNING',
            elementSelector,
          }));
        }

        // Check colors
        if (lower.color !== prod.color) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Text Color - ${elementId}`,
            expectedValue: prod.color,
            actualValue: lower.color,
            differenceDescription: `Text color changed: Prod=${prod.color}, Local=${lower.color}`,
            severity: 'MEDIUM',
            status: 'WARNING',
            elementSelector,
          }));
        }

        if (lower.backgroundColor !== prod.backgroundColor) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Background Color - ${elementId}`,
            expectedValue: prod.backgroundColor,
            actualValue: lower.backgroundColor,
            differenceDescription: `Background color changed: Prod=${prod.backgroundColor}, Local=${lower.backgroundColor}`,
            severity: 'MEDIUM',
            status: 'WARNING',
            elementSelector,
          }));
        }

        // Check width/overflow (affects text wrapping)
        if (lower.width !== prod.width) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Width - ${elementId}`,
            expectedValue: prod.width,
            actualValue: lower.width,
            differenceDescription: `Element width different: Prod=${prod.width}, Local=${lower.width}. This affects text wrapping!`,
            severity: 'HIGH',
            status: 'WARNING',
            elementSelector,
          }));
        }

        if (lower.overflow !== prod.overflow) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Overflow - ${elementId}`,
            expectedValue: prod.overflow,
            actualValue: lower.overflow,
            differenceDescription: `Overflow property different: Prod=${prod.overflow}, Local=${lower.overflow}`,
            severity: 'MEDIUM',
            status: 'WARNING',
            elementSelector,
          }));
        }

        // Check flex/gap (spacing in sidebars/menus)
        if (lower.gap !== prod.gap && lower.gap && prod.gap) {
          results.push(await createTestResultWithElement(lowerPage, {
            pageUrl: relativeUrl,
            category: this.name,
            subTest: `Gap/Spacing - ${elementId}`,
            expectedValue: prod.gap,
            actualValue: lower.gap,
            differenceDescription: `Gap/spacing in flex/grid different: Prod=${prod.gap}, Local=${lower.gap}. Affects sidebar/menu spacing!`,
            severity: 'HIGH',
            status: 'WARNING',
            elementSelector,
          }));
        }
      }

      logExecution(`UI comparison complete. Found ${results.length} style differences`);
    } catch (err: any) {
      logExecution(`Error in UI detailed comparison: ${err.message}`);
    }

    return results;
  }
}
