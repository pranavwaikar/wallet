var passwordValidator = require('password-validator');
var mongoose = require('mongoose');
var session = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(session);

const HOST = 'localhost';
const PORT = 3001;
const DB_URL  = 'mongodb://cmnshareteb:cmnshareteb1@ds161062.mlab.com:61062/walletio';
const ALGORITHM = 'aes-128-cbc';


const PWD_SCHEMA = new passwordValidator();
PWD_SCHEMA
.is().min(8)                                    // Minimum length 8
.is().max(100)                                  // Maximum length 100
//.has().uppercase()                              // Must have uppercase letters
.has().lowercase()                              // Must have lowercase letters
.has().digits()                                 // Must have digits
.has().not().spaces()                           // Should not have spaces
.is().not().oneOf(['Passw0rd', 'Password123']); // Blacklist these values

const PHNUMBER_SCHEMA = new passwordValidator();
PHNUMBER_SCHEMA
.is().min(10)
.is().max(10)
.has().digits()
.has().not().symbols()
.has().not().lowercase()
.has().not().uppercase()
.has().not().spaces();

const NAME_SCHEMA = new passwordValidator();
NAME_SCHEMA
.is().min(3)
.is().max(50)
.has().not().symbols()
.has().not().digits();

const PASSPHRASE_SCHEMA = new passwordValidator();
PASSPHRASE_SCHEMA
.is().min(8)
.is().max(300);


//DATABASE CONNECTIONS
mongoose.connect(DB_URL,{ useNewUrlParser: true });
//create schema for database
var userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phnumber : String,
  password : String,
  isWalletCreated : {type:Boolean , default:false},
  balance : Number ,
  publicKey: String,
  privateKey: String,
  strategy: String,
  sysPrivateKey:String,
  sysKey : String,
  userKey: String,
  addressBook: [ {name:String, publicKey:String} ]
});
var userModel = mongoose.model('user',userSchema);
//SESSION DATABASE SETUP
var STORE = new MongoDBStore({
  uri: DB_URL,
  collection: 'mySessions'
});
// Catch errors
STORE.on('error', function(error) {
  assert.ifError(error);
  assert.ok(false);
});


module.exports = {HOST,PORT,PWD_SCHEMA,PHNUMBER_SCHEMA,NAME_SCHEMA,STORE,userModel,ALGORITHM,PASSPHRASE_SCHEMA};