const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 450, height: 700 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/embed/c8fa19c8-dd25-43a3-9c55-e8099e6f532e', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByText('Send us a message').click();
  await page.waitForTimeout(1000);
  const input = page.locator('input[placeholder*="Compose your message"]');
  await input.fill('Hi! What are your pricing plans?');
  await input.press('Enter');
  console.log('Message sent. Waiting for AI response...');
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'public/product-hunt-assets/chat_real_ai_reply.png' });
  await browser.close();
  console.log('Saved chat_real_ai_reply.png');
})();
