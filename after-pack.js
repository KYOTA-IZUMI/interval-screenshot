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

  console.log('Cleanup completed!');
}; 