const fs = require('fs');
const path = require('path');
const favBase64 = 'data:image/png;base64,' + fs.readFileSync('public/favicon.png').toString('base64');
let html = fs.readFileSync('public/product-hunt-assets/demo_stage.html', 'utf8');
html = html.replace(/src="\/favicon\.png"/g, 'src="' + favBase64 + '"');
// Also ensure launcher background is white so circular chatty icon stands out cleanly
html = html.replace(/#launcher \{([^}]+)background: #f97316;/g, '#launcher {$1background: #ffffff;');
html = html.replace(/background: #f97316;\s+display: flex;\s+align-items: center;\s+justify-content: center;\s+margin-bottom: 24px;/g, 'background: #ffffff; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;');
fs.writeFileSync('public/product-hunt-assets/demo_stage.html', html, 'utf8');
console.log('Updated demo_stage.html with base64 favicon successfully!');
