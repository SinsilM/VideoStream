const electron = require('electron')
const onvif = require('node-onvif')
const request = require('request').defaults({ encoding: null });
const { session } = require('electron')
const Stream = require('node-rtsp-stream')
const ffmpegPath  = require('ffmpeg-static');

const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipcMain = electron.ipcMain

const path = require('path')
const url = require('url')

const cookieUrl = 'https://github.com/rogalmic/onvif-standalone';
var devices = {};
var names = {};
var connectedDevice = 'aaa';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow() {

  // Create the browser window.
  mainWindow = new BrowserWindow(
    { 
      width: 900, 
      height: 600, 
      webPreferences: {nodeIntegration: true, allowRunningInsecureContent: true, experimentalFeatures: true}
   })
  mainWindow.setMenu(null);

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  session.defaultSession.cookies.flushStore((error) => {
    if (error) console.error(error)
  })

  if (process.platform !== 'darwin') {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.on('device_discover', (event, arg) => {
  console.log('device_discover(' + JSON.stringify(arg) + ')');

  onvif.startProbe().then(
    (device_list) => {
      console.log(device_list)
      device_list.forEach((device) => {
        let odevice = new onvif.OnvifDevice({
          xaddr: device.xaddrs[0]
        });
        let addr = odevice.address;
        devices[addr] = odevice;
        names[addr] = device.name;
      });
      var devs = {};
      for (var addr in devices) {
        devs[addr] = {
          name: names[addr],
          address: addr
        }
      }
      //console.log("device",devices)
      //console.log("dev", devs)
      let res = { 'id': 'startDiscovery', 'result': devs };
      console.log(res)
      mainWindow.webContents.send('device_discovered', devs);
    }).catch((error) => {
      let res = { 'id': 'connect', 'error': error.message };
      console.error(res)
      var devs = {};
      mainWindow.webContents.send('device_discovered', devs);
    });
});


ipcMain.on('cookies_acquire', (event, arg) => {
  console.log('cookies_acquire(' + JSON.stringify(arg) + ')');

  var cookies = session.defaultSession.cookies.get({ url: cookieUrl }, (error, cookies) => {
    console.log(error);
    event.sender.send('cookies_acquired', cookies);
  });
});


ipcMain.on('snapshot_update', (event, arg) => {
  console.log('snapshot_update(' + JSON.stringify(arg) + ')');

  /*connectedDevice.fetchSnapshot().then((error, response) => {
    if (!error && response.statusCode == 200) {
      data = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
      event.sender.send('snapshot_updated', data);
    }
    else {
      event.sender.send('snapshot_updated', 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAxNi4wLjQsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+DQo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkNhcGFfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiDQoJIHdpZHRoPSIxNnB4IiBoZWlnaHQ9IjE2cHgiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgMTYgMTYiIHhtbDpzcGFjZT0icHJlc2VydmUiPg0KPHBhdGggZD0iTTgsMEMzLjU4MiwwLDAsMy41ODIsMCw4czMuNTgyLDgsOCw4czgtMy41ODIsOC04UzEyLjQxOCwwLDgsMHogTTksMTJjMCwwLjU1Mi0wLjQ0OCwxLTEsMXMtMS0wLjQ0OC0xLTFWNw0KCWMwLTAuNTUyLDAuNDQ4LTEsMS0xczEsMC40NDgsMSwxVjEyeiBNOCw1LjAxNmMtMC41NTIsMC0xLTAuNDQ4LTEtMWMwLTAuNTUyLDAuNDQ4LTEsMS0xczEsMC40NDgsMSwxQzksNC41NjgsOC41NTIsNS4wMTYsOCw1LjAxNnoNCgkiLz4NCjwvc3ZnPg==');
    }
  }).catch((error) => {
    console.error(error);
  })*/

  /*request.get('rtsp://192.168.0.101:554/DeskCamera/DISPLAY2_For_SubStream_Token', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log(response);
      console.log(body);
      data = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
      event.sender.send('snapshot_updated', data);
    }
    else {
      event.sender.send('snapshot_updated', 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAxNi4wLjQsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+DQo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkNhcGFfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiDQoJIHdpZHRoPSIxNnB4IiBoZWlnaHQ9IjE2cHgiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgMTYgMTYiIHhtbDpzcGFjZT0icHJlc2VydmUiPg0KPHBhdGggZD0iTTgsMEMzLjU4MiwwLDAsMy41ODIsMCw4czMuNTgyLDgsOCw4czgtMy41ODIsOC04UzEyLjQxOCwwLDgsMHogTTksMTJjMCwwLjU1Mi0wLjQ0OCwxLTEsMXMtMS0wLjQ0OC0xLTFWNw0KCWMwLTAuNTUyLDAuNDQ4LTEsMS0xczEsMC40NDgsMSwxVjEyeiBNOCw1LjAxNmMtMC41NTIsMC0xLTAuNDQ4LTEtMWMwLTAuNTUyLDAuNDQ4LTEsMS0xczEsMC40NDgsMSwxQzksNC41NjgsOC41NTIsNS4wMTYsOCw1LjAxNnoNCgkiLz4NCjwvc3ZnPg==');
    }
  });*/
});

ipcMain.on('device_connect', (event, arg) => {
  console.log('device_connect(' + JSON.stringify(arg).replace(arg.pass, '*') + ')');
  console.log(arg)
  connectedDevice = new onvif.OnvifDevice({ xaddr: arg.url, user : arg.user, pass : arg.pass });

  connectedDevice.init().then((info) => {
    console.log("device connect", JSON.stringify(info));

    let url = connectedDevice.getUdpStreamUrl();
    console.log(url);

    let profile = connectedDevice.getProfileList();
    console.log(JSON.stringify(profile, null, '  '));

    connectedDevice.services.media.getVideoSources().then((result) => {
      //console.log(JSON.stringify(result['data'], null, '  '));
    }).catch((error) => {
     // console.error(error);
    });

    var cookie = { url: cookieUrl, name: 'user', value: arg.user, expirationDate: Date.now() + 365 * 24 * 60 * 60 * 1000 }
    var cookie2 = { url: cookieUrl, name: 'pass', value: arg.pass, expirationDate: Date.now() + 365 * 24 * 60 * 60 * 1000 }
  
    session.defaultSession.cookies.set(cookie, (error) => {
      if (error) console.error(error)
    })
  
    session.defaultSession.cookies.set(cookie2, (error) => {
      if (error) console.error(error)
    })

    stream = new Stream({
      name: 'DISPLAY1_For_MainStream_Token',
      streamUrl: 'rtsp://192.168.0.100:8080/h264_ulaw.sdp',
      //streamUrl: 'rtsp://admin:admin@192.168.0.101:554/DeskCamera/DISPLAY1_For_SubStreamJpeg_Token',
      //'rtsp://admin:admin@192.168.0.101:554/DeskCamera/DISPLAY1_For_MainStream_Token',
      wsPort: 9999,
      ffmpegOptions: { // options ffmpeg flags
        '-stats': '', // an option with no neccessary value uses a blank string
        '-r': 30, // options with required values specify the value after the key
        '-s': '540x540'
      },
      ffmpegPath: ffmpegPath
    })
  
    stream1 = new Stream({
      name: 'HDCamp',
      streamUrl: 'rtsp://admin:admin@192.168.0.101:554/DeskCamera/webcam1',
      //'rtsp://admin:admin@192.168.0.101:554/DeskCamera/DISPLAY1_For_MainStream_Token',
      wsPort: 9998,
      ffmpegOptions: { // options ffmpeg flags
        '-stats': '', // an option with no neccessary value uses a blank string
        '-r': 30, // options with required values specify the value after the key
        '-s': '540x540'
      },
      ffmpegPath: ffmpegPath
    })    

    event.sender.send('device_connected', info);
    

  }).catch((error) => {
    console.error("error", JSON.stringify(error));

    //event.sender.send('device_connected', undefined);
  });
});

ipcMain.on('device_disconnect', (event, arg) => {
  console.log('device_disconnect(' + JSON.stringify(arg) + ')');

  mainWindow.reload();
});

ipcMain.on('device_execute', (event, arg) => {
  console.log('device_execute(' + JSON.stringify(arg) + ')');
  var result = eval(arg);

  event.sender.send('device_executed', result);
});

