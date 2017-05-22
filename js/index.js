const ipc = require('electron').ipcRenderer;
const remote = require('electron').remote;
const userAgent = {
	desktop: 'bilimini Desktop like Mozilla/233 (Chrome and Safari)',
	mobile: 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Mobile Safari/537.36'
};
const videoUrlPrefix = 'http://bilibili.com/video/av';
const videoUrlPattern = /video\/av(\d+)/;
let wv, wrapper;

// UI逻辑
const v = new Vue({
	el: '#wrapper',
	data: {
		naviGotoTarget: '',
		naviGotoInputShow: false,
		naviCanGoBack: false,
		naviCanGoForward: false,
		showNaviGotoOverlay: false,
		showAboutOverlay: false
	},
	methods: {
		// 后退
		naviBack: function() {
			wv.goBack();
		},
		// 前进
		naviForward: function() {
			wv.goForward();
		},
		// 通过url或av号跳转
		naviGotoShow: function() {
			this.naviGotoTarget = '';
			this.naviGotoInputShow = true;
			this.showNaviGotoOverlay = true;
		},
        // 回到主页
        naviGoHome: function() {
            wv.loadURL('http://bilibili.com/index.html',{
                userAgent: userAgent.mobile
            });
        },
		naviGotoHide: function() {
			this.naviGotoInputShow = this.showNaviGotoOverlay = false;
		},
		naviGoto: function() {
			var target = this.naviGotoTarget;
			if( target.startsWith('http') && target.indexOf('bilibili.com') > -1 ) {
				// is Url
				if( target.indexOf('video/av') > -1 ) {
					wv.loadURL(target, {
						userAgent: userAgent.desktop
					});
				} else {
					wv.loadURL(target);
				}
				this.naviGotoHide();
			} else if( /^(\d+)$/.test(target) ) {
				// is avid
				wv.loadURL(videoUrlPrefix + target, {
					userAgent: userAgent.desktop
				});
				this.naviGotoHide();
			} else {
				// not a valid input
				alert('你确定输入的是b站链接或者av号吗？');
			}
		},
		// 关于
		showAbout: function() {
			this.showAboutOverlay = true;
			wrapper.classList.add('showAbout');
		},
		hideAbout: function() {
			this.showAboutOverlay = false;
			wrapper.classList.remove('showAbout');
		},
		// 关鸡
		turnOff: function() {
			remote.getCurrentWindow().close();
		},
		// 显示、隐藏弹幕快捷键
		// pull request #1. Thanks to bumaociyuan
    toggleDanmaku: function() {
      wv.executeJavaScript(`document.getElementsByName('ctlbar_danmuku_on').length`, function(result){
        let isDanmakuOn = result == 1;
        if (isDanmakuOn) {
          wv.executeJavaScript(`document.querySelector('.bilibili-player-iconfont-danmaku-off').click()`)
        } else {
          wv.executeJavaScript(`document.querySelector('.bilibili-player-iconfont-danmaku').click()`)
        }
      });
    }
	}
});

// 给body加上platform flag
function detectPlatform() {
	if( process.platform.startsWith('win') ) {
		window.platform = 'win';
		document.body.classList.add('win');
	} else if( process.platform == 'darwin' ) {
		window.platform = 'darwin';
		document.body.classList.add('macos');
	}
}

// 根据用户访问的url决定app窗口尺寸
function resizeWindowOnNavigation() {
	var currentWindowType = 'default';
	const sizeMap = {
    'mini': [300, 187],
    'default': [375, 500]
  };
	wv.addEventListener('did-finish-load', function() {
		let targetWindowType;
		if( wv.getURL().indexOf('video/av') > -1 ) {
			targetWindowType = 'mini';
		} else {
			targetWindowType = 'default';
		}
		if( targetWindowType != currentWindowType ) {
			let mw = remote.getCurrentWindow(),
					currentSize = mw.getSize(),
          leftTopPosition = mw.getPosition(),
          rightBottomPosition = [leftTopPosition[0] + currentSize[0], leftTopPosition[1] + currentSize[1]],
          targetSize = ( targetWindowType in sizeMap ) ? sizeMap[targetWindowType] : sizeMap.default,
          targetPosition = [rightBottomPosition[0] - targetSize[0], rightBottomPosition[1] - targetSize[1]];

      mw.setBounds({
        x: targetPosition[0], y: targetPosition[1], width: targetSize[0], height: targetSize[1]
      }, true);

      currentWindowType = targetWindowType;
		}
	});
}

// 判断是否能前进/后退
function checkGoBackAndForwardStateOnNavigation() {
	wv.addEventListener('did-finish-load', function() {
		v.naviCanGoBack = wv.canGoBack();
		v.naviCanGoForward = wv.canGoForward();
	});
}

// 当用户点到视频播放页时跳到桌面版页面，桌面版的h5播放器弹幕效果清晰一点
function switchDesktopOnNavigationToVideoPage() {
	wv.addEventListener('will-navigate', function(e) {
		let m = videoUrlPattern.exec(e.url);
		if( m ) {
			wv.loadURL(videoUrlPrefix + m[1], {
				userAgent: userAgent.desktop
			});
		}
	});
}

// windows下frameless window没法正确检测到mouseout事件，只能根据光标位置做个dirtyCheck了
function initMouseStateDirtyCheck() {
	if( platform != 'win' ) {
		return false;
	}
	var getMousePosition = remote.screen.getCursorScreenPoint,
			mw = remote.getCurrentWindow();
	setInterval(function() {
    let mousePos = getMousePosition(),
        windowPos = mw.getPosition(),
        windowSize = mw.getSize();
    if( (mousePos.x > windowPos[0]) && (mousePos.x < windowPos[0] + windowSize[0]) &&
        (mousePos.y > windowPos[1]) && (mousePos.y < windowPos[1] + windowSize[1]) ) {
    	wrapper.classList.add('showTopBar');
    } else {
    	wrapper.classList.remove('showTopBar');
    }
  }, 300);
}

// 点击菜单「webview console」时打开webview
function openWebviewConsoleOnMenuClick() {
	ipc.on('openWebviewDevTools', () => {
		wv.openDevTools();
	});
}

window.addEventListener('DOMContentLoaded', function() {
	wrapper = document.getElementById('wrapper');
	wv = document.getElementById('wv');
	detectPlatform();
	resizeWindowOnNavigation();
	checkGoBackAndForwardStateOnNavigation();
	switchDesktopOnNavigationToVideoPage();
	initMouseStateDirtyCheck();
	openWebviewConsoleOnMenuClick();
});
