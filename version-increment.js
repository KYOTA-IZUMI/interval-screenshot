const fs = require('fs');
const path = require('path');

// package.jsonファイルのパス
const packageJsonPath = path.join(__dirname, 'package.json');

// package.jsonファイルを読み込む
const packageJson = require(packageJsonPath);

// 現在のバージョンを取得
const currentVersion = packageJson.version;
console.log(`現在のバージョン: ${currentVersion}`);

// バージョン番号を分解
const versionParts = currentVersion.split('.');
const major = parseInt(versionParts[0], 10);
const minor = parseInt(versionParts[1], 10);
const patch = parseInt(versionParts[2], 10);

// マイナーバージョンを上げる
const newMinor = minor + 1;
const newVersion = `${major}.${newMinor}.${patch}`;

// 新しいバージョンをpackage.jsonに書き込む
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log(`新しいバージョン: ${newVersion}`); 