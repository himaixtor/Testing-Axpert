import { NextResponse } from 'next/server';
import { ConfigRepository } from '@/lib/storage/configRepository';

export async function GET() {
  try {
    const config = ConfigRepository.getConfig();
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === 'toggleSubTest') {
      const { categoryId, subTestId, enabled } = body;
      const config = ConfigRepository.toggleSubTest(categoryId, subTestId, enabled);
      return NextResponse.json(config);
    } else if (body.action === 'toggleCategory') {
      const { categoryId, enabled } = body;
      const config = ConfigRepository.toggleCategory(categoryId, enabled);
      return NextResponse.json(config);
    } else if (body.categories) {
      // Overwrite config
      ConfigRepository.saveConfig(body);
      return NextResponse.json(body);
    }
    return NextResponse.json({ error: 'Invalid config command' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}
