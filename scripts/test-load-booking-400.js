const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 400, height: 670 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/embed/ad32f373-7694-43f4-9465-f8d65ce291e3?tab=messages', { timeout: 45000 });
  await page.waitForTimeout(1500);
  
  const hideDevBadges = async () => {
    await page.evaluate(() => {
      document.querySelectorAll('nextjs-portal, [data-nextjs-toast-wrapper], button[data-nextjs-dev-tools-button]').forEach(el => el.remove());
    });
  };

  const input = page.locator('input[placeholder*="Compose your message"]');
  await input.fill('I would like to schedule a demo call with your team');
  await input.press('Enter');

  console.log('Waiting for booking slots to appear...');
  try {
    await page.waitForSelector('button:has-text("10:00 AM")', { timeout: 25000 });
  } catch (e) {
    console.log('Timeout waiting for 10:00 AM, waiting 5s more...');
    await page.waitForTimeout(5000);
  }
  await hideDevBadges();
  await page.screenshot({ path: 'public/product-hunt-assets/chatty_booking_card_loaded.png' });
  console.log('Saved loaded booking card!');
  await browser.close();
})();
