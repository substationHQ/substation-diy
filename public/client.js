/*

// fucking safari, for real
if (/Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor)) {
	document.getElementById("ytplayer1").style.left = '-30%';
}

var switchTimer = false;
var current = false;
var ytready = 0;
var firstrun = 1;
var player1DOM = false;
var player2DOM = false;
var ytids = ['VOaZbaPzdsk','E3yOnr2cl3c','ZQ_MEFVx5jM','ZphKq6WBpbI','TKcrnTZ9IaE'];
var player,player1,player2,nextvideo;
var credits = {};
var ytVars = {
		'autoplay': 1,
		'controls': 0,
		'disablekb': 1,
		'enablejsapi': 1,
		'loop': 1,
		'modestbranding': 1,
		'origin': window.location.protocol + '//' + window.location.host,
		'playlist': '',
		'playsinline': 1,
		'rel': 0,
		'showinfo': 0,
		'iv_load_policy': 3,
		'wmode': 'opaque',
		'suggestedQuality':'hd1080'
	};

function submitData() {
  injectYTFrameTag();
}

function injectYTFrameTag() {
  var tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

function onYouTubeIframeAPIReady() {
  var ytEvents = {
    'onReady': onPlayerReady
  };
  // console.log(ytids);
  var ytId1 = ytids[Math.floor(Math.random() * ytids.length)];
  var ytId2 = ytids[Math.floor(Math.random() * ytids.length)];
  var ytVars0 = ytVars;
  var ytVars1 = ytVars;
  var ytVars2 = ytVars;
  ytVars1.playlist = ytId1;
  ytVars2.playlist = ytId2;
  nextvideo = ytId2;
  player1 = new YT.Player('ytplayer1', {
    videoId: ytId1,
    events: ytEvents,
    playerVars: ytVars1
  });
  player2 = new YT.Player('ytplayer2', {
    videoId: ytId2,
    events: ytEvents,
    playerVars: ytVars2
  });
}

function onPlayerReady(event) {
  if (/Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor)) {
    document.getElementById("ytplayer1").style.left = '-400%';
  }

  ytready = ytready + 1;
  event.target.mute();
  //event.target.pauseVideo();
  if (ytready > 1) {
    player1DOM = document.getElementById("ytplayer1");
    player2DOM = document.getElementById("ytplayer2");

    player1DOM.addEventListener("click", function( event ) {
      event.preventDefault();
      event.stopPropagation();
    }, false);

    player2DOM.addEventListener("click", function( event ) {
      event.preventDefault();
      event.stopPropagation();
    }, false);

    current = player1;

    // give it a little load time
    setTimeout(function(){player1DOM.style.left = '-30%'},4000);

    switchVideos();
  }
}

function switchVideos() {
  var delay = 3500;
  var hidden = player2;
  var hiddenDOM = player2DOM;
  var currentDOM = player1DOM;
  if (firstrun) {
    firstrun = 0;
    delay = 100;
  }
  if (current == player2) {
    hidden = player1;
    hiddenDOM = player1DOM;
    currentDOM = player2DOM;
  }
  hidden.playVideo();
  window.setTimeout(finishSwitch, delay);
}

function finishSwitch() {
  var hidden = player2;
  var hiddenDOM = player2DOM;
  var currentDOM = player1DOM;
  if (current == player2) {
    hidden = player1;
    hiddenDOM = player1DOM;
    currentDOM = player2DOM;
  }
  hiddenDOM.style.left = '-30%';
  currentDOM.style.left = '-200%';

  var loadVideo = ytids[Math.floor(Math.random() * ytids.length)];
  current.loadVideoById(loadVideo);
  nextvideo = loadVideo;
  var timeout = Math.floor(Math.random() * 11000)
  switchTimer = window.setTimeout(switchVideos, 8000 + timeout);
  current.pauseVideo();
  current = hidden;
}









$(submitData);

*/