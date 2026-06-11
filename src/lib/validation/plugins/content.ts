import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';
import { createTestResultWithElement } from '../../utils/elementSelector';

export class ContentValidationPlugin implements ValidationPlugin {
  id = 'content';
  name = 'Content Validation';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing Content Validation...');
    logExecution(`Enabled SubTests: ${Array.from(enabledSubTests).join(', ')}`);

    // 1. Page Availability
    if (enabledSubTests.has('pageAvailability')) {
      try {
        const response = await lowerPage.evaluate(() => {
          return {
            status: window.performance.getEntriesByType('navigation')[0]
              ? (window.performance.getEntriesByType('navigation')[0] as any).responseStatus || 200
              : 200,
            title: document.title
          };
        });

        const status = response.status;
        const passed = status >= 200 && status < 400;

        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Page Availability',
          expectedValue: '2xx or 3xx HTTP Status',
          actualValue: `HTTP Status ${status}`,
          differenceDescription: passed ? 'Page loaded successfully' : `Unexpected HTTP status code: ${status}`,
          severity: passed ? 'LOW' : 'CRITICAL',
          status: passed ? 'PASS' : 'FAIL',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Page Availability',
          expectedValue: 'Page accessible',
          actualValue: 'Page crashed/unreachable',
          differenceDescription: `Error: ${err.message || err}`,
          severity: 'CRITICAL',
          status: 'FAIL',
          timestamp: new Date().toISOString()
        });
      }
    }

    // 2. DEEP RECURSIVE DOM TEXT VALIDATION
    if (enabledSubTests.has('textComparison') && context.comparePage) {
      try {
        logExecution('Starting deep recursive DOM text validation...');

        // Extract all DOM nodes with direct text recursively
        const extractDOMNodes = () => {
          return `
            (function() {
              const nodes = [];
              const IGNORE_TAGS = ['script', 'style', 'noscript', 'iframe', 'meta', 'head'];
              const IGNORE_CLASSES = /tracking|analytics|ga-|gtag|gtm|csrf|token|_ga|_gat|sid|sessionid/i;

              function getCSSSelector(el) {
                let path = [];
                while (el && el.nodeType === 1) {
                  let selector = el.tagName.toLowerCase();
                  if (el.id) {
                    selector += '#' + el.id;
                    path.unshift(selector);
                    break;
                  } else {
                    let siblings = Array.from(el.parentNode.children || [])
                      .filter(e => e.tagName === el.tagName);
                    if (siblings.length > 1) {
                      let index = siblings.indexOf(el) + 1;
                      selector += ':nth-of-type(' + index + ')';
                    }
                  }

                  let classes = (el.className || '').split(/\\s+/)
                    .filter(c => c && !IGNORE_CLASSES.test(c));
                  if (classes.length > 0) {
                    selector += '.' + classes.slice(0, 2).join('.');
                  }

                  path.unshift(selector);
                  el = el.parentElement;
                }
                return path.join(' > ') || 'body';
              }

              function getDirectText(el) {
                let text = '';
                for (let node of el.childNodes) {
                  if (node.nodeType === 3) {
                    let t = node.textContent.trim();
                    if (t) text += t + ' ';
                  }
                }
                return text.trim();
              }

              function shouldIgnore(el) {
                if (!el || IGNORE_TAGS.includes(el.tagName.toLowerCase())) return true;
                if (el.getAttribute('aria-hidden') === 'true') return true;
                let style = getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return true;
                if (IGNORE_CLASSES.test(el.className)) return true;
                return false;
              }

              function traverse(el, depth) {
                if (shouldIgnore(el)) return;

                let text = getDirectText(el);
                if (text && text.length > 2) {
                  nodes.push({
                    selector: getCSSSelector(el),
                    tag: el.tagName.toLowerCase(),
                    level: depth,
                    text: text
                  });
                }

                Array.from(el.children || []).forEach(child => {
                  traverse(child, depth + 1);
                });
              }

              if (document.body) {
                traverse(document.body, 0);
              }

              return nodes;
            })()
          `;
        };

        // Extract from LOCAL environment
        const localNodes = (await lowerPage.evaluate(extractDOMNodes())) as any[];

        // Extract from UAT environment
        const uatNodes = (await context.comparePage.evaluate(extractDOMNodes())) as any[];

        logExecution(`Found ${localNodes.length} text nodes in LOCAL, ${uatNodes.length} in UAT`);

        // Match nodes and find differences
        const matchedUAT = new Set();
        const differences = [];
        let totalChecked = localNodes.length + uatNodes.length;
        let totalDifferences = 0;

        // Helper: Calculate text similarity
        const textSimilarity = (text1: string, text2: string): number => {
          const t1 = text1.toLowerCase().substring(0, 100);
          const t2 = text2.toLowerCase().substring(0, 100);
          if (t1 === t2) return 1;

          const len = Math.max(t1.length, t2.length);
          let matches = 0;
          for (let i = 0; i < Math.min(t1.length, t2.length); i++) {
            if (t1[i] === t2[i]) matches++;
          }
          return matches / len;
        };

        localNodes.forEach((localNode) => {
          // Strategy 1: Try EXACT TEXT match first
          let uatMatch = uatNodes.find((n, idx) =>
            !matchedUAT.has(idx) && n.text === localNode.text
          );

          // Strategy 2: Try EXACT SELECTOR match
          if (!uatMatch) {
            uatMatch = uatNodes.find((n, idx) =>
              !matchedUAT.has(idx) && n.selector === localNode.selector
            );
          }

          // Strategy 3: Try similar text (>80% match) + same tag
          if (!uatMatch) {
            let bestMatch: any = null;
            let bestScore = 0;
            uatNodes.forEach((n, idx) => {
              if (!matchedUAT.has(idx) && n.tag === localNode.tag) {
                const score = textSimilarity(localNode.text, n.text);
                if (score > bestScore && score > 0.7) {
                  bestScore = score;
                  bestMatch = { node: n, idx };
                }
              }
            });
            if (bestMatch) {
              uatMatch = bestMatch.node;
              matchedUAT.add(bestMatch.idx);
            }
          }

          if (uatMatch) {
            if (!matchedUAT.has(uatNodes.indexOf(uatMatch))) {
              const idx = uatNodes.indexOf(uatMatch);
              matchedUAT.add(idx);
            }

            if (localNode.text !== uatMatch.text) {
              totalDifferences++;

              // Determine difference type
              let diffType = 'Modified';
              if (!uatMatch.text) diffType = 'Missing in UAT';
              else if (!localNode.text) diffType = 'Added in UAT';
              else if (localNode.text.toLowerCase() === uatMatch.text.toLowerCase()) diffType = 'Capitalization';
              else if (localNode.text.replace(/\\s+/g, '') === uatMatch.text.replace(/\\s+/g, '')) diffType = 'Whitespace';

              let severity = 'Minor';
              const charDiff = Math.abs(localNode.text.length - uatMatch.text.length);
              const wordDiff = Math.abs(
                localNode.text.split(/\\s+/).length -
                uatMatch.text.split(/\\s+/).length
              );

              if (charDiff > 50 || wordDiff > 5) severity = 'Major';
              if (charDiff > 200 || wordDiff > 10) severity = 'Critical';

              differences.push({
                selector: localNode.selector,
                tag: localNode.tag,
                level: localNode.level <= 2 ? 'Parent' : localNode.level <= 5 ? 'Child' : 'Leaf',
                localText: localNode.text.substring(0, 150),
                uatText: uatMatch.text.substring(0, 150),
                diffType,
                severity,
                charDiff,
                wordDiff
              });

              results.push({
                pageUrl: relativeUrl,
                category: this.name,
                subTest: 'Text Content Comparison',
                expectedValue: localNode.text.substring(0, 100),
                actualValue: uatMatch.text.substring(0, 100),
                differenceDescription: `${localNode.tag.toUpperCase()} [${diffType}]\nLocal: "${localNode.text.substring(0, 100)}"\nUAT: "${uatMatch.text.substring(0, 100)}"`,
                severity: severity as any,
                status: 'WARNING',
                elementSelector: localNode.selector,
                elementTag: localNode.tag,
                timestamp: new Date().toISOString()
              });
            }
          }
        });

        logExecution(`DOM Validation Complete: Total checked=${totalChecked}, Differences found=${totalDifferences}`);

      } catch (err: any) {
        logExecution(`Error in DOM text validation: ${err.message}`);
      }
    }

    // 3. Content Accuracy
    if (enabledSubTests.has('contentAccuracy')) {
      try {
        const accuracyData = await lowerPage.evaluate(() => {
          const h1s = Array.from(document.querySelectorAll('h1')).map(el => el.textContent?.trim() || '');
          const images = Array.from(document.querySelectorAll('img')).map(el => el.getAttribute('src') || '');
          const footer = document.querySelector('footer')?.textContent?.trim() || '';

          return {
            title: document.title,
            h1Count: h1s.length,
            h1s,
            imagesCount: images.length,
            hasFooter: footer.length > 0
          };
        });

        const h1Passed = accuracyData.h1Count === 1;
        results.push(await createTestResultWithElement(lowerPage, {
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'H1 Header Count',
          expectedValue: 'Exactly 1 H1 element',
          actualValue: `${accuracyData.h1Count} H1(s) found`,
          differenceDescription: h1Passed ? 'H1 tag structure is correct' : `Page has ${accuracyData.h1Count} H1 tags instead of 1. Titles: ${JSON.stringify(accuracyData.h1s)}`,
          severity: h1Passed ? 'LOW' : 'MEDIUM',
          status: h1Passed ? 'PASS' : 'WARNING',
          elementSelector: 'h1'
        }));

        const titlePassed = accuracyData.title.length > 0;
        results.push(await createTestResultWithElement(lowerPage, {
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Page Title',
          expectedValue: 'Non-empty page title',
          actualValue: accuracyData.title ? `Title: "${accuracyData.title}"` : 'Title is empty',
          differenceDescription: titlePassed ? 'Title tag is present and non-empty' : 'Page title is completely blank',
          severity: titlePassed ? 'LOW' : 'HIGH',
          status: titlePassed ? 'PASS' : 'FAIL',
          elementSelector: 'title'
        }));

        const imagesPassed = accuracyData.imagesCount > 0;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Images Present',
          expectedValue: 'At least 1 image on the page',
          actualValue: `${accuracyData.imagesCount} images found`,
          differenceDescription: imagesPassed ? 'Images parsed successfully' : 'No images found on this page',
          severity: 'LOW',
          status: imagesPassed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error executing Content Accuracy check: ${err.message}`);
      }
    }

    // 4. Rich Content
    if (enabledSubTests.has('richContent')) {
      try {
        const richData = await lowerPage.evaluate(() => {
          const videos = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
          const accordions = document.querySelectorAll('[class*="accordion"], [id*="accordion"], details').length;
          const tabs = document.querySelectorAll('[class*="tab"], [id*="tab"], [role="tab"]').length;

          return { videos, accordions, tabs };
        });

        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Rich Content Detection',
          expectedValue: 'Detect rich widgets (videos, accordions, tabs)',
          actualValue: `Videos: ${richData.videos}, Accordions: ${richData.accordions}, Tabs: ${richData.tabs}`,
          differenceDescription: 'Rich content structure parsed',
          severity: 'LOW',
          status: 'PASS',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error executing Rich Content check: ${err.message}`);
      }
    }

    return results;
  }
}
