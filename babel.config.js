export default {
  presets: [
    ['@babel/preset-env', {
      targets: {
        chrome: '100'
      },
      modules: 'auto'
    }]
  ]
};
