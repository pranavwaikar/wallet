var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var ObjectId = require('mongodb').ObjectId; 

var emailValidator = require("email-validator");
var passwordValidator = require('password-validator');
const bcrypt = require('bcryptjs');
const saltRounds = 10;


var passport = require('passport');
var CustomStrategy = require('passport-custom');

var Utils=require('./utils');
const {PWD_SCHEMA,PHNUMBER_SCHEMA,PASSPHRASE_SCHEMA,NAME_SCHEMA,STORE,userModel} = require('./config');

mongoose.set('useFindAndModify', false);


/*
//add data to mongodb
var user1 = userModel({name:'pkw',email:'pkw@pkw.com',phnumber:'7066506779',password:'pkw'}).save(function(err){
  if(err) throw err;
  console.log('user added.');
});
*/


//params
var loginErrors = new Object();



var app = express();
app.set('view engine','ejs');
app.use('/assets',express.static('assets'));
app.use(require('express-session')({
  secret: 'kjhasdkjhkasdk',
  store: STORE,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // cookie age: 1 week
  }
  //cookie: { secure: true }
}));
app.use(passport.initialize());
app.use(passport.session());
var urlencodedParser = bodyParser.urlencoded({ extended: false });


app.use(function(req,res,next){
  res.locals.isAuthenticated = req.isAuthenticated();
  res.locals.isUser = req.user;
  next();
});

app.get('/', function(req,res) {
  res.render('home',{});
});

app.get('/home', function(req,res) {
  res.render('home',{});
});

app.get('/about', function(req,res) {
  res.render('about',{});
});

//__________________________________LOGIN RELATED ROUTINES________________________________________

//use passport js for password validation.
passport.use(new CustomStrategy(
  function(req, done) {
    userModel.find({email:req.body.email},function(err,data){
      if(err) throw err;

      if(data.length === 0 || data.length >1 ) {
        console.log('zero or more than 1 user with same email!');
        return done(null,false);
      }

      bcrypt.compare(req.body.pwd,data[0].password,function(err,response){
        if(response === true) {
          req.login(data[0]._id,function(err) {
            return done(null, data[0]._id);
          });
        }
        else {
          loginErrors.success = false;
          //console.log('password do not match! invalid!');
          return done(null,false);
        }
      });
  }
)}));


//simple login page rendering
app.get('/login', function(req,res) {
  console.log(req.user);
  console.log(req.isAuthenticated());
  res.render('login',{errors:loginErrors});
});

//when user enters login data, it is parsed here
app.post('/login',urlencodedParser,passport.authenticate('custom',
{ failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/profile');
  }
);

//____________________________________LOGOUT RELATED ROUTINES _____________________________________
//it simply removes session & user gets logged out
app.get('/logout',function(req,res) {
  req.logout();
  req.session.destroy();
  res.redirect('/');
});

//_______________________________________SIGN-UP RELATED ROUTINES____________________________________
app.get('/register', function(req,res) {
  var error = new Object();
  res.render('register',{errors:error});
});

app.post('/register',urlencodedParser,function(req,res){
  registerUser(req.body.name,req.body.phnumber,req.body.email,req.body.pwd,req.body.pwd2,function(err,error){
  if(err)
    console.log('Error while register user : ',err);
  res.render('register',{errors: error});
  });
});

//____________________________________________PROFILE RELATED ROUTINES ____________________________________

//simple rendering of profile page
//fetches user details from database & balance from cryptocurrency
//display all details to user
app.get('/profile',authenticationMiddleware(), function(req,res) {
  getProfile(req.user,function(err,profile){
  if(err)
    console.log('Error --',err);

  getBalance(req.user,function(err,result){
    if(err)
      console.log('Error while fetching balance-',err);
    var profileBalance = new Object();
    profileBalance.balance=result.balance;
    res.render('profile',{profileData:profile,profileBalanceData:profileBalance});
  });   
  });
});

//user can change email or mobile number here
//upon updating again show the profile page with updated value
app.post('/profile-update',urlencodedParser,authenticationMiddleware(),function(req,res){
  updateProfile(req.user,req.body.email,req.body.phnumber,function(err,profile){
    if(err)
      console.log('Error while profile update--',err);
    getBalance(req.user,function(err,result) {
      if(err)
        console.log('Error while fetching balance--',err);
      var profileBalance = new Object();
      profileBalance.balance=result.balance;

      res.render('profile',{profileData:profile,profileBalanceData:profileBalance});
    });
  });
});

//simple password change form rendering
app.get('/change-password',authenticationMiddleware(), function(req,res) {
  var error= new Object();
    res.render('change-password',{errors:error});
});

//Accepts old & new password , validates & updates password.
//Notifies success or failure of coperation
app.post('/change-password',urlencodedParser,authenticationMiddleware(),function(req,res){
  changePassword(req.user,req.body.pwd,req.body.pwd1,req.body.pwd2,function(err,result){
    if(err)
      console.log('Error while change-password --',err);

    res.render('change-password',{errors:result});
  });
});

//_________________________________________KEY MANAGEMENT RELATED ROUTINES______________________________________

//Render the key management policy page
//here page highlights the current startegy 
app.get('/key-settings',authenticationMiddleware(), function(req,res) {
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,data){
    var obj = new Object();
    obj.strategy = data.strategy;
    res.render('key-settings',{Data:obj});
  });
});

//User lands here when he selects automatic strategy
//we find his current strategy & show the form accordingly
app.get('/make-auto',authenticationMiddleware(), function(req,res) {  
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,data){
    var obj = new Object();
    obj.strategy = data.strategy;
    res.render('make-auto',{Data:obj});
  });
});

//When user enters data in auto strategy form , it is parsed here
//according to the current strategy , the input changes.
//we take input necessary,validate input, manipulate DB, show success/failure for operation
app.post('/make-auto',urlencodedParser,authenticationMiddleware(), function(req,res) {  
  if (typeof req.body.userKey !== 'undefined' && req.body.userKey !== null) {
   if(!PASSPHRASE_SCHEMA.validate(req.body.userKey)) {
     var obj = new Object();
       obj.passphrase = false;
       obj.success  = false;   
       res.render('make-auto',{Data:obj});
       return;
   }
}
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,data){
    bcrypt.compare(req.body.pwd,data.password,function(err,response){
        if(response === true) 
        {
          if (data.strategy === 'AUTO') {
            makeAutoStrategy(req.user,null,null,function(err,obj){
              res.render('make-auto',{Data:obj});
            });
          } else if(data.strategy === 'RECOVERABLE') {
            makeAutoStrategy(req.user,null,null,function(err,obj){
              res.render('make-auto',{Data:obj});
            });
          } else if(data.strategy === 'NONRECOVERABLE') {
            makeAutoStrategy(req.user,req.body.userKey,null,function(err,obj){
              res.render('make-auto',{Data:obj});
            });
          } else if(data.strategy === 'DONTSAVE') {
            makeAutoStrategy(req.user,null,req.body.privateKey,function(err,obj){
              res.render('make-auto',{Data:obj});
            });
          }
        }
        else {
          //if password is incorrect
          var obj = new Object();
          obj.password = false;
          obj.success  = false;
          res.render('make-auto',{Data:obj});
        }
      });   
  });
});

//User lands here when he selects recoverable strategy
//we find his current strategy & show the form accordingly
app.get('/make-recoverable',authenticationMiddleware(), function(req,res) {  
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,data){
    var obj = new Object();
    obj.strategy = data.strategy;
    res.render('make-recoverable',{Data:obj});
  });
});

//When user enters data in recoverable strategy form , it is parsed here
//according to the current strategy , the input changes. we validate
//we take input necessary,validate input, manipulate DB, show success/failure for operation
app.post('/make-recoverable',urlencodedParser,authenticationMiddleware(), function(req,res) {  
    if (typeof req.body.userKey !== 'undefined' && req.body.userKey !== null) {
   if(!PASSPHRASE_SCHEMA.validate(req.body.userKey)) {
     var obj = new Object();
       obj.passphrase = false;
       obj.success  = false;   
       res.render('make-recoverable',{Data:obj});
       return;
   }
}
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,data){
    bcrypt.compare(req.body.pwd,data.password,function(err,response){
        if(response === true) 
        {
          if (data.strategy === 'AUTO') {
            makeRecoverableStrategy(req.user,req.body.userKey,null,function(err,obj){
              res.render('make-recoverable',{Data:obj});
            });
          } else if(data.strategy === 'RECOVERABLE') {
            makeRecoverableStrategy(req.user,null,null,function(err,obj){
              res.render('make-recoverable',{Data:obj});
            });
          } else if(data.strategy === 'NONRECOVERABLE') {
            makeRecoverableStrategy(req.user,req.body.userKey,null,function(err,obj){
              res.render('make-recoverable',{Data:obj});
            });
          } else if(data.strategy === 'DONTSAVE') {
            makeRecoverableStrategy(req.user,req.body.userKey,req.body.privateKey,function(err,obj){
              res.render('make-recoverable',{Data:obj});
            });
          }
        }
        else {
          //if password is incorrect
          var obj = new Object();
          obj.password = false;
          obj.success  = false;
          res.render('make-recoverable',{Data:obj});
        }
      });   
  });
});


//User lands here when he selects recoverable strategy
//we find his current strategy & show the form accordingly
app.get('/make-nonrecoverable',authenticationMiddleware(), function(req,res) {  
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,data){
    var obj = new Object();
    obj.strategy = data.strategy;
    res.render('make-nonrecoverable',{Data:obj});
  });
});


//When user enters data in nonrecoverable strategy form , it is parsed here
//according to the current strategy , the input changes.
//we take input necessary,validate input, manipulate DB, show success/failure for operation
app.post('/make-nonrecoverable',urlencodedParser,authenticationMiddleware(), function(req,res) {  
    if (typeof req.body.userKey !== 'undefined' && req.body.userKey !== null) {
     if(!PASSPHRASE_SCHEMA.validate(req.body.userKey)) {
       var obj = new Object();
         obj.passphrase = false;
         obj.success  = false;   
         res.render('make-nonrecoverable',{Data:obj});
         return;
     }
    }
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,data){
    bcrypt.compare(req.body.pwd,data.password,function(err,response){
        if(response === true) 
        {
          if (data.strategy === 'AUTO') {
            makeNonrecoverableStrategy(req.user,req.body.userKey,null,function(err,obj){
              res.render('make-nonrecoverable',{Data:obj});
            });
          } else if(data.strategy === 'RECOVERABLE') {
            makeNonrecoverableStrategy(req.user,null,null,function(err,obj){
              res.render('make-nonrecoverable',{Data:obj});
            });
          } else if(data.strategy === 'NONRECOVERABLE') {
            makeNonrecoverableStrategy(req.user,null,null,function(err,obj){
              res.render('make-nonrecoverable',{Data:obj});
            });
          } else if(data.strategy === 'DONTSAVE') {
            makeNonrecoverableStrategy(req.user,req.body.userKey,req.body.privateKey,function(err,obj){
              res.render('make-nonrecoverable',{Data:obj});
            });
          }
        }
        else {
          //if password is incorrect
          var obj = new Object();
          obj.password = false;
          obj.success  = false;
          res.render('make-nonrecoverable',{Data:obj});
        }
      });   
  });
});



//User lands here when he selects recoverable strategy
//we find his current strategy & show the form accordingly
app.get('/make-dontsave',authenticationMiddleware(), function(req,res) {  
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,data){
    var obj = new Object();
    obj.strategy = data.strategy;
    res.render('make-dontsave',{Data:obj});
  });
});



//When user enters data in dont save strategy form , it is parsed here
//according to the current strategy , the input changes.
//we take input necessary,validate input, manipulate DB, redirect user to key-download page
app.post('/make-dontsave',urlencodedParser,authenticationMiddleware(), function(req,res) {
    if (typeof req.body.userKey !== 'undefined' && req.body.userKey !== null) {
     if(!PASSPHRASE_SCHEMA.validate(req.body.userKey)) {
         var obj = new Object();
         obj.passphrase = false;
         obj.success  = false;   
         res.render('make-dontsave',{Data:obj});
         return;
     }
    }
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,data){
    bcrypt.compare(req.body.pwd,data.password,function(err,response){
        if(response === true) 
        {
          if (data.strategy === 'AUTO') {
            makeDontsaveStrategy(req.user,null,null,function(err,obj){
              res.render('make-dontsave',{Data:obj});
            });
          } else if(data.strategy === 'RECOVERABLE') {
            makeDontsaveStrategy(req.user,req.body.userKey,null,function(err,obj){
              res.render('make-dontsave',{Data:obj});
            });
          } else if(data.strategy === 'NONRECOVERABLE') {
            makeDontsaveStrategy(req.user,req.body.userKey,null,function(err,obj){
              res.render('make-dontsave',{Data:obj});
            });
          } else if(data.strategy === 'DONTSAVE') {
            makeDontsaveStrategy(req.user,null,null,function(err,obj){
              res.render('make-dontsave',{Data:obj});
            });
          }
        }
        else {
          //if password is incorrect
          var obj = new Object();
          obj.password = false;
          obj.success  = false;
          res.render('make-dontsave',{Data:obj});
        }
      });   
  });
});

//When dont save strategy is selected. This page shows key for last time & 
//user can download his key from here in privateKey.txt file 
//keys 
app.post('/download-key',urlencodedParser, function(req,res) {
  var key = req.body.privateKey;
  console.log('key--',key);
  res.setHeader('Content-type', "application/octet-stream");
  res.setHeader('Content-disposition', 'attachment; filename=privateKey.txt');
  res.send(key);
});

//_________________________________TRANSACTION HISTORY & STATUS RELATED ROUTINES_________________________________

//requests debit completed transactions & shows in table format
app.get('/completed-transactions',authenticationMiddleware(), function(req,res) {
  getCompletedTransactions(req.user,function(err,result){
    if(err)
      console.log('Error while fetching completed transactions-',err);
    var completedTransactions = new Object();
    completedTransactions.data = result;
    completedTransactions.success = true;
    res.render('completed-transactions',{transactionData:completedTransactions});
  });
});

//requests debit pending transactions & shows in table format
app.get('/pending-transactions',authenticationMiddleware(), function(req,res) {
  getPendingTransactions(req.user,function(err,result){
    if(err)
      console.log('Error while fetching pending transactions-',err);
    var pendingTransactions = new Object();
    pendingTransactions.data = result;
    pendingTransactions.success = true;
    res.render('pending-transactions',{transactionData:pendingTransactions});
  });
});

//requests credit completed transactions & shows in table format
app.get('/completed-credit-transactions',authenticationMiddleware(), function(req,res) {
  getCompletedCreditTransactions(req.user,function(err,result){
    if(err)
      console.log('Error while fetching completed transactions-',err);
    console.log(result);
    var completedTransactions = new Object();
    completedTransactions.data = result;
    completedTransactions.success = true;
    res.render('completed-credit-transactions',{transactionData:completedTransactions});
  });
});

//requests pending transactions & shows in table format
app.get('/pending-credit-transactions',authenticationMiddleware(), function(req,res) {
  getPendingCreditTransactions(req.user,function(err,result){
    if(err)
      console.log('Error while fetching completed transactions-',err);
    console.log(result);
    var completedTransactions = new Object();
    completedTransactions.data = result;
    completedTransactions.success = true;
    res.render('pending-credit-transactions',{transactionData:completedTransactions});
  });
});

//shows transact form according to KMS strategy
//shows current balance 
app.get('/transactions',authenticationMiddleware(), function(req,res) {
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,data) {
  if(err) throw err;
    getBalance(req.user,function(err,result){
      if(err)
        console.log('Error while fetching balance-',err);
      var transaction = new Object();
      transaction.strategy= data.strategy;
      transaction.isGet = true;
      transaction.balance=result.balance;
      if (req.query.name && req.query.key) {
        transaction.recipientName = req.query.name;
        transaction.recipientKey = req.query.key;
      }
      res.render('transactions',{transactionData:transaction});
    }); 
  });   
});

//here we take  transaction input & forward it to crypto currency
//it sends the transaction reciept as response
//display it to the user.
app.post('/transactions',urlencodedParser,authenticationMiddleware(), function(req,res) {
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,userProfile) {
  if(err) throw err;
  if (userProfile.strategy ===  'AUTO') {
    makeTransaction(req.user,req.body.recipient,Number(req.body.ammount),null,null,function(err,result){
      if(err)
        console.log('Error while making transactions',err);
      var transaction = new Object();
      transaction.Tid = result.Tid;
      transaction.ammount = result.Ammount;
      transaction.balance = result.Balance;
      transaction.recipient = result.recipientAddress;
      transaction.sender = result.senderAddress;
      transaction.status = result.status; 
      transaction.success = true;
      transaction.strategy = userProfile.strategy;
      res.render('transactions',{transactionData:transaction});
    });
  } else if (userProfile.strategy === 'RECOVERABLE') {
    makeTransaction(req.user,req.body.recipient,Number(req.body.ammount),req.body.userKey,null,function(err,result){
      if(err)
        console.log('Error while making transactions',err);
      var transaction = new Object();
      transaction.Tid = result.Tid;
      transaction.ammount = result.Ammount;
      transaction.balance = result.Balance;
      transaction.recipient = result.recipientAddress;
      transaction.sender = result.senderAddress;
      transaction.status = result.status; 
      transaction.success = true;
      transaction.strategy = userProfile.strategy;
      res.render('transactions',{transactionData:transaction});
    });  
  } else if (userProfile.strategy === 'NONRECOVERABLE') {
    makeTransaction(req.user,req.body.recipient,Number(req.body.ammount),req.body.userKey,null,function(err,result){
      if(err)
        console.log('Error while making transactions',err);
      var transaction = new Object();
      transaction.Tid = result.Tid;
      transaction.ammount = result.Ammount;
      transaction.balance = result.Balance;
      transaction.recipient = result.recipientAddress;
      transaction.sender = result.senderAddress;
      transaction.status = result.status; 
      transaction.success = true;
      transaction.strategy = userProfile.strategy;
      res.render('transactions',{transactionData:transaction});
    });   
  } else if (userProfile.strategy === 'DONTSAVE') {
    makeTransaction(req.user,req.body.recipient,Number(req.body.ammount),null,req.body.privateKey,function(err,result){
      if(err)
        console.log('Error while making transactions',err);
      var transaction = new Object();
      transaction.Tid = result.Tid;
      transaction.ammount = result.Ammount;
      transaction.balance = result.Balance;
      transaction.recipient = result.recipientAddress;
      transaction.sender = result.senderAddress;
      transaction.status = result.status; 
      transaction.success = true;
      transaction.strategy = userProfile.strategy;
      res.render('transactions',{transactionData:transaction});
    });
  }
  });
});

//this is handle for mine -now button
//displays reciept for transaction to user.
app.get('/mine-now',authenticationMiddleware(), function(req,res) {
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,data) {

  Utils.GETjson('/do-mine-transactions',function(err,result){
    if (result.status === 'failed') {
      var transaction = new Object();
      transaction.status = result.status;
      transaction.errors = result.errors;
      transaction.failed = true;
      transaction.strategy = data.strategy;
      res.render('transactions',{transactionData:transaction});
    } else
    {
      var transaction = new Object();
      transaction.Tid = result.Tid;
      transaction.ammount = result.Ammount;
      transaction.balance = result.Balance;
      transaction.recipient = result.recipientAddress;
      transaction.sender = result.senderAddress;
      transaction.status = result.status; 
      transaction.errors = result.errors;
      transaction.strategy = data.strategy;
      transaction.failed = false;
      res.render('transactions',{transactionData:transaction});
    }
  });   
  });
});


//____________________________________________TOOLS RELATED ROUTINES________________________________________


//        __________________________RECOVER PASSPHRASE RELATED ROUTINES_________________

//If user has opted for recoverable then show input form
//if not then show the error & link to change strategy
app.get('/recover-passphrase', function(req,res) {
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,userProfile) {
  if(err) throw err;
  var obj = new Object();
  obj.strategy = userProfile.strategy;
  res.render('recover-passphrase',{recoveryData:obj});
  });
});

//accept password & new passphrase 
//verify & vallidate bot fields
//Manipulte DB & show success/failure
app.post('/recover-passphrase',urlencodedParser,authenticationMiddleware(), function(req,res) {

  userModel.findOne({"_id":new ObjectId(req.user)},function(err,userProfile){
   if(PASSPHRASE_SCHEMA.validate(req.body.userKey))
   { 
    bcrypt.compare(req.body.pwd,userProfile.password,function(err,response){
        if(response === true) 
        {
          var decryptedKey = Utils.decryptData(userProfile.sysPrivateKey,userProfile.sysKey);
          var encryptedKey = Utils.encryptData(decryptedKey,req.body.userKey);

          userModel.findOneAndUpdate({"_id":new ObjectId(req.user)},
            {$set:{privateKey:encryptedKey}},{new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
            var obj = new Object();
            obj.success  = true;
            obj.strategy = userProfile.strategy;
            res.render('recover-passphrase',{recoveryData:obj});
          });
        }
        else {
          //if password is incorrect
          var obj = new Object();
          obj.password = true;
          obj.success  = false;
          obj.strategy = userProfile.strategy;
          res.render('recover-passphrase',{recoveryData:obj});
        }
      });
    }
     else
     {
          var obj = new Object();
          obj.passphrase = true;
          obj.success  = false;
          obj.strategy = userProfile.strategy;
          res.render('recover-passphrase',{recoveryData:obj});
     }
  });
   
});


//      _____________________________________ADDRESS BOOK RELATED ROUTINES_________________

//default landing page , show form for entry addition
// shows all previous entries
app.get('/address-book', function(req,res) {
  userModel.findOne({"_id":new ObjectId(req.user)},function(err,userProfile) {
  if(err) throw err;
    var addressData = new Object();
    addressData.data = userProfile.addressBook;
    res.render('address-book',{addressData:addressData});
  });
});

// prepoulate the fields according to URL structure
//if action is edit then prepoulate selected entry fields in form for editing
//if action is remove then delete the entry from DB
//show success/failure for operation
app.get('/address-bookops', function(req,res) {
  if (req.query) {
    if (req.query.act === 'edit') {
      //pre populate fields
      userModel.findOne({"_id":new ObjectId(req.user)},function(err,userProfile) {
        if(err) throw err;
          var addressData = new Object();
          addressData.data = userProfile.addressBook;
          addressData.edit = true;
          addressData.editName = req.query.name;
          addressData.editKey = req.query.key;
          res.render('address-book',{addressData:addressData});
          return;
        });
    }
    if (req.query.act === 'remove') {
      userModel.findOneAndUpdate({"_id":new ObjectId(req.user)},{ $pull: { addressBook: { name: req.query.name , publicKey: req.query.key } } },
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
              var addressData = new Object();
              addressData.removal = true;
              addressData.data = doc.addressBook;
              //res.render('address-book',{addressData:addressData});
              res.redirect('/address-book');
              return;
            });
    }
  } 
});


//add new entry in address book
//validate fields of input
// add entry in DB
//show suceess/failure
app.post('/address-book',urlencodedParser, function(req,res) {
  var isNameOk  = NAME_SCHEMA.validate(req.body.name);
  var isKeyOk   = PASSPHRASE_SCHEMA.validate(req.body.publicKey);
  var addressData = new Object();

  if (!isNameOk) 
    addressData.names = false;
  if (!isKeyOk) 
    addressData.key = false;
  if (isNameOk && isKeyOk === true) {
    userModel.findOneAndUpdate({"_id":new ObjectId(req.user)},{$push: {addressBook: {name: req.body.name, publicKey: req.body.publicKey}}},
        {new: true},(err,doc) => {
          if(err)
            console.log('Error while updating database!',err);
          var addressData = new Object();
          addressData.success = true;
          addressData.data = doc.addressBook;
          res.render('address-book',{addressData:addressData});
      });
  }
  else
  {
    userModel.findOne({"_id":new ObjectId(req.user)},(err,doc) => {
          if(err)
            console.log('Error while updating database!',err);
          addressData.data = doc.addressBook;
          addressData.success = false;
          res.render('address-book',{addressData:addressData});
      });
  }
});


//while editing, validate the fields
//add updated entry first & then delete the old entry
app.post('/address-book-update',urlencodedParser, function(req,res) {
  var isNameOk  = NAME_SCHEMA.validate(req.body.name);
  var isKeyOk   = PASSPHRASE_SCHEMA.validate(req.body.publicKey);
  var addressData = new Object();

  if (!isNameOk) 
    addressData.names = false;
  if (!isKeyOk) 
    addressData.key = false;
  if (isNameOk && isKeyOk === true) {
    userModel.findOneAndUpdate({"_id":new ObjectId(req.user)},
      {$push: {addressBook: {name: req.body.name, publicKey: req.body.publicKey}}},
        {new: true},(err,doc) => {
          if(err)
            console.log('Error while updating database!',err);
      });
    userModel.findOneAndUpdate({"_id":new ObjectId(req.user)},
      {$pull: {addressBook: {name: req.body.oldname, publicKey: req.body.oldkey}}},
        {new: true},(err,doc) => {
          if(err)
            console.log('Error while updating database!',err);
          var addressData = new Object();
          addressData.editSuccess = true;
          addressData.data = doc.addressBook;
          res.render('address-book',{addressData:addressData})
      });

  }
  else
  {
    userModel.findOne({"_id":new ObjectId(req.user)},(err,doc) => {
          if(err)
            console.log('Error while updating database!',err);
          addressData.data = doc.addressBook;
          addressData.success = false;
          res.render('address-book',{addressData:addressData});
      });
  }
});

//____________________________________________MOCK ENDPOINT_______________________________________________
app.get('/test', function(req,res) {
  console.log(req.query);
  if (req.query.act === 'edit') {

  }
  if (req.query.act === 'remove') {

  }
  if (req.query.recipient) {
    console.log('here');
  }
  res.render('test',{});
});


app.post('/test',urlencodedParser, function(req,res) {
  console.log(req.body.encdata,req.body.key);
  var decryptedKey = Utils.decryptData(req.body.encdata,req.body.key);

  console.log('decryptedKey--',decryptedKey); 
});



app.listen(3000,function(){
         console.log('walletio Server started at 3000');
});


//_________________________________________________SERVICE ROUTINES___________________________________________
passport.serializeUser(function(user_id, done) {
  done(null, user_id);
});

passport.deserializeUser(function(user_id, done) {
    done(null, user_id);
});

function authenticationMiddleware () {
	return (req, res, next) => {
		console.log(`req.session.passport.user: ${JSON.stringify(req.session.passport)}`);

	    if (req.isAuthenticated()) return next();
	    res.redirect('/login')
	}
}

//backend calls
function getProfile(user_id,cb)
{
  userModel.findOne({"_id":new ObjectId(user_id)},function(err,data){
      if(err) throw err;
      if (data.isWalletCreated) {
      var profile = new Object();
          profile.publicKey =  data.publicKey;
          profile.privateKey = data.privateKey;
          profile.balance = data.balance;
          profile.email = data.email;
          profile.phnumber = data.phnumber;
          profile.success = true;
      cb(null,profile);
        } 
      else {
        //hit create user endpoint
        Utils.GETjson('/create-user',function(err,result){
          if(err)
             console.log('Error while GET request : ',err);
          var sysKey = Utils.generateKey(); 
          var encryptedKey = Utils.encryptData(result.privateKey,sysKey); 
          userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{publicKey:result.publicKey,privateKey:encryptedKey,sysKey:sysKey,sysPrivateKey:encryptedKey,strategy:'AUTO',balance:result.balance,isWalletCreated:true}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var profile = new Object();
        profile.email = doc.email;
        profile.phnumber = doc.phnumber;
        profile.balance = doc.balance;
        profile.publicKey = doc.publicKey;
        profile.privateKey = doc.privateKey;
        profile.success = true;
        cb(null,profile);
            });
        });
      }
   });
}

function registerUser(name,phnumber,email,pwd1,pwd2,cb)
{
  var error = new Object();
  //validate 
  var isNameOk  = NAME_SCHEMA.validate(name);
  var isPhnumberOk = PHNUMBER_SCHEMA.validate(phnumber);
  var isEmailOk  = emailValidator.validate(email);
  var isPwdOK  = PWD_SCHEMA.validate(pwd1);
  
  
  var isPwd2Ok;
  if(pwd1 === pwd2)
    isPwd2Ok = true;
  else
    isPwd2Ok = false;

  if(!isNameOk)
    error.names =true;
  if(!isPhnumberOk)
    error.phone = true;
  if(!isEmailOk)
    error.email = true;
  if(!isPwdOK)
    error.password = true;
  if(!isPwd2Ok)
    error.password2 = true;

  var isExistsOk=false;
  
  userModel.find({email:email},function(err,data){
      if(err) throw err;

      if(data.length === 0 || data.length >1 )
       {
        error.exists = true;
        exval=true;
       }
   });

  if( (isNameOk && isPhnumberOk && isEmailOk && isPwdOK && isPwd2Ok=== true) && (isExistsOk === false) )
  {
    bcrypt.hash(pwd1, saltRounds, function(err, hash) {
    // Store hash in your password DB.
    var userEntry = userModel({name:name,phnumber:phnumber,email:email ,password:hash})
  .save(function(err){
      if(err) throw err;
      });
    });
    error.success = true;
   }
   else
   {
     error.success= false;
   }
   
   cb(null,error);
}


function getCompletedTransactions(user_id,cb)
{
  userModel.findOne({"_id":new ObjectId(user_id)},function(err,data) {
  if(err) throw err;
  Utils.POSTjson('/get-completed-user-transactions',{"publicKey":data.publicKey},function(err,result){
    cb(null,result);
  });
  });
}

function getPendingTransactions(user_id,cb)
{
  userModel.findOne({"_id":new ObjectId(user_id)},function(err,data) {
  if(err) throw err;
  Utils.POSTjson('/get-pending-user-transactions',{"publicKey":data.publicKey},function(err,result){
    cb(null,result);
  });
  });
}

function getCompletedCreditTransactions(user_id,cb)
{
  userModel.findOne({"_id":new ObjectId(user_id)},function(err,data) {
  if(err) throw err;
  Utils.POSTjson('/get-completed-credit-user-transactions',{"publicKey":data.publicKey},function(err,result){
    cb(null,result);
  });
  });
}

function getPendingCreditTransactions(user_id,cb)
{
  userModel.findOne({"_id":new ObjectId(user_id)},function(err,data) {
  if(err) throw err;
  Utils.POSTjson('/get-pending-credit-user-transactions',{"publicKey":data.publicKey},function(err,result){
    cb(null,result);
  });
  });
}

function makeTransaction(user_id,recipient,ammount,userKey,privateKey,cb)  //changes here due to different key mgmt #######
{
  userModel.findOne({"_id":new ObjectId(user_id)},function(err,userProfile){
  if(err) throw err;
  var realKey;
  if (userProfile.strategy ===  'AUTO') {
    realKey = Utils.decryptData(userProfile.privateKey,userProfile.sysKey);
  } else if (userProfile.strategy === 'RECOVERABLE') {
    realKey = Utils.decryptData(userProfile.privateKey,userKey);
  } else if (userProfile.strategy === 'NONRECOVERABLE') {
    realKey = Utils.decryptData(userProfile.privateKey,userKey);
  } else if (userProfile.strategy === 'DONTSAVE') {
    realKey = privateKey;
  }
    Utils.POSTjson('/launch-user-transaction',
    {"recipient":recipient,"ammount":ammount,"privateKey":realKey,"publicKey":userProfile.publicKey},function(err,result) {
      cb(null,result);
    });
  });
}

function getBalance(user_id,cb)
{
  userModel.findOne({"_id":new ObjectId(user_id)},function(err,data){
    Utils.POSTjson('/get-user-balance',{"publicKey":data.publicKey},function(err,result){
      cb(null,result);
    });
  });
}

function updateProfile(user_id,email,phnumber,cb)
{
  var profile = new Object();
  var isEmailOk  = emailValidator.validate(email);
  var isPhnumberOk = PHNUMBER_SCHEMA.validate(phnumber);

  if(!isEmailOk)
  {
    profile.errorEmail =true;
  }
  if(!isPhnumberOk)
  {
    profile.errorPhone = true;
  }
  //check if email already exists or not #################
  if(isEmailOk && isPhnumberOk === true)
  {
    userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{email:email,phnumber:phnumber}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
              profile.email = doc.email;
              profile.phnumber = doc.phnumber;
              profile.balance = doc.balance;
              profile.publicKey = doc.publicKey;
              profile.privateKey = doc.privateKey;
              profile.success = true;
              cb(null,profile);
            });
  }
  else
  {
    cb(null,profile);
  }
}

function changePassword(user_id,oldPwd,newPwd,newPwd2,cb)
{
  var errors = new Object();
  var isOldPwdOK  = PWD_SCHEMA.validate(oldPwd);
  var isNewPwdOK  = PWD_SCHEMA.validate(newPwd);
  var isNewPwd2OK;
  if (newPwd === newPwd2) 
    isNewPwd2OK = true;
  else 
    isNewPwd2OK = false;

  if(!isOldPwdOK);
    errors.pwd = true;
  if(!isNewPwdOK);
    errors.pwd1 = true; 
  if(!isNewPwd2OK);
    errors.pwd2 = true;

  if(isOldPwdOK && isNewPwdOK && isNewPwd2OK === true) {
    userModel.findOne({"_id":new ObjectId(user_id)},function(err,data){
    bcrypt.compare(oldPwd,data.password,function(err,response){
        if(response === true) 
        {
          //update pwd

          bcrypt.hash(newPwd, saltRounds, function(err, hash) {
            // Store hash in your password DB.
            userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{password:hash}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
              var errors = new Object();
              errors.success = true;
              cb(null,errors);
            });
            });
        }
        else {
          var errors = new Object();
          errors.pwd = true;
          errors.success =false;
          cb(null,errors);
        }
      });
    });
  }
  else {
    cb(null,errors);
  } 
}

function makeAutoStrategy(user_id,userKey,privateKey,cb)
{
  userModel.findOne({"_id":new ObjectId(user_id)},function(err,userProfile){

    if (userProfile.strategy === 'AUTO') {
      var obj = new Object();
      obj.success = true;
      cb(null,obj);
    }
    else if (userProfile.strategy === 'RECOVERABLE') {
      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{privateKey:userProfile.sysPrivateKey,strategy:'AUTO'},$unset:{sysPrivateKey:1}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.success = true;
        cb(null,obj);
      });
    }
    else if (userProfile.strategy === 'NONRECOVERABLE') {
      var decryptedKey = Utils.decryptData(userProfile.privateKey,userKey);
      var sysKey = Utils.generateKey();
      var encryptedKey = Utils.encryptData(decryptedKey,sysKey);

      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{privateKey:encryptedKey,sysKey:sysKey,strategy:'AUTO'}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.success = true;
        cb(null,obj);
      });

    }
    else if (userProfile.strategy === 'DONTSAVE') {
      var sysKey = Utils.generateKey();
      var encryptedKey = Utils.encryptData(privateKey,sysKey);

      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{privateKey:encryptedKey,sysKey:sysKey,strategy:'AUTO'}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.success = true;
        cb(null,obj);
      });
    }
  });
}

function makeRecoverableStrategy(user_id,userKey,privateKey,cb)
{
  userModel.findOne({"_id":new ObjectId(user_id)},function(err,userProfile){

    if (userProfile.strategy === 'AUTO') {
      var sysPrivateKey = userProfile.privateKey;
      var decryptedKey = Utils.decryptData(userProfile.privateKey,userProfile.sysKey);
      var encryptedKey = Utils.encryptData(decryptedKey,userKey);

      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{privateKey:encryptedKey,sysPrivateKey:sysPrivateKey,strategy:'RECOVERABLE'}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.success = true;
        cb(null,obj);
      });
    }
    else if (userProfile.strategy === 'RECOVERABLE') {
      var obj = new Object();
      obj.success = true;
      cb(null,obj);
    }
    else if (userProfile.strategy === 'NONRECOVERABLE') {
      var decryptedKey = Utils.decryptData(userProfile.privateKey,userKey);
      var sysKey = Utils.generateKey();
      var encryptedKey = Utils.encryptData(decryptedKey,sysKey);

      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{sysPrivateKey:encryptedKey,sysKey:sysKey,strategy:'RECOVERABLE'}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.success = true;
        cb(null,obj);
      });

    }
    else if (userProfile.strategy === 'DONTSAVE') {
      var sysKey = Utils.generateKey();
      var sysPrivateKey = Utils.encryptData(privateKey,sysKey);
      var encryptedKey = Utils.encryptData(privateKey,userKey);
      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{privateKey:encryptedKey,sysKey:sysKey,sysPrivateKey:sysPrivateKey,strategy:'RECOVERABLE'}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.success = true;
        cb(null,obj);
      });
    }
  });
}

function makeNonrecoverableStrategy(user_id,userKey,privateKey,cb)
{
  userModel.findOne({"_id":new ObjectId(user_id)},function(err,userProfile){

    if (userProfile.strategy === 'AUTO') {
      var decryptedKey = Utils.decryptData(userProfile.privateKey,userProfile.sysKey);
      var encryptedKey = Utils.encryptData(decryptedKey,userKey);

      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{privateKey:encryptedKey,strategy:'NONRECOVERABLE'},$unset:{sysPrivateKey:1,sysKey:1}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.success = true;
        cb(null,obj);
      });
    }
    else if (userProfile.strategy === 'RECOVERABLE') {
      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{strategy:'NONRECOVERABLE'},$unset:{sysPrivateKey:1,sysKey:1}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.success = true;
        cb(null,obj);
      });    
    }
    else if (userProfile.strategy === 'NONRECOVERABLE') {
      var obj = new Object();
      obj.success = true;
      cb(null,obj);
    }
    else if (userProfile.strategy === 'DONTSAVE') {
      var encryptedKey = Utils.encryptData(privateKey,userKey);
      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{privateKey:encryptedKey,strategy:'NONRECOVERABLE'}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.success = true;
        cb(null,obj);
      });
    }
  });
}

function makeDontsaveStrategy(user_id,userKey,privateKey,cb)
{
  userModel.findOne({"_id":new ObjectId(user_id)},function(err,userProfile){

    if (userProfile.strategy === 'AUTO') {
      var decryptedKey = Utils.decryptData(userProfile.privateKey,userProfile.sysKey);
      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{strategy:'DONTSAVE'},$unset:{sysPrivateKey:1,sysKey:1,privateKey:1}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.privateKey = decryptedKey;
        obj.success = true;
        cb(null,obj);
      });
    }
    else if (userProfile.strategy === 'RECOVERABLE') {
      var decryptedKey = Utils.decryptData(userProfile.privateKey,userKey);
      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{strategy:'DONTSAVE'},$unset:{sysPrivateKey:1,sysKey:1,privateKey:1}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.privateKey = decryptedKey;
        obj.success = true;
        cb(null,obj);
      });    
    }
    else if (userProfile.strategy === 'NONRECOVERABLE') {
      var decryptedKey = Utils.decryptData(userProfile.privateKey,userKey);
      userModel.findOneAndUpdate({"_id":new ObjectId(user_id)},
            {$set:{strategy:'DONTSAVE'},$unset:{privateKey:1}},
            {new: true},(err,doc) => {
              if(err)
                console.log('Error while updating database!',err);
        var obj = new Object();
        obj.privateKey = decryptedKey;
        obj.success = true;
        cb(null,obj);
      });
    }
    else if (userProfile.strategy === 'DONTSAVE') {
      var obj = new Object();
      obj.success = true;
      cb(null,obj);
    }
  });
}
