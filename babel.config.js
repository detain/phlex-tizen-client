module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        chrome: '100'
      },
      modules: false
    }]
  ]
};
