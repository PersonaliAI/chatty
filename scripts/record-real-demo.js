const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function main() {
  const recDir = path.join(__dirname, '../public/product-hunt-assets/recordings');
  if (!fs.existsSync(recDir)) {
    fs.mkdirSync(recDir, { recursive: true });
  }

  // Clean old webms
  fs.readdirSync(recDir).forEach(f => {
    if (f.endsWith('.webm')) fs.unlinkSync(path.join(recDir, f));
  });

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: recDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  const stageUrl = 'file:///' + path.resolve(__dirname, '../public/product-hunt-assets/demo_stage.html').replace(/\\/g, '/');
  console.log('Opening demo stage:', stageUrl);
  await page.goto(stageUrl);

  console.log('Recording 20 seconds of real UI flow...');
  await page.waitForTimeout(20000);

  await page.close();
  await context.close();
  await browser.close();

  const files = fs.readdirSync(recDir).filter(f => f.endsWith('.webm'));
  if (files.length === 0) {
    throw new Error('No webm file was recorded!');
  }
  const inputWebm = path.join(recDir, files[0]);
  console.log('Raw recorded webm:', inputWebm);

  const outMp4 = path.join(__dirname, '../public/product-hunt-assets/chatty-product-hunt-demo.mp4');
  const outGif = path.join(__dirname, '../public/product-hunt-assets/chatty-product-hunt-preview.gif');
  const brainDir = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\1ca617eb-bc44-4730-826c-47a5eaa19628';

  console.log('Transcoding to MP4 (H.264, 1280x720)...');
  const ffmpegMp4 = `ffmpeg -y -i "${inputWebm}" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart "${outMp4}"`;
  execSync(ffmpegMp4, { stdio: 'inherit' });
  fs.copyFileSync(outMp4, path.join(brainDir, 'chatty-product-hunt-demo.mp4'));
  console.log('Saved chatty-product-hunt-demo.mp4');

  console.log('Generating high-quality preview GIF...');
  const palettePng = path.join(recDir, 'palette.png');
  execSync(`ffmpeg -y -i "${outMp4}" -vf "fps=15,scale=640:-1:flags=lanczos,palettegen" "${palettePng}"`, { stdio: 'inherit' });
  execSync(`ffmpeg -y -i "${outMp4}" -i "${palettePng}" -filter_complex "fps=15,scale=640:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" "${outGif}"`, { stdio: 'inherit' });
  fs.copyFileSync(outGif, path.join(brainDir, 'chatty-product-hunt-preview.gif'));
  console.log('Saved chatty-product-hunt-preview.gif');

  console.log('All real UI demo video assets generated successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
