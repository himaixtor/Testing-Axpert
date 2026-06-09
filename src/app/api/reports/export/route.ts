import { NextResponse } from 'next/server';
import { ReportRepository } from '@/lib/storage/reportRepository';
import { ReportExporter } from '@/lib/utils/exporters';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const format = searchParams.get('format')?.toLowerCase() || 'json';

    if (!id) {
      return NextResponse.json({ error: 'Missing report id parameter' }, { status: 400 });
    }

    const report = ReportRepository.getReport(id);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const filename = `validation_report_${id}`;

    switch (format) {
      case 'csv': {
        const csvString = ReportExporter.exportToCsv(report);
        return new Response(csvString, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}.csv"`
          }
        });
      }

      case 'xml': {
        const xmlString = ReportExporter.exportToXml(report);
        return new Response(xmlString, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}.xml"`
          }
        });
      }

      case 'excel':
      case 'xlsx': {
        const buffer = await ReportExporter.exportToExcel(report);
        return new Response(buffer as any, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}.xlsx"`
          }
        });
      }

      case 'json':
      default: {
        return new Response(JSON.stringify(report, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${filename}.json"`
          }
        });
      }
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}
