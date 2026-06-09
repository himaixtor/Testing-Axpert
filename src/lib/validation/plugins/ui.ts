import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';
import { createTestResultWithElement } from '../../utils/elementSelector';

interface UIComputedStyles {
  typography: {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    textAlign: string;
  };
  colors: {
    textColor: string;
    backgroundColor: string;
  };
  button?: {
    text: string;
    backgroundColor: string;
    color: string;
    borderRadius: string;
    fontSize: string;
  };
}

export class UiValidationPlugin implements ValidationPlugin {
  id = 'ui';
  name = 'UI Testing';

  // Normalize colors for comparison (rgb vs rgba)
  private normalizeColor(color: string): string {
    if (!color) return '';
    // Skip transparent colors
    if (color.includes('rgba(0, 0, 0, 0)') || color === 'transparent' || color.includes('rgba(') && color.endsWith(', 0)')) {
      return 'TRANSPARENT';
    }
    // Convert rgba to rgb if alpha is 1
    color = color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*1\)/g, 'rgb($1, $2, $3)');
    color = color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*1\.0\)/g, 'rgb($1, $2, $3)');
    // Normalize whitespace
    return color.replace(/\s+/g, ' ').trim();
  }

  private async extractUiStyles(page: any): Promise<UIComputedStyles> {
    return page.evaluate(() => {
      // 1. Get computed styles for first H1 or first body paragraph
      const heading = document.querySelector('h1, h2, h3');
      const bodyText = document.querySelector('p, body');
      
      const computedHeading = heading ? window.getComputedStyle(heading) : null;
      const computedBody = bodyText ? window.getComputedStyle(bodyText) : null;

      // 2. Get computed styles for first button
      const button = document.querySelector('button, a[class*="btn"], a[class*="button"]');
      const computedButton = button ? window.getComputedStyle(button) : null;

      return {
        typography: {
          fontFamily: computedHeading?.fontFamily || computedBody?.fontFamily || 'serif',
          fontSize: computedHeading?.fontSize || '16px',
          fontWeight: computedHeading?.fontWeight || '400',
          lineHeight: computedHeading?.lineHeight || 'normal',
          textAlign: computedHeading?.textAlign || 'left'
        },
        colors: {
          textColor: computedBody?.color || 'rgb(0,0,0)',
          backgroundColor: computedBody?.backgroundColor || 'rgb(255,255,255)'
        },
        button: button ? {
          text: button.textContent?.trim() || '',
          backgroundColor: computedButton?.backgroundColor || 'transparent',
          color: computedButton?.color || 'black',
          borderRadius: computedButton?.borderRadius || '0px',
          fontSize: computedButton?.fontSize || '14px'
        } : undefined
      };
    });
  }

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, comparePage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing UI Comparative Style Testing...');

    let uatUi: UIComputedStyles;
    let prodUi: UIComputedStyles;

    try {
      uatUi = await this.extractUiStyles(lowerPage);
      prodUi = await this.extractUiStyles(comparePage);
    } catch (err: any) {
      logExecution(`Error extracting UI computed styles: ${err.message}`);
      return results;
    }

    // Helper to log differences with element tracking
    const checkStyleDiff = async (
      subTest: string,
      expected: string,
      actual: string,
      desc: string,
      severity: 'LOW' | 'MEDIUM' | 'HIGH',
      elementSelector: string = 'body',
      isColor: boolean = false
    ) => {
      // For colors, use normalization to avoid false positives
      let exp = expected;
      let act = actual;
      let displayExp = expected;
      let displayAct = actual;

      if (isColor) {
        exp = this.normalizeColor(expected);
        act = this.normalizeColor(actual);

        // Skip if either is transparent
        if (exp === 'TRANSPARENT' || act === 'TRANSPARENT') return;
      }

      const match = exp.replace(/\s+/g, '') === act.replace(/\s+/g, '');

      // Report BOTH pass and fail cases
      results.push(await createTestResultWithElement(lowerPage, {
        pageUrl: relativeUrl,
        category: this.name,
        subTest,
        expectedValue: `Production: ${displayExp}`,
        actualValue: `UAT: ${displayAct}`,
        differenceDescription: match
          ? 'Styles match Production'
          : `${desc}. Production = ${displayExp}, UAT = ${displayAct}`,
        severity: match ? 'LOW' : severity,
        status: match ? 'PASS' : 'WARNING',
        elementSelector
      }));
    };

    // 1. Typography style verification
    if (enabledSubTests.has('typography')) {
      await checkStyleDiff(
        'Typography: Font Family',
        prodUi.typography.fontFamily,
        uatUi.typography.fontFamily,
        'Font family changed',
        'MEDIUM',
        'h1, h2, h3'
      );
      await checkStyleDiff(
        'Typography: Heading Size',
        prodUi.typography.fontSize,
        uatUi.typography.fontSize,
        'Heading computed size changed',
        'MEDIUM',
        'h1, h2, h3'
      );
      await checkStyleDiff(
        'Typography: Font Weight',
        prodUi.typography.fontWeight,
        uatUi.typography.fontWeight,
        'Font weight styling changed',
        'LOW',
        'h1, h2, h3'
      );
    }

    // 2. Colors check
    if (enabledSubTests.has('colors')) {
      await checkStyleDiff(
        'Colors: Text Color',
        prodUi.colors.textColor,
        uatUi.colors.textColor,
        'Main paragraph text color changed',
        'HIGH',
        'p, body',
        true // isColor flag
      );
      await checkStyleDiff(
        'Colors: Background Canvas Color',
        prodUi.colors.backgroundColor,
        uatUi.colors.backgroundColor,
        'Body background fill color changed',
        'HIGH',
        'body',
        true // isColor flag
      );
    }

    // 3. Button details
    if (enabledSubTests.has('buttons')) {
      if (prodUi.button && uatUi.button) {
        await checkStyleDiff(
          'Buttons: Background Color',
          prodUi.button.backgroundColor,
          uatUi.button.backgroundColor,
          'Main Action Button color changed',
          'HIGH',
          'button, a[class*="btn"]',
          true // isColor flag
        );
        await checkStyleDiff(
          'Buttons: Text Color',
          prodUi.button.color,
          uatUi.button.color,
          'Button foreground text color changed',
          'HIGH',
          'button, a[class*="btn"]',
          true // isColor flag
        );
        await checkStyleDiff(
          'Buttons: Corner Border Radius',
          prodUi.button.borderRadius,
          uatUi.button.borderRadius,
          'Button border-radius shape changed',
          'MEDIUM',
          'button, a[class*="btn"]'
        );
      } else if (prodUi.button !== uatUi.button) {
        // One has button, other doesn't
        results.push(await createTestResultWithElement(lowerPage, {
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Buttons: Action Button Presence',
          expectedValue: prodUi.button ? 'Button element present' : 'No button element',
          actualValue: uatUi.button ? 'Button element present' : 'No button element',
          differenceDescription: 'Primary action button presence mismatch between Production and UAT',
          severity: 'HIGH',
          status: 'FAIL',
          elementSelector: 'button, a[class*="btn"]'
        }));
      }
    }

    return results;
  }
}
