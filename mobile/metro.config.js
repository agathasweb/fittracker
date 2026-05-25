const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite usa wa-sqlite (.wasm) na web. Metro precisa tratar como asset
// pra resolver o `import wasmModule from './wa-sqlite/wa-sqlite.wasm'` no
// worker. No Android/iOS o arquivo .wasm é resolvido pra módulo vazio porque
// o `worker.ts` só é carregado em web (via ExpoSQLite.web.js).
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
