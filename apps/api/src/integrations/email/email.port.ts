export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Provider seam for transactional email. Verification, invitations, registration
 * confirmations, badges and operational notices all go through this port so the
 * vendor can be replaced without touching business code.
 */
export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL_PORT = Symbol('EMAIL_PORT');
