const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 400, height: 670 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/voice-demo', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal, [data-nextjs-toast-wrapper], button[data-nextjs-dev-tools-button]').forEach(el => el.remove());
  });
  const voiceCard = page.locator('#voice-widget-card');
  await voiceCard.screenshot({ path: 'public/product-hunt-assets/real_voice_widget.png' });
  await browser.close();
  console.log('Saved pristine real_voice_widget.png');
})();
