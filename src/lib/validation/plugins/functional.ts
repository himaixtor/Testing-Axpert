import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';

export class FunctionalValidationPlugin implements ValidationPlugin {
  id = 'functional';
  name = 'Functional Testing';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing Functional Testing...');

    // 1. Navigation Menu checks
    if (enabledSubTests.has('navigation')) {
      try {
        const nav = await lowerPage.evaluate(() => {
          const mainNav = document.querySelectorAll('nav, [class*="nav"], [id*="nav"]').length;
          const footerNav = document.querySelectorAll('footer a').length;
          const breadcrumbs = document.querySelectorAll('[class*="breadcrumb"], [id*="breadcrumb"], ol[class*="breadcrumbs"]').length;
          
          return { mainNav, footerNav, breadcrumbs };
        });

        const navPassed = nav.mainNav > 0;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Header Navigation Elements',
          expectedValue: 'At least 1 navigation menu',
          actualValue: `${nav.mainNav} nav element(s) detected`,
          differenceDescription: navPassed ? 'Page has navigation tags' : 'No main navigation tag (<nav> or class containing nav) detected',
          severity: 'MEDIUM',
          status: navPassed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error checking navigation: ${err.message}`);
      }
    }

    // 2. Form checking
    if (enabledSubTests.has('forms')) {
      try {
        const forms = await lowerPage.evaluate(() => {
          const formElements = Array.from(document.querySelectorAll('form'));
          return formElements.map(f => {
            const inputs = f.querySelectorAll('input, select, textarea').length;
            const submitBtn = f.querySelectorAll('button[type="submit"], input[type="submit"]').length;
            return {
              action: f.getAttribute('action') || '',
              method: f.getAttribute('method') || 'get',
              inputs,
              submitBtn
            };
          });
        });

        if (forms.length > 0) {
          forms.forEach((form, idx) => {
            const hasSubmit = form.submitBtn > 0;
            results.push({
              pageUrl: relativeUrl,
              category: this.name,
              subTest: `Form Verification - Index ${idx}`,
              expectedValue: 'Form has fields and a submit button',
              actualValue: `Form fields: ${form.inputs}, Submit buttons: ${form.submitBtn}`,
              differenceDescription: hasSubmit ? 'Form configuration matches validation criteria' : 'Form is missing a submit button, preventing submission',
              severity: hasSubmit ? 'LOW' : 'HIGH',
              status: hasSubmit ? 'PASS' : 'FAIL',
              timestamp: new Date().toISOString()
            });
          });
        } else {
          results.push({
            pageUrl: relativeUrl,
            category: this.name,
            subTest: 'Form Verification',
            expectedValue: 'Scan forms on page',
            actualValue: 'No form elements found on this page',
            differenceDescription: 'Validation bypassed as no forms exist on this template',
            severity: 'LOW',
            status: 'PASS',
            timestamp: new Date().toISOString()
          });
        }
      } catch (err: any) {
        logExecution(`Error checking forms: ${err.message}`);
      }
    }

    // 3. Search validation
    if (enabledSubTests.has('search')) {
      try {
        const searchInput = await lowerPage.evaluate(() => {
          const queryInput = document.querySelector('input[type="search"], input[name*="search"], input[id*="search"]');
          return !!queryInput;
        });

        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Search Bar Integration',
          expectedValue: 'Scan search forms or input bars',
          actualValue: searchInput ? 'Search element found' : 'No search elements found',
          differenceDescription: searchInput ? 'Search input present' : 'No search input found on this page structure',
          severity: 'LOW',
          status: 'PASS',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error checking search functionality: ${err.message}`);
      }
    }

    // 4. Authentication detection
    if (enabledSubTests.has('authentication')) {
      try {
        const authForms = await lowerPage.evaluate(() => {
          const content = document.body.innerHTML.toLowerCase();
          const hasLogin = content.includes('login') || content.includes('sign in') || document.querySelector('input[type="password"]');
          const hasRegister = content.includes('register') || content.includes('sign up') || content.includes('create account');
          
          return {
            hasPasswordInput: !!document.querySelector('input[type="password"]'),
            hasLogin,
            hasRegister
          };
        });

        const isAuthPage = relativeUrl.includes('login') || relativeUrl.includes('register') || relativeUrl.includes('signup') || authForms.hasPasswordInput;
        if (isAuthPage) {
          const authPassed = authForms.hasPasswordInput;
          results.push({
            pageUrl: relativeUrl,
            category: this.name,
            subTest: 'Authentication Form Elements',
            expectedValue: 'Security credentials field (<input type="password">)',
            actualValue: authPassed ? 'Password field detected' : 'No password field detected on auth page route',
            differenceDescription: authPassed ? 'Login/Registration structure verified' : 'Possible UI regression: Password field not found on matching authentication route path',
            severity: 'CRITICAL',
            status: authPassed ? 'PASS' : 'FAIL',
            timestamp: new Date().toISOString()
          });
        }
      } catch (err: any) {
        logExecution(`Error checking authentication: ${err.message}`);
      }
    }

    return results;
  }
}
