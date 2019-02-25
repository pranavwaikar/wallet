//this is test script to see how much time it takes to mine 100 transaction.
//using this we can approximately define transactions per minute
// Result: core 2 duo : 32 bit : windows 7 :  
// Execution time (hr): 67s 634.284258ms Number of transactions:100

const Utils = require('./utils');

let recipient="049ad2aae3e84b775d6ef6ec209114aabd5f7fb84d6bba262c6cb919d641e648486252a9fe5e37a06e34878d36680ed159c82f18ffe3a7b5e7c31ed11e00273e48";
let ammount=1;
let privateKey="474e1bac9dc839c20cc6e3e6913a658c54b9845a581ce86a558731f416561294";
let publicKey = "04078fa044d810d0073ac7ecf3b7e3804eeb56dc82889f6ac04ca2d5f4cd80f2b3d3455df15b3645f4fdd52f4373aaa08c73d780b58576fa43585b0f86f9104da2";
let txns=0;

var hrend;
var hrstart = process.hrtime();



for (var i = 0; i < 100; i++) {
	testMe();
}


function testMe()
{
	Utils.POSTjson('/launch-user-transaction',
    {"recipient":recipient,"ammount":ammount,"privateKey":privateKey,"publicKey":publicKey},function(err,result) {
      //you can log your results here
  });
	Utils.GETjson('/do-mine-transactions',function(err,result){
	    //you can log here
	    txns=txns+1;
	    print();
  });
}

function print() {
	hrend = process.hrtime(hrstart);
	console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
	console.info('Number of transactions:'+txns);
}

