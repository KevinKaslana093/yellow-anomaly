import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const output=resolve(process.argv[2]||'dist');mkdirSync(output,{recursive:true});
const img='data:image/png;base64,'+readFileSync('public/assets/trio.png').toString('base64');
const css=readFileSync('public/style.css','utf8').replaceAll('assets/trio.png',img);
const sim=readFileSync('public/sim.js','utf8'),js=readFileSync('public/game.js','utf8').replaceAll('assets/trio.png',img);
let html=readFileSync('public/index.html','utf8').replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>').replace('<script src="sim.js"></script><script src="game.js"></script>','<script>'+sim+'\n'+js+'</script>');
writeFileSync(resolve(output,'黄色生物-失控现场.html'),html);console.log('Built standalone offline HTML ('+Math.round(Buffer.byteLength(html)/1024)+' KB)');
