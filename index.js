const is_webpacked  = __filename.endsWith('main.js');

const path = require('path'),fs = require('fs'), vd_path = is_webpacked ? __dirname : path.dirname(require.resolve('virtual-desktop'));
const os = require('os')
const { execFile } = require('node:child_process');
const { error } = require('console');

let virtualDesktopExePath = path.join(vd_path,'VirtualDesktop.exe');
let virtualDesktopConfigPath = path.join(vd_path,'VirtualDesktop.json');

const clientNames = [
    'VirtualDesktop11InsiderCanary',
    'VirtualDesktop11-23H2',
    'VirtualDesktop11-21H2',
    'VirtualDesktop11',
    'VirtualDesktop',
    'VirtualDesktopServer2022',
    'VirtualDesktopServer2016'
];

const clientExePaths = clientNames.map(function(p){
    return path.join(vd_path,p+'.exe');
});


function detectClient() {

    const spawn = require('child_process').spawn;   

    return new Promise(function(resolve,reject){

        detect(0);

        function detect(i) {
            if (i<clientExePaths.length) {
                const candidatePath = clientExePaths[i];
                let failed = false;
                const exe = spawn(candidatePath,["/LIST"]); 

                exe.stderr.on('data',function(buf){
                    failed = true;
                });

                exe.on('exit',function(){
                    if (failed) {
                        return detect(i+1);
                    } else {
                        resolve(candidatePath);
                    }
                   
                });

            
            } else {
                reject(new Error('No Client'));
            }
        }

    });

   
}

function startManager(){
    return new Promise(function(resolve,reject){

        fs.readFile(virtualDesktopConfigPath,'utf8',function(err,json){
            try {
                if (json) {
                    virtualDesktopExePath = JSON.parse(json).path;
                    return resolve(desktopManager());
                }
            } catch ( err ) {
            }

            detectClient().then(function(path){
                fs.writeFile(virtualDesktopConfigPath,JSON.stringify({path}),function(){
                    virtualDesktopExePath = path;
                    resolve(desktopManager());
                });
            }).catch(reject);
        });

       

    });
}

module.exports = function(usePath) {

    if (usePath) {
        virtualDesktopExePath = usePath;
    }
    
    return new Promise(function(resolve,reject){

        fs.stat(virtualDesktopExePath,function(err){
            if (err) {
               reject(err);
            } else {
                resolve( desktopManager() );
            }            
        });     

    });
   
};

module.exports.detectClient = detectClient;
module.exports.startManager = startManager;

function getDesktops(cb) {
    const child = execFile(virtualDesktopExePath, ['/JSON'], (error, stdout, stderr) => {
        if (error) {
            return cb( error );
        }
        try {
            const payload = JSON.parse(stdout);
            let visible,visibleIndex;
            const list = payload.desktops.map(function(x,i){
                if (x.visible) {
                    visible = x.name;
                    visibleIndex = i;
                }
                return x.name;
            });

            return cb (undefined,{names:list,visible,visibleIndex});

        } catch (err ) {
            return cb (err);
        }
       
       
    }); 

}

function getDesktopCount(cb) {
    const child = execFile(virtualDesktopExePath, ['/Count'], (exit) => {
        
        if (exit) {
            return cb( undefined,exit.code );
        }
       
       
    }); 
}

function getCurrentDesktop(cb) {

    const child = execFile(virtualDesktopExePath, ['/gcd'], (error,stdout) => {
        
        if (error&& !stdout) {
            return cb( error );
        }

        cb (undefined,{name:stdout.split("'")[1],index:error.code});
       
       
    }); 
}

function waitForDesktopChanges(cb) {
 

    getDesktops(function (error,desktops) {
        if (error) {
            console.log({error});
            return;
        }
        let names = desktops.names;
        let current = desktops.visibleIndex;
        fetcher();

        function fetcher(){

            const child = execFile(virtualDesktopExePath, ['/WDC'], function(exit,stdout) {

                const index = exit ? exit.code : 0;

                poller(index);

                function poller(index) {
                    if (current!==index) {
                        const info = {
                            index : index,
                            name : names[index],
                        };
                        current=index;
                        getDesktops(function (error,desktops) {
                            names = desktops.names;
                            poller(desktops.visibleIndex);
                        });
                        cb(info);
                    }  else {
                        fetcher();
                    }                
                }

            });
        }
    });

}

function switchToDesktop(n,cb) {

    if (typeof n==='number' ) {

        if (n<0 )  return cb (new Error("desktop number out of range")) ;
    } else {
        if (typeof n!=='string' ) {
            return cb (new Error("invalid desktop arg - expecting number or string")) ;
        }
    }

    getDesktops(function (err,desktops) {

        if (err) return cb (err);

        if (typeof n==='number' ) {

            if (n>= desktops.names.length) return cb (new Error("desktop number out of range")) ;

        } else {
            n = desktops.names.indexOf (n);
            if (n < 0 ) {
                cb (new Error(`invalid desktop name : ${n} not in  ${JSON.stringify(desktops.names)}`)) ;
            }
        }

        const child = execFile(virtualDesktopExePath, [`/Switch:${n}` ], function (err,stdout,stderr) {
            if (err && err.code !== n) return cb (err);
            cb(undefined,desktops.names [n],n);
        }); 
        
    });

}

function previousDesktop(cb) {
    const child = execFile(virtualDesktopExePath, ['/l'], (error, stdout, stderr) => {
        console.log({error, stdout});
        if (error) {
            return cb( error );
        }
        cb(undefined,stdout);
    });
}
 
function nextDesktop(cb) {
    const child = execFile(virtualDesktopExePath, ['/ri'], (error, stdout, stderr) => {
        console.log({error, stdout});
        if (error) {
            return cb( error );
        }
        cb(undefined,stdout);
    });
}
 
function ipcTask(path,args) { 

    const events = { error: [], message: [], send:[],exit: [] } ;
    const spawn = require('child_process').spawn;   

    const ipc = spawn(path,args); 

    let closed = false;

    ipc.stdin.setEncoding("utf8");

    ipc.stderr.on('data', function (data) {
        emit('error',data.toString());
    });

    ipc.stdout.on('data', function (data) {
        const json = data.toString().trim();
        if (json.length>0) {
            
            try {
                emit('message',JSON.parse(json));
            } catch (err) {
                emit('error',err);
            }
        } else {
            console.log("on data:",data,json);
        }
    });

    ipc.on('exit', function () {
        closed=true;
        emit('exit');
    });

    function on(ev,fn) {
        if (typeof ev+typeof fn+ typeof events[ev] === 'stringfunctionobject') {
            const stack = events[ev],ix=stack.indexOf(fn);
            if (ix<0) stack.push(fn);            
        }
    }

    function off(ev,fn) {
        if (typeof ev+typeof fn+ typeof events[ev] === 'stringfunctionobject') {
            const stack = events[ev],ix=stack.indexOf(fn);
            if (ix>=0) stack.splice(ix,1);            
        }
    }

    function emit(ev) {
        const stack = events[ev];
        if (Array.isArray(stack)) {
            const args = [].slice.call(arguments,1);
            stack.forEach(function(fn){
                fn.apply(null,args);
            });
        }
    }

    function send(msg) {
        if (closed) throw new Error ("Attempt to send to client that has exited");
        ipc.stdin.write((typeof msg==='string'?msg:JSON.stringify(msg)) + "\n");
        emit('send',msg);
    }


    function close() {
        try {
            ipc.kill(); 
        } catch (err) {
            console.log(err);
        }
    }

    return {
        on,
        off,
        send,
        close
    };
}

function desktopManager() {

    var vd_IPC = ipcTask(virtualDesktopExePath,['/INT']);

    vd_IPC.on('message',function(msg){
        if (typeof msg==='object') {
            if (Array.isArray(msg)) {
                processArray(msg)
            } else {
                processObject(msg);
            }
        }
    });

    vd_IPC.on('send',function(msg){
        console.log('sent message:',msg);
    });

    vd_IPC.on('error',function(err){
        console.log('client error',err.message);
    });

    vd_IPC.on('exit',function(){
        console.log('client exited');
    });
    
    

    let data_in = '';

    let onvariable;

    const countResolves = [], namesResolves = [], objectCallbacks = [];
 
    
    const self = {

        count,
        goto,
        next,
        previous,
        current,
        names,
        custom,
        visibleIndex,
        on: function(e,fn) {
            switch (e) {
                case 'variable' : onvariable = fn; break;
                case 'change' : self.onchange = fn; break;
                    
            }
        }
    };

    let onchange,last;

    Object.defineProperties(self,{onchange:{
        get : function () { return onchange;},
        set : function(v) {
          
            if (typeof v==='function') {
                onchange = v;
            }
        },
        enumerable: true,
    }});




    return self;

    function processObject(obj) {
  
        if (typeof onchange + typeof obj.visibleIndex + typeof obj.visible === 'functionnumberstring' ) {
            const token = `${obj.visibleIndex}:${obj.visible}`;
            if (last !== token) {
                last=token;
                onchange(obj);
            }
        }

        objectCallbacks.forEach(function(fn){fn(obj);});

        if (typeof onvariable==='function') {

            if (typeof obj.visibleIndex==='number') {
                onvariable('visibleIndex',obj.visibleIndex);
            }
            if (typeof obj.visible === 'string') {
                onvariable('visible',obj.visible);
            }
        }
        
    }

    function processArray(arr) {
   
        countResolves.splice(0,countResolves.length).forEach(function(resolve){
            resolve(arr.length);
        });

        namesResolves.splice(0,namesResolves.length).forEach(function(resolve){
            resolve(arr);
        });

        if (typeof onvariable==='function') {
            onvariable('count',arr.length);
            arr.forEach(function(nm,i){
                onvariable(`Desktop-${i+1}`,nm);
            });
        }
    }

    function send (cmd){
        vd_IPC.send(cmd);
    }

    function custom (cmd) {
        return new Promise(function(resolve,reject) {
            objectCallbacks.push(onObj);

            send(cmd);

            function onObj(obj) {
                objectCallbacks.splice(objectCallbacks.indexOf(onObj),1);
                resolve(obj);
            }
        });

    }



    function visibleIndex () {
        return new Promise(function(resolve,reject) {
            objectCallbacks.push(onObj);

            send('gcd');

            function onObj(obj) {
                objectCallbacks.splice(objectCallbacks.indexOf(onObj),1);
                resolve(obj.visibleIndex);
            }
        });

    }


    function names() {

        return new Promise(function(resolve,reject) {
            try {
                namesResolves.push(resolve);
                send ('names');      
            } catch (e) {
                reject(e);
            }
        });

    }

    function goto (dt) {
        return new Promise(function(resolve) {

            objectCallbacks.push(onObj);
            send(`s:${dt}`);

            function onObj(obj) {
                if( (typeof dt==='string' && obj.visible === dt)||
                    (typeof dt==='number' && obj.visibleIndex === dt) ) {
                    objectCallbacks.splice(objectCallbacks.indexOf(onObj),1);
                    resolve(obj);
                }
            }
        });
    }

    function previous (index) {

        return new Promise(function(resolve,reject) {
            objectCallbacks.push(onObj);
            send ('left');     
            function onObj(obj) {
                objectCallbacks.splice(objectCallbacks.indexOf(onObj),1);
                resolve(obj);
            }       
        });
    }

    function next (index) {
        return new Promise(function(resolve,reject) {
            objectCallbacks.push(onObj);
            send ('right');     
            function onObj(obj) {
                objectCallbacks.splice(objectCallbacks.indexOf(onObj),1);
                resolve(obj);
            }       
        });
    }

    function current () {
        return new Promise(function(resolve,reject) {
            objectCallbacks.push(onObj);
            send ('gcd');     
            function onObj(obj) {
                objectCallbacks.splice(objectCallbacks.indexOf(onObj),1);
                resolve(obj);
            }       
        });
    }


    function count () {
        return new Promise(function(resolve,reject) {
            countResolves.push(resolve);
            send ('names');
            
        });
    }

 
}