const path = require('path');
const fs = require('fs');

const outputDirectory = path.resolve(__dirname, 'build/webpack');

if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, {recursive: true});
}
module.exports = function (config) {
    config.set({
        basePath: '.',
        files: [
            {pattern: 'src/*.spec.ts', watched: false, served: true, included: true},
        ],
        client: {
            jasmine: {
                random: false
            }
        },
        autoWatch: false,
        singleRun: true,
        logLevel: config.LOG_WARN,
        frameworks: ['jasmine', 'webpack'],
        browsers: ['ChromeHeadlessNS'],
        customLaunchers: {
            ChromeHeadlessNS: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox', '--disable-gpu']
            }
        },
        webpack: {
            devtool: 'inline-source-map',
            output: {
                filename: 'tests-bundle.js',
                path: path.resolve(__dirname, outputDirectory),
            },
            resolve: {
                extensions: [".ts", ".js", ".node"],
                modules: ['node_modules'],
                fallback: {
                    "path": false,
                    "fs": false,
                    "http": false,
                    "url": false,
                    "https": false,
                    "readline": false,
                    "console": false,
                }
            },
            module: {
                rules: [
                    {
                        test: /\.ts?$/i,
                        exclude: /(node_modules)/,
                        loader: 'ts-loader'
                    },
                    {
                        test: /\.node$/,
                        loader: "node-loader",
                    },

                ]
            }
        },
        preprocessors: {
            './src/*.ts': ['webpack']
        },
    });
};
