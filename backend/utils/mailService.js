const fs = require('fs');
const path = require('path');

let nodemailer = null;
try {
    nodemailer = require('nodemailer');
} catch {
    nodemailer = null;
}

const getFrontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const getTransporter = () => {
    if (!nodemailer || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

const writeDevOutbox = async ({ to, subject, html, text }) => {
    const outboxDir = path.join(__dirname, '..', 'outbox');
    await fs.promises.mkdir(outboxDir, { recursive: true });

    const safeName = `${Date.now()}-${String(to).replace(/[^a-z0-9._-]/gi, '_')}.html`;
    const outboxPath = path.join(outboxDir, safeName);
    const fallbackText = text ? `<pre>${text}</pre>` : '';

    await fs.promises.writeFile(
        outboxPath,
        `<!doctype html><html><body><h1>${subject}</h1>${html || fallbackText}</body></html>`,
        'utf8'
    );

    console.log(`[mailService] SMTP not configured. Email for ${to} saved to ${outboxPath}`);
    return outboxPath;
};

const sendMail = async ({ to, subject, html, text }) => {
    const transporter = getTransporter();

    if (!transporter) {
        await writeDevOutbox({ to, subject, html, text });
        return { sent: false };
    }

    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html
    });

    return { sent: true };
};

const buttonEmail = ({ title, intro, buttonLabel, link, outro }) => `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#166534;margin-bottom:12px">${title}</h2>
        <p>${intro}</p>
        <p style="margin:28px 0">
            <a href="${link}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;display:inline-block">${buttonLabel}</a>
        </p>
        <p style="font-size:13px;color:#64748b">If the button does not work, paste this link into your browser:</p>
        <p style="font-size:13px;word-break:break-all;color:#166534">${link}</p>
        <p>${outro}</p>
    </div>
`;

const codeEmail = ({ title, intro, code, outro }) => `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#166534;margin-bottom:12px">${title}</h2>
        <p>${intro}</p>
        <div style="margin:28px 0;text-align:center">
            <span style="display:inline-block;background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:16px 32px;font-size:32px;font-weight:800;letter-spacing:8px;color:#166534">${code}</span>
        </div>
        <p style="font-size:13px;color:#64748b">${outro}</p>
    </div>
`;

// Send a 6-digit verification code
const sendVerificationCode = async ({ user, code }) => {
    return sendMail({
        to: user.email,
        subject: `${code} — Your AgroVision verification code`,
        text: `Your AgroVision verification code is: ${code}\n\nThis code expires in 10 minutes.`,
        html: codeEmail({
            title: 'Verify your email',
            intro: `Hi ${user.fullName || 'there'}, welcome to AgroVision! Enter this code in the app to verify your email:`,
            code,
            outro: 'This code expires in 10 minutes. If you did not create an account, you can ignore this email.'
        })
    });
};

const sendPasswordResetEmail = async ({ user, token }) => {
    const link = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    return sendMail({
        to: user.email,
        subject: 'Reset your AgroVision password',
        text: `Reset your AgroVision password here: ${link}`,
        html: buttonEmail({
            title: 'Reset your password',
            intro: `Hi ${user.fullName || 'there'}, use the secure link below to create a new AgroVision password.`,
            buttonLabel: 'Reset password',
            link,
            outro: 'This link expires in 1 hour. You can ignore this email if you did not request it.'
        })
    });
};

module.exports = {
    sendVerificationCode,
    sendPasswordResetEmail
};
