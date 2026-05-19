const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:5001').replace(/\/$/, '');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || 'dummy_client_id_for_dev_time',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret_for_dev_time',
    callbackURL: `${BACKEND_URL}/api/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = normalizeEmail(profile.emails?.[0]?.value);
        if (!email) {
            return done(new Error('Google did not provide an email address'), null);
        }

        // Check if user already exists based on googleId OR email
        let user = await User.findOne({ 
            $or: [
                { googleId: profile.id },
                { email }
            ]
        });

        if (user) {
            // If they signed up via email previously, link the googleId
            if (!user.googleId) user.googleId = profile.id;
            user.isEmailVerified = true;
            user.authProvider = user.authProvider || 'google';
            if (profile.photos?.[0]?.value && !user.profilePic) user.profilePic = profile.photos[0].value;
            await user.save();
            return done(null, user);
        }

        // Auto-create new user if none exists
        user = new User({
            googleId: profile.id,
            authProvider: 'google',
            fullName: profile.displayName || 'Google User',
            email,
            role: 'user',
            profilePic: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : '',
            isEmailVerified: true
            // no password set, handled nicely by User model
        });

        await user.save();
        done(null, user);
    } catch (err) {
        console.error('Google Auth Strategy Error:', err);
        done(err, null);
    }
}));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID || 'dummy_fb_id',
    clientSecret: process.env.FACEBOOK_APP_SECRET || 'dummy_fb_secret',
    callbackURL: `${BACKEND_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'name', 'emails', 'photos']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = normalizeEmail(profile.emails?.[0]?.value || '');

        let user = null;
        if (email) {
            user = await User.findOne({ 
                $or: [
                    { facebookId: profile.id },
                    { email: email }
                ]
            });
        } else {
            user = await User.findOne({ facebookId: profile.id });
        }

        if (user) {
            // Link facebook if not linked
            if (!user.facebookId) user.facebookId = profile.id;
            user.isEmailVerified = true;
            user.authProvider = user.authProvider || 'facebook';
            if (profile.photos?.[0]?.value && !user.profilePic) user.profilePic = profile.photos[0].value;
            await user.save();
            return done(null, user);
        }

        // Auto-create new user
        let fullName = profile.displayName || 'Facebook User';
        if (profile.name) {
            fullName = `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim();
        }
        if (!fullName) fullName = 'Facebook User';

        user = new User({
            facebookId: profile.id,
            authProvider: 'facebook',
            fullName: fullName,
            email: email || `${profile.id}@facebook.local`, // fallback if no email granted
            role: 'user',
            profilePic: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : '',
            isEmailVerified: true
        });

        await user.save();
        done(null, user);
    } catch (err) {
        console.error('Facebook Auth Strategy Error:', err);
        done(err, null);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
