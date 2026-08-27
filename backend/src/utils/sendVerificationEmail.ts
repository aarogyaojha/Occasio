import { transporter } from '../config/mailer';
import { env } from '../config/env';

/**
 * Sends an email verification link to a user via Gmail SMTP using Nodemailer.
 * Logs the link to the console in all cases for local testing / proof of generation.
 *
 * @param to - Recipient email address
 * @param verificationLink - Complete verification link including raw token
 */
export const sendVerificationEmail = async (to: string, verificationLink: string): Promise<void> => {
  // Always log the link for dev/testing fallback
  console.log(`[VERIFICATION LINK] (${to}): ${verificationLink}`);

  try {
    await transporter.sendMail({
      from: `"Occasio" <${env.GMAIL_USER}>`,
      to,
      subject: 'Verify your Occasio account',
      text: `Hello,\n\nPlease verify your Occasio account by clicking the link below:\n\n${verificationLink}\n\nThis link will expire in 24 hours.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111;">
          <h2>Verify your Occasio account</h2>
          <p>Thank you for signing up! Please click the link below to verify your email address:</p>
          <p><a href="${verificationLink}" style="display: inline-block; padding: 10px 16px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px;">Verify Email</a></p>
          <p style="font-size: 12px; color: #666;">Or copy and paste this URL into your browser:</p>
          <p style="font-size: 12px; color: #666;">${verificationLink}</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('[Mailer Error] Failed to send verification email via SMTP:', error);
  }
};
