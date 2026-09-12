const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 450, height: 700 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/embed/ad32f373-7694-43f4-9465-f8d65ce291e3?tab=messages', { timeout: 30000 });
  await page.waitForTimeout(1000);
  const input = page.locator('input[placeholder*="Compose your message"]');
  await input.fill('I would like to schedule a demo call with your team');
  await input.press('Enter');
  console.log('Asked for schedule demo. Waiting 15s...');
  await page.waitForTimeout(15000);
  await page.screenshot({ path: 'public/product-hunt-assets/chatty_booking_response.png' });
  await browser.close();
  console.log('Saved chatty_booking_response.png');
})();
