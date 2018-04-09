
var request = require('request');

var bitcoinaddress = require('bitcoin-address');
var bitcoreExplorers = require('bitcore-explorers');
var insight = new bitcoreExplorers.Insight();

delete global._bitcore;
var bitcore = require('bitcore-lib');


var options = {
  maximumFee: 5000,
  feeMode: 'halfHourFee',
  enableTransactions: false
};

var mergeOptions = function(newOptions){
  options = Object.assign(options, newOptions);
};

var isBitcoinAddressValid = function(btcAddress){
  return bitcoinaddress.validate(btcAddress);
};

var calculateUnspentSatoshis = function(utxos){
  let balance = 0;
  for (var i = 0; i < utxos.length; i++) {
    balance +=utxos[i]['satoshis'];
  }
  return balance;
};

var estimateMinerFee = function(utxos, txData, fees){
  let minerFee = new bitcore.Transaction()
    .from(utxos)
    .to(txData.toAddress, txData.amount)
    .change(txData.fromAddress)
    .sign(txData.privateKey)
    .serialize().length * fees[options.feeMode];
  
  return minerFee;
};

var broadcastTransaction = function(transaction, callback){
  console.log('SENDING THE TRANSACTION');
  insight.broadcast(transaction.serialize(), function(error, body) {
    if (error) {
      callback('Error in broadcast: ' + error);
    } 
    else {
      callback(null, {
        transactionId: body
      });
    }
  });
};


var performTransaction = function(txData, callback) {

    if (!isBitcoinAddressValid(txData.fromAddress)) {
      callback('Origin address checksum failed');
    }
    else if (!isBitcoinAddressValid(txData.toAddress)) {
      callback('Recipient address checksum failed');
    }
    else {
      
      request('https://bitcoinfees.earn.com/api/v1/fees/recommended', function(error, response, body) {
        if (error) {
          callback(error);
        }
        else if (response.statusCode !== 200) {
          callback('Wrong status-code? :', response.statusCode);
        }
        else {
          let fees = JSON.parse(body);
          
          insight.getUnspentUtxos(txData.fromAddress, function(error, utxos){
            var balance = calculateUnspentSatoshis(utxos);
            
            let minerFee = estimateMinerFee(utxos, txData, fees);

            if (minerFee > options.maximumFee){
              callback('maximum minerfee exceeded: ' + minerFee + ' satoshis' + ' current costs: ' +  JSON.stringify(fees));
            }
            else {
      
              if ((balance - minerFee - txData.amount) > 0) {

                let transaction = new bitcore.Transaction()
                  .from(utxos)
                  .to(txData.toAddress, txData.amount)
                  .fee(minerFee)
                  .change(txData.fromAddress)
                  .sign(txData.privateKey);

        
                if (transaction.getSerializationError()) {
                  callback( transaction.getSerializationError().message );
                }
                else {
                  if (options.enableTransactions === true){
                    broadcastTransaction(transaction, callback);
                  }
                  else {
                    callback('transactions are not enabled, we are most probably in debug mode, not sending the transaction');
                  }
                }
              }
              else {
                callback('not enough satoshis');
              }
            }
          });
        }
      });
    }
};
















module.exports = {
    performTransaction: performTransaction,
    mergeOptions: mergeOptions
    
};












