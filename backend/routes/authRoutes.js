const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('passport');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { sendVerificationCode, sendPasswordResetEmail } = require('../utils/mailService');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || 'dummy_client');
const SECRET_KEY = process.env.SECRET_KEY || 'mysecret123';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const createRawToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Generate a 6-digit verification code
const generate6DigitCode = () => {
    return String(Math.floor(100000 + Math.random() * 900000));
};

const publicUser = (user) => ({
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    profilePic: user.profilePic || '',
    isEmailVerified: user.isEmailVerified
});

const signToken = (user) => jwt.sign({
    id: String(user._id),
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    profilePic: user.profilePic || ''
}, SECRET_KEY, { expiresIn: '7d' });

// Issue a 6-digit verification code and send it via email
const issueVerificationCode = async (user) => {
    const code = generate6DigitCode();
    user.verificationCode = code;
    user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();
    console.log(`[auth] Verification code for ${user.email}: ${code}`);
    let mail = { sent: false };
    try {
        mail = await sendVerificationCode({ user, code });
    } catch (emailErr) {
        console.error(`[auth] Failed to send verification email to ${user.email}:`, emailErr.message);
        console.log(`[auth] Code is still valid — use: ${code}`);
    }
    return { code, mail };
};

const providerConfigured = (provider) => {
    if (provider === 'google') {
        return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    }
    if (provider === 'facebook') {
        return Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
    }
    return false;
};

const oauthUnavailableRedirect = (provider) => (
    `${FRONTEND_URL}/signin?error=${encodeURIComponent(`${provider}_not_configured`)}`
);

const oauthFailureRedirect = (provider) => (
    `${FRONTEND_URL}/signin?error=${encodeURIComponent(`${provider}_oauth_failed`)}`
);

const redirectOAuthSuccess = (res, user) => {
    const token = signToken(user);
    const userQuery = encodeURIComponent(JSON.stringify(publicUser(user)));
    res.redirect(`${FRONTEND_URL}/auth-success?token=${encodeURIComponent(token)}&user=${userQuery}`);
};

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { fullName, password, role } = req.body;
        const email = normalizeEmail(req.body.email);

        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'Full name, email and password are required' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            if (!existingUser.isEmailVerified) {
                // Re-send a new code
                const { code, mail } = await issueVerificationCode(existingUser);
                return res.status(202).json({
                    message: 'Account exists but is not verified. A new verification code has been sent.',
                    requiresVerification: true,
                    email: existingUser.email,
                    emailSent: mail.sent,
                    devCode: process.env.NODE_ENV === 'production' ? undefined : code
                });
            }
            return res.status(400).json({ message: 'User already exists' });
        }

        const requestedRole = role === 'admin' && process.env.ALLOW_PUBLIC_ADMIN_REGISTER === 'true' ? 'admin' : 'user';
        const isAdminAccount = requestedRole === 'admin';

        const user = new User({
            fullName,
            email,
            password,
            role: requestedRole,
            authProvider: 'local',
            isEmailVerified: isAdminAccount
        });

        await user.save();

        // Admin accounts skip verification
        if (isAdminAccount) {
            const token = signToken(user);
            return res.status(201).json({ token, user: publicUser(user) });
        }

        // Send 6-digit code
        const { code, mail } = await issueVerificationCode(user);

        res.status(201).json({
            message: 'Account created. Please enter the 6-digit code sent to your email.',
            requiresVerification: true,
            email: user.email,
            emailSent: mail.sent,
            devCode: process.env.NODE_ENV === 'production' ? undefined : code
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── Verify 6-digit code ───────────────────────────────────────────────────────
router.post('/verify-code', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: 'Email and verification code are required.' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }

        const user = await User.findOne({
            email,
            verificationCode: String(code),
            verificationCodeExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification code.' });
        }

        user.isEmailVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();

        // Issue JWT token after successful verification
        const token = signToken(user);
        res.json({
            message: 'Email verified successfully!',
            token,
            user: publicUser(user)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── Resend verification code ──────────────────────────────────────────────────
router.post('/resend-verification', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({ message: 'If this email has an account, a verification code has been sent.' });
        }

        if (user.isEmailVerified) {
            return res.json({ message: 'This email is already verified.' });
        }

        const { code, mail } = await issueVerificationCode(user);
        res.json({
            message: 'New verification code sent.',
            emailSent: mail.sent,
            devCode: process.env.NODE_ENV === 'production' ? undefined : code
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
        const user = await User.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.isBanned) {
            return res.status(403).json({ message: 'Your account has been suspended by the administrator.' });
        }

        if (!user.isEmailVerified) {
            return res.status(403).json({
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Please verify your email before signing in.'
            });
        }

        const token = signToken(user);
        res.json({ token, user: publicUser(user) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    res.json({ user: publicUser(req.user) });
});

// ── Forgot Password ──────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const user = await User.findOne({ email });

        if (user && !user.isBanned) {
            const rawToken = createRawToken();
            user.passwordResetToken = hashToken(rawToken);
            user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
            await user.save();
            await sendPasswordResetEmail({ user, token: rawToken });
        }

        res.json({ message: 'If this email has an account, a password reset link has been sent.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password || password.length < 6) {
            return res.status(400).json({ message: 'A valid token and a password of at least 6 characters are required.' });
        }

        const user = await User.findOne({
            passwordResetToken: hashToken(token),
            passwordResetExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Password reset link is invalid or expired.' });
        }

        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        user.isEmailVerified = true;
        await user.save();

        res.json({ message: 'Password updated. You can sign in with your new password.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==== WEB FLOW: Google OAuth Redirect ====
router.get('/google', (req, res, next) => {
    if (!providerConfigured('google')) {
        return res.redirect(oauthUnavailableRedirect('google'));
    }
    return passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
});

router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: oauthFailureRedirect('google') }),
    (req, res) => {
        const user = req.user;
        if (user.isBanned) {
            return res.redirect(`${FRONTEND_URL}/signin?error=banned`);
        }
        redirectOAuthSuccess(res, user);
    }
);

// ==== WEB FLOW: Facebook OAuth Redirect ====
router.get('/facebook', (req, res, next) => {
    if (!providerConfigured('facebook')) {
        return res.redirect(oauthUnavailableRedirect('facebook'));
    }
    return passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
});

router.get('/facebook/callback',
    passport.authenticate('facebook', { session: false, failureRedirect: oauthFailureRedirect('facebook') }),
    (req, res) => {
        const user = req.user;
        if (user.isBanned) {
            return res.redirect(`${FRONTEND_URL}/signin?error=banned`);
        }
        redirectOAuthSuccess(res, user);
    }
);

// ==== MOBILE FLOW: Google Token Verification ====
router.post('/google/mobile', async (req, res) => {
    try {
        const { idToken } = req.body;

        const audiences = [
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_WEB_CLIENT_ID,
            process.env.GOOGLE_ANDROID_CLIENT_ID,
            process.env.GOOGLE_IOS_CLIENT_ID
        ].filter(Boolean);

        const ticket = await client.verifyIdToken({
            idToken,
            audience: audiences.length > 0 ? audiences : undefined
        });

        const payload = ticket.getPayload();

        let user = await User.findOne({
            $or: [
                { googleId: payload.sub },
                { email: normalizeEmail(payload.email) }
            ]
        });

        if (user) {
            if (!user.googleId) user.googleId = payload.sub;
            user.authProvider = user.authProvider || 'google';
            user.isEmailVerified = true;
            if (payload.picture && !user.profilePic) user.profilePic = payload.picture;
            await user.save();
        } else {
            user = new User({
                googleId: payload.sub,
                authProvider: 'google',
                fullName: payload.name || 'Google User',
                email: normalizeEmail(payload.email),
                role: 'user',
                profilePic: payload.picture || '',
                isEmailVerified: true
            });
            await user.save();
        }

        if (user.isBanned) {
            return res.status(403).json({ message: 'Your account has been suspended by the administrator.' });
        }

        const token = signToken(user);
        res.json({ token, user: publicUser(user) });
    } catch (err) {
        console.error('Google Mobile verification error', err);
        res.status(401).json({ message: 'Invalid Google token' });
    }
});

// ==== MOBILE FLOW: Facebook Access Token Verification ====
router.post('/facebook/mobile', async (req, res) => {
    try {
        const { accessToken } = req.body;
        if (!accessToken) {
            return res.status(400).json({ message: 'Facebook access token is required' });
        }

        const graphUrl = new URL('https://graph.facebook.com/me');
        graphUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');
        graphUrl.searchParams.set('access_token', accessToken);

        const graphResponse = await fetch(graphUrl);
        const profile = await graphResponse.json();

        if (!graphResponse.ok || !profile.id) {
            return res.status(401).json({ message: 'Invalid Facebook token' });
        }

        const email = normalizeEmail(profile.email || `${profile.id}@facebook.local`);
        let user = await User.findOne({
            $or: [
                { facebookId: profile.id },
                { email }
            ]
        });

        if (user) {
            if (!user.facebookId) user.facebookId = profile.id;
            user.authProvider = user.authProvider || 'facebook';
            user.isEmailVerified = true;
            if (profile.picture?.data?.url && !user.profilePic) user.profilePic = profile.picture.data.url;
            await user.save();
        } else {
            user = new User({
                facebookId: profile.id,
                authProvider: 'facebook',
                fullName: profile.name || 'Facebook User',
                email,
                role: 'user',
                profilePic: profile.picture?.data?.url || '',
                isEmailVerified: true
            });
            await user.save();
        }

        if (user.isBanned) {
            return res.status(403).json({ message: 'Your account has been suspended by the administrator.' });
        }

        const token = signToken(user);
        res.json({ token, user: publicUser(user) });
    } catch (err) {
        console.error('Facebook Mobile verification error', err);
        res.status(401).json({ message: 'Invalid Facebook token' });
    }
});

module.exports = router;
