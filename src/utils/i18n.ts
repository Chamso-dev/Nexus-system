/**
 * Minimal localization layer.
 *
 * A full i18n framework is overkill for a bot, so we ship a tiny, dependency-free
 * translator that supports {placeholder} interpolation and locale fallback.
 * Add a new locale by extending `messages`.
 */
import { env } from '../config/env';

export type Locale = 'en' | 'es' | 'fr';

type MessageTree = Record<string, string>;

/** Flat translation dictionaries keyed by locale then message id. */
const messages: Record<Locale, MessageTree> = {
  en: {
    'common.notFinancialAdvice': 'Not financial advice.',
    'common.error': 'Something went wrong. Please try again later.',
    'common.premiumRequired': 'This feature requires a premium subscription.',
    'common.cooldown': 'Please wait {seconds}s before using this command again.',
    'wallet.added': 'Wallet added and now being watched.',
    'wallet.removed': 'Wallet removed.',
    'wallet.renamed': 'Wallet renamed.',
    'wallet.limitReached': 'You have reached your wallet limit ({limit}).',
    'alert.created': 'Alert created.',
    'alert.limitReached': 'You have reached your alert limit ({limit}).',
  },
  es: {
    'common.notFinancialAdvice': 'Esto no es asesoramiento financiero.',
    'common.error': 'Algo salió mal. Inténtalo de nuevo más tarde.',
    'common.premiumRequired': 'Esta función requiere una suscripción premium.',
    'common.cooldown': 'Espera {seconds}s antes de usar este comando de nuevo.',
    'wallet.added': 'Cartera añadida y ahora en seguimiento.',
    'wallet.removed': 'Cartera eliminada.',
    'wallet.renamed': 'Cartera renombrada.',
    'wallet.limitReached': 'Has alcanzado tu límite de carteras ({limit}).',
    'alert.created': 'Alerta creada.',
    'alert.limitReached': 'Has alcanzado tu límite de alertas ({limit}).',
  },
  fr: {
    'common.notFinancialAdvice': "Ceci n'est pas un conseil financier.",
    'common.error': "Une erreur s'est produite. Réessayez plus tard.",
    'common.premiumRequired': 'Cette fonctionnalité nécessite un abonnement premium.',
    'common.cooldown': "Veuillez patienter {seconds}s avant de réutiliser cette commande.",
    'wallet.added': 'Portefeuille ajouté et maintenant surveillé.',
    'wallet.removed': 'Portefeuille supprimé.',
    'wallet.renamed': 'Portefeuille renommé.',
    'wallet.limitReached': 'Vous avez atteint votre limite de portefeuilles ({limit}).',
    'alert.created': 'Alerte créée.',
    'alert.limitReached': 'Vous avez atteint votre limite d’alertes ({limit}).',
  },
};

const SUPPORTED: Locale[] = ['en', 'es', 'fr'];

/** Coerce an arbitrary locale string into a supported one, else the default. */
export function resolveLocale(locale?: string | null): Locale {
  if (locale && SUPPORTED.includes(locale as Locale)) return locale as Locale;
  const fallback = env.DEFAULT_LOCALE as Locale;
  return SUPPORTED.includes(fallback) ? fallback : 'en';
}

/**
 * Translate a message id for a locale, interpolating {placeholders}.
 * Falls back to English, then to the raw key if nothing matches.
 */
export function t(
  key: string,
  params: Record<string, string | number> = {},
  locale?: string | null,
): string {
  const resolved = resolveLocale(locale);
  const template = messages[resolved][key] ?? messages.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}
