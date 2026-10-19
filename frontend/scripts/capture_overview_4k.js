const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function capture() {
  console.log('Launching headless Chromium at 3840x2160 (1920x1080 @ 2x Retina)...');
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  console.log('Navigating to login page...');
  await page.goto('https://chatty.personaliai.com/login', { waitUntil: 'networkidle', timeout: 45000 });

  console.log('Entering credentials for katdamayantha@gmail.com...');
  await page.fill('#email', 'katdamayantha@gmail.com');
  await page.fill('#password', 'Abc@123A');

  console.log('Submitting login form...');
  await Promise.all([
    page.waitForURL(/.*dashboard.*/, { timeout: 30000 }).catch(() => console.log('waitForURL completed or redirected')),
    page.click('button[type="submit"]'),
  ]);

  await page.waitForTimeout(3000);
  console.log('Current URL after submit:', page.url());

  if (!page.url().includes('/dashboard')) {
    console.log('Navigating to /dashboard explicitly...');
    await page.goto('https://chatty.personaliai.com/dashboard', { waitUntil: 'networkidle', timeout: 45000 });
  }

  console.log('Waiting for dashboard networkidle...');
  await page.waitForLoadState('networkidle');

  // Ensure Overview tab is clicked/active
  try {
    const overviewBtn = await page.waitForSelector('text=Overview', { timeout: 10000 });
    if (overviewBtn) {
      await overviewBtn.click();
    }
  } catch (e) {
    console.log('Overview selector notice:', e.message);
  }

  // Wait for RECENT FEEDBACK or welcome banner
  try {
    await page.waitForSelector('text=RECENT FEEDBACK', { timeout: 20000 });
  } catch (e) {
    console.log('Recent feedback selector wait notice:', e.message);
  }

  // Generous pause so all charts, counters, badges, and avatars settle
  console.log('Waiting 8 seconds for all telemetry, charts, and animations to fully hydrate...');
  await page.waitForTimeout(8000);

  const outputPath = path.resolve(__dirname, '../../screenshots/real-01-overview.png');
  console.log('Writing screenshot to:', outputPath);
  await page.screenshot({ path: outputPath, fullPage: false });

  // Copy to brain artifacts folder for embedding in chat
  const artifactDir = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\bf4307fa-8172-4f0b-8fcd-81903842114b';
  if (fs.existsSync(artifactDir)) {
    const artifactPath = path.join(artifactDir, 'real-01-overview-captured.png');
    fs.copyFileSync(outputPath, artifactPath);
    console.log('Copied to artifact path:', artifactPath);
  }

  console.log('Screenshot capture complete!');
  await browser.close();
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
