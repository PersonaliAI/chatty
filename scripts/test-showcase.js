const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:3000/ph-showcase', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'public/product-hunt-assets/showcase_overview.png' });
  await browser.close();
  console.log('Saved showcase_overview.png');
})();
