/**
 * Debug launcher for Phlex Tizen App
 * Starts webpack dev server for local testing
 */

const webpackDevServer = require('webpack-dev-server');
const webpack = require('webpack');
const path = require('path');

const config = require('../webpack.config.js');

const startServer = async () => {
    const compiler = webpack(config);

    const server = new webpackDevServer({
        host: '0.0.0.0',
        port: 8080,
        static: {
            directory: path.join(__dirname, '../dist')
        },
        hot: true,
        headers: {
            'Access-Control-Allow-Origin': '*'
        }
    });

    server.startCallback(() => {
        console.log('Dev server running at http://localhost:8080');
        console.log('For Tizen testing, package with: npm run build');
    });
};

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
