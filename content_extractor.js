var extract = function(){

  var i;

  var nodesToScore = document.querySelectorAll("p, div, pre, section, article, blockquote, li, td, span, font, img, iframe");
  var candidates = [];

  var curNode, parentNode, grandParentNode, score, tagName, goodImages = [], videos = [];
  for(i = nodesToScore.length - 1; i >= 0; --i ){
    
    curNode = nodesToScore[i];

    tagName = curNode.nodeName.toLowerCase();

    if(tagName == "iframe" && isVideoUrl(curNode.src)){
      curNode.isVideo = true;
      videos.push(curNode);
    } else if(tagName == "img" && isGoodImage(curNode)){
      curNode.isGoodImage = true;
      goodImages.push(curNode);
    } else if(!nodeIsVisible(curNode)){
      continue;
    }
    
    initNode(curNode);
    
    parentNode = curNode.parentNode;
    initNode(parentNode);

    grandParentNode = parentNode !== document.body ? parentNode.parentNode : null;
    if(grandParentNode){
      initNode(grandParentNode);
    }

    score = 0;

    if(curNode.isVideo || curNode.isGoodImage){
      score += 20;
    } else {
      score += getWordCount(getDirectInnerText(curNode));
    }

    curNode.readify.score += score;
    if(curNode.readify.score > 40){
      candidates.push(curNode);
    }

    parentNode.readify.score += score/2;
    candidates.push(parentNode);

    if(grandParentNode){
      grandParentNode.readify.score += score/3;
      candidates.push(grandParentNode);
    }

  }

  var curCandidate, topCandidate = null;
  for(i = candidates.length - 1; i >= 0; --i){
    curCandidate = candidates[i];
    if(!topCandidate || (curCandidate.readify.score > topCandidate.readify.score)){
      topCandidate = curCandidate;
    }
  }

  var articleContents = [];
  var sibling, topCandidateSiblings = Array.prototype.slice.call(topCandidate.parentNode.children);
  for(i = topCandidateSiblings.length - 1; i >= 0 ; --i){
    sibling = topCandidateSiblings[i];
    if(sibling === topCandidate || (sibling.readify && (sibling.readify.score >= 3))){
      articleContents.unshift(sibling);
    }
  }

  var boundLookupRect = topCandidate.parentNode.getBoundingClientRect(), curMediaRect, medias = videos.concat(goodImages), additionalMedia = null;
  for(i = medias.length - 1; i >= 0; --i){
    curMediaRect = medias[i].getBoundingClientRect();
    if((curMediaRect.bottom <= boundLookupRect.top) && 
       ((curMediaRect.left >= boundLookupRect.left && curMediaRect.right <= boundLookupRect.right) ||
        (curMediaRect.left <= boundLookupRect.left && curMediaRect.right >= boundLookupRect.right))){
      additionalMedia = medias[i];
      break;
    }
  }

  if(additionalMedia){
    articleContents.unshift(additionalMedia);
  }

  var noneContent = [];
  for(i = articleContents.length -1; i >= 0; --i ){
    grabNoneContent(articleContents[i], noneContent);
  }

  var toRemoveNode, contentIndex;
  for(i = noneContent.length - 1; i >= 0; --i){
    toRemoveNode = noneContent[i];
    if(toRemoveNode.parentNode){
      toRemoveNode.parentNode.removeChild(toRemoveNode);
    }
    contentIndex = articleContents.indexOf(toRemoveNode);
    if(contentIndex != -1){
      articleContents.splice(contentIndex, 1);
    }
  }
  
  for(i = articleContents.length - 1; i >= 0; --i){
    cleanNode(articleContents[i]);
  }

  if(!videos.length){
    var ogVideo = getOgVideo();
    if(ogVideo){
      articleContents.unshift(ogVideo);
    }
  }

  return articleContents;

}

var extractTitle = function(){
  
}

var initNode = function(node){
  if(!node.readify){
    node.readify = { score: 0, wordCount: 0, linkDensity: 0 };
  }
}

var getDirectInnerText = function(node){
  var i, l, curChildNode, text = "";
  for(curChildNode = node.firstChild; !!curChildNode; curChildNode = curChildNode.nextSibling){
    if(curChildNode.nodeType == Node.TEXT_NODE){
      text += curChildNode.nodeValue;
    }
  }
  return text;
}

var getWordCount = function(str){
  var matches = str.match(/\S+/g);
  return matches && (matches.length - 1) || 0;
}

var getLinkDensity = function(node){
  var links = node.getElementsByTagName("a");
  var linkWordCount = 0;
  for(i = links.length - 1; i >= 0 ; --i){
    linkWordCount += getWordCount(links[i].innerText);
  }
  var textWordCount = getWordCount(node.innerText) - linkWordCount;
  if(textWordCount == 0){
    return linkWordCount > 0 ? 1 : 0;
  } else {
    return linkWordCount / textWordCount;
  }
}

var getTagDensity = function(node){
  var textWordCount = getWordCount(node.innerText);
  var tagCount = node.getElementsByTagName("*").length;
  if(textWordCount == 0){
    return tagCount > 0 ? 1 : 0;
  } else {
    return tagCount / textWordCount;
  }
}

var nodeIsVisible = function(node){
  var style = getComputedStyle(node);
  return  style.getPropertyValue("display").toLowerCase() != 'none' &&
          style.getPropertyValue("visibility").toLowerCase() != 'hidden';//opacity
}

var removeNode = function(node){
  var parentNode = node.parentNode;
  if(parentNode){
    parentNode.removeChild(node);
  }
}

// TODO: simplfy node structure.
var cleanNode = function(node){
  var children = Array.prototype.slice.call(node.children);
  for(var i = children.length - 1; i >= 0; --i){
    cleanNode(children[i]);
  }
  if(!(node.isGoodImage || node.isVideo) && node.childElementCount == 0 && node.innerText.trim() == "" && node.nodeName.toLowerCase() != "br"){
    node.parentNode && node.parentNode.removeChild(node);
  } else {
    node.removeAttribute('style');
    if(node.tagName.toLowerCase() == "font"){
      node.outerHTML = node.innerHTML;
    }
  }
}

var isFontSizeSmaller = function(node){
  var previous = node.previousElementSibling;
  if(previous){
    var prePrevious = previous.previousElementSibling;
    if(prePrevious){
      var curFontSize = parseFloat(getComputedStyle(node).getPropertyValue("font-size"));
      var previousFontSize = parseFloat(getComputedStyle(previous).getPropertyValue("font-size"));
      var prePreviousFontSize = parseFloat(getComputedStyle(prePrevious).getPropertyValue("font-size"));
      if(curFontSize < prePreviousFontSize && curFontSize < previousFontSize){
        return true;
      }
    }
  }
  var next = node.nextElementSibling;
  if(next){
    var nextNext = next.nextElementSibling;
    if(nextNext){
      var curFontSize = parseFloat(getComputedStyle(node).getPropertyValue("font-size"));
      var nextFontSize = parseFloat(getComputedStyle(next).getPropertyValue("font-size"));
      var nextNextFontSize = parseFloat(getComputedStyle(nextNext).getPropertyValue("font-size"));
      if(curFontSize < nextNextFontSize && curFontSize < nextFontSize){
        return true;
      }
    }
  }
  return false;
}

var isVideoUrl = function(url){
  var videosRegex = [
    /^(https?:\/\/|\/\/)(www\.)?youtube\.com\/watch\?v=([^\&\?\/]+)/,
    /^(http(s)?:\/\/|\/\/)(www\.)?youtube\.com\/embed\/([^\&\?\/]+)/,
    /^(http(s)?:\/\/|\/\/)(www\.)?youtube\.com\/v\/([^\&\?\/]+)/,
    /^(http(s)?:\/\/|\/\/)youtu\.be\/([^\&\?\/]+)/,
    /^(https?:\/\/|\/\/)(www\.)?rutube\.ru\/video\/(\w+)/,
    /^(https?:\/\/|\/\/)(www\.)?rutube\.ru\/play\/embed\/(\w+)/, 
    /^(https?:\/\/|\/\/)(www\.)?dailymotion.com\/video\/([\w-]+)/, 
    /^(https?:\/\/|\/\/)(www\.)?dailymotion.com\/embed\/video\/([\w-]+)/, 
    /^(https?:\/\/|\/\/)dai.ly\/([\w-]+)/, 
    /^(https?:\/\/|\/\/)(www\.)?metacafe.com\/watch\/([\w-]+)/, 
    /^(https?:\/\/|\/\/)(www\.)?metacafe.com\/fplayer\/(\w+)\/metacafe.swf/, 
    /^(https?:\/\/|\/\/)(www\.)?metacafe.com\/embed\/([\w-]+)/, 
    /^(https?:\/\/|\/\/)(www\.)?vine\.co\/v\/(\w+)/, 
    /^(https?:\/\/|\/\/)(www\.)?vine\.co\/v\/(\w+)\/embed/, 
    /^(https?:\/\/|\/\/)(www\.)?instagram\.com\/p\/([\w\-]+)/, 
    /^(https?:\/\/|\/\/)(www\.)?instagram\.com\/p\/([\w\-]+)\/embed/
  ];
  var match = false;
  for(var i = videosRegex.length - 1; i >=0; --i ){
    if(videosRegex[i].test(url)){
      match = true;
      break;
    }
  }
  return match;
}

var isGoodImage = function(img){
  var minRatio = 1/3, maxRatio = 3;
  var width = img.width;
  var height = img.height;
  if(img.src && width > 200 && height > 100){
    var curRatio = width / height;
    if(curRatio > minRatio && curRatio < maxRatio){
      return true;
    }
  }
  return false;
}

var getOgVideo = function(){
  var ogVideoMeta = document.querySelector('[property="og:video"]');
  if(ogVideoMeta){
    var video = document.createElement("iframe");
    video.src = ogVideoMeta.getAttribute("content");
    return video;
  }
}

var grabNoneContent = function(node, noneContentList){
  var tagName = node.nodeName.toLowerCase();
  switch(tagName){
    case "style":
    case "script":
    case "link":
    case "noscript":
    case "template":
    case "nav":
    case "aside":
    case "h1":
    case "footer":
    case "address":
    case "hr":
    case "form":
    case "fieldset":
    case "legend":
    case "label":
    case "input":
    case "button":
    case "select":
    case "datalist":
    case "optgroup":
    case "option":
    case "textarea":
    case "keygen":
    case "output":
    case "progress":
    case "meter":
    case "details":
    case "summary":
    case "menuitem":
    case "menu":
    case "canvas":
    case "map":
    case "area":
    case "wbr":
    case "header":
      return noneContentList.push(node);
    case "img":
    case "iframe":
      if(node.isGoodImage || node.isVideo){
        return;
      } else {
        return noneContentList.push(node);
      }
    case "embed":
    case "object":
    case "param":
    case "video":
    case "audio":
    case "source":
    case "track":
    case "svg":
    case "math":
      return noneContentList.push(node);
    case "table":
    case "caption":
    case "colgroup":
    case "col":
    case "thead":
    case "tbody":
    case "tfoot":
    case "tr":
    case "td":
    case "th":
    case "a":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
    case "em":
    case "strong":
    case "small":
    case "s":
    case "cite":
    case "q":
    case "dfn":
    case "abbv":
    case "data":
    case "time":
    case "code":
    case "var":
    case "samp":
    case "kbd":
    case "sub":
    case "sup":
    case "i":
    case "b":
    case "u":
    case "mark":
    case "ruby":
    case "rt":
    case "rp":
    case "bdi":
    case "figure":
    case "figcaption":
    case "li":
      if(nodeIsVisible(node)){
       break;
      } else {
       return noneContentList.push(node);
      }
    default:
      if(!nodeIsVisible(node)/* || isFontSizeSmaller(node) || getLinkDensity(node) > 0.333333*/){
        return noneContentList.push(node);
      }
  }

  var children = node.children;
  for( var i = children.length - 1; i >= 0; --i){
    grabNoneContent(children[i], noneContentList);
  }
}

var startedAt = new Date;
var content = extract();
console.log("time: "  + ((new Date).getTime() - startedAt.getTime()) + "ms");

