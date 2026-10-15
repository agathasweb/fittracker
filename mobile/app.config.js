// O google-services.json fica fora do git (repo público). No EAS ele chega como
// variável de ambiente do tipo arquivo (GOOGLE_SERVICES_JSON = caminho do arquivo);
// localmente usa o arquivo da pasta, como antes.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile,
  },
});
