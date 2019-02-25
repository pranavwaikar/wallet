//This file contains common utility functions which can be used directly in app 
var http = require('http');
var request = require('request');
const secureRandom = require('secure-random');
var crypto = require('crypto');
const {HOST,PORT,ALGORITHM} = require('./config');

class utils
{
	//Used to make GET request to any API
	static GETjson(path,cb)
	{
		var options = {
			host: HOST,
			port: PORT,
			path: path,
			method: 'GET'
		};

		http.request(options,function(res){
		var body = '';
		res.on('data',function(chunk){
			body +=chunk;
		});
		res.on('end',function(){
			var result = JSON.parse(body);
			cb(null,result);
		});
		res.on('error',cb);
		})
		.on('error',cb)
		.end();
	}

	//makes POST request to any API where request body is JSON
	static POSTjson(path,senddata,cb)
	{
		var options={
			host: HOST,
			port: PORT,
			path:path,
			method: 'POST',
			headers :{
				'Content-Type': 'application/json'
			}
		};
		var req = http.request(options,function(res){
			var body='';
			res.on('data',function(chunk){
				body +=chunk;
				var result = JSON.parse(body);
				cb(null,result);
			});
		});
		
		req.on('error',function(e){
			console.log('Error while POST request',e.message);
		});
		
		req.write(JSON.stringify(senddata));
		req.end();
	}

	//encrypts the given data with given key & returns cypher text
	static encryptData(data,key)
	{
		var cipher = crypto.createCipher(ALGORITHM,key);
		var encrypted = cipher.update(data,'utf8','hex') + cipher.final('hex');
	return encrypted;
	}

	//decrypts the given cypher text with given key & returns plain text
	static decryptData(encyptedMsg,key)
	{
		var decipher = crypto.createDecipher(ALGORITHM,key);
		var decrypted = decipher.update(encyptedMsg, 'hex', 'utf8') + decipher.final('utf8'); 
	return decrypted;
	}

	//generates random 32bit hex string
	static generateKey()
	{
	return secureRandom.randomBuffer(32).toString('hex');
	}
}

module.exports = utils;
