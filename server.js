var system    = require("system")
var webserver = require("webserver")
var webpage   = require("webpage")

var configPath = "./config.js"
var config     = require(configPath)

var readify = require('./readify')
var benchmark = require('./benchmark')

if (!config.port) {
  console.error("No port specified in " + configPath)
  phantom.exit(1)
}

var server    = webserver.create()
var port = Number(system.env.PORT || system.args[1]) || config.port
var listening = server.listen(port, onRequest)

if (!listening) {
  console.error("Could not bind to port " + port)
  phantom.exit(1)
}
console.log("Listening on port " + port)

function onRequest(req, res) {
  var page          = webpage.create()

  if (req.method != "GET") {
    return send(405, toHTML("Method not accepted."))
  }

  var url = parse(req.url)

  if(url.pathname == "/test"){
    return send(200, toHTML("Test is OK"))
  } else if (url.pathname != "/") {
    return send(404, toHTML("Not found."))
  }

  var query = url.query
  var href  = query.href

  if (!href) {
    return send(400, toHTML("`href` parameter is missing."))
  }

  var maxTime    = config.maxTime
  var readyEvent = config.readyEvent
  var loadImages = config.loadImages

  page.settings.loadImages = loadImages

  page.onInitialized = function() {

    page.evaluate(onInit, readyEvent)

    function onInit(readyEvent) {
      window.addEventListener(readyEvent, function() {
        setTimeout(window.callPhantom, 0)
      })
    }
  }

  page.onResourceRequested = function(requestData, networkRequest){
    if(requestData.id > 1 && !/(\.css|\.js|\.png|\.gif|\.jpe?g)(\?.*)?$/.test(requestData.url)){
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
        console.log('aborted request : ' + requestData.url );
       }
    }
  }

  page.onCallback = function() {
    send(200, JSON.stringify(out))
  }

  page.onConsoleMessage = function(msg) {
    if((/^(Readability|Benchmark)/).test(msg)){
      console.log('page: ' + msg);
    }
  };

  var timeout = setTimeout(page.onCallback, maxTime)

  var out, startedAt = new Date;
  page.open(href, function(status){
    console.log("Benchmark - url open: " + ( (new Date).getTime() - startedAt.getTime() ) + "ms");
    page.injectJs('benchmark.js');
    out = page.evaluate(readify);
  })

  function send(statusCode, data) {
    clearTimeout(timeout)

    res.statusCode = statusCode

    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Content-Length", byteLength(data))

    res.write(data)
    res.close()

    page.close()
  }
}

function byteLength(str) {
  return encodeURIComponent(str).match(/%..|./g).length
}

function toHTML(message) {
  return "<!DOCTYPE html><body>" + message + "</body>\n"
}

function parse(url) {
  var anchor = document.createElement("a")

  anchor.href = url
  anchor.query = {}

  anchor.search.slice(1).split("&").forEach(function(pair) {
    pair = pair.split("=").map(decodeURIComponent)
    anchor.query[pair[0]] = pair[1]
  })

  return anchor
}
