
const path = require('path'),fs = require('fs'), vd_path = path.dirname(require.resolve('virtual-desktop'));
const os = require('os')
const { execFile } = require('node:child_process');

let virtualDesktopExePath = path.join(vd_path,'VirtualDesktop.exe');
let buildVirtualDesktopExePath = path.join(vd_path,'Build.bat');

 

module.exports = function() {
    
    return new Promise(function(resolve,reject){

        fs.stat(virtualDesktopExePath,function(err){
            if (err) {
                process.chdir(vd_path);
                console.log("building virtualDesktop.exe");
                const child = execFile('cmd', [ '/c', buildVirtualDesktopExePath ], {env : {CMDCMDLINE : ``} }, function (error,stdout) {
                    process.chdir(__dirname);
                    if (error) return reject(error);
                  
                    resolve( desktopManager() );
        
                });
            } else {
                resolve( desktopManager() );
            }
            
        });
     

    });
   
 
};

module.exports.CSharpPath = CSharpPath;
module.exports.CSharpOk = CSharpOk;


function CSharpPath () {
    if (! CSharpPath.cache ) {
        CSharpPath.cache = path.join (  process.env.SystemRoot ||  process.env.windir || 'c:\\Windows' ,'Microsoft.NET','Framework','v4.0.30319','csc.exe');
    }
    return CSharpPath.cache;
}

function  CSharpOk() {
    return fs.existsSync( CSharpPath ());
}



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
 
function desktopManager() {

    let onchange;
    let self = {
        count,
        goto,
        names,
        visibleIndex,
        current,
        next,
        previous
    };

    Object.defineProperties(self,{onchange:{
        get : function () { return onchange;},
        set : function(v) {
          
            if (typeof v==='function') {
                onchange = v;
            }
        },
        enumerable: true,
    }})

    waitForDesktopChanges(notifier);

    return self;

    function notifier(info) {
        if (typeof onchange==='function') {
            onchange(info);
        }
    }

    function goto (n) {
        return new Promise(function(resolve,reject){
            switchToDesktop(n,function (err,name,index ){
                return err ? reject(err) : resolve( {index,name}  );
            });
        });
            
    }

    function count() {
        return new Promise(function(resolve,reject){
            getDesktopCount(function (err,count){
                return err ? reject(err) : resolve( count );
            });
        });
    }

    function names () {
        return new Promise(function(resolve,reject){
            getDesktops(function (err,desktops){
                return err ? reject(err) : resolve( desktops.names );
            });
        });
    }

    

    function visibleIndex () {
        return new Promise(function(resolve,reject){
            getDesktops(function (err,desktops){
                return err ? reject(err) : resolve( desktops.visibleIndex );
            });
        });
    }

    function current( ) {

        return new Promise(function(resolve,reject){
            getCurrentDesktop(function (err,info){
                return err ? reject(err) : resolve( info );
            });
        });
        
    }

    function previous( ) {

        return new Promise(function(resolve,reject){
            previousDesktop(function (err,info){
                return err ? reject(err) : resolve( info );
            });
        });
        
    }

    function next( ) {

        return new Promise(function(resolve,reject){
            nextDesktop(function (err,info){
                return err ? reject(err) : resolve( info );
            });
        });
        
    }


    
}


function desktopManager1() {

    var spawn = require('child_process').spawn;
    var child = spawn(virtualDesktopExePath,['/INT']);

    let data_in = '';

    let onvariable;

    const countResolves = [], namesResolves = [], objectCallbacks = [];
 
    child.stdout.on('data', function(data) {
       
       data_in += data.toString();
       const lines = data_in.split('\n');
       data_in = '';
      
       while (lines.length>0) {

         const line = lines.shift();
         
         if (line.startsWith('{') ) {

            if (line.endsWith('}')) {
                
                // process json object line
                try {
                    processObject(JSON.parse(line));
                } catch (err) {
                    console.log(err)
                }

            } else {

                if (lines.length===0) {
                    // this is an incomplete json object line, save it for later
                    data_in = line;
                    break;
                }

            }

         } else {
            if (line.startsWith('[') ) {
                if (line.endsWith(']') ) {
                    try {
                        processArray(JSON.parse(line));
                    } catch (err) {
                        console.log(err)
                    }
                } else {
                    if (lines.length===0) {
                         // this is an incomplete json array line, save it for later
                        data_in = line;
                        break;
                    }
                }
            } else {
               // ignore non JSON line
            }
         }
       }

    });

    const self = {

        count,
        goto,
        next,
        previous,
        current,
        names,
        send,
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
        console.log({obj});


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
        console.log({arr});

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
        child.stdin.write(`${cmd}\n`);
        
    }

    function visibleIndex () {
        return new Promise(function(resolve,reject) {
            objectCallbacks.push(onObj);

            send('gcd');

            function onObj(obj) {
                objectCallbacks.splice(objectCallbacks.indexOf(onObj),1);
                resolve(obj);
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