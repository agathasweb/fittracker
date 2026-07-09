/**
 * Endereço do painel FitTracker (Laravel + Filament).
 *
 * Fonte única: usado pelo registro de push (lib/push.ts) e pela autenticação
 * (lib/api.ts). Apontar pro dev só em desenvolvimento — um APK publicado com
 * a URL de dev não consegue validar assinatura de ninguém.
 */
export const PANEL_BASE_URL = 'https://fittracker.agathasweb.com';

/** Janela de tolerância sem internet antes de exigir reconexão. */
export const OFFLINE_GRACE_MS = 48 * 60 * 60 * 1000; // 48h
