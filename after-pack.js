const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 指定されたディレクトリ内の不要なファイルを削除する
 * @param {string} dir - 削除対象のディレクトリパス
 * @param {Array<string>} patterns - 削除するファイルパターンの配列
 */
function removeUnnecessaryFiles(dir, patterns) {
  if (!fs.existsSync(dir)) return;

  // パターンに一致するファイルを検索して削除
  for (const pattern of patterns) {
    try {
      const command = `find "${dir}" -name "${pattern}" -type f -delete`;
      execSync(command);
      console.log(`Removed files matching pattern: ${pattern}`);
    } catch (error) {
      console.error(`Error removing files with pattern ${pattern}:`, error);
    }
  }
}

/**
 * 指定されたディレクトリ内の不要なディレクトリを削除する
 * @param {string} dir - 削除対象のディレクトリパス
 * @param {Array<string>} patterns - 削除するディレクトリパターンの配列
 */
function removeUnnecessaryDirs(dir, patterns) {
  if (!fs.existsSync(dir)) return;

  // パターンに一致するディレクトリを検索して削除
  for (const pattern of patterns) {
    try {
      const command = `find "${dir}" -name "${pattern}" -type d -exec rm -rf {} \\; 2>/dev/null || true`;
      execSync(command);
      console.log(`Removed directories matching pattern: ${pattern}`);
    } catch (error) {
      console.error(`Error removing directories with pattern ${pattern}:`, error);
    }
  }
}

/**
 * sharpモジュールの依存ライブラリをコピーする
 * @param {string} appOutDir - アプリケーションの出力ディレクトリ
 */
function copySharpDependencies(appOutDir) {
  try {
    const resourcesDir = path.join(appOutDir, 'Contents', 'Resources');
    const appDir = path.join(resourcesDir, 'app.asar.unpacked');
    const nodeModulesDir = path.join(appDir, 'node_modules');
    const sharpDir = path.join(nodeModulesDir, 'sharp');
    const sharpVendorDir = path.join(sharpDir, 'vendor');
    
    // sharpのvendorディレクトリが存在するか確認
    if (fs.existsSync(sharpVendorDir)) {
      console.log('Copying Sharp dependencies...');
      
      // Frameworksディレクトリにライブラリをコピー
      const frameworksDir = path.join(appOutDir, 'Contents', 'Frameworks');
      if (!fs.existsSync(frameworksDir)) {
        fs.mkdirSync(frameworksDir, { recursive: true });
      }
      
      // vendorディレクトリからlibディレクトリを探す
      const vendorLibDir = path.join(sharpVendorDir, 'lib');
      if (fs.existsSync(vendorLibDir)) {
        // libディレクトリ内のすべてのファイルをFrameworksディレクトリにコピー
        const files = fs.readdirSync(vendorLibDir);
        for (const file of files) {
          const srcPath = path.join(vendorLibDir, file);
          const destPath = path.join(frameworksDir, file);
          fs.copyFileSync(srcPath, destPath);
          console.log(`Copied ${file} to Frameworks directory`);
        }
      } else {
        console.log('Sharp vendor/lib directory not found');
      }
      
      // extraResourcesからsharp-libディレクトリをFrameworksディレクトリにコピー
      const extraResourcesDir = path.join(resourcesDir, 'sharp-lib');
      if (fs.existsSync(extraResourcesDir)) {
        const files = fs.readdirSync(extraResourcesDir);
        for (const file of files) {
          const srcPath = path.join(extraResourcesDir, file);
          const destPath = path.join(frameworksDir, file);
          fs.copyFileSync(srcPath, destPath);
          console.log(`Copied ${file} from extraResources to Frameworks directory`);
        }
      } else {
        console.log('extraResources sharp-lib directory not found');
      }
    } else {
      console.log('Sharp vendor directory not found');
    }
  } catch (error) {
    console.error('Error copying Sharp dependencies:', error);
  }
}

/**
 * electron-builderのafterPackフック
 */
exports.default = async function(context) {
  const appOutDir = context.appOutDir;
  const resourcesDir = path.join(appOutDir, 'Contents', 'Resources');
  const appDir = path.join(resourcesDir, 'app.asar.unpacked');
  const nodeModulesDir = path.join(appDir, 'node_modules');

  console.log('Cleaning up unnecessary files...');

  // 不要なファイルパターン
  const unnecessaryFilePatterns = [
    '*.md',
    '*.markdown',
    '*.ts',
    '*.map',
    'LICENSE*',
    'license*',
    '*.log',
    '*.lock',
    'AUTHORS*',
    'CONTRIBUTORS*',
    'CHANGELOG*',
    'HISTORY*',
    'CHANGES*',
    '*.tgz',
    '*.swp',
    '.npmignore',
    '.gitignore',
    '.gitattributes',
    '.editorconfig',
    '.eslintrc*',
    '.jshintrc',
    '.travis.yml',
    'appveyor.yml',
    'circle.yml',
    '.coveralls.yml',
    '*.coverage',
    'Makefile',
    'Gulpfile.js',
    'Gruntfile.js',
    'tsconfig.json',
    'tslint.json',
    'webpack.config.js',
    'karma.conf.js',
    'rollup.config.js',
    'yarn.lock',
    'package-lock.json'
  ];

  // 不要なディレクトリパターン
  const unnecessaryDirPatterns = [
    'test',
    'tests',
    '__tests__',
    'example',
    'examples',
    'doc',
    'docs',
    '.github',
    '.git',
    'benchmark',
    'benchmarks',
    'coverage',
    'man',
    'scripts',
    'samples',
    'demo',
    'fixtures',
    'typings',
    'typescript',
    'flow-typed'
  ];

  // node_modules内の不要なファイルとディレクトリを削除
  if (fs.existsSync(nodeModulesDir)) {
    removeUnnecessaryFiles(nodeModulesDir, unnecessaryFilePatterns);
    removeUnnecessaryDirs(nodeModulesDir, unnecessaryDirPatterns);
  }

  // sharpモジュールの依存ライブラリをコピー
  copySharpDependencies(appOutDir);

  console.log('Cleanup completed!');
}; 