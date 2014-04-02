var system    = require("system")
var webserver = require("webserver")
var webpage   = require("webpage")

var configPath = system.args[1] || "./config.js"
var config     = require(configPath)

var readify = require('./readify')

if (!config.port) {
  console.error("No port specified in " + configPath)
  phantom.exit(1)
}

var server    = webserver.create()
var port = Number(system.env.PORT) || config.port
var listening = server.listen(port, onRequest)

if (!listening) {
  console.error("Could not bind to port " + port)
  phantom.exit(1)
}

function onRequest(req, res) {
  var page          = webpage.create()
  var bytesConsumed = 0

  if (req.method != "GET") {
    return send(405, toHTML("Method not accepted."))
  }

  var url = parse(req.url)

  if (url.pathname != "/") {
    return send(404, toHTML("Not found."))
  }

  var query = url.query
  var href  = query.href

  if (!href) {
    return send(400, toHTML("`href` parameter is missing."))
  }

  var maxTime    = Number(query.max_time)  || config.maxTime
  var maxBytes   = Number(query.max_bytes) || config.maxBytes
  var readyEvent = query.ready_event       || config.readyEvent
  var loadImages = "load_images" in query  || config.loadImages

  page.settings.loadImages = loadImages

  page.onInitialized = function() {

    page.evaluate(onInit, readyEvent)

    function onInit(readyEvent) {
      window.addEventListener(readyEvent, function() {
        setTimeout(window.callPhantom, 0)
      })
    }
  }

  page.onResourceReceived = function(resource) {
    if (resource.bodySize) bytesConsumed += resource.bodySize

    if (bytesConsumed > maxBytes) {
      send(502, toHTML("More than " + maxBytes + "consumed."))
    }
  }

  page.onCallback = function() {
    send(200, JSON.stringify(out))
  }

  page.onConsoleMessage = function(msg) {
    console.log('page: ' + msg);
  };

  var timeout = setTimeout(page.onCallback, maxTime)

  var out;

  page.open(href, function(status){
    out = page.evaluate(readify);
  })

  function send(statusCode, data) {
    clearTimeout(timeout)

    res.statusCode = statusCode

    res.setHeader("Content-Type", "application/json")
    res.setHeader("Content-Length", byteLength(data))
    res.setHeader("X-Rndrme-Bytes-Consumed", bytesConsumed.toString())

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
