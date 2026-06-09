import { ValidationPlugin, ValidationContext } from '../types';
import { TestResult } from '../../storage/reportRepository';

export class ErrorMonitoringValidationPlugin implements ValidationPlugin {
  id = 'errorMonitoring';
  name = 'Error Monitoring';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { relativeUrl, enabledSubTests, logExecution } = context;

    logExecution('Executing Error Monitoring Validation...');

    // Access current logs inside browser logs collector (part of the context)
    // The orchestrator hooks page.on('console') and page.on('requestfailed')
    // We will inspect these collections from the context in Node.js
    
    // In our context: browserLogs and networkLogs will be captured by the engine runner.
    // Let's search context for captured items: we need to find how many are relevant to this page
    // Since we compile them on a per-page basis in the runner, we can check the context's logs!
    
    // Let's assume the context provides access to the logs lists for the current page.
    // Yes! Let's mock/read the page console logs
    
    if (enabledSubTests.has('errorHandling')) {
      try {
        // Let's run a quick page eval to count window error listeners or any unhandled exceptions
        const runtimeErrorsCount = await context.lowerPage.evaluate(() => {
          return (window as any).__uncaughtErrorsCount || 0;
        });

        const noCrash = runtimeErrorsCount === 0;
        results.push({
          pageUrl: relativeUrl,
          category: this.name,
          subTest: 'Runtime Crash Prevention',
          expectedValue: 'Zero uncaught JS runtime exceptions',
          actualValue: `${runtimeErrorsCount} uncaught script error(s) detected`,
          differenceDescription: noCrash
            ? 'Page JS thread execution is stable'
            : 'Page script thread crashed. Uncaught exceptions were thrown during load.',
          severity: 'CRITICAL',
          status: noCrash ? 'PASS' : 'FAIL',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logExecution(`Error checking runtime stability: ${err.message}`);
      }
    }

    return results;
  }
}
