const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  const hideDevBadges = async (page) => {
    await page.addStyleTag({
      content: `
        nextjs-portal,
        [data-nextjs-toast-wrapper],
        #nextjs-toast-errors,
        div[data-nextjs-dev-overlay],
        button[data-nextjs-dev-tools-button],
        div[data-nextjs-dev-tools] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `
    });
    await page.evaluate(() => {
      document.querySelectorAll('nextjs-portal, [data-nextjs-toast-wrapper], button[data-nextjs-dev-tools-button]').forEach(el => el.remove());
    });
  };

  // 1. Capture Home Tab at exact 400x670
  console.log('1. Capturing Home Tab (400x670)...');
  const pageHome = await browser.newPage({ viewport: { width: 400, height: 670 }, deviceScaleFactor: 2 });
  await pageHome.goto('http://localhost:3000/embed/ad32f373-7694-43f4-9465-f8d65ce291e3?tab=home', { timeout: 30000 });
  await pageHome.waitForTimeout(3000);
  await hideDevBadges(pageHome);
  await pageHome.screenshot({ path: 'public/product-hunt-assets/chatty_home_tab.png' });
  await pageHome.close();

  // 2. Capture Chat Booking Card at exact 400x670
  console.log('2. Capturing In-Chat Booking Card (400x670)...');
  const pageBooking = await browser.newPage({ viewport: { width: 400, height: 670 }, deviceScaleFactor: 2 });
  await pageBooking.goto('http://localhost:3000/embed/ad32f373-7694-43f4-9465-f8d65ce291e3?tab=messages', { timeout: 30000 });
  await pageBooking.waitForTimeout(2000);
  await hideDevBadges(pageBooking);
  const input = pageBooking.locator('input[placeholder*="Compose your message"]');
  await input.fill('I would like to schedule a demo call with your team');
  await input.press('Enter');
  console.log('Waiting 18s for AI and booking card...');
  await pageBooking.waitForTimeout(18000);
  await hideDevBadges(pageBooking);
  await pageBooking.screenshot({ path: 'public/product-hunt-assets/chatty_booking_card_loaded.png' });

  // 3. Capture Selected Slot Attendee Form at exact 400x670
  console.log('3. Capturing Slot Selected Form (400x670)...');
  const slotBtn = pageBooking.getByRole('button', { name: '10:00 AM' }).first();
  if (await slotBtn.count() > 0) {
    await slotBtn.click();
    await pageBooking.waitForTimeout(1500);
    await hideDevBadges(pageBooking);
    await pageBooking.screenshot({ path: 'public/product-hunt-assets/chatty_slot_selected_form.png' });
  }
  await pageBooking.close();

  // 4. Capture Full Reply with Citations at exact 400x670
  console.log('4. Capturing Full Reply with Citations (400x670)...');
  const pageReply = await browser.newPage({ viewport: { width: 400, height: 670 }, deviceScaleFactor: 2 });
  await pageReply.goto('http://localhost:3000/embed/ad32f373-7694-43f4-9465-f8d65ce291e3?tab=messages', { timeout: 30000 });
  await pageReply.waitForTimeout(2000);
  await hideDevBadges(pageReply);
  const input2 = pageReply.locator('input[placeholder*="Compose your message"]');
  await input2.fill('What does Chatty do?');
  await input2.press('Enter');
  console.log('Waiting 16s for citation reply...');
  await pageReply.waitForTimeout(16000);
  await hideDevBadges(pageReply);
  await pageReply.screenshot({ path: 'public/product-hunt-assets/chatty_full_reply.png' });
  await pageReply.close();

  // 5. Capture Voice Widget Card at exact 400x670
  console.log('5. Capturing Real Voice Widget Card (400x670)...');
  const pageVoice = await browser.newPage({ viewport: { width: 400, height: 670 }, deviceScaleFactor: 2 });
  await pageVoice.goto('http://localhost:3000/voice-demo', { timeout: 30000 });
  await pageVoice.waitForTimeout(2500);
  await hideDevBadges(pageVoice);
  const voiceCard = pageVoice.locator('#voice-widget-card');
  await voiceCard.screenshot({ path: 'public/product-hunt-assets/real_voice_widget.png' });
  await pageVoice.close();

  await browser.close();
  console.log('All screenshots recaptured at exact 400x670 successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
