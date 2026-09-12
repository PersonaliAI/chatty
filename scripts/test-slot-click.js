const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 450, height: 750 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/embed/ad32f373-7694-43f4-9465-f8d65ce291e3?tab=messages', { timeout: 30000 });
  await page.waitForTimeout(1000);
  const input = page.locator('input[placeholder*="Compose your message"]');
  await input.fill('I would like to schedule a demo call with your team');
  await input.press('Enter');
  await page.waitForTimeout(18000);
  // Click 10:00 AM slot
  const slotBtn = page.getByRole('button', { name: '10:00 AM' }).first();
  await slotBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'public/product-hunt-assets/chatty_slot_selected_form.png' });
  await browser.close();
  console.log('Saved chatty_slot_selected_form.png');
})();
