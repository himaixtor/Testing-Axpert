import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';

export class AnalyticsValidationPlugin implements ValidationPlugin {
  id = 'analytics';
  name = 'Analytics & Tracking Validation';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing Analytics & Tracking Validation...');

    if (enabledSubTests.has('trackingDetection')) {
      try {
        const trackingData = await lowerPage.evaluate(() => {
          const scripts = Array.from(document.querySelectorAll('script'));
          const sources = scripts.map(s => s.getAttribute('src') || '').filter(src => src.length > 0);
          
          // 1. Google Analytics / GTM
          const hasGtmScript = sources.some(src => src.includes('googletagmanager.com/gtm.js'));
          const hasGaScript = sources.some(src => src.includes('google-analytics.com/analytics.js') || src.includes('googletagmanager.com/gtag/js'));
          const hasGtmGlobal = !!(window as any).google_tag_manager;
          const hasDataLayer = !!(window as any).dataLayer;
          const hasGtagGlobal = !!(window as any).gtag;

          // 2. Cookie consent banner
          const consentBannerKeywords = ['cookie', 'consent', 'privacy-policy', 'accept-cookies'];
          const bodyHtml = document.body.innerHTML.toLowerCase();
          const hasCookieKeywordInDom = consentBannerKeywords.some(kw => bodyHtml.includes(kw));

          return {
            hasGtmScript,
            hasGaScript,
            hasGtmGlobal,
            hasDataLayer,
            hasGtagGlobal,
            hasCookieKeywordInDom,
            sourcesCount: sources.length
          };
        });

        const hasAnalytics = trackingData.hasGtmScript || trackingData.hasGaScript || trackingData.hasGtmGlobal || trackingData.hasGtagGlobal;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Analytics Engine Detection',
          expectedValue: 'Google Tag Manager or Google Analytics configured',
          actualValue: hasAnalytics 
            ? `Detected: ${trackingData.hasGtmGlobal ? 'GTM Global ' : ''}${trackingData.hasGtagGlobal ? 'gtag.js ' : ''}${trackingData.hasDataLayer ? 'dataLayer ' : ''}`
            : 'No analytics triggers or global scopes detected',
          differenceDescription: hasAnalytics 
            ? 'Marketing analytics integration validated successfully' 
            : 'Warning: No standard tracking tags or scripts found. If this is a landing/marketing page, tracking code should be added.',
          severity: 'LOW',
          status: hasAnalytics ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });

        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Cookie Consent Detection',
          expectedValue: 'Cookie banner keywords/elements in DOM',
          actualValue: trackingData.hasCookieKeywordInDom ? 'Consent markers detected' : 'No explicit cookie markers found',
          differenceDescription: trackingData.hasCookieKeywordInDom 
            ? 'Cookie consent layout strings present in body scope' 
            : 'Advisory: Privacy compliance - No explicit cookie agreement layout markers found in text contents',
          severity: 'LOW',
          status: trackingData.hasCookieKeywordInDom ? 'PASS' : 'WARNING',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error checking analytics: ${err.message}`);
      }
    }

    return results;
  }
}
