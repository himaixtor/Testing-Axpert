import fs from 'fs';
import path from 'path';

export interface TestResult {
  pageUrl: string;
  category: string;
  subTest: string;
  expectedValue: string;
  actualValue: string;
  differenceDescription: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PASS' | 'WARNING' | 'FAIL';
  timestamp: string;
  elementSelector?: string;  // CSS selector for the element being tested
  elementId?: string;        // HTML element ID if available
  elementClass?: string;     // HTML element class if available
  elementTag?: string;       // HTML tag name (e.g., 'div', 'button', 'span')
}

export interface BrowserLog {
  timestamp: string;
  type: string;
  text: string;
  url: string;
}

export interface NetworkLog {
  timestamp: string;
  url: string;
  status: number;
  statusText: string;
  error?: string;
}

export interface RunLogs {
  execution: string[];
  browser: BrowserLog[];
  network: NetworkLog[];
  error: string[];
}

export interface ReportSummary {
  id: string;
  timestamp: string;
  lowerSitemap: string;
  compareSitemap: string;
  pagesChecked: number;
  durationMs: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    total: number;
  };
  categoryBreakdown: Record<string, {
    passed: number;
    failed: number;
    warnings: number;
    total: number;
  }>;
}

export interface DetailedReport extends ReportSummary {
  results: TestResult[];
  logs: RunLogs;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const INDEX_PATH = path.join(DATA_DIR, 'reports_index.json');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

export class ReportRepository {
  static getIndex(): ReportSummary[] {
    ensureDirs();
    if (!fs.existsSync(INDEX_PATH)) {
      this.saveIndex([]);
      return [];
    }

    try {
      const content = fs.readFileSync(INDEX_PATH, 'utf-8');
      return JSON.parse(content) as ReportSummary[];
    } catch (error) {
      console.error('Failed to parse reports index:', error);
      return [];
    }
  }

  static saveIndex(index: ReportSummary[]): void {
    ensureDirs();
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
  }

  static getReport(id: string): DetailedReport | null {
    ensureDirs();
    const filePath = path.join(REPORTS_DIR, `report_${id}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as DetailedReport;
    } catch (error) {
      console.error(`Failed to read report ${id}:`, error);
      return null;
    }
  }

  static saveReport(report: DetailedReport): void {
    ensureDirs();
    
    // Save detailed report
    const filePath = path.join(REPORTS_DIR, `report_${report.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');

    // Update index
    const index = this.getIndex();
    const summary: ReportSummary = {
      id: report.id,
      timestamp: report.timestamp,
      lowerSitemap: report.lowerSitemap,
      compareSitemap: report.compareSitemap,
      pagesChecked: report.pagesChecked,
      durationMs: report.durationMs,
      status: report.status,
      summary: report.summary,
      categoryBreakdown: report.categoryBreakdown
    };

    const existingIndex = index.findIndex(r => r.id === report.id);
    if (existingIndex >= 0) {
      index[existingIndex] = summary;
    } else {
      index.unshift(summary); // Add to the top (newest first)
    }

    this.saveIndex(index);
  }

  static deleteReport(id: string): boolean {
    ensureDirs();
    const filePath = path.join(REPORTS_DIR, `report_${id}.json`);
    let deletedDetail = false;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deletedDetail = true;
    }

    const index = this.getIndex();
    const filteredIndex = index.filter(r => r.id !== id);
    if (filteredIndex.length !== index.length) {
      this.saveIndex(filteredIndex);
      return true;
    }

    return deletedDetail;
  }
}
