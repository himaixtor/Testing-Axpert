import ExcelJS from 'exceljs';
import { DetailedReport } from '../storage/reportRepository';

export class ReportExporter {
  static async exportToExcel(report: DetailedReport): Promise<Buffer> {

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Website Migration Validation Platform';
    workbook.lastModifiedBy = 'Validation Engine';
    workbook.created = new Date();
    workbook.modified = new Date();

    // 1. Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.views = [{ showGridLines: true }];

    summarySheet.addRow(['MIGRATION VALIDATION RUN SUMMARY']).font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800
    };
    summarySheet.addRow([]);

    summarySheet.addRow(['Run ID', report.id]);
    summarySheet.addRow(['Timestamp', report.timestamp]);
    summarySheet.addRow(['UAT (Lower) Sitemap', report.lowerSitemap]);
    summarySheet.addRow(['Production Sitemap', report.compareSitemap]);
    summarySheet.addRow(['Pages Checked', report.pagesChecked]);
    summarySheet.addRow(['Execution Duration', `${(report.durationMs / 1000).toFixed(2)}s`]);
    summarySheet.addRow(['Overall Status', report.status]);
    summarySheet.addRow([]);

    summarySheet.addRow(['Test Category Breakdown']).font = { bold: true, size: 12 };
    const breakdownHeader = summarySheet.addRow(['Category ID', 'Passed', 'Warnings', 'Failed', 'Total']);
    breakdownHeader.font = { bold: true };
    breakdownHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' } // Slate 200
    };

    Object.entries(report.categoryBreakdown).forEach(([catId, stats]) => {
      summarySheet.addRow([catId, stats.passed, stats.warnings, stats.failed, stats.total]);
    });

    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 45;
    summarySheet.getColumn(3).width = 15;
    summarySheet.getColumn(4).width = 15;
    summarySheet.getColumn(5).width = 15;

    // Add border to summary details
    for (let r = 3; r <= 9; r++) {
      summarySheet.getCell(`A${r}`).font = { bold: true };
      summarySheet.getCell(`B${r}`).alignment = { horizontal: 'left' };
    }

    const statusCell = summarySheet.getCell('B9');
    if (report.status === 'FAIL') {
      statusCell.font = { color: { argb: 'FFEF4444' }, bold: true }; // Red
    } else if (report.status === 'WARNING') {
      statusCell.font = { color: { argb: 'FFF59E0B' }, bold: true }; // Orange
    } else {
      statusCell.font = { color: { argb: 'FF10B981' }, bold: true }; // Green
    }

    // 2. Details Sheet
    const detailsSheet = workbook.addWorksheet('Validation Details');
    detailsSheet.views = [{ showGridLines: true }];

    const headerRow = detailsSheet.addRow([
      'Page URL',
      'Element ID',
      'Element Class',
      'Element Tag',
      'Element Selector',
      'Test Category',
      'Sub-Test',
      'Expected Value',
      'Actual Value',
      'Difference Description',
      'Severity',
      'Status',
      'Timestamp'
    ]);

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Slate 900
    };

    report.results.forEach(res => {
      const row = detailsSheet.addRow([
        res.pageUrl,
        res.elementId || 'N/A',
        res.elementClass || 'N/A',
        res.elementTag || 'N/A',
        res.elementSelector || 'N/A',
        res.category,
        res.subTest,
        res.expectedValue,
        res.actualValue,
        res.differenceDescription,
        res.severity,
        res.status,
        res.timestamp
      ]);

      // Highlight row according to status
      const statusCell = row.getCell(8);
      if (res.status === 'FAIL') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEEF2F3' } // Light grayish red
        };
        statusCell.font = { color: { argb: 'FFDC2626' }, bold: true }; // Red
      } else if (res.status === 'WARNING') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFBEB' } // Light yellow
        };
        statusCell.font = { color: { argb: 'FFD97706' }, bold: true }; // Amber
      } else {
        statusCell.font = { color: { argb: 'FF059669' } }; // Green
      }

      // Highlight severity
      const sevCell = row.getCell(7);
      if (res.severity === 'CRITICAL') {
        sevCell.font = { bold: true, color: { argb: 'FF7F1D1D' } };
      } else if (res.severity === 'HIGH') {
        sevCell.font = { bold: true, color: { argb: 'FFB91C1C' } };
      }
    });

    // Auto-fit columns
    detailsSheet.columns.forEach(column => {
      let maxLen = 0;
      column.eachCell?.({ includeEmpty: true }, cell => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > maxLen) maxLen = len;
      });
      column.width = Math.min(Math.max(maxLen + 3, 10), 60);
    });

    // exceljs typings for writeBuffer are sometimes incompatible with Node's Buffer type.
    // The value returned is a Uint8Array/Buffer-like payload; returning as Buffer works at runtime.
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as unknown as Uint8Array);
  }


  static exportToCsv(report: DetailedReport): string {
    const headers = [
      'Page URL',
      'Element ID',
      'Element Class',
      'Element Tag',
      'Element Selector',
      'Test Category',
      'Sub-Test',
      'Expected Value',
      'Actual Value',
      'Difference Description',
      'Severity',
      'Status',
      'Timestamp'
    ];

    const escapeCsv = (val: string | undefined) => {
      if (val === null || val === undefined) return '';
      const str = val.toString().replace(/"/g, '""');
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    };

    const lines = [headers.map(escapeCsv).join(',')];

    report.results.forEach(res => {
      const line = [
        res.pageUrl,
        res.elementId || 'N/A',
        res.elementClass || 'N/A',
        res.elementTag || 'N/A',
        res.elementSelector || 'N/A',
        res.category,
        res.subTest,
        res.expectedValue,
        res.actualValue,
        res.differenceDescription,
        res.severity,
        res.status,
        res.timestamp
      ];
      lines.push(line.map(escapeCsv).join(','));
    });

    return lines.join('\n');
  }

  static exportToXml(report: DetailedReport): string {
    const escapeXml = (unsafe: string) => {
      if (unsafe === null || unsafe === undefined) return '';
      return unsafe.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<validationReport>\n';
    xml += `  <reportId>${escapeXml(report.id)}</reportId>\n`;
    xml += `  <timestamp>${escapeXml(report.timestamp)}</timestamp>\n`;
    xml += `  <lowerSitemap>${escapeXml(report.lowerSitemap)}</lowerSitemap>\n`;
    xml += `  <compareSitemap>${escapeXml(report.compareSitemap)}</compareSitemap>\n`;
    xml += `  <pagesChecked>${report.pagesChecked}</pagesChecked>\n`;
    xml += `  <durationSeconds>${(report.durationMs / 1000).toFixed(2)}</durationSeconds>\n`;
    xml += `  <status>${escapeXml(report.status)}</status>\n`;
    
    xml += '  <summary>\n';
    xml += `    <passed>${report.summary.passed}</passed>\n`;
    xml += `    <failed>${report.summary.failed}</failed>\n`;
    xml += `    <warnings>${report.summary.warnings}</warnings>\n`;
    xml += `    <total>${report.summary.total}</total>\n`;
    xml += '  </summary>\n';

    xml += '  <results>\n';
    report.results.forEach(res => {
      xml += '    <result>\n';
      xml += `      <pageUrl>${escapeXml(res.pageUrl)}</pageUrl>\n`;
      xml += `      <category>${escapeXml(res.category)}</category>\n`;
      xml += `      <subTest>${escapeXml(res.subTest)}</subTest>\n`;
      xml += `      <expectedValue>${escapeXml(res.expectedValue)}</expectedValue>\n`;
      xml += `      <actualValue>${escapeXml(res.actualValue)}</actualValue>\n`;
      xml += `      <differenceDescription>${escapeXml(res.differenceDescription)}</differenceDescription>\n`;
      xml += `      <severity>${escapeXml(res.severity)}</severity>\n`;
      xml += `      <status>${escapeXml(res.status)}</status>\n`;
      xml += `      <timestamp>${escapeXml(res.timestamp)}</timestamp>\n`;
      xml += '    </result>\n';
    });
    xml += '  </results>\n';
    xml += '</validationReport>\n';

    return xml;
  }
}
