import { Page } from 'playwright';
import { TestResult } from '../storage/reportRepository';

export interface ElementInfo {
  elementId?: string;
  elementClass?: string;
  elementTag?: string;
  elementSelector?: string;
}

export interface TestResultWithElement extends TestResult {
  elementSelector?: string;
  elementId?: string;
  elementClass?: string;
  elementTag?: string;
}

/**
 * Extract element information from a Playwright page
 * Useful for identifying which HTML elements are being tested
 */
export async function getElementInfo(
  page: Page,
  selector: string
): Promise<ElementInfo> {
  try {
    const info = await page.evaluate((sel: string) => {
      const element = document.querySelector(sel);
      if (!element) {
        return {
          elementId: undefined,
          elementClass: undefined,
          elementTag: undefined,
          elementSelector: sel
        };
      }

      return {
        elementId: element.id || undefined,
        elementClass: element.className || undefined,
        elementTag: element.tagName.toLowerCase(),
        elementSelector: sel
      };
    }, selector);

    return info as ElementInfo;
  } catch (err) {
    // If selector fails, return minimal info
    return {
      elementSelector: selector
    };
  }
}

/**
 * Get element info from common selectors used in testing
 */
export async function getElementInfoFromQuery(
  page: Page,
  queryDescription: string,
  ...selectors: string[]
): Promise<ElementInfo> {
  for (const selector of selectors) {
    try {
      const exists = await page.$(selector);
      if (exists) {
        return getElementInfo(page, selector);
      }
    } catch {
      // Continue to next selector
    }
  }

  return {
    elementSelector: queryDescription
  };
}

/**
 * Generate CSS selector for an element
 */
export async function generateElementSelector(
  page: Page,
  element: string
): Promise<string> {
  try {
    const selector = await page.evaluate((el: string) => {
      const element = document.querySelector(el);
      if (!element) return el;

      const getPath = (el: Element): string[] => {
        if (el.parentElement === null) return [];

        const parent = el.parentElement;
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(el);
        const name = el.tagName.toLowerCase();
        const indexStr = siblings.length > 1 ? `:nth-child(${index + 1})` : '';

        return [...getPath(parent), name + indexStr];
      };

      return getPath(element).join(' > ');
    }, element);

    return selector || element;
  } catch {
    return element;
  }
}

/**
 * Create a test result with automatic element tracking
 * USAGE:
 * const result = await createTestResultWithElement(page, {
 *   pageUrl: url,
 *   category: 'SEO',
 *   subTest: 'Meta Title',
 *   expectedValue: 'Title present',
 *   actualValue: 'Title found',
 *   differenceDescription: 'OK',
 *   severity: 'LOW',
 *   status: 'PASS',
 *   elementSelector: 'title'  // ← Specify the selector
 * });
 */
export async function createTestResultWithElement(
  page: Page,
  resultData: Partial<TestResult> & { elementSelector?: string }
): Promise<TestResultWithElement> {
  const { elementSelector, ...baseResult } = resultData;

  let elementInfo: ElementInfo = {};

  if (elementSelector) {
    try {
      elementInfo = await getElementInfo(page, elementSelector);
    } catch {
      elementInfo = { elementSelector };
    }
  }

  return {
    pageUrl: '',
    category: '',
    subTest: '',
    expectedValue: '',
    actualValue: '',
    differenceDescription: '',
    severity: 'LOW' as const,
    status: 'PASS' as const,
    timestamp: new Date().toISOString(),
    ...baseResult,
    ...elementInfo
  };
}
