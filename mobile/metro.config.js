const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

config.server = config.server || {};
const baseEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const wrapped = baseEnhanceMiddleware ? baseEnhanceMiddleware(middleware, server) : middleware;
  return (req, res, next) => {
    if (req.url && req.url.endsWith('.wasm')) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }
    return wrapped(req, res, next);
  };
};

module.exports = config;
