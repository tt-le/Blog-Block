//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const mongoose = require("mongoose");
const date = require(__dirname + "/date.js");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 2000;
let secret = process.env.SECRET || "thisisasecretkey";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(session({ secret: secret, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

//DATABASE
const ADMIN = process.env.MONGO_ADMIN;
const PW = process.env.MONGO_PW;
const DBNAME = process.env.DBNAME;
const uri = `mongodb+srv://${ADMIN}:${PW}@cluster0-iykpd.mongodb.net/${DBNAME}?retryWrites=true&w=majority`;
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});
mongoose.set("useCreateIndex", true);

const postSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  date: String,
});

const userSchema = mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
  facebookId: String,
  posts: [postSchema]
})

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const Post = mongoose.model("Post", postSchema);
const User = mongoose.model("User", userSchema);

// // // // // // // //
// COOKIES/SESSIONS  //
// // // // // // // //
passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:2000/auth/google/profile",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
      (accessToken, refreshToken, profile, cb) => {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:2000/auth/facebook/profile"
  },
  (accessToken, refreshToken, profile, done) => {
    User.findOrCreate({ facebookId: profile.id }, function(err, user) {
      if (err) { return done(err); }
      done(null, user);
    });
  }
));


//Lorum Ipsum content
const homeStartingContent =
  "Lacus vel facilisis volutpat est velit egestas dui id ornare. Semper auctor neque vitae tempus quam. Sit amet cursus sit amet dictum sit amet justo. Viverra tellus in hac habitasse. Imperdiet proin fermentum leo vel orci porta. Donec ultrices tincidunt arcu non sodales neque sodales ut. Mattis molestie a iaculis at erat pellentesque adipiscing. Magnis dis parturient montes nascetur ridiculus mus mauris vitae ultricies. Adipiscing elit ut aliquam purus sit amet luctus venenatis lectus. Ultrices vitae auctor eu augue ut lectus arcu bibendum at. Odio euismod lacinia at quis risus sed vulputate odio ut. Cursus mattis molestie a iaculis at erat pellentesque adipiscing.";
const aboutContent =
  "Hac habitasse platea dictumst vestibulum rhoncus est pellentesque. Dictumst vestibulum rhoncus est pellentesque elit ullamcorper. Non diam phasellus vestibulum lorem sed. Platea dictumst quisque sagittis purus sit. Egestas sed sed risus pretium quam vulputate dignissim suspendisse. Mauris in aliquam sem fringilla. Semper risus in hendrerit gravida rutrum quisque non tellus orci. Amet massa vitae tortor condimentum lacinia quis vel eros. Enim ut tellus elementum sagittis vitae. Mauris ultrices eros in cursus turpis massa tincidunt dui.";
const contactContent =
  "Scelerisque eleifend donec pretium vulputate sapien. Rhoncus urna neque viverra justo nec ultrices. Arcu dui vivamus arcu felis bibendum. Consectetur adipiscing elit duis tristique. Risus viverra adipiscing at in tellus integer feugiat. Sapien nec sagittis aliquam malesuada bibendum arcu vitae. Consequat interdum varius sit amet mattis. Iaculis nunc sed augue lacus. Interdum posuere lorem ipsum dolor sit amet consectetur adipiscing elit. Pulvinar elementum integer enim neque. Ultrices gravida dictum fusce ut placerat orci nulla. Mauris in aliquam sem fringilla ut morbi tincidunt. Tortor posuere ac ut consequat semper viverra nam libero.";




app.get("/", (req, res) => {
  Post.find({}, (err, posts) => {
    res.render("home", { homeContent: homeStartingContent, POSTS: posts});
  });
});

app.route("/profile").get((req, res) => {
  if(!req.isAuthenticated()) {
    res.redirect("/login");
  } else {
    res.render("/profile", {user: req.user});
  }
});


app.route("/login").get((req,res) =>{
  if(!req.isAuthenticated()){
    res.render('login');
  } else {
    res.redirect('/');
  }
}
).post((req, res) => {

});

app.route("/auth/google/")
  .get(passport.authenticate("google", { scope: ["profile"] }));
app.route("/auth/google/profile")
  .get(
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
      // Successful authentication, redirect secrets.
      res.redirect("/profile");
    }
  );

app.get('/auth/facebook',
  passport.authenticate('facebook')); 

  app.get('/auth/facebook/profile',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect('/profile');
  });



app.get("/posts/:postID", (req, res) => {
  const requestedId = req.params.postID;
  console.log("the req id" + requestedId);

  Post.findById(req.params.postID, (err, requestedPost) => {
    res.render("post", {
      title: requestedPost.title,
      body: requestedPost.body,
    });
  });
});

app.route("/compose")
  .get((req, res) => {
    res.render("compose");
  })
  .post((req, res) => {
    const newPost = new Post({
      title: req.body.postTitle,
      body: req.body.postBody,
      date: date.getDate(),
    });
    newPost.save();
    res.redirect("/");
  });

  app.route("/profile/:user").get((req, res)=> {
    
  })





  app.get("/about", (req, res) => {
    res.render("about", { aboutContent: aboutContent });
  });
  
  app.get("/contact", (req, res) => {
    res.render("contact", { contactContent: contactContent });
  });


app.listen(PORT, () => {
  console.log("server started");
});
