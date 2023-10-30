# virtual-desktop-node

node.js Wrapper around my fork of [VirtualDesktop](https://github.com/jonathan-annett/VirtualDesktop) a utilty originally written by [MScholtes](https://github.com/MScholtes/VirtualDesktop) 


It's intended for use in an electron or nwjs app that interacts with the windows desktop, although there is nothing stopping you using it in a "server" app that happens to be running on windows.


in your project's **package.json** file
```json
{
   ...

    "dependencies": {
        "virtual-desktop-node": "git+https://github.com/jonathan-annett/virtual-desktop-node.git"
    }
    ...
}
```

In your project's **whatever.js** file

```js
 
 const virtualDesktop = require ("virtual-desktop-node");

 
 virtualDesktop.startManager ( ).then(function(desktops){

    const logger = console.info.bind(console);
    const errors = console.error.bind(console);

    desktops.on('change',logger);

    desktops.on('variable',logger);

    desktops.names().then(logger).catch(errors);

    desktops.goto(1).then(logger).catch(errors);


 });

```
