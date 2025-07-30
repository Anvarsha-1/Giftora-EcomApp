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
      const existingUser = await User.findOne({ googleId: profile.id });
      

      if (existingUser) {
        return done(null, existingUser);
      }

      
      const firstName = profile.name?.givenName || "NoFirstName";
      const lastName = profile.name?.familyName || "NoLastName";
      const email = profile.emails?.[0]?.value || `nodemail-${profile.id}@google.com`;
      const profileImage = profile.photos?.[0]?.value || 'https://via.placeholder.com/150';

      const existingEmail = await User.findOne({email})
      if(existingEmail){
        return done(null, false, { message: 'Email already registered. Please log in using your email and password.' });
      }


      const newUser = new User({
        googleId: profile.id,
        firstName: firstName,
        lastName: lastName,
        email: email,
        profileImage :{
         public_id:"",
         url:profileImage
        },
        phone:'registered by google',
      });
      

      await newUser.save();
      done(null, newUser);
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

module.exports=passport