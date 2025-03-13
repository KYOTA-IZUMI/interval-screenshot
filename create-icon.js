const fs = require('fs');
const path = require('path');

// main.jsからアイコンデータを抽出
const mainJsContent = fs.readFileSync('main.js', 'utf8');
const iconDataMatch = mainJsContent.match(/const iconData = `([^`]+)`/);

if (!iconDataMatch) {
  console.error('アイコンデータが見つかりません');
  process.exit(1);
}

const iconData = iconDataMatch[1];

// PNGファイルを作成
const pngBuffer = Buffer.from(iconData, 'base64');
fs.writeFileSync('icon.png', pngBuffer);

console.log('icon.pngを作成しました');

// macOSでは、iconutilコマンドを使用してicnsファイルを作成するためのコマンドを表示
console.log('\nmacOSでicnsファイルを作成するには、以下のコマンドを実行してください:');
console.log('mkdir -p icon.iconset');
console.log('sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png');
console.log('sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png');
console.log('sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png');
console.log('sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png');
console.log('sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png');
console.log('sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png');
console.log('sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png');
console.log('sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png');
console.log('sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png');
console.log('sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png');
console.log('iconutil -c icns icon.iconset'); 