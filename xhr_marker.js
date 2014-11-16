module.exports = function(){
  XMLHttpRequest.prototype.send = function(){
    var origSend = XMLHttpRequest.prototype.send;
    return function(){
      this.setRequestHeader("x-requested-with", "xmlhttprequest");
      return origSend.call(this, Array.prototype.slice.call(arguments));
    }
  }
}