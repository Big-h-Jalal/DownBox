const {app, BrowserWindow, ipcMain, globalShortcut, shell, Tray, Menu} = require("electron");
const url = require("url");
const fs = require("fs");
const path = require("path");

let appName = 'DownBox';
let win;
let tray;
const is_second_instance = app.makeSingleInstance((_argv, working_dir)=>{
    if(win){
        if(win.isMinimized()) win.restore();
        if(!win.isVisible()) win .show();
        win.focus();
    }
});

if(is_second_instance){
    app.quit();
}

app.setName(appName);
app.on('ready', function(){
    win = new BrowserWindow({title:appName, width:1024, height:768, minWidth:800, minHeight:600, icon:'./app/img/icon.png', frame: false});
    win.setMenu(null);
    win.loadURL(`file://${__dirname}/app/index.html`);
    fs.mkdir('.\\Downloads', (err)=>{});
    //tray= new Tray('./app/img/icon.png');
    tray= new Tray('./icon.png');
    const tray_context_menu = Menu.buildFromTemplate([
        {label: 'Exit', type: 'normal', role: 'quit'}
    ]);
    tray.setToolTip('DownBox');
    tray.setContextMenu(tray_context_menu);
    tray.on('double-click', (event)=>{
        if(!win.isVisible()) win.show();
        win.focus();
    });
});

ipcMain.on('loading-elements', (event, args)=>{
    fs.readFile('list.json', "utf8", (err, data)=>{
        if(err === null)
        {
            event.sender.send("loading-reply", data);
        }else{
            event.sender.send("loading-reply", '{"items":[]}');
        }
    });
});

ipcMain.on('remove-file-message', (event, args)=>{
    shell.moveItemToTrash(path.resolve("./Downloads") + "\\" + args);
});

ipcMain.on('open-file-message', (event, args)=>{
    shell.showItemInFolder(path.resolve("./Downloads") + "\\" + args);
});

ipcMain.on('quiting-message', (event, args)=>{
    win.hide();
});

ipcMain.on('restore-message', (event, args)=>{
    if(win.isMaximized()){
        win.restore();
    }else{
        win.maximize();
    }
});

ipcMain.on('minimize-message', (event, args)=>{
    win.minimize();
});

ipcMain.on('cache-list', (event, args)=>{
    args.map(item => {item.handle = null;});
    fs.writeFileSync("list.json", JSON.stringify({items: args}));
})