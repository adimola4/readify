var readify = function (){

  var dbg = function(msg){
    console.log("Readify: " + msg);
  }

  var eToS = function(elem){
    return "" + elem.nodeName + ((elem.id && ("#" + elem.id)) || (elem.className && ("." + elem.className)));
  }

  var extract = function(){
    try {
      var i;

      //scrollInSteps(document.body.clientHeight - window.innerHeight, 500, function(){ window.scrollTo(0,0) });
      window.scrollTo(0, 100);
      window.scrollTo(0, 0);

      var rating = rateContent();
      dbg("topCandidate: " + (rating.topCandidate && eToS(rating.topCandidate)));

      var topCandidate = rating.topCandidate,
          videos = rating.videos,
          goodImages = rating.goodImages;

      var articleContents = [], articleTitle = "";
      if(topCandidate){
        var sibling,
            topCandidateMaybeComment = nodeMaybeComment(topCandidate),
            topCandidateSiblings = Array.prototype.slice.call(topCandidate.parentNode.children);
        for(i = topCandidateSiblings.length - 1; i >= 0 ; --i){
          sibling = topCandidateSiblings[i];
          if(sibling === topCandidate || 
            (getAggragatedScore(sibling) >= 3 && 
              (topCandidateMaybeComment || 
              (!topCandidateMaybeComment && !nodeMaybeComment(sibling))))){
            articleContents.unshift(sibling);
            (sibling != topCandidate) && dbg("Added sibling "+ eToS(sibling));
          }
        }
        var boundLookupRect = topCandidate.parentNode.getBoundingClientRect(), curMediaRect, medias = videos.concat(goodImages), additionalMedia = null;
        for(i = medias.length - 1; i >= 0; --i){
          curMediaRect = medias[i].getBoundingClientRect();
          if((curMediaRect.bottom <= boundLookupRect.top) && (curMediaRect.width > 0.5 * boundLookupRect.width) &&
             ((curMediaRect.left >= boundLookupRect.left && curMediaRect.right <= boundLookupRect.right) ||
              (curMediaRect.left <= boundLookupRect.left && curMediaRect.right >= boundLookupRect.right))){
            additionalMedia = medias[i];
            break;
          }
        }

        if(additionalMedia){
          articleContents.unshift(additionalMedia);
          dbg("additional media: " + eToS(additionalMedia));
        }

        articleTitle = extractTitle();

        removeNoneContent(articleContents, topCandidate);
        
        for(i = articleContents.length - 1; i >= 0; --i){
          cleanNode(articleContents[i]);
        }
      } else {
        articleTitle = extractTitle();
      }

      if(!videos.length){
        var ogVideo = getOgVideo();
        if(ogVideo){
          articleContents.unshift(ogVideo);
          dbg("og video: " + eToS(ogVideo));
        }
      }

      if((topCandidate && topCandidate.readify.score < 20 || !topCandidate) && videos.length == 0 && goodImages.length == 0 && !ogVideo){
        var content = null;
      } else {
        var content = "";
        for(i = articleContents.length -1; i >=0; --i){
          content = articleContents[i].outerHTML + content;
        }
      }

      return content && { title: articleTitle, content: content, url: location.href, isRTL: langIsRTL(topCandidate.innerText || "abc")};
    } catch (e){
      dbg("error: " + e + " line: " + e.line );
      return null;
    }
  }

  var rateContent = function(){
    var i;

    var nodesToScore = document.body.querySelectorAll("p, div, pre, section, article, blockquote, li, td, span, font, img, iframe, "
                                                      + "em, strong, small, s, cite, q, dfn, abbv, data, time, code, var, samp, kbd, sub, sup, i, b, u, mark, ruby, rt, rp, bdi");
    var candidates = [];

    var curNode, parentNode, grandParentNode, score, tagName, goodImages = [], videos = [];
    for(i = nodesToScore.length - 1; i >= 0; --i ){
      
      curNode = nodesToScore[i];

      tagName = curNode.nodeName.toLowerCase();

      if(!nodeIsVisible(curNode)){
        continue;
      }

      if(tagName == "iframe" && isVideoUrl(curNode.src)){
        curNode.isVideo = true;
        videos.push(curNode);
      } else if(tagName == "img" && isGoodImage(curNode)){
        curNode.isGoodImage = true;
        curNode.src = curNode.src;
        goodImages.push(curNode);
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
        score += 40;
      } else {
        score += getWordCount(getDirectInnerText(curNode));
      }

      if(nodeMaybeComment(curNode)){
        score *= 0.01;
      }

      curNode.readify.score += score;

      if(curNode.readify.score > 0){
        candidates.push(curNode);

        parentNode.readify.score += score/2;
        candidates.push(parentNode);

        if(grandParentNode){
          grandParentNode.readify.score += score/3;
          candidates.push(grandParentNode);
        }
      }

    }

    dbg(candidates.length + " candidates");

    var lookupLimitTop = 500, docHeight = document.body.clientHeight, curCandidate, topCandidate = null;
    do {
      if(lookupLimitTop > 2000 || lookupLimitTop >= docHeight){
        lookupLimitTop = null;
      }
      for(i = candidates.length - 1; i >= 0; --i){
        curCandidate = candidates[i];
        if(!topCandidate || ((curCandidate.readify.score > topCandidate.readify.score) && (!lookupLimitTop || (lookupLimitTop && (curCandidate.getBoundingClientRect().top < lookupLimitTop))) )){
          topCandidate = curCandidate;
          dbg("topCandidate: " + eToS(topCandidate) + " score: " + topCandidate.readify.score + " lookupLimitTop: " + lookupLimitTop);
        }
      }
      if(topCandidate  && (topCandidate.readify.score > 100 || (lookupLimitTop >= 2000 && topCandidate.readify.score > 50 ))){
        break;
      } else if(lookupLimitTop){
        lookupLimitTop += 500;
      }
    } while(lookupLimitTop);
    

    return { topCandidate: topCandidate, videos: videos, goodImages: goodImages }
  }

  var extractTitle = function(){
    var title = "", 
        titleWordCount = 0,
        candidateType,
        candidates = [
          document.getElementsByTagName("h1"),
          document.getElementsByTagName("h2"),
          document.querySelectorAll("[id='title']"),
          document.querySelectorAll("[class='title']")
          ],
        docTitle = document.title,
        docTitleWordCount = getWordCount(docTitle);
    for(var i = 0, len = candidates.length; i < len; ++i){
      candidateType = candidates[i];
      title = (candidateType && candidateType.length == 1 && candidateType[0].innerText) || "";
      titleWordCount = getWordCount(title);
      if(title && titleWordCount >= 3){
        return title;
      }
    }
    return docTitle;
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
    return matches && matches.length || 0;
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
    var rect = node.getBoundingClientRect(node);
    var parentNode = node.parentNode;
    if(parentNode == document.body){
      parentNode = null;
    }
    return  style.getPropertyValue("display").toLowerCase() != 'none' &&
            style.getPropertyValue("visibility").toLowerCase() != 'hidden' &&
            ((node.childNodes.length > 0 && style.getPropertyValue("overflow") != "hidden") || (rect.width > 1 && rect.height > 1)) &&
            (!parentNode || (parentNode && nodeIsVisible(parentNode)));
  }

  var getAggragatedScore = function(node){
    var score = 0, children = node.children || [];
    if(children.length){
      for(var i = children.length - 1; i >= 0; --i){
        score += getAggragatedScore(children[i]);
      }
    } 
    score += (node.readify && node.readify.score) || 0;
    return score;
  }

  var nodeMaybeComment = function(node){
    return /(comment|talkback|reply|replies|discuss)/i.test(node.className + node.id);
  }

  var langIsRTL = function(sampleText) {
    var t = sampleText.replace(/@\w+/, ''),
        countHeb = countMatches('[\\u05B0-\\u05F4\\uFB1D-\\uFBF4]'),
        countArb = countMatches('[\\u060C-\\u06FE\\uFB50-\\uFEFC]');

    function countMatches (match) {
        var matches = t.match(new RegExp(match, 'g'));
        return matches !== null ? matches.length : 0;
    }

    return (countHeb + countArb) * 100 / t.length > 20;
  }

  var scrollInSteps = function(y, step, callback){
    if(y == window.scrollY){
      return callback();
    } else if(y < window.scrollY){
      step = -step;
    }
    if(Math.abs(window.scrollY - y) < Math.abs(step)){
      window.scrollTo(0, y);
      callback();
    } else {
      window.scrollTo(0, window.scrollY + step);
      setTimeout(function(){ scrollInSteps(y, step, callback) }, 10);
    }
  }

  var removeNode = function(node){
    var parentNode = node.parentNode;
    if(parentNode){
      parentNode.removeChild(node);
    }
  }

  var removeNoneContent = function(articleContents, topCandidate){
    var i, noneContent = [];
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
  }

  // TODO: simplfy node structure.
  var cleanNode = function(node){
    var children = Array.prototype.slice.call(node.children || []);
    for(var i = children.length - 1; i >= 0; --i){
      cleanNode(children[i]);
    }
    if(!(node.isGoodImage || node.isVideo) && node.childElementCount == 0 && node.innerText.trim() == "" && node.nodeName.toLowerCase() != "br" && node.nodeName.toLowerCase() != "td"){
      node.parentNode && node.parentNode.removeChild(node);
    } else {
      node.removeAttribute('style');
      if(node.tagName.toLowerCase() == "font"){
        node.outerHTML = node.innerHTML;
      } else if(node.src){
        node.setAttribute("src", node.src);
      }
    }
  }

  var compEnv = function(node, predicate){
    var previous = node.previousElementSibling,
        prevPrevious = previous && previous.previousElementSibling,
        next = node.nextElementSibling,
        nextNext = next && next.nextElementSibling;
    if(previous && next){
      return predicate(node, previous, next);
    } else if(previous && prevPrevious){
      return predicate(node, previous, prevPrevious);
    } else if(next && nextNext){
      return predicate(node, next, nextNext);
    } else {
      return predicate(node, previous, next);
    }
  }

  var isFontSizeSmaller = function(node){
    return compEnv(node, function(n, a, b){
      if(a && b){
        var nFontSize = parseFloat(getComputedStyle(n).getPropertyValue("font-size"));
        var aFontSize = parseFloat(getComputedStyle(a).getPropertyValue("font-size"));
        var bFontSize = parseFloat(getComputedStyle(b).getPropertyValue("font-size"));
        return nFontSize < aFontSize && nFontSize < bFontSize;
      } else {
        return false;
      }
    });
  }

  var nodeIsPositioned = function(node){
    return compEnv(node, function(n, a, b){
      var nPosition = getComputedStyle(n).getPropertyValue("position") == "absolute";
      var aPosition = a && getComputedStyle(a).getPropertyValue("position") == "absolute";
      var bPosition = b && getComputedStyle(b).getPropertyValue("position") == "absolute";
      return nPosition && !(aPosition && bPosition );
    });
  }

  var nodeIsFloating = function(node){
    return compEnv(node, function(n, a, b){
      var nFloat = getComputedStyle(n).getPropertyValue("float") != "none";
      var aFloat = a && getComputedStyle(a).getPropertyValue("float") != "none";
      var bFloat = b && getComputedStyle(b).getPropertyValue("float") != "none";
      return nFloat && !(aFloat && bFloat);
    });
  }

  var nodeHasLargerTagDensity = function(node){
    return compEnv(node, function(n, a, b){
      return getTagDensity(n) > 1 && ((a && getTagDensity(a) < 1) || (b && getTagDensity(b) < 1));
    });
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
      /^(https?:\/\/|\/\/)(www\.)?instagram\.com\/p\/([\w\-]+)\/embed/,
      /^(https?:\/\/|\/\/)player\.vimeo\.com\/video\/.*/
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
    var minRatio = 1/9, maxRatio = 3;
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
    if(ogVideoMeta && isVideoUrl(ogVideoMeta.getAttribute("content"))){
      var video = document.createElement("iframe");
      video.src = ogVideoMeta.getAttribute("content");
      return video;
    }
  }

  var nodeHasGoodMedia = function(node){
    var iframes = node.getElementsByTagName('iframe'), images = node.getElementsByTagName('img');
    for(var i = iframes.length - 1; i >=0; --i){
      if(iframes[i].isVideo){
        return true;
      }
    }
    for(i = images.length - 1; i>= 0; --i){
      if(images[i].isGoodImage){
        return true;
      }
    }
    return false;
  }

  var markNoneContent = function(node, noneContentList, reason){
    dbg("none content: " + eToS(node) + " reason: " + reason);
    noneContentList.push(node);
  };

  var grabNoneContent = function(node, noneContentList){
    var linkDensity, tagName = node.nodeName.toLowerCase();
    switch(tagName){
      case "br":
        return;
      case "style":
      case "script":
      case "link":
      case "noscript":
      case "template":
      case "nav":
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
        return markNoneContent(node, noneContentList, "none content element");
      case "img":
      case "iframe":
        if(node.isGoodImage || node.isVideo){
          return;
        } else {
          return markNoneContent(node, noneContentList, "bad img/iframe");
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
        return markNoneContent(node, noneContentList, "none content element(*)");//maybe support in the future
      case "table":
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
      case "ul":
      case "ol":
        if(nodeIsVisible(node)){
         break;
        } else {
         return markNoneContent(node, noneContentList, "invisible inline element");
        }
      case "a":
        if((nodeIsVisible(node) && node.getAttribute('href') && node.getAttribute('href').indexOf("#") != 0) || nodeHasGoodMedia(node)){
          break;
        } else {
          return markNoneContent(node, noneContentList, "invisible link or src=#");
        }
      case "td":
      case "th":
      case "tr":
      case "tbody":
      case "thead":
      case "tfoot":
      case "caption":
      case "colgroup":
      case "col":
        break;
      default:
        if(!nodeIsVisible(node)){
          return markNoneContent(node, noneContentList, "invisible element");
        } else if(!nodeHasGoodMedia(node)) {
          var wordCount = getWordCount(node.innerText);
          if(nodeIsPositioned(node)){
            return markNoneContent(node, noneContentList, "element is positioned");
          } else if(nodeIsFloating(node)){
            return markNoneContent(node, noneContentList, "element is floating");
          } else if(isFontSizeSmaller(node) && wordCount < 40){
            return markNoneContent(node, noneContentList, "element font size is smaller");
          } else if(nodeHasLargerTagDensity(node) && wordCount < 100){
            return markNoneContent(node, noneContentList, "element has larger tag density");
          }
        }
    }

    var children = node.children || [];
    for( var i = children.length - 1; i >= 0; --i){
      grabNoneContent(children[i], noneContentList);
    }
  }

  extract = benchmark("extract", extract);
  
  return extract();

}

module.exports = readify;
