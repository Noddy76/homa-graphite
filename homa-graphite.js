#!/usr/bin/env node
var homa = require('homa');
var lynx = require('lynx');

var systemId = homa.paramsWithDefaultSystemId("homa-graphite");

var metrics;

(function connect() {
  homa.mqttHelper.connect();
})();

homa.mqttHelper.on('connect', function(packet) {    
  homa.settings.require('statsd_host');
  homa.settings.require('statsd_port');

  homa.mqttHelper.subscribe("/devices/#");
});

homa.mqttHelper.on('message', function(packet) {
  homa.settings.insert(packet.topic, packet.payload);
  
  if (!homa.settings.isLocked() && homa.settings.isBootstrapCompleted()) {
    homa.settings.lock();
    var host = homa.settings.get("statsd_host");
    var port = homa.settings.get("statsd_port");
    console.log("Sending metrics to StatsD at %s:%s", host, port);
    metrics = new lynx(host, port);
  }

  if (typeof metrics == 'undefined') {
    return;
  }

  var match;

  if (match = /^\/devices\/([^\/]+)\/controls\/([^\/]+)$/.exec(packet.topic)) {
    var value = parseFloat(packet.payload);
    if (!isNaN(value)) {
      console.log("homa." + match[1] + "." + match[2] + "\t" + packet.payload);
      metrics.gauge("homa." + match[1] + "." + match[2], packet.payload);
    }
  }
});

