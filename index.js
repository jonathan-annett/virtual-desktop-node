
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
            cb(undefined,desktops.names [n]);
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
        goto : switchTo,
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

    function switchTo (n) {
        return new Promise(function(resolve,reject){
            switchToDesktop(n,function (err,name ){
                return err ? reject(err) : resolve( name  );
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


