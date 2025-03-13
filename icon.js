const fs = require('fs');

// 32x32の白黒アイコンのBase64エンコードされたデータ
const iconData = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABQSURBVFiF7c6xDYAwDETRH4pMwCIMwyIMwwRUVBmJIhVNLCdYUZo7+VVnS76IiB5NamvvR3BL05qZ4wN4AAcWdWBRBxZ1YFEHFnVgUQcW3QBxJQ1tN1PgIAAAAABJRU5ErkJggg==';

// Base64データをバイナリに変換してファイルに保存
const buffer = Buffer.from(iconData, 'base64');
fs.writeFileSync('icon.png', buffer); 