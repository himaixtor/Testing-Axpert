import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';

export class SecurityValidationPlugin implements ValidationPlugin {
  id = 'security';
  name = 'Security Validation';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, lowerUrl, lowerHeaders, enabledSubTests, logExecution } = context;

    logExecution('Executing Security Validation...');

    // 1. HTTPS / SSL Active & Mixed Content
    if (enabledSubTests.has('https')) {
      const isHttps = lowerUrl.startsWith('https://') || lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1');
      results.push({
        pageUrl: context.relativeUrl,
        category: this.name,
        subTest: 'HTTPS Secure Socket Layer',
        expectedValue: 'HTTPS connection enabled',
        actualValue: lowerUrl.split(':')[0] + '://',
        differenceDescription: isHttps ? 'SSL/TLS secure transport active' : 'Security risk: Lower environment connection is unencrypted HTTP',
        severity: isHttps ? 'LOW' : 'CRITICAL',
        status: isHttps ? 'PASS' : 'FAIL',
        timestamp: new Date().toISOString()
      });

      if (isHttps) {
        try {
          const mixedContent = await lowerPage.evaluate(() => {
            const media = Array.from(document.querySelectorAll('img, video, audio, script, link[rel="stylesheet"]'));
            const httpSources = media
              .map(el => el.getAttribute('src') || el.getAttribute('href') || '')
              .filter(src => src.startsWith('http://'));
            
            return { httpSourcesCount: httpSources.length, httpSources };
          });

          const mixedPassed = mixedContent.httpSourcesCount === 0;
          results.push({
            pageUrl: context.relativeUrl,
            category: this.name,
            subTest: 'Mixed Content Check',
            expectedValue: 'No HTTP assets loaded over HTTPS',
            actualValue: `${mixedContent.httpSourcesCount} HTTP resources found`,
            differenceDescription: mixedPassed
              ? 'Zero mixed content items detected'
              : `Active mixed content warning: HTTPS page loads assets over unencrypted HTTP: ${JSON.stringify(mixedContent.httpSources.slice(0, 3))}`,
            severity: 'CRITICAL',
            status: mixedPassed ? 'PASS' : 'FAIL',
            timestamp: new Date().toISOString()
          });
        } catch (err: any) {
          logExecution(`Error checking mixed content: ${err.message}`);
        }
      }
    }

    // 2. Security Headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
    if (enabledSubTests.has('securityHeaders')) {
      const headersToCheck = [
        { name: 'content-security-policy', desc: 'Content-Security-Policy (CSP)', severity: 'HIGH' as const },
        { name: 'strict-transport-security', desc: 'Strict-Transport-Security (HSTS)', severity: 'HIGH' as const },
        { name: 'x-frame-options', desc: 'X-Frame-Options (Clickjacking protection)', severity: 'MEDIUM' as const },
        { name: 'x-content-type-options', desc: 'X-Content-Type-Options (MIME Sniffing protection)', severity: 'MEDIUM' as const }
      ];

      // Normalize headers keys to lowercase
      const normalizedHeaders: Record<string, string> = {};
      Object.keys(lowerHeaders).forEach(k => {
        normalizedHeaders[k.toLowerCase()] = lowerHeaders[k];
      });

      headersToCheck.forEach(h => {
        const value = normalizedHeaders[h.name];
        const passed = !!value;

        results.push({
          pageUrl: context.relativeUrl,
          category: this.name,
          subTest: `Header: ${h.name}`,
          expectedValue: `Header is defined`,
          actualValue: passed ? `${h.name}: "${value.slice(0, 30)}..."` : 'Header missing',
          differenceDescription: passed
            ? `${h.desc} is configured correctly`
            : `Security advisory: ${h.desc} response header is missing, exposing browser connection to standard vulnerabilities`,
          severity: passed ? 'LOW' : h.severity,
          status: passed ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });
      });
    }

    // 3. Form input safety and anti-CSRF token verification
    if (enabledSubTests.has('forms')) {
      try {
        const csrfAudit = await lowerPage.evaluate(() => {
          const forms = Array.from(document.querySelectorAll('form[method="post"]'));
          const results = [];

          for (const form of forms) {
            // Typical anti-CSRF names
            const inputs = Array.from(form.querySelectorAll('input[type="hidden"]'));
            const hasCsrfInput = inputs.some(i => {
              const name = (i.getAttribute('name') || '').toLowerCase();
              const val = i.getAttribute('value') || '';
              return name.includes('csrf') || name.includes('token') || name.includes('xsrf') || (val.length > 20 && /^[a-z0-9_\-]+$/i.test(val));
            });
            results.push({
              action: form.getAttribute('action') || '',
              hasCsrfInput
            });
          }

          return results;
        });

        if (csrfAudit.length > 0) {
          csrfAudit.forEach((form, index) => {
            results.push({
              pageUrl: context.relativeUrl,
              category: this.name,
              subTest: `Anti-CSRF Protection (Form ${index})`,
              expectedValue: 'Anti-CSRF hidden token present in POST form',
              actualValue: form.hasCsrfInput ? 'Token detected' : 'No token detected',
              differenceDescription: form.hasCsrfInput
                ? `POST form contains hidden CSRF validation state`
                : `Security warning: POST form targeting "${form.action}" does not contain a recognizable anti-CSRF validation field`,
              severity: form.hasCsrfInput ? 'LOW' : 'HIGH',
              status: form.hasCsrfInput ? 'PASS' : 'WARNING',
              timestamp: new Date().toISOString()
            });
          });
        }
      } catch (err: any) {
        logExecution(`Error checking form security CSRF status: ${err.message}`);
      }
    }

    return results;
  }
}
