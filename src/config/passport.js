import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.model.js';
import logger from './logger.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, displayName, emails } = profile;
        const email = emails[0].value;

        // 1. Check if user exists with this Google ID
        let user = await User.findOne({ googleId: id });
        if (user) {
          return done(null, user);
        }

        // 2. Check if user exists with this email (registered with password)
        user = await User.findOne({ email });
        if (user) {
          // Link account
          user.googleId = id;
          user.name = user.name || displayName; // Only set if name wasn't set
          user.isVerified = true; // Google emails are verified
          await user.save();
          return done(null, user);
        }

        // 3. Create new user
        const newUser = await User.create({
          googleId: id,
          email,
          name: displayName,
          isVerified: true, // Google emails are implicitly verified
        });

        logger.info(`New user created via Google OAuth: ${email}`);
        return done(null, newUser);
      } catch (err) {
        logger.error('Error in Google OAuth strategy:', err);
        return done(err, false);
      }
    }
  )
);

// Note: We don't need serialize/deserializeUser for JWT-based auth
export default passport;