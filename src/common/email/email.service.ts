import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface SendInvitePayload {
  to: string;
  inviterName: string;
  orgName: string;
  role: string;
  token: string;
}

/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly isProd: boolean;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.getOrThrow<string>('RESEND_API_KEY'));
    this.isProd = this.config.get<string>('NODE_ENV') === 'production';
  }

  async sendInvite(payload: SendInvitePayload) {
    const acceptUrl = `${this.config.get('FRONTEND_URL') ?? 'http://localhost:3000'}/accept-invite?token=${encodeURIComponent(payload.token)}`;
    const html = this.buildInviteHtml(payload.inviterName, payload.orgName, payload.role, acceptUrl);

    const actualTo = this.isProd
      ? payload.to
      : (this.config.get<string>('MAIL_DEV_OVERRIDE') ?? payload.to);

    if (!this.isProd) {
      this.logger.log(`[DEV] Email intended for ${payload.to} → redirected to ${actualTo}`);
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.getOrThrow<string>('MAIL_FROM'),
        to: actualTo,
        subject: `You're invited to join ${escapeHtml(payload.orgName)}`,
        html,
      });

      if (error) {
        this.logger.error(`Failed to send invite to ${payload.to}: ${JSON.stringify(error)}`);
        return;
      }

      this.logger.log(`Invite sent to ${payload.to} — Resend id: ${data?.id}`);
    } catch (err) {
      this.logger.error(`Failed to send invite to ${payload.to}: ${err}`);
    }
  }

  private buildInviteHtml(
    inviterName: string,
    orgName: string,
    role: string,
    acceptUrl: string,
  ): string {
    const safeInviter = escapeHtml(inviterName);
    const safeOrg = escapeHtml(orgName);
    const safeRole = escapeHtml(role);
    const safeUrl = escapeHtml(acceptUrl);

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 16px;">
        <h2 style="color: #0A0D14;">You've been invited!</h2>
        <p style="color: #374151;">
          <strong>${safeInviter}</strong> has invited you to join
          <strong>${safeOrg}</strong> as <strong>${safeRole}</strong>.
        </p>
        <p style="color: #374151;">Click the button below to accept your invite and set up your account.</p>
        <a href="${safeUrl}"
          style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #4F46E5;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 16px 0;
            font-weight: 600;
          "
        >
          Accept Invite
        </a>
        <p style="color: #6B7280; font-size: 14px;">This invite expires in 72 hours.</p>
        <p style="color: #6B7280; font-size: 14px;">If you did not expect this invite, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 12px;">
          Or copy this link:<br/>
          <a href="${safeUrl}" style="color: #6B7280;">${safeUrl}</a>
        </p>
      </div>
    `;
  }
}