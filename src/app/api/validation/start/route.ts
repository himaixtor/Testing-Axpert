import { NextResponse } from 'next/server';
import { ValidationEngine } from '@/lib/validation/engine';

async function parseFileContent(file: File): Promise<string[]> {
  const text = await file.text();
  return text
    .split(/[\n\r]+/)
    .map(line => line.trim())
    .filter(line => line && (line.startsWith('http://') || line.startsWith('https://')));
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type');

    if (contentType?.includes('multipart/form-data')) {
      // File upload mode
      const formData = await request.formData();
      const runMode = formData.get('runMode') as string;
      const lowerEnvFile = formData.get('lowerEnvFile') as File;
      const productionEnvFile = formData.get('productionEnvFile') as File;
      const limitedPages = formData.get('limitedPages') === 'true';
      const pagesCount = Number(formData.get('pagesCount')) || 5;
      const selectedCategoryIds = JSON.parse(formData.get('selectedCategoryIds') as string);

      if (!runMode || runMode !== 'file-upload') {
        return NextResponse.json({ error: 'Invalid runMode for file upload' }, { status: 400 });
      }

      if (!lowerEnvFile || !productionEnvFile) {
        return NextResponse.json({ error: 'Both environment files are required' }, { status: 400 });
      }

      if (!selectedCategoryIds || !Array.isArray(selectedCategoryIds) || selectedCategoryIds.length === 0) {
        return NextResponse.json({ error: 'At least one test category must be selected' }, { status: 400 });
      }

      const testDesktop = formData.get('testDesktop') === 'true';
      const testTablet = formData.get('testTablet') === 'true';
      const testMobile = formData.get('testMobile') === 'true';
      const hiddenComponentOption = (formData.get('hiddenComponentOption') as string) || 'avoid';
      const checkLevel = (formData.get('checkLevel') as string) || 'micro';

      const lowerUrls = await parseFileContent(lowerEnvFile);
      const productionUrls = await parseFileContent(productionEnvFile);

      if (lowerUrls.length === 0 || productionUrls.length === 0) {
        return NextResponse.json({ error: 'No valid URLs found in uploaded files' }, { status: 400 });
      }

      // Validate that both files have matching relative paths
      const lowerPaths = lowerUrls.map(url => new URL(url).pathname);
      const productionPaths = productionUrls.map(url => new URL(url).pathname);

      // Check if relative paths match (should have same paths but different domains)
      const unmatchedPaths = lowerPaths.filter(path => !productionPaths.includes(path));
      if (unmatchedPaths.length > 0) {
        return NextResponse.json({ error: `URLs paths do not match. Unmatched paths: ${unmatchedPaths.join(', ')}` }, { status: 400 });
      }

      const runId = await ValidationEngine.runValidation({
        runMode: 'file-upload',
        lowerUrls,
        productionUrls,
        limitedPages,
        pagesCount,
        selectedCategoryIds,
        testDesktop,
        testTablet,
        testMobile,
        hiddenComponentOption,
        checkLevel
      } as any);

      return NextResponse.json({ success: true, runId });
    } else {
      // JSON mode (sitemap or webpage)
      const body = await request.json();
      const {
        runMode,
        lowerSitemap,
        compareSitemap,
        lowerWebpage,
        compareWebpage,
        limitedPages,
        pagesCount,
        selectedCategoryIds,
        testDesktop = true,
        testTablet = true,
        testMobile = true,
        hiddenComponentOption = 'avoid',
        checkLevel = 'micro'
      } = body;

      if (!runMode) {
        return NextResponse.json({ error: 'Missing runMode parameter' }, { status: 400 });
      }

      if (runMode === 'sitemap') {
        if (!lowerSitemap || !compareSitemap) {
          return NextResponse.json({ error: 'Missing lowerSitemap or compareSitemap parameters for sitemap mode' }, { status: 400 });
        }
      }

      if (runMode === 'webpage') {
        if (!lowerWebpage || !compareWebpage) {
          return NextResponse.json({ error: 'Missing lowerWebpage or compareWebpage parameters for webpage mode' }, { status: 400 });
        }
      }

      if (!selectedCategoryIds || !Array.isArray(selectedCategoryIds) || selectedCategoryIds.length === 0) {
        return NextResponse.json({ error: 'At least one test category must be selected' }, { status: 400 });
      }

      const runId = await ValidationEngine.runValidation({
        runMode,
        lowerSitemap,
        compareSitemap,
        lowerWebpage,
        compareWebpage,
        limitedPages: !!limitedPages,
        pagesCount: Number(pagesCount) || 5,
        selectedCategoryIds,
        testDesktop,
        testTablet,
        testMobile,
        hiddenComponentOption,
        checkLevel
      } as any);

      return NextResponse.json({ success: true, runId });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}
