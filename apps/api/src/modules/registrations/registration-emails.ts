import type { Locale } from '@event-platform/shared';

interface Compose {
  locale: Locale;
  eventName: string;
  firstName: string;
  portalUrl: string;
}

export interface ComposedEmail {
  subject: string;
  text: string;
}

const COPY = {
  en: {
    pending: (c: Compose) => ({
      subject: `We received your registration: ${c.eventName}`,
      text: `Hello ${c.firstName},\n\nWe received your registration for ${c.eventName}. It is waiting for review and you will hear from us once it is decided.\n\nYour participant page: ${c.portalUrl}`,
    }),
    confirmed: (c: Compose) => ({
      subject: `You are registered: ${c.eventName}`,
      text: `Hello ${c.firstName},\n\nYour registration for ${c.eventName} is confirmed. Your QR badge is on your participant page; show it at the entrance.\n\n${c.portalUrl}`,
    }),
    rejected: (c: Compose) => ({
      subject: `About your registration: ${c.eventName}`,
      text: `Hello ${c.firstName},\n\nWe are sorry: we could not confirm your registration for ${c.eventName}.`,
    }),
    cancelled: (c: Compose) => ({
      subject: `Registration cancelled: ${c.eventName}`,
      text: `Hello ${c.firstName},\n\nYour registration for ${c.eventName} has been cancelled.`,
    }),
  },
  fr: {
    pending: (c: Compose) => ({
      subject: `Nous avons reçu votre inscription : ${c.eventName}`,
      text: `Bonjour ${c.firstName},\n\nNous avons bien reçu votre inscription à ${c.eventName}. Elle est en cours d'examen et nous reviendrons vers vous dès qu'une décision sera prise.\n\nVotre espace participant : ${c.portalUrl}`,
    }),
    confirmed: (c: Compose) => ({
      subject: `Inscription confirmée : ${c.eventName}`,
      text: `Bonjour ${c.firstName},\n\nVotre inscription à ${c.eventName} est confirmée. Votre badge QR se trouve dans votre espace participant ; présentez-le à l'entrée.\n\n${c.portalUrl}`,
    }),
    rejected: (c: Compose) => ({
      subject: `À propos de votre inscription : ${c.eventName}`,
      text: `Bonjour ${c.firstName},\n\nNous sommes désolés : nous n'avons pas pu confirmer votre inscription à ${c.eventName}.`,
    }),
    cancelled: (c: Compose) => ({
      subject: `Inscription annulée : ${c.eventName}`,
      text: `Bonjour ${c.firstName},\n\nVotre inscription à ${c.eventName} a été annulée.`,
    }),
  },
} as const;

export function composeRegistrationEmail(
  kind: 'pending' | 'confirmed' | 'rejected' | 'cancelled',
  input: Compose,
): ComposedEmail {
  return COPY[input.locale][kind](input);
}
