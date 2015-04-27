#!/usr/bin/env node
var homa = require('homa');
var devNull = require('dev-null');
var net = require('net');

var log = require('./logger.js');

var systemId = homa.paramsWithDefaultSystemId("homa-graphite");

var host;
var port;

var buffer = [];

(function connect() {
  homa.logger.stream = devNull();
  homa.logger.on('log', function(msg) {
    log[msg.level](msg.prefix + " - " + msg.message);
  });
  homa.mqttHelper.connect();
})();

homa.mqttHelper.on('connect', function(packet) {    
  homa.settings.require('graphite_host');
  homa.settings.require('graphite_port');

  homa.mqttHelper.subscribe("/devices/#");
});

homa.mqttHelper.on('message', function(packet) {
  homa.settings.insert(packet.topic, packet.payload);
  
  if (!homa.settings.isLocked() && homa.settings.isBootstrapCompleted()) {
    homa.settings.lock();
    host = homa.settings.get("graphite_host").toString();
    port = parseInt(homa.settings.get("graphite_port").toString());
    log.info("Sending metrics to Graphite at %s:%s", host, port);
  }

  if (typeof host == 'undefined' || typeof port == 'undefined') {
    return;
  }

  var match;

  if (match = /^\/devices\/([^\/]+)\/controls\/([^\/]+)$/.exec(packet.topic)) {
    var value = parseFloat(packet.payload);
    if (!isNaN(value)) {
      var metric = "homa." + match[1] + "." + match[2];
      var value = packet.payload.toString();
      var timestamp = Math.floor(Date.now() / 1000);

      var record = [metric, value, timestamp].join(' ');
      buffer.push(record);
    }
  }
});

function sendBuffer() {
  (function() {
    if (buffer.length < 1) {
      return;
    }

    var records = buffer;
    buffer = [];
    
    var client = new net.Socket();
    client.connect(port, host, function() {
      for (var i = 0; i < records.length; i++) {
        client.write(records[i] + "\n");
      }
      client.end();
      log.debug("Sent %d records to graphite", records.length);
    });
  })();

  var timeToNextRun = 10000 - (Date.now() % 10000);
  if (timeToNextRun < 100) timeToNextRun += 10000;
  setTimeout(sendBuffer, timeToNextRun);
}

sendBuffer();
