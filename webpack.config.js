import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: './app/js/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/bundle.[contenthash].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './app/index.html',
      filename: 'index.html'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'app/config.xml', to: 'config.xml' },
        { from: 'app/css', to: 'css' }
      ]
    })
  ],
  resolve: {
    extensions: ['.js']
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },
    port: 8080,
    hot: true
  }
};
