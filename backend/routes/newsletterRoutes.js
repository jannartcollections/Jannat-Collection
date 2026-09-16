import express from 'express';
import { isSmtpConfigured, sendEmail } from '../services/mailService.js';
import NewsletterSubscriber from '../models/NewsletterSubscriber.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: 'A valid email is required' });
  }

  const subscriberSave = NewsletterSubscriber.findOneAndUpdate(
    { email },
    [
      {
        $set: {
          subscriptionCount: {
            $add: [{ $ifNull: ['$subscriptionCount', 0] }, 1],
          },
          updatedAt: '$$NOW',
        },
      },
    ],
    { upsert: true, new: true }
  );

  if (isSmtpConfigured()) {
    void (async () => {
      try {
      const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
      const messageReference = `jannat-welcome-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const subscriberEmail = await sendEmail({
        to: email,
        replyTo: process.env.SMTP_FROM,
        subject: 'Welcome to Jannat Collection',
        text: `You received this email because you subscribed to Jannat Collection. Discover refined essentials and effortless elegance at ${clientUrl}.`,
        headers: {
          'X-Entity-Ref-ID': messageReference,
          'List-Unsubscribe': `<mailto:${process.env.SMTP_USER}?subject=Unsubscribe>`,
        },
        html: `
          <div style="margin:0;padding:0;background:#f5eee7;color:#2b211b;font-family:Georgia,'Times New Roman',serif;">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">A little more elegance is on its way to your inbox.</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5eee7;padding:28px 12px;">
              <tr><td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#fffdfb;border:1px solid #e6d7c9;box-shadow:0 12px 30px rgba(80,52,32,.10);">
                  <tr><td style="height:7px;background:#8c6a4d;font-size:0;line-height:0;">&nbsp;</td></tr>
                  <tr><td align="center" style="padding:34px 30px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="width:86px;height:86px;border:1px solid #b48a65;border-radius:50%;background:#33251c;"><tr><td align="center" valign="middle" style="width:86px;height:86px;border:3px solid #8c6a4d;border-radius:50%;color:#f8eee5;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1;letter-spacing:-2px;">JC</td></tr></table>
                    <p style="margin:16px 0 0;color:#8c6a4d;font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;font-weight:bold;">JANNAT COLLECTION</p>
                  </td></tr>
                  <tr><td style="padding:8px 42px 38px;text-align:center;">
                    <p style="margin:0 0 12px;color:#b48a65;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">Welcome to your new style ritual</p>
                    <h1 style="margin:0;color:#33251c;font-size:34px;line-height:1.15;font-weight:normal;">Elegance, chosen for you.</h1>
                    <p style="margin:20px auto 0;max-width:470px;color:#66574c;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;">Thank you for joining us. You are now part of a thoughtful community discovering refined essentials, beautiful details, and the confidence that comes from wearing what feels truly right.</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto 0;"><tr><td style="border-radius:3px;background:#8c6a4d;"><a href="${clientUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-family:Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;font-weight:bold;">Explore the Collection</a></td></tr></table>
                  </td></tr>
                  <tr><td style="padding:24px 34px;background:#f8f0e8;border-top:1px solid #eadccf;text-align:center;">
                    <p style="margin:0;color:#8c6a4d;font-size:18px;line-height:1.4;">“Style is the quietest way to say who you are.”</p>
                    <p style="margin:9px 0 0;color:#76665a;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;">Look out for new arrivals, considered edits, and inspiration made for your everyday.</p>
                  </td></tr>
                  <tr><td style="padding:22px 30px;text-align:center;">
                    <p style="margin:0;color:#8c6a4d;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;font-weight:bold;">JANNAT COLLECTION</p>
                    <p style="margin:8px 0 0;color:#9a8a7d;font-family:Arial,sans-serif;font-size:11px;line-height:1.5;">Curated modern elegance, delivered to your inbox.</p>
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </div>
        `,
      });
      console.log(`Newsletter email accepted for ${email}: ${subscriberEmail.messageId}`);

      if (process.env.SMTP_ADMIN_EMAIL) {
        try {
          await sendEmail({
            to: process.env.SMTP_ADMIN_EMAIL,
            subject: 'New newsletter subscriber',
            text: `${email} subscribed to the Jannat Collection newsletter.`,
          });
        } catch (error) {
          console.error('Admin newsletter notification failed:', error.message);
        }
      }
    } catch (error) {
      console.error('Newsletter email failed:', error.message);
    }
    })();
  }

  try {
    await subscriberSave;
  } catch (error) {
    console.error('Newsletter subscriber save failed:', error.message);
    return res.status(503).json({ message: 'Unable to save subscription' });
  }

  return res.status(201).json({ message: 'Subscribed successfully' });
});

export default router;
