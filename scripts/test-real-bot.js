const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 450, height: 700 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/embed/ad32f373-7694-43f4-9465-f8d65ce291e3', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'public/product-hunt-assets/chatty_home_tab.png' });
  await page.getByText('Send us a message').click();
  await page.waitForTimeout(1000);
  const input = page.locator('input[placeholder*="Compose your message"]');
  await input.fill('What does Chatty do?');
  await input.press('Enter');
  console.log('Sent question to real bot. Waiting for streaming response...');
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'public/product-hunt-assets/chatty_real_response.png' });
  await browser.close();
  console.log('Finished real bot test');
})();
