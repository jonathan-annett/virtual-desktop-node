
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
    const child = execFile(virtualDesktopExePath, ['/List'], (error, stdout, stderr) => {
        if (error) {
            return cb( error );
        }
        const list = stdout.replace(/\r\n/g,'\n').split("\n");
        if (list[1].startsWith('---')) {
            list.splice(0,2);
            const term =  list.indexOf('') ;
            if (term >=0) {
                list.splice(term,list.length);
            }
            const current = list.findIndex(function (line){return line.endsWith(' (visible)')});
            if (current>=0) {
                list[current]=list[current].replace(/\ \(visible\)$/,'');
                return cb (undefined,{names:list,visible:list[current],visibleIndex:current});
            }
            cb (undefined,{names:list});
           
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
    const child = execFile(virtualDesktopExePath, ['/GetCurrentDesktop'], (error,stdout) => {
   
        if (error) {
            return cb( error );
        }

       cb (undefined,{name:stdout.split("'")[1],index:Number.parseInt(stdout.split('(desktop number ')[1])});
       
       
    }); 
}



function waitForDesktopChanges(cb) {
 

    getDesktops(function (error,desktops) {

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
                cb (new Error("invalid desktop name")) ;
            }
        }

        const child = execFile(virtualDesktopExePath, [`/Switch:${n}` ], function (err,stdout,stderr) {
            if (err && err.code !== n) return cb (err);
            cb(undefined,desktops.names [n]);
        }); 
        
    });

}

 
function desktopManager() {

    let onchange;
    let self = {
        count,
        switch : switchTo,
        names,
        visibleIndex,
        current
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

    
}


