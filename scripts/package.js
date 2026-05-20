/**
 * Tizen packaging script
 * Creates .wgt package for Samsung TV deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PKG_NAME = 'phlix-tizen';
const VERSION = '1.0.0';

const packageApp = () => {
    console.log('Packaging Tizen app...');

    // Ensure dist exists
    if (!fs.existsSync(path.join(__dirname, '../dist'))) {
        console.error('Run build first: npm run build');
        process.exit(1);
    }

    // Create package directory
    const pkgDir = path.join(__dirname, '../package');
    if (fs.existsSync(pkgDir)) {
        fs.rmSync(pkgDir, { recursive: true });
    }
    fs.mkdirSync(pkgDir);

    // Copy dist files
    execSync(`cp -r ${path.join(__dirname, '../dist')}/* ${pkgDir}/`, { stdio: 'inherit' });

    // Copy config
    execSync(`cp ${path.join(__dirname, '../app/config.xml')} ${pkgDir}/`, { stdio: 'inherit' });

    console.log('Package created in:', pkgDir);
    console.log('Note: Use Tizen Studio to sign and deploy the .wgt file');
};

packageApp();
