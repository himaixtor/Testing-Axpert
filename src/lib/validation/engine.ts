import { chromium } from 'playwright';
import { ValidationPlugin, ValidationContext } from './types';
import { ConfigRepository } from '../storage/configRepository';
import { ReportRepository, DetailedReport, TestResult, BrowserLog, NetworkLog } from '../storage/reportRepository';
import { SitemapCrawler } from '../utils/crawler';

// Plugins list imports
import { ContentValidationPlugin } from './plugins/content';
import { SeoValidationPlugin } from './plugins/seo';
import { FunctionalValidationPlugin } from './plugins/functional';
import { LinkValidationPlugin } from './plugins/links';
import { PerformanceValidationPlugin } from './plugins/performance';
import { ResponsiveValidationPlugin } from './plugins/responsive';
import { BrowserCompatibilityValidationPlugin } from './plugins/browser';
import { AccessibilityValidationPlugin } from './plugins/accessibility';
import { SecurityValidationPlugin } from './plugins/security';
import { AnalyticsValidationPlugin } from './plugins/analytics';
import { MigrationValidationPlugin } from './plugins/migration';
import { ErrorMonitoringValidationPlugin } from './plugins/error-monitoring';
import { UiValidationPlugin } from './plugins/ui';
import { UiComprehensivePlugin } from './plugins/ui-comprehensive';
import { UiDetailedPlugin } from './plugins/ui-detailed';
import { VisualComprehensivePlugin } from './plugins/visual-comprehensive';

export interface ValidationJobProgress {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  currentUrl: string;
  errors: string[];
  resultsCount: number;
  startTime: number;
  durationMs: number;
}

// Global state hook to allow API polling to access running job status
const globalStatusKey = Symbol.for('testing-axpert.validation-job');
if (!(global as any)[globalStatusKey]) {
  (global as any)[globalStatusKey] = {
    id: '',
    status: 'idle',
    progress: 0,
    total: 0,
    currentUrl: '',
    errors: [],
    resultsCount: 0,
    startTime: 0,
    durationMs: 0
  } as ValidationJobProgress;
}

export const activeJob = (global as any)[globalStatusKey] as ValidationJobProgress;

export class ValidationEngine {
  private static plugins: ValidationPlugin[] = [
    new ContentValidationPlugin(),
    new SeoValidationPlugin(),
    new FunctionalValidationPlugin(),
    new LinkValidationPlugin(),
    new PerformanceValidationPlugin(),
    new ResponsiveValidationPlugin(),
    new BrowserCompatibilityValidationPlugin(),
    new AccessibilityValidationPlugin(),
    new SecurityValidationPlugin(),
    new AnalyticsValidationPlugin(),
    new MigrationValidationPlugin(),
    new ErrorMonitoringValidationPlugin(),
    new UiValidationPlugin(),
    new UiComprehensivePlugin(),
    new UiDetailedPlugin(),
    new VisualComprehensivePlugin()
  ];

  static getActiveJobStatus(): ValidationJobProgress {
    return activeJob;
  }

  static async runValidation(params: {
    runMode: 'sitemap' | 'webpage' | 'file-upload';
    lowerSitemap?: string;
    compareSitemap?: string;
    lowerWebpage?: string;
    compareWebpage?: string;
    lowerUrls?: string[];
    productionUrls?: string[];
    limitedPages: boolean;
    pagesCount: number;
    selectedCategoryIds: string[];
    testDesktop?: boolean;
    testTablet?: boolean;
    testMobile?: boolean;
    hiddenComponentOption?: 'avoid' | 'with';
    checkLevel?: 'highlevel' | 'micro';
  }): Promise<string> {
    if (activeJob.status === 'running') {
      throw new Error('A validation run is already in progress.');
    }

    const runId = new Date().getTime().toString();
    activeJob.id = runId;
    activeJob.status = 'running';
    activeJob.progress = 0;
    activeJob.total = 0;
    activeJob.currentUrl = params.runMode === 'webpage' ? 'Validating webpage pairs...' :
                            params.runMode === 'file-upload' ? 'Preparing URLs from files...' :
                            'Crawling sitemaps...';
    activeJob.errors = [];
    activeJob.resultsCount = 0;
    activeJob.startTime = Date.now();
    activeJob.durationMs = 0;

    this.executeJob(runId, params).catch(err => {
      console.error('Job execution failed:', err);
      activeJob.status = 'failed';
      activeJob.errors.push(err?.message || String(err));
    });

    return runId;
  }

  private static async executeJob(
    runId: string,
    params: {
      runMode: 'sitemap' | 'webpage' | 'file-upload';
      lowerSitemap?: string;
      compareSitemap?: string;
      lowerWebpage?: string;
      compareWebpage?: string;
      lowerUrls?: string[];
      productionUrls?: string[];
      limitedPages: boolean;
      pagesCount: number;
      selectedCategoryIds: string[];
      testDesktop?: boolean;
      testTablet?: boolean;
      testMobile?: boolean;
      hiddenComponentOption?: 'avoid' | 'with';
      checkLevel?: 'highlevel' | 'micro';
    }
  ) {
    const config = ConfigRepository.getConfig();
    const allResults: TestResult[] = [];

    // Logs
    const executionLogs: string[] = [];
    const browserLogs: BrowserLog[] = [];
    const networkLogs: NetworkLog[] = [];
    const errorLogs: string[] = [];

    const logExecution = (msg: string) => {
      const entry = `[${new Date().toISOString()}] ${msg}`;
      executionLogs.push(entry);
      console.log(entry);
    };

    logExecution(`Starting validation job #${runId}`);
    logExecution(`Run mode: ${params.runMode}`);
    logExecution(`Selected categories: ${JSON.stringify(params.selectedCategoryIds)}`);

    const getBaseUrl = (raw: string) => {
      const url = new URL(raw);
      return `${url.protocol}//${url.host}`;
    };

    const buildEnabledSubTests = (pluginId: string) => {
      const catConfig = config.categories.find(c => c.id === pluginId);
      if (!catConfig || !catConfig.enabled) return new Set<string>();
      return new Set(catConfig.subTests.filter(s => s.enabled).map(s => s.id));
    };

    const runPluginsForPage = async (context: ValidationContext) => {
      for (const plugin of ValidationEngine.plugins) {
        if (!params.selectedCategoryIds.includes(plugin.id)) continue;
        const catConfig = config.categories.find(c => c.id === plugin.id);
        if (!catConfig || !catConfig.enabled) continue;

        context.enabledSubTests = buildEnabledSubTests(plugin.id);
        try {
          const pluginResults = await plugin.execute(context);
          allResults.push(...pluginResults);
        } catch (pluginErr: any) {
          const msg = pluginErr?.message || String(pluginErr);
          logExecution(`Error running plugin "${plugin.name}" on ${context.relativeUrl}: ${msg}`);
          errorLogs.push(`Plugin crash: ${plugin.id} on ${context.relativeUrl} - ${msg}`);
        }
      }
    };

    const compileAndSaveReport = async (opts: {
      lowerSitemap?: string;
      compareSitemap?: string;
      pagesChecked: number;
      targetRelativePaths: string[];
    }) => {
      logExecution('Compiling final validation summary metrics...');

      const passed = allResults.filter(r => r.status === 'PASS').length;
      const failed = allResults.filter(r => r.status === 'FAIL').length;
      const warnings = allResults.filter(r => r.status === 'WARNING').length;

      const categoryBreakdown: Record<string, { passed: number; failed: number; warnings: number; total: number }> = {};
      params.selectedCategoryIds.forEach(catId => {
        const catConfig = config.categories.find(c => c.id === catId);
        if (!catConfig) return;
        const catResults = allResults.filter(r => r.category === catConfig.name);
        categoryBreakdown[catId] = {
          passed: catResults.filter(r => r.status === 'PASS').length,
          failed: catResults.filter(r => r.status === 'FAIL').length,
          warnings: catResults.filter(r => r.status === 'WARNING').length,
          total: catResults.length
        };
      });

      const status = failed > 0 ? 'FAIL' : warnings > 0 ? 'WARNING' : 'PASS';
      const durationMs = Date.now() - activeJob.startTime;

      const detailedReport: DetailedReport = {
        id: runId,
        timestamp: new Date().toISOString(),
        lowerSitemap: opts.lowerSitemap || (params.lowerWebpage as string) || '',
        compareSitemap: opts.compareSitemap || (params.compareWebpage as string) || '',
        pagesChecked: opts.pagesChecked,
        durationMs,
        status,
        summary: { passed, failed, warnings, total: allResults.length },
        categoryBreakdown,
        results: allResults,
        logs: { execution: executionLogs, browser: browserLogs, network: networkLogs, error: errorLogs }
      };

      logExecution('Saving report database entries...');
      ReportRepository.saveReport(detailedReport);

      logExecution(`Job completed successfully! Passed: ${passed}, Failed: ${failed}, Warnings: ${warnings}`);

      activeJob.status = 'completed';
      activeJob.progress = 100;
      activeJob.durationMs = durationMs;
    };

    if (params.runMode === 'sitemap') {
      const lowerSitemap = params.lowerSitemap as string;
      const compareSitemap = params.compareSitemap as string;

      logExecution(`Lower environment sitemap: ${lowerSitemap}`);
      logExecution(`Compare environment sitemap: ${compareSitemap}`);

      logExecution('Fetching UAT (lower) sitemap...');
      const lowerSitemapResult = await SitemapCrawler.fetchSitemapUrls(lowerSitemap);
      if (lowerSitemapResult.error) {
        logExecution(`UAT Sitemap Error: ${lowerSitemapResult.error}`);
        errorLogs.push(lowerSitemapResult.error);
      }

      logExecution('Fetching Production (compare) sitemap...');
      const compareSitemapResult = await SitemapCrawler.fetchSitemapUrls(compareSitemap);
      if (compareSitemapResult.error) {
        logExecution(`Prod Sitemap Error: ${compareSitemapResult.error}`);
        errorLogs.push(compareSitemapResult.error);
      }

      const aligned = SitemapCrawler.alignSitemaps(lowerSitemapResult.urls, compareSitemapResult.urls);
      logExecution(
        `Sitemap crawl result: Matches = ${aligned.matchedRelativePaths.length}, UAT-Only = ${aligned.lowerOnly.length}, Prod-Only = ${aligned.compareOnly.length}`
      );

      if (aligned.matchedRelativePaths.length === 0 && (lowerSitemapResult.error || compareSitemapResult.error)) {
        activeJob.status = 'failed';
        activeJob.errors.push('Could not parse any matching URLs from both sitemaps. Check connection status and schemas.');
        return;
      }

      let targetRelativePaths = [...aligned.matchedRelativePaths];
      if (targetRelativePaths.length === 0) {
        targetRelativePaths = lowerSitemapResult.urls.map(u => SitemapCrawler.getRelativePath(u));
      }

      if (params.limitedPages) {
        targetRelativePaths = targetRelativePaths.slice(0, params.pagesCount);
        logExecution(`Limiting check to first ${params.pagesCount} URLs.`);
      }

      activeJob.total = targetRelativePaths.length;
      if (activeJob.total === 0) {
        logExecution('Zero URLs aligned for validation. Completing dry-run.');
        activeJob.status = 'completed';
        activeJob.progress = 100;
        return;
      }

      const lowerBase = getBaseUrl(lowerSitemap);
      const compareBase = getBaseUrl(compareSitemap);

      logExecution('Launching Playwright Chromium browser instances...');
      const browser = await chromium.launch({ headless: true });
      try {
        const lowerContext = await browser.newContext();
        const compareContext = await browser.newContext();

        const lowerPage = await lowerContext.newPage();
        const comparePage = await compareContext.newPage();

        lowerPage.on('console', msg => {
          browserLogs.push({ timestamp: new Date().toISOString(), type: msg.type(), text: msg.text(), url: lowerPage.url() });
          if (msg.type() === 'error') logExecution(`[Browser Console Error] ${msg.text()}`);
        });

        lowerPage.on('requestfailed', request => {
          const failure = request.failure();
          networkLogs.push({
            timestamp: new Date().toISOString(),
            url: request.url(),
            status: 0,
            statusText: 'Failed',
            error: failure?.errorText || 'Failed request'
          });
          logExecution(`[Network Request Failed] ${request.url()} - ${failure?.errorText}`);
        });

        for (let i = 0; i < targetRelativePaths.length; i++) {
          const relUrl = targetRelativePaths[i];
          const lowerUrl = `${lowerBase}${relUrl}`;
          const compareUrl = `${compareBase}${relUrl}`;

          activeJob.currentUrl = relUrl;
          logExecution(`Validating page [${i + 1}/${targetRelativePaths.length}]: ${relUrl}`);

          let lowerHeaders: Record<string, string> = {};
          let compareHeaders: Record<string, string> = {};

          try {
            logExecution(`Navigating UAT: ${lowerUrl}`);
            const res = await lowerPage.goto(lowerUrl, { waitUntil: 'load', timeout: 25000 });
            lowerHeaders = res ? res.headers() : {};
            // Wait for network idle to ensure all JavaScript has executed and DOM is fully rendered
            await lowerPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          } catch (e: any) {
            const msg = e?.message || String(e);
            logExecution(`Failed to navigate UAT page ${lowerUrl}: ${msg}`);
            errorLogs.push(`Navigation failed for UAT: ${lowerUrl} - ${msg}`);
          }

          try {
            logExecution(`Navigating Prod: ${compareUrl}`);
            const res = await comparePage.goto(compareUrl, { waitUntil: 'load', timeout: 25000 });
            compareHeaders = res ? res.headers() : {};
            // Wait for network idle to ensure all JavaScript has executed and DOM is fully rendered
            await comparePage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          } catch (e: any) {
            const msg = e?.message || String(e);
            logExecution(`Failed to navigate Prod page ${compareUrl}: ${msg}`);
            errorLogs.push(`Navigation failed for Prod: ${compareUrl} - ${msg}`);
          }

          const context: ValidationContext = {
            relativeUrl: relUrl,
            lowerUrl,
            compareUrl,
            lowerPage,
            comparePage,
            lowerHeaders,
            compareHeaders,
            enabledSubTests: new Set<string>(),
            logExecution,
            logBrowser: (type: string, text: string, url: string) => browserLogs.push({ timestamp: new Date().toISOString(), type, text, url }),
            logNetwork: (url: string, status: number, statusText: string, error?: string) =>
              networkLogs.push({ timestamp: new Date().toISOString(), url, status, statusText, error }),
            // Add viewport and hidden component options
            testDesktop: (params as any).testDesktop !== false,
            testTablet: (params as any).testTablet !== false,
            testMobile: (params as any).testMobile !== false,
            hiddenComponentOption: ((params as any).hiddenComponentOption || 'avoid') as 'avoid' | 'with',
            checkLevel: ((params as any).checkLevel || 'micro') as 'highlevel' | 'micro'
          } as any;

          await runPluginsForPage(context);

          activeJob.progress = Math.round(((i + 1) / targetRelativePaths.length) * 100);
          activeJob.resultsCount = allResults.length;
        }
      } finally {
        await browser.close().catch(() => undefined);
      }

      await compileAndSaveReport({ lowerSitemap, compareSitemap, pagesChecked: targetRelativePaths.length, targetRelativePaths });
      return;
    }

    else if (params.runMode === 'webpage') {
    const lowerWebpage = params.lowerWebpage as string;
    const compareWebpage = params.compareWebpage as string;

    logExecution(`Lower environment webpage: ${lowerWebpage}`);
    logExecution(`Compare environment webpage: ${compareWebpage}`);

    const lowerRootUrl = new URL(lowerWebpage);
    const compareRootUrl = new URL(compareWebpage);

    // Requirement: domain must be different
    if (lowerRootUrl.host === compareRootUrl.host) {
      activeJob.status = 'failed';
      activeJob.errors.push('Validation error: Lower and Production domains must be different for webpage comparison.');
      return;
    }

    const discoverRelativePathsFromRoot = async (root: string): Promise<string[]> => {
      const rootUrl = new URL(root);
      const discovered = new Set<string>();

      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(root, { waitUntil: 'load', timeout: 25000 });

        discovered.add(rootUrl.pathname + rootUrl.search);

        // lightweight discovery (anchors only). convert to relative (pathname+search)
        const hrefs: string[] = await page.$$eval('a[href]', els => els.map(a => (a as HTMLAnchorElement).href));

        for (const href of hrefs) {
          try {
            const u = new URL(href);
            if (u.host !== rootUrl.host) continue;
            discovered.add(u.pathname + u.search);
          } catch {
            // ignore
          }
        }
      } finally {
        await browser.close().catch(() => undefined);
      }

      return Array.from(discovered);
    };

    // Discover URLs to compare
    logExecution('Discovering relative paths from lower webpage...');
    const lowerRelativePaths = await discoverRelativePathsFromRoot(lowerWebpage);

    logExecution('Discovering relative paths from compare webpage...');
    const compareRelativePaths = await discoverRelativePathsFromRoot(compareWebpage);

    const lowerSet = new Set(lowerRelativePaths);
    const compareSet = new Set(compareRelativePaths);

    const matchedRelativePaths: string[] = [];
    const lowerOnly: string[] = [];
    const compareOnly: string[] = [];

    Array.from(lowerSet).forEach(rel => {
      if (compareSet.has(rel)) matchedRelativePaths.push(rel);
      else lowerOnly.push(rel);
    });

    Array.from(compareSet).forEach(rel => {
      if (!lowerSet.has(rel)) compareOnly.push(rel);
    });


    logExecution(
      `Webpage discovery result: matched=${matchedRelativePaths.length}, lowerOnly=${lowerOnly.length}, compareOnly=${compareOnly.length}`
    );

    // Fail fast per requirement: only compare pages where paths match.
    // If there are mismatches, treat them as validation errors but still run on matched pages
    // so the UI can show detailed assertions like sitemap mode.
    if (lowerOnly.length > 0 || compareOnly.length > 0) {
      activeJob.errors.push(
        'Webpage path mismatch found (non-fatal). ' +
          `Lower-only: ${lowerOnly.slice(0, 10).join(', ')}${lowerOnly.length > 10 ? '...' : ''}. ` +
          `Compare-only: ${compareOnly.slice(0, 10).join(', ')}${compareOnly.length > 10 ? '...' : ''}.`
      );
      // Keep status running/completed based on actual plugin results.
    }

    let targetRelativePaths = matchedRelativePaths;


    if (params.limitedPages) {
      targetRelativePaths = targetRelativePaths.slice(0, params.pagesCount);
      logExecution(`Limiting check to first ${params.pagesCount} URLs.`);
    }

    activeJob.total = targetRelativePaths.length;
    if (activeJob.total === 0) {
      logExecution('Zero URLs discovered for validation. Completing dry-run.');
      activeJob.status = 'completed';
      activeJob.progress = 100;
      return;
    }

    const lowerBase = getBaseUrl(lowerWebpage);
    const compareBase = getBaseUrl(compareWebpage);

    logExecution('Launching Playwright Chromium browser instances...');
    const browser = await chromium.launch({ headless: true });
    try {
      const lowerContext = await browser.newContext();
      const compareContext = await browser.newContext();

      const lowerPage = await lowerContext.newPage();
      const comparePage = await compareContext.newPage();

      lowerPage.on('console', msg => {
        browserLogs.push({ timestamp: new Date().toISOString(), type: msg.type(), text: msg.text(), url: lowerPage.url() });
        if (msg.type() === 'error') logExecution(`[Browser Console Error] ${msg.text()}`);
      });

      lowerPage.on('requestfailed', request => {
        const failure = request.failure();
        networkLogs.push({
          timestamp: new Date().toISOString(),
          url: request.url(),
          status: 0,
          statusText: 'Failed',
          error: failure?.errorText || 'Failed request'
        });
        logExecution(`[Network Request Failed] ${request.url()} - ${failure?.errorText}`);
      });

      for (let i = 0; i < targetRelativePaths.length; i++) {
        const relUrl = targetRelativePaths[i];
        const lowerUrl = `${lowerBase}${relUrl}`;
        const compareUrl = `${compareBase}${relUrl}`;

        activeJob.currentUrl = relUrl;
        logExecution(`Validating page [${i + 1}/${targetRelativePaths.length}]: ${relUrl}`);

        let lowerHeaders: Record<string, string> = {};
        let compareHeaders: Record<string, string> = {};

        try {
          logExecution(`Navigating Lower: ${lowerUrl}`);
          const res = await lowerPage.goto(lowerUrl, { waitUntil: 'load', timeout: 25000 });
          lowerHeaders = res ? res.headers() : {};
          // Wait for network idle to ensure all JavaScript has executed and DOM is fully rendered
          await lowerPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        } catch (e: any) {
          const msg = e?.message || String(e);
          logExecution(`Failed to navigate Lower page ${lowerUrl}: ${msg}`);
          errorLogs.push(`Navigation failed for Lower: ${lowerUrl} - ${msg}`);
        }

        try {
          logExecution(`Navigating Compare: ${compareUrl}`);
          const res = await comparePage.goto(compareUrl, { waitUntil: 'load', timeout: 25000 });
          compareHeaders = res ? res.headers() : {};
          // Wait for network idle to ensure all JavaScript has executed and DOM is fully rendered
          await comparePage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        } catch (e: any) {
          const msg = e?.message || String(e);
          logExecution(`Failed to navigate Compare page ${compareUrl}: ${msg}`);
          errorLogs.push(`Navigation failed for Compare: ${compareUrl} - ${msg}`);
        }

        const context: ValidationContext = {
          relativeUrl: relUrl,
          lowerUrl,
          compareUrl,
          lowerPage,
          comparePage,
          lowerHeaders,
          compareHeaders,
          enabledSubTests: new Set<string>(),
          logExecution,
          logBrowser: (type: string, text: string, url: string) => browserLogs.push({ timestamp: new Date().toISOString(), type, text, url }),
          logNetwork: (url: string, status: number, statusText: string, error?: string) =>
            networkLogs.push({ timestamp: new Date().toISOString(), url, status, statusText, error }),
          // Add viewport and hidden component options
          testDesktop: params.testDesktop !== false,
          testTablet: params.testTablet !== false,
          testMobile: params.testMobile !== false,
          hiddenComponentOption: params.hiddenComponentOption || 'avoid',
          checkLevel: params.checkLevel || 'micro'
        } as any;

        await runPluginsForPage(context);

        activeJob.progress = Math.round(((i + 1) / targetRelativePaths.length) * 100);
        activeJob.resultsCount = allResults.length;
      }
    } finally {
      await browser.close().catch(() => undefined);
    }

    await compileAndSaveReport({
      lowerSitemap: lowerWebpage,
      compareSitemap: compareWebpage,
      pagesChecked: targetRelativePaths.length,
      targetRelativePaths
    });
    }

    else if (params.runMode === 'file-upload') {
    const lowerUrls = params.lowerUrls as string[];
    const productionUrls = params.productionUrls as string[];

    logExecution(`File-upload mode: ${lowerUrls.length} lower environment URLs`);
    logExecution(`File-upload mode: ${productionUrls.length} production environment URLs`);

    // Build maps of pathname -> URL
    const lowerUrlMap = new Map<string, string>();
    const productionUrlMap = new Map<string, string>();

    lowerUrls.forEach(url => {
      const pathname = new URL(url).pathname;
      lowerUrlMap.set(pathname, url);
    });

    productionUrls.forEach(url => {
      const pathname = new URL(url).pathname;
      productionUrlMap.set(pathname, url);
    });

    // Find matched paths
    const matchedPaths: string[] = [];
    const lowerOnly: string[] = [];
    const productionOnly: string[] = [];

    Array.from(lowerUrlMap.keys()).forEach(path => {
      if (productionUrlMap.has(path)) {
        matchedPaths.push(path);
      } else {
        lowerOnly.push(path);
      }
    });

    Array.from(productionUrlMap.keys()).forEach(path => {
      if (!lowerUrlMap.has(path)) {
        productionOnly.push(path);
      }
    });

    logExecution(
      `File URL matching: matched=${matchedPaths.length}, lowerOnly=${lowerOnly.length}, productionOnly=${productionOnly.length}`
    );

    if (lowerOnly.length > 0 || productionOnly.length > 0) {
      activeJob.errors.push(
        'File URL path mismatch found (non-fatal). ' +
        `Lower-only: ${lowerOnly.slice(0, 10).join(', ')}${lowerOnly.length > 10 ? '...' : ''}. ` +
        `Production-only: ${productionOnly.slice(0, 10).join(', ')}${productionOnly.length > 10 ? '...' : ''}.`
      );
    }

    let targetRelativePaths = matchedPaths;

    if (params.limitedPages) {
      targetRelativePaths = targetRelativePaths.slice(0, params.pagesCount);
      logExecution(`Limiting check to first ${params.pagesCount} URLs.`);
    }

    activeJob.total = targetRelativePaths.length;
    if (activeJob.total === 0) {
      logExecution('Zero matched URLs for validation. Completing dry-run.');
      activeJob.status = 'completed';
      activeJob.progress = 100;
      return;
    }

    logExecution('Launching Playwright Chromium browser instances...');
    const browser = await chromium.launch({ headless: true });
    try {
      const lowerContext = await browser.newContext();
      const compareContext = await browser.newContext();

      const lowerPage = await lowerContext.newPage();
      const comparePage = await compareContext.newPage();

      lowerPage.on('console', msg => {
        browserLogs.push({ timestamp: new Date().toISOString(), type: msg.type(), text: msg.text(), url: lowerPage.url() });
        if (msg.type() === 'error') logExecution(`[Browser Console Error] ${msg.text()}`);
      });

      lowerPage.on('requestfailed', request => {
        const failure = request.failure();
        networkLogs.push({
          timestamp: new Date().toISOString(),
          url: request.url(),
          status: 0,
          statusText: 'Failed',
          error: failure?.errorText || 'Failed request'
        });
        logExecution(`[Network Request Failed] ${request.url()} - ${failure?.errorText}`);
      });

      for (let i = 0; i < targetRelativePaths.length; i++) {
        const relPath = targetRelativePaths[i];
        const lowerUrl = lowerUrlMap.get(relPath)!;
        const compareUrl = productionUrlMap.get(relPath)!;

        activeJob.currentUrl = relPath;
        logExecution(`Validating page [${i + 1}/${targetRelativePaths.length}]: ${relPath}`);

        let lowerHeaders: Record<string, string> = {};
        let compareHeaders: Record<string, string> = {};

        try {
          logExecution(`Navigating Lower: ${lowerUrl}`);
          const res = await lowerPage.goto(lowerUrl, { waitUntil: 'load', timeout: 25000 });
          lowerHeaders = res ? res.headers() : {};
          // Wait for network idle to ensure all JavaScript has executed and DOM is fully rendered
          await lowerPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        } catch (e: any) {
          const msg = e?.message || String(e);
          logExecution(`Failed to navigate Lower page ${lowerUrl}: ${msg}`);
          errorLogs.push(`Navigation failed for Lower: ${lowerUrl} - ${msg}`);
        }

        try {
          logExecution(`Navigating Production: ${compareUrl}`);
          const res = await comparePage.goto(compareUrl, { waitUntil: 'load', timeout: 25000 });
          compareHeaders = res ? res.headers() : {};
          // Wait for network idle to ensure all JavaScript has executed and DOM is fully rendered
          await comparePage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        } catch (e: any) {
          const msg = e?.message || String(e);
          logExecution(`Failed to navigate Production page ${compareUrl}: ${msg}`);
          errorLogs.push(`Navigation failed for Production: ${compareUrl} - ${msg}`);
        }

        const context: ValidationContext = {
          relativeUrl: relPath,
          lowerUrl,
          compareUrl,
          lowerPage,
          comparePage,
          lowerHeaders,
          compareHeaders,
          enabledSubTests: new Set<string>(),
          logExecution,
          logBrowser: (type: string, text: string, url: string) => browserLogs.push({ timestamp: new Date().toISOString(), type, text, url }),
          logNetwork: (url: string, status: number, statusText: string, error?: string) =>
            networkLogs.push({ timestamp: new Date().toISOString(), url, status, statusText, error }),
          // Add viewport and hidden component options
          testDesktop: params.testDesktop !== false,
          testTablet: params.testTablet !== false,
          testMobile: params.testMobile !== false,
          hiddenComponentOption: params.hiddenComponentOption || 'avoid',
          checkLevel: params.checkLevel || 'micro'
        } as any;

        await runPluginsForPage(context);

        activeJob.progress = Math.round(((i + 1) / targetRelativePaths.length) * 100);
        activeJob.resultsCount = allResults.length;
      }
    } finally {
      await browser.close().catch(() => undefined);
    }

    await compileAndSaveReport({
      lowerSitemap: lowerUrls[0] || 'file-upload',
      compareSitemap: productionUrls[0] || 'file-upload',
      pagesChecked: targetRelativePaths.length,
      targetRelativePaths
    });
    }
  }
}

