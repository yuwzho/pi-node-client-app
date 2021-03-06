/*
* IoT Hub Raspberry Pi NodeJS - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';


const fs = require('fs');
const path = require('path');

const wpi = require('wiring-pi');

const Client = require('azure-iot-device').Client;
const ConnectionString = require('azure-iot-device').ConnectionString;
const Message = require('azure-iot-device').Message;
const Protocol = require('azure-iot-device-mqtt').Mqtt;

const MessageProcessor = require('./messageProcessor.js');

var sendingMessage = true;

// read in configuration in config.json
var config;
try {
  config = require('./config.json');
} catch (err) {
  console.error('Failed to load config.json: ' + err.message);
  return;
}

// set up wiring
wpi.setup('wpi');
wpi.pinMode(config.LEDPin, wpi.OUTPUT);
var messageProcessor = new MessageProcessor(config);

// create a client
// read out the connectionString from process environment
var connectionString = process.env['AzureIoTHubConnectionString'];
var client = initClient(connectionString, config);

client.open((err) => {
  if (err) {
    console.error('[IoT hub Client] Connect error: ' + err.message);
    return;
  }

  // set C2D and device method callback
  client.onDeviceMethod('start', onStart);
  client.onDeviceMethod('stop', onStop);
  client.on('message', receiveMessageCallback);
  onStart();
  setInterval(sendMessage, config.interval);
});

var messageId = 0;
function sendMessage() {
  if (!sendingMessage) { return; }
  messageId++;
  messageProcessor.getMessage(messageId, (content) => {
    var message = new Message(content);
    client.sendEvent(message, (err) => {
      if (err) {
        console.error('[IoT hub Client] Send message error: ' + err.message);
      } else {
        blinkLED();
        console.log('[IoT hub Client] Sent message: ' + content);
      }
    });
  });
}

function onStart(request, response) {
  console.log('Receive direct method: ' + request.payload);
  sendingMessage = true;

  response.send(200, 'Successully start sending message to cloud', function (err) {
    if (err) {
      console.error('[IoT hub Client] Failed sending a method response:\n' + err.message);
    }
  });
}

function onStop(request, response) {
  console.log('Receive direct method: ' + request.payload);
  sendingMessage = false;

  response.send(200, 'Successully stop sending message to cloud', function (err) {
    if (err) {
      console.error('[IoT hub Client] Failed sending a method response:\n' + err.message);
    }
  });
}

function receiveMessageCallback(msg) {
  blinkLED();
  var message = msg.getData().toString('utf-8');
  client.complete(msg, () => {
    console.log('Receive Cloud-to-Device message: ' + message);
  });
}

function blinkLED() {
  // Light up LED for 500 ms
  wpi.digitalWrite(config.LEDPin, 1);
  setTimeout(function () {
    wpi.digitalWrite(config.LEDPin, 0);
  }, 500);
}

function initClient(connectionStringParam, credentialPath) {
  var connectionString = ConnectionString.parse(connectionStringParam);
  var deviceId = connectionString.DeviceId;

  // fromConnectionString must specify a transport constructor, coming from any transport package.
  client = Client.fromConnectionString(connectionStringParam, Protocol);

  // Configure the client to use X509 authentication if required by the connection string.
  if (connectionString.x509) {
    // Read X.509 certificate and private key.
    // These files should be in the current folder and use the following naming convention:
    // [device name]-cert.pem and [device name]-key.pem, example: myraspberrypi-cert.pem
    var connectionOptions = {
      cert: fs.readFileSync(path.join(credentialPath, deviceId + '-cert.pem')).toString(),
      key: fs.readFileSync(path.join(credentialPath, deviceId + '-key.pem')).toString()
    };

    client.setOptions(connectionOptions);

    console.log('[Device] Using X.509 client certificate authentication');
  }
  return client;
}
