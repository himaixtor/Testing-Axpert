import { Page } from 'playwright';
import { TestResult, BrowserLog, NetworkLog } from '../storage/reportRepository';

export interface ValidationContext {
  relativeUrl: string;
  lowerUrl: string;
  compareUrl: string;
  lowerPage: Page;
  comparePage: Page;
  lowerHeaders: Record<string, string>;
  compareHeaders: Record<string, string>;
  enabledSubTests: Set<string>;
  logExecution: (msg: string) => void;
  logBrowser: (type: string, text: string, url: string) => void;
  logNetwork: (url: string, status: number, statusText: string, error?: string) => void;
}

export interface ValidationPlugin {
  id: string;
  name: string;
  execute(context: ValidationContext): Promise<TestResult[]>;
}
