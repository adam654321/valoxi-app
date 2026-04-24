import { escapeHtml } from '../utils/html';

const BRAND = {
  bg: '#0D0D0D',
  card: '#141414',
  border: '#252525',
  orange: '#F97316',
  white: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textBody: '#CCCCCC',
  textMuted: '#555555',
  fontStack: "Inter, 'Segoe UI', Arial, sans-serif",
};

export interface EmailCta {
  label: string;
  href: string;
}

export interface EmailInfoBox {
  tone?: 'info' | 'warning' | 'success';
  title?: string;
  body: string;
}

export interface EmailBlock {
  type: 'paragraph' | 'heading' | 'cta' | 'info_box' | 'divider' | 'steps';
  text?: string;
  cta?: EmailCta;
  box?: EmailInfoBox;
  steps?: Array<{ lead: string; detail: string }>;
}

export interface RenderBrandedEmailConfig {
  preheader?: string;
  eyebrow?: string;
  heading: string;
  blocks: EmailBlock[];
  footerLine?: string;
  supportLine?: string;
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case 'paragraph':
      return `<p style="margin:0 0 20px 0;font-size:15px;color:${BRAND.textBody};line-height:1.7;">${block.text ?? ''}</p>`;
    case 'heading':
      return `<p style="margin:24px 0 12px 0;font-size:13px;font-weight:700;color:${BRAND.textPrimary};text-transform:uppercase;letter-spacing:0.06em;">${block.text ?? ''}</p>`;
    case 'divider':
      return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;"><tr><td style="height:1px;background:${BRAND.border};line-height:1px;font-size:1px;">&nbsp;</td></tr></table>`;
    case 'cta':
      if (!block.cta) return '';
      return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 24px 0;"><tr><td style="background:${BRAND.orange};border-radius:6px;padding:14px 28px;"><a href="${block.cta.href}" style="color:${BRAND.white};font-size:14px;font-weight:700;text-decoration:none;font-family:${BRAND.fontStack};">${block.cta.label}</a></td></tr></table>`;
    case 'info_box': {
      if (!block.box) return '';
      const toneColors: Record<string, { bg: string; border: string; text: string }> = {
        info: { bg: '#1A1F2E', border: '#2563EB', text: '#BFDBFE' },
        warning: { bg: '#2A1F0A', border: '#F59E0B', text: '#FCD34D' },
        success: { bg: '#0F1F15', border: '#10B981', text: '#A7F3D0' },
      };
      const tone = toneColors[block.box.tone ?? 'info'];
      const title = block.box.title
        ? `<p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:${tone.text};">${block.box.title}</p>`
        : '';
      return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;"><tr><td style="background:${tone.bg};border-left:3px solid ${tone.border};border-radius:4px;padding:16px 18px;">${title}<p style="margin:0;font-size:14px;color:${tone.text};line-height:1.6;">${block.box.body}</p></td></tr></table>`;
    }
    case 'steps': {
      if (!block.steps || block.steps.length === 0) return '';
      const items = block.steps.map(s => `<li style="margin-bottom:10px;color:${BRAND.textBody};font-size:15px;line-height:1.6;"><strong style="color:${BRAND.textPrimary};">${s.lead}.</strong> ${s.detail}</li>`).join('');
      return `<ol style="margin:8px 0 20px 20px;padding:0;">${items}</ol>`;
    }
    default:
      return '';
  }
}

export function renderBrandedEmail(cfg: RenderBrandedEmailConfig): string {
  const preheader = cfg.preheader
    ? `<div style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;visibility:hidden;">${cfg.preheader}</div>`
    : '';
  const eyebrow = cfg.eyebrow
    ? `<p style="margin:0 0 8px 0;font-size:11px;font-weight:600;color:${BRAND.orange};letter-spacing:0.1em;text-transform:uppercase;font-family:${BRAND.fontStack};">${cfg.eyebrow}</p>`
    : '';
  const supportLine = cfg.supportLine ?? 'Any questions, reply to this email or reach us at <a href="mailto:hello@valoxi.ai" style="color:' + BRAND.orange + ';text-decoration:none;">hello@valoxi.ai</a>.';
  const footerLine = cfg.footerLine ?? 'You are receiving this because you have an account with Valoxi.';
  const blocksHtml = cfg.blocks.map(renderBlock).join('\n');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark light"><title>${cfg.heading}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:${BRAND.fontStack};">
${preheader}
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BRAND.bg};padding:40px 20px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;width:100%;">
      <tr>
        <td style="padding-bottom:32px;">
          <span style="font-size:22px;font-weight:700;color:${BRAND.orange};letter-spacing:0.05em;font-family:${BRAND.fontStack};">VALOXI</span>
        </td>
      </tr>
      <tr>
        <td style="background:${BRAND.card};border-radius:12px;border:1px solid ${BRAND.border};padding:40px;">
          ${eyebrow}
          <h1 style="margin:0 0 24px 0;font-size:26px;font-weight:700;color:${BRAND.textPrimary};line-height:1.2;font-family:${BRAND.fontStack};">${cfg.heading}</h1>
          ${blocksHtml}
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 16px 0;"><tr><td style="height:1px;background:${BRAND.border};line-height:1px;font-size:1px;">&nbsp;</td></tr></table>
          <p style="margin:0;font-size:14px;color:${BRAND.textBody};line-height:1.7;">${supportLine}<br><br>The Valoxi Team</p>
        </td>
      </tr>
      <tr>
        <td style="padding-top:24px;">
          <p style="margin:0;font-size:11px;color:${BRAND.textMuted};line-height:1.6;text-align:center;">${footerLine}<br>&copy; 2026 ADJV LLC trading as Valoxi &nbsp;&middot;&nbsp; valoxi.ai</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export { escapeHtml };
