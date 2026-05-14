import { Resend } from 'resend';

function buildResendMarketing(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY_MARKETING;
  if (!apiKey) {
    console.warn('[resend-marketing] RESEND_API_KEY_MARKETING not set, marketing Resend client disabled');
    return null;
  }
  console.log('[resend-marketing] marketing Resend client initialised');
  return new Resend(apiKey);
}

export const resendMarketing = buildResendMarketing();
