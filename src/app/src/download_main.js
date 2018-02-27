'use strict';
const https = require('https');
const url = require('url');
const fs = require('fs');
const {ipcRenderer} = require('electron');

let dironame = ".\\Downloads\\";
//ui binding
Vue.component('download-item', {
    props: ['element'],
    methods:{
      dpause: function(event){
        if(this.element.pausable){
          this.element.pauseOrResume();
        }
      },
      dabort: function(event){
        if(this.element.handle !== null){
            this.element.handle.abort();
        }
        content.items.splice(content.items.indexOf(this.element), 1);
      },
      ddelete: function(event){
        ipcRenderer.send('remove-file-message', this.element.filename);
        content.items.splice(content.items.indexOf(this.element), 1);
      },
      dopenInExp: function(event){
        ipcRenderer.send('open-file-message', this.element.filename);
      },
    },
    template: '<div class="download"><div class="download-icon"><img src="img/Asset%2011.png" alt=""> <div class="type">{{element.format}}</div></div><div class="download-name"><p><b>{{element.filename}}</b></p><p>{{element.link}}</p></div><div class="download-actions"><a v-on:click="dabort"><img src="img/ico-x.png" alt=""></a><a v-if="element.done" v-on:click="ddelete"><img src="img/ico-trash.png" alt=""></a><a v-if="element.done" v-on:click="dopenInExp"><img src="img/ico-folder.png" alt=""></a><a v-if="!element.done" v-on:click="dpause"><img v-if="!element.paused" src="img/Asset 13.png" alt=""><img v-else src="img/Asset 14.png" alt=""></a></div><div class="progress-bar" v-if="!element.done"><div class="progress" v-bind:style="element.progress"></div></div></div>'
  })
  
  let content = new Vue({
    el: '#content',
    data:{
      label: "Recent Downloads",
      keyword: "",
      scan_condition: true,
      items: []
    },
    computed:{
        filteredItems: function(){
            return this.items.filter(item => {
                switch(sidebar.tab){
                    case 0: this.scan_condition = true; break;
                    case 1: this.scan_condition = !item.done && !item.paused; break;
                    case 2: this.scan_condition = !item.done && item.paused; break;
                    case 3: this.scan_condition = item.done; break;
                }
                return (item.filename.includes(this.keyword) || item.link.includes(this.keyword)) && this.scan_condition;
            });
        }
    }
  })

  let sidebar = new Vue({
    el: "#side",
    data: {
      recent: "active",
      running: "",
      inpause: "",
      finished: "",
      tab : 0
    },
    methods:{
      sidefunc: function(e){
          this.tab = e;
        switch(e){
          case 0: {
            this.recent = "active";
            this.running = this.inpause = this.finished = "";
            content.label = "Recent Downloads";
          }; break;
          case 1: {
            this.running = "active";
            this.recent = this.inpause = this.finished = "";
            content.label = "Downloading";
          }; break;
          case 2: {
            this.inpause = "active";
            this.recent = this.running = this.finished = "";
            content.label = "Paused";
          }; break;
          case 3: {
            this.finished = "active";
            this.recent = this.running = this.inpause = "";
            content.label = "Finished";
          }; break;
        }
      }
    }
  })

let mainbar = new Vue({
    el: '#mainbar',
    data:{
      toolbarc: 'toolbar',
      iconc: 'icon'
    },
    methods:{
      action: function(act){
        switch(act){
          case 0:{
            ipcRenderer.send('quiting-message', null);
          }break;
          case 1:{
            ipcRenderer.send('restore-message', null);
          }break;
          case 2:{
            ipcRenderer.send('minimize-message', null);
          }break;
        }
      }
    }
  })
//loading cached download data
window.addEventListener('load',(sender, event)=>{
   ipcRenderer.send('loading-elements', null); 
   ipcRenderer.on('loading-reply', (event, args)=>{
       let tmp = JSON.parse(args)
       tmp.items.forEach(function(element) {
            let e = download_object(element.id, element.filename, element.format, element.link, element.filesize, element.downloaded_size, !element.done, element.pausable);
            content.items.push(e);
       }, this);
   });
});

window.addEventListener('beforeunload', (event)=>{
    ipcRenderer.send('cache-list', content.items);
})

//auto download start when link pasted in view
let bdy = document.body;
let count = 1;

bdy.addEventListener('paste', (e)=>{
    let link = e.clipboardData.getData('Text');
    if(link !== '')
    {
        download_handle(link);
    }
});

//creating download object
function download_object(_id, _filename, _format, _link, _filesize, _downloaded_size, _paused, _pausable){
    let _done = _downloaded_size === _filesize;
    let _progress = `width: ${((_downloaded_size/_filesize)*100).toFixed(2)}%;`;
    let o = {
        id: _id,
        filename: _filename,
        format: _format,
        link: _link,
        paused: _paused,
        pausable: _pausable,
        done: _done,
        filesize: _filesize,
        downloaded_size: _downloaded_size,
        progress: _progress,
        handle: null,
        download: function(_options){
            start_download(this, _link, _options);
        },
        pauseOrResume: function(){
            this.paused = !this.paused;
            if(this.paused){
                this.handle.abort();
                this.progress += "background: rgba(35, 103, 158, 0.20);";
            }else{
                ranged_download(this, this.link,{'Range': `bytes=${this.downloaded_size}-${this.filesize}`});
            }
        }
    }
    return o;
}
//handling downloads
function download_handle(_link){
    let durl;
    try{
        durl = new URL(_link);
    }catch(err){
        alert(`This URL ${_link} is invalid`);
        return;
    }

    const options = {
        host : durl.host,
        hostname: durl.host,
        path : durl.pathname
    };

    let e = download_object(count, '', '', _link, 1, 0, false, false);
    count++;
    content.items.push(e);
    e.download(options);
}

//ranged download
function start_download(_sender,_link, _options){
    let hrc;
    try{
        hrc = https.request(_options, (resp)=>{
            _sender.handle = hrc;
            _sender.pausable = resp.headers["accept-ranges"] === "bytes" ? true : false;
            if(resp.statusCode !== 200)
            {
                error = new Error(`Request Failed with Status Code : ${resp.statusCode}`);
                console.error(error.message);
                resp.resume();
                return;
            }
            let filename = '';
            let format = '';
            _sender.filesize = Number(resp.headers["content-length"]);

            
            //auto detecting filename
            if(resp.headers["content-disposition"]){ //case filename in header
                let fn = resp.headers["content-disposition"].split(';').pop();
                filename += fn.split('=').pop().split("\"").join('');
            }
            else{//case filename is not in header but in link
                let lnk = resp.req.path.split('/').pop();
                filename += lnk;
            }

            //checking if file exists or not
            let temp = filename;
            let file_count = 1;
            while(true){
                if(fs.existsSync(dironame + temp)){
                    temp = filename.split('.');
                    temp[0] += '_' + file_count;
                    temp = temp.join('.');
                    file_count++;
                }else{
                    filename = temp;
                    break;
                }
            }
            //to ui
            let tmp = filename.split('.');
            format = tmp[tmp.length - 1];
            tmp[tmp.length - 1] = "dbcache";
            let t_filename = tmp.join('.');

            _sender.filename = filename;
            _sender.format = format;
            //downloading data
            resp.on('data', (chunk)=>{
                _sender.downloaded_size += chunk.length;
                fs.appendFileSync(dironame + t_filename, chunk, 'binary', (err)=>{
                    if(err) throw err;
                });
                _sender.progress = `width: ${((_sender.downloaded_size/_sender.filesize)*100).toFixed(2)}%;`;
            });

            resp.on('end', ()=>{
                if(_sender.downloaded_size === _sender.filesize)
                {
                    _sender.done = true;
                    _sender.progress = "";
                    fs.renameSync(dironame + t_filename, dironame + filename);
                    let myNotification = new Notification('Download Finished!', {
                        icon: './img/icon.png',
                        body: `${filename} done downloading!`
                    });
                }
            });
        });
        hrc.on('error', (err) => {
            setTimeout(start_download(_sender,_link, _options), 5000);
        });
        hrc.end();
    }catch(err){
        console.error('Error: ', err);
    }
}

function ranged_download(_sender, _link, _headers){
    let durl = new URL(_link);
    const options = {
        host : durl.host,
        hostname: durl.host,
        path : durl.pathname,
        headers: _headers
    };
    let hrc;
    try{
        hrc = https.request(options, (resp)=>{
            _sender.handle = hrc;
            if(resp.statusCode !== 206)
            {
                error = new Error(`Request Failed with Status Code : ${resp.statusCode}`);
                alert(error.message);
                resp.resume();
                return;
            }
            //downloading data
            let filename = _sender.filename;

            let tmp = filename.split('.');
            tmp[tmp.length - 1] = "dbcache";
            let t_filename = tmp.join('.');

            resp.on('data', (chunk)=>{
                _sender.downloaded_size += chunk.length;
                fs.appendFileSync(dironame + t_filename, chunk, 'binary', (err)=>{
                    if(err) throw err;
                });
                _sender.progress = `width: ${((_sender.downloaded_size/_sender.filesize)*100).toFixed(2)}%;`;
            });

            resp.on('end', ()=>{
                if(_sender.downloaded_size === _sender.filesize)
                {
                    _sender.done = true;
                    _sender.progress = "";
                    fs.renameSync(dironame + t_filename, dironame + filename);
                    let myNotification = new Notification('Download Finished!', {
                        icon: './img/icon.png',
                        body: `${filename} done downloading!`
                    });
                }
            });
        });
        hrc.on('error', (err) => {
            setTimeout(ranged_download(_sender,_link, _headers), 5000);
        });
        hrc.end();
    }catch(err){
        console.error('Error: ', err);
    }
}