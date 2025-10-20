const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require('passport');
const User = require('../models/userSchema');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL,
},
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('Google profile:', profile);

      const firstName = profile.name?.givenName || "NoFirstName";
      const lastName = profile.name?.familyName || "NoLastName";
      const email = profile.emails?.[0]?.value || `nodemail-${profile.id}@google.com`;
      const profileImage = profile.photos?.[0]?.value || 'https://via.placeholder.com/150';

      // Check if user already exists by Google ID or email
      let user = await User.findOne({
        $or: [{ email }, { googleId: profile.id }]
      });

      if (user) {
        // User exists
        if (user.isBlocked) {
          // User is blocked, prevent login
          return done(null, false, { message: 'This account has been blocked.' });
        }
        if (!user.googleId) {
          // This is an existing local account, link it with Google ID
          user.googleId = profile.id;
          // Optionally update profile image if they don't have one
          if (!user.profileImage || !user.profileImage.url) {
            user.profileImage = { public_id: "", url: profileImage };
          }
          await user.save();
        }
        return done(null, user); // Login existing user
      }

      // Create new user
      const newUser = new User({
        googleId: profile.id,
        firstName,
        lastName,
        email,
        profileImage: {
          public_id: "",
          url: profileImage
        },
        phone: 'registered by google',
      });

      await newUser.save();
      return done(null, newUser);

    } catch (err) {
      done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

module.exports = passport;
