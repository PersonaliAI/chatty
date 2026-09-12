const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const WIDTH = 1920;
const HEIGHT = 1080;
const baseDir = path.join("public", "demo-video-assets");
const outputDir = path.join("public", "demo-video-caption-screens");

const scenes = [
  {
    source: "scene-01-visitor-problem.png",
    output: "screen-01-visitors-have-questions.png",
    eyebrow: "SCENE 01",
    line1: "Visitors have questions.",
    line2: "Chatty answers instantly.",
  },
  {
    source: "scene-02-knowledge-answer.png",
    output: "screen-02-train-it-on-your-content.png",
    eyebrow: "SCENE 02",
    line1: "Train it on your website,",
    line2: "files, and docs.",
  },
  {
    source: "scene-03-lead-capture.png",
    output: "screen-03-capture-every-lead.png",
    eyebrow: "SCENE 03",
    line1: "Capture every lead",
    line2: "automatically.",
  },
  {
    source: "scene-04-booking-routing.png",
    output: "screen-04-book-meetings-time-zone.png",
    eyebrow: "SCENE 04",
    line1: "Book meetings in the",
    line2: "visitor’s time zone.",
  },
  {
    source: "scene-05-dashboard-command-center.png",
    output: "screen-05-manage-everything.png",
    eyebrow: "SCENE 05",
    line1: "Manage conversations, team workflows,",
    line2: "and analytics.",
  },
];

function escapeSvg(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function captionOverlay({ eyebrow, line1, line2 }) {
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="96" y="720" width="1040" height="260" rx="48" fill="#fffaf2" fill-opacity="0.94"/>
      <rect x="96" y="720" width="1040" height="260" rx="48" fill="none" stroke="#201e1d" stroke-opacity="0.10" stroke-width="2"/>
      <circle cx="166" cy="792" r="24" fill="#c67139"/>
      <path d="M155 792h22M166 781v22" stroke="#fffaf2" stroke-width="5" stroke-linecap="round"/>
      <text x="216" y="803" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="800" letter-spacing="3" fill="#8c491a">${escapeSvg(eyebrow)} · CHATTY DEMO</text>
      <text x="148" y="884" font-family="Georgia, 'Times New Roman', serif" font-size="68" font-weight="700" fill="#201e1d">${escapeSvg(line1)}</text>
      <text x="148" y="956" font-family="Georgia, 'Times New Roman', serif" font-size="68" font-weight="700" fill="#b2622d">${escapeSvg(line2)}</text>
    </svg>
  `);
}

function endCardSvg() {
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="#f5ead8"/>
      <circle cx="1650" cy="170" r="160" fill="#e1eecc"/>
      <circle cx="230" cy="900" r="220" fill="#ffe1d0"/>
      <rect x="350" y="210" width="1220" height="660" rx="76" fill="#fffaf2" stroke="#201e1d" stroke-opacity="0.09" stroke-width="2"/>
      <circle cx="960" cy="374" r="76" fill="#c67139"/>
      <path d="M923 380c0-25 20-45 45-45s45 20 45 45-20 45-45 45h-12l-25 16 8-25c-10-8-16-21-16-36Z" fill="#fffaf2"/>
      <circle cx="952" cy="381" r="6" fill="#c67139"/>
      <circle cx="969" cy="381" r="6" fill="#c67139"/>
      <circle cx="986" cy="381" r="6" fill="#c67139"/>
      <text x="960" y="535" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="104" font-weight="700" fill="#201e1d">Chatty</text>
      <text x="960" y="646" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="700" fill="#b2622d">AI customer support</text>
      <text x="960" y="724" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="700" fill="#201e1d">for your website.</text>
      <rect x="760" y="782" width="400" height="82" rx="41" fill="#c67139"/>
      <text x="960" y="836" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800" fill="#fffaf2">Start free</text>
    </svg>
  `);
}

async function createSceneScreen(scene) {
  const background = await sharp(path.join(baseDir, scene.source))
    .resize(WIDTH, HEIGHT, { fit: "cover" })
    .modulate({ brightness: 0.96, saturation: 0.94 })
    .png()
    .toBuffer();

  await sharp(background)
    .composite([{ input: captionOverlay(scene), left: 0, top: 0 }])
    .png({ compressionLevel: 9, quality: 92 })
    .toFile(path.join(outputDir, scene.output));
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const scene of scenes) {
    await createSceneScreen(scene);
  }

  await sharp(endCardSvg())
    .png({ compressionLevel: 9, quality: 92 })
    .toFile(path.join(outputDir, "screen-06-end-card.png"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
