import { execSync } from 'child_process';

function getChromiumExecutable(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  try {
    return execSync('which chromium').toString().trim();
  } catch {
    try {
      return execSync('which chromium-browser').toString().trim();
    } catch {
      return '/run/current-system/sw/bin/chromium';
    }
  }
}

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const alreadyWrapped = html.trimStart().startsWith('<!DOCTYPE') || html.trimStart().startsWith('<html');

  const fullHtml = alreadyWrapped ? html : `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.6; font-size: 13px; }
  h1 { font-size: 18px; }
  h2 { font-size: 15px; }
  h3 { font-size: 13px; }
  p { margin: 6px 0; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 4px 8px; }
</style>
</head>
<body>${html}</body>
</html>`;

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: getChromiumExecutable(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
    await page.waitForNetworkIdle({ concurrency: 0, idleTime: 500 });
    const pdfBuffer = Buffer.from(await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    }));
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
