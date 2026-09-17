const { chromium } = require('playwright');

async function testProd() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  
  await page.goto('https://chatty.personaliai.com');
  await page.waitForTimeout(5000);
  
  const hostFound = await page.evaluate(() => !!document.getElementById('chatty-widget-host'));
  console.log('Host found with stealth:', hostFound);
  
  if (hostFound) {
    // Open widget
    await page.evaluate(() => window.Chatty && window.Chatty.open());
    await page.waitForTimeout(1500);
    
    // Switch to Messages tab and ask for demo
    const msgResult = await page.evaluate(async () => {
      const host = document.getElementById('chatty-widget-host');
      const root = host.shadowRoot;
      // Click messages tab or ask assistant
      const askBtn = Array.from(root.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Ask AI'));
      if (askBtn) askBtn.click();
      return { clickedAsk: !!askBtn };
    });
    console.log('Clicked ask:', msgResult);
    await page.waitForTimeout(1500);
    
    // Type "Can I book a demo?"
    await page.evaluate(() => {
      const host = document.getElementById('chatty-widget-host');
      const root = host.shadowRoot;
      const input = root.querySelector('input[type="text"]');
      if (input) {
        input.value = 'Can I book a demo?';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const form = input.closest('form');
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    });
    console.log('Sent demo message, waiting for bot response...');
    await page.waitForTimeout(6000);
    
    // Check timezone button inside shadow DOM
    const tzState = await page.evaluate(() => {
      const host = document.getElementById('chatty-widget-host');
      const root = host.shadowRoot;
      const tzBtn = root.querySelector('button[title*="timezone"]');
      return {
        hasTzBtn: !!tzBtn,
        text: tzBtn ? tzBtn.innerText : null
      };
    });
    console.log('Timezone button in shadow DOM:', tzState);
    
    // Click timezone button to open dropdown
    const dropdownOpened = await page.evaluate(() => {
      const host = document.getElementById('chatty-widget-host');
      const root = host.shadowRoot;
      const tzBtn = root.querySelector('button[title*="timezone"]');
      if (tzBtn) {
        tzBtn.click();
        return true;
      }
      return false;
    });
    await page.waitForTimeout(1000);
    
    // Check if dropdown is visible inside shadow DOM
    const dropdownState = await page.evaluate(() => {
      const host = document.getElementById('chatty-widget-host');
      const root = host.shadowRoot;
      const input = root.querySelector('input[placeholder*="Search city"]');
      const tzItems = Array.from(root.querySelectorAll('button')).filter(b => b.innerText && (b.innerText.includes('New York') || b.innerText.includes('Eastern Time')));
      return {
        hasSearch: !!input,
        nyItemCount: tzItems.length
      };
    });
    console.log('Dropdown state before click:', dropdownState);
    
    // Now click the New York option!
    const clickResult = await page.evaluate(() => {
      const host = document.getElementById('chatty-widget-host');
      const root = host.shadowRoot;
      const tzItems = Array.from(root.querySelectorAll('button')).filter(b => b.innerText && b.innerText.includes('New York'));
      if (tzItems.length > 0) {
        tzItems[0].click();
        return { clicked: true, itemText: tzItems[0].innerText };
      }
      return { clicked: false };
    });
    console.log('Clicked NY option:', clickResult);
    await page.waitForTimeout(2000);
    
    // Check if timezone button updated!
    const afterClickState = await page.evaluate(() => {
      const host = document.getElementById('chatty-widget-host');
      const root = host.shadowRoot;
      const tzBtn = root.querySelector('button[title*="timezone"]');
      const slotsLabel = Array.from(root.querySelectorAll('*')).find(el => el.innerText && el.innerText.startsWith('Available Slots'));
      return {
        tzBtnText: tzBtn ? tzBtn.innerText : null,
        slotsLabel: slotsLabel ? slotsLabel.innerText : null
      };
    });
    console.log('After click state:', afterClickState);
  }
  
  await browser.close();
}

testProd().catch(console.error);
