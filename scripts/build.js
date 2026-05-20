/**
 * Build script for Phlix Tizen App
 */

const webpack = require('webpack');
const path = require('path');

const config = require('../webpack.config.js');

const build = () => {
    return new Promise((resolve, reject) => {
        webpack(config, (err, stats) => {
            if (err) {
                reject(err);
                return;
            }

            if (stats.hasErrors()) {
                console.error(stats.toString({
                    colors: true,
                    errors: true,
                    warnings: true
                }));
                reject(new Error('Build failed'));
                return;
            }

            console.log(stats.toString({
                colors: true,
                assets: true,
                chunks: false,
                modules: false
            }));

            console.log('\nBuild complete!');
            resolve();
        });
    });
};

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
