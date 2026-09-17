const { chromium } = require('playwright');

async function testTz() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  
  await page.goto('http://localhost:3000/embed/ad32f373-7694-43f4-9465-f8d65ce291e3?tab=messages');
  await page.waitForTimeout(2000);
  
  // Trigger booking by sending a message
  const input = await page.$('input[placeholder*="message"]');
  if (input) {
    await input.fill('Can I book a demo?');
    await page.keyboard.press('Enter');
    console.log('Sent demo booking request');
    await page.waitForTimeout(3000);
  }
  
  // Check if timezone button is present
  const tzBtn = await page.$('button[title*="timezone"]');
  if (!tzBtn) {
    console.log('No timezone button found!');
    await browser.close();
    return;
  }
  
  const initialText = await tzBtn.innerText();
  console.log('Initial Timezone Button Text:', initialText);
  
  // Click to open timezone dropdown
  await tzBtn.click();
  await page.waitForTimeout(500);
  
  // Check if dropdown is open
  const searchInput = await page.$('input[placeholder*="Search city or timezone"]');
  console.log('Search input present:', !!searchInput);
  
  if (searchInput) {
    await searchInput.fill('New York');
    await page.waitForTimeout(500);
    
    // Find New York button in dropdown
    const nyBtn = await page.$('button:has-text("New York")');
    console.log('New York button found:', !!nyBtn);
    if (nyBtn) {
      console.log('Clicking New York button...');
      await nyBtn.click();
      await page.waitForTimeout(1000);
      
      const newTzBtn = await page.$('button[title*="timezone"]');
      const newText = newTzBtn ? await newTzBtn.innerText() : 'NOT FOUND';
      console.log('After selection, Timezone Button Text:', newText);
      
      const availableLabel = await page.$('text=Available slots in');
      const labelText = availableLabel ? await availableLabel.innerText() : 'NOT FOUND';
      console.log('Available slots label:', labelText);
    }
  }
  
  await browser.close();
}

testTz().catch(console.error);
