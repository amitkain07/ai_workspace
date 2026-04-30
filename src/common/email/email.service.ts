import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  
constructor(private readonly config: ConfigService) {
  nodemailer.createTestAccount().then((account) => {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });
    this.logger.log(`Ethereal test account: ${account.user}`);
    this.logger.log(`View emails at: https://ethereal.email`);
  });
}

  async sendInvite({
    to,
    inviterName,
    orgName,
    role,
    token,
  }: {
    to: string;
    inviterName: string;
    orgName: string;
    role: string;
    token: string;
  }) {
    const acceptUrl = `${this.config.get('FRONTEND_URL') ?? 'http://localhost:3000'}/accept-invite?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited!</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> as <strong>${role}</strong>.</p>
        <p>Click the button below to accept your invite and set up your account.</p>
        <a href="${acceptUrl}"
          style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #4F46E5;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 16px 0;
          "
        >
          Accept Invite
        </a>
        <p style="color: #6B7280; font-size: 14px;">This invite expires in 72 hours.</p>
        <p style="color: #6B7280; font-size: 14px;">If you did not expect this invite, you can ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 12px;">
          Or copy this link: <a href="${acceptUrl}">${acceptUrl}</a>
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"SynthCore" <${this.config.getOrThrow('MAIL_FROM')}>`,
        to,
        subject: `You're invited to join ${orgName}`,
        html,
      });
      this.logger.log(`Invite email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send invite email to ${to}: ${err}`);
    }
  }
}