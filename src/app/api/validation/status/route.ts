import { NextResponse } from 'next/server';
import { ValidationEngine } from '@/lib/validation/engine';

export async function GET() {
  try {
    const status = ValidationEngine.getActiveJobStatus();
    
    // Calculate live duration if running
    let liveDurationMs = status.durationMs;
    if (status.status === 'running' && status.startTime > 0) {
      liveDurationMs = Date.now() - status.startTime;
    }

    return NextResponse.json({
      ...status,
      durationMs: liveDurationMs
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}
