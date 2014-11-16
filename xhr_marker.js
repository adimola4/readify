module.exports = function(){
  XMLHttpRequest.prototype.open = (function(){
    var origOpen = XMLHttpRequest.prototype.open;
    var absoluteUrl = function(url) {
      var a = document.createElement('a');
      a.href = url;
      return a.href;
    }
    return function(){
      window.callPhantom({ action: "addXhrUrl", url: absoluteUrl(arguments[1]) });
      return origOpen.apply(this, Array.prototype.slice.call(arguments));
    }
  }());

}