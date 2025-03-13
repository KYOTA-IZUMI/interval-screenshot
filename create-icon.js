const { createCanvas } = require('canvas');
const fs = require('fs');

// 32x32のキャンバスを作成
const canvas = createCanvas(32, 32);
const ctx = canvas.getContext('2d');

// 白い背景
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 32, 32);

// 黒い四角形
ctx.fillStyle = 'black';
ctx.fillRect(8, 8, 16, 16);

// PNGとして保存
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('icon.png', buffer); 