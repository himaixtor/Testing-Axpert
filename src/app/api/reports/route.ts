import { NextResponse } from 'next/server';
import { ReportRepository } from '@/lib/storage/reportRepository';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const report = ReportRepository.getReport(id);
      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }
      return NextResponse.json(report);
    }

    const index = ReportRepository.getIndex();
    return NextResponse.json(index);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing report id parameter' }, { status: 400 });
    }

    const success = ReportRepository.deleteReport(id);
    if (!success) {
      return NextResponse.json({ error: 'Report not found or could not delete' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}
