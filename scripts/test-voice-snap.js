const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 390, height: 640 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/voice-demo', { timeout: 30000 });
  await page.waitForTimeout(2000);
  const voiceCard = page.locator('#voice-widget-card');
  await voiceCard.screenshot({ path: 'public/product-hunt-assets/real_voice_widget.png' });
  await browser.close();
  console.log('Captured new real_voice_widget.png');
})();
