var system    = require("system"),
    webserver = require("webserver"),
    webpage   = require("webpage");

var config     = require("./config.js"),
    readify = require('./readify'),
    benchmark = require('./benchmark');

if (!config.port) {
  console.error("No port specified in config.js");
  phantom.exit(1);
}

var server    = webserver.create();
var port = Number(system.env.PORT || system.args[1]) || config.port;
var listening = server.listen(port, onRequest);

if (!listening) {
  console.error("Could not bind to port " + port);
  phantom.exit(1);
}
console.log("Listening on port " + port);

function onRequest(req, res) {
  var page          = webpage.create(),
      requestServed = false;

  if (req.method != "GET") {
    return send(405, toHTML("Method not accepted."));
  }

  var url = parse(req.url);

  if(url.pathname == "/test"){
    return send(200, toHTML("Test is OK"));
  } else if (url.pathname != "/") {
    return send(404, toHTML("Not found."));
  }

  var query = url.query,
      href  = query.href;

  if (!href) {
    return send(400, toHTML("`href` parameter is missing."));
  }

  page.settings.loadImages = config.loadImages;

  page.onInitialized = function() {

    page.evaluate(onInit, config.readyEvent);

    function onInit(readyEvent) {
      window.addEventListener(readyEvent, function() {
        setTimeout(window.callPhantom, 0);
      })
    }
  }

  page.onResourceRequested = function(requestData, networkRequest){
    if(page.url != 'about:blank' && !/(\.css|\.js|\.png|\.gif|\.jpe?g)(\?.*)?$/.test(requestData.url)){
       var i, l, curItem, abort = true;
       for(i = 0, l = requestData.headers.length; i < l; ++i){
         curItem = requestData.headers[i];
         if(curItem.name.toLowerCase() == 'x-requested-with' && curItem.value.toLowerCase() == 'xmlhttprequest'){
           abort = false;
           break;
         }
       }
       if(abort){
        networkRequest.abort();
        //console.log('aborted request : ' + requestData.url );
       }
    }
  }

  page.onCallback = function() {
    send(200, JSON.stringify(out), true);
  }

  page.onConsoleMessage = function(msg) {
    if((/^(Readability|Benchmark)/).test(msg)){
      console.log('page: ' + msg);
    }
  };

  var timeout = setTimeout(function(){
    console.log("page readify timeout (" + config.maxTime + "ms)");
    send(502, toHTML("page readify timeout"));
  }, config.maxTime);

  var out, startedAt = new Date;
  page.open(href, function(status){
    console.log("Benchmark - url open: " + ( (new Date).getTime() - startedAt.getTime() ) + "ms");
    page.injectJs('benchmark.js');
    out = page.evaluate(readify);
  });

  function send(statusCode, data, isJson) {
    if(!requestServed){
      clearTimeout(timeout);

      res.statusCode = statusCode;
      if(isJson){
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      } else {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
      }
      res.setHeader("Content-Length", byteLength(data));

      res.write(data);
      res.close();
      res = null;

      page.close();
      page = null;

      requestServed = true;
    }
  }
}

function byteLength(str) {
  return encodeURIComponent(str).match(/%..|./g).length;
}

function toHTML(message) {
  return "<!DOCTYPE html><html><head><title>Readify</title></head><body>" + message + "</body></html>\n";
}

function parse(url) {
  var anchor = document.createElement("a");

  anchor.href = url;
  anchor.query = {};

  anchor.search.slice(1).split("&").forEach(function(pair) {
    pair = pair.split("=").map(decodeURIComponent);
    anchor.query[pair[0]] = pair[1];
  })

  return anchor;
}
