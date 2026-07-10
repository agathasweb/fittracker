/**
 * Endereço do painel FitTracker (Laravel + Filament).
 *
 * Fonte única: usado pelo registro de push (lib/push.ts) e pela autenticação
 * (lib/api.ts). Apontar pro dev só em desenvolvimento — um APK publicado com
 * a URL de dev não consegue validar assinatura de ninguém.
 */
export const PANEL_BASE_URL = 'https://fittracker.agathasweb.com';

/**
 * Janela de tolerância sem internet antes de exigir reconexão.
 * Passado esse tempo desde a última confirmação do servidor, o app bloqueia
 * sozinho — sem depender de rede pra decidir.
 */
export const OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000; // 24h
