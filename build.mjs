import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const output=resolve(process.argv[2]||'dist');mkdirSync(output,{recursive:true});
const img='data:image/png;base64,'+readFileSync('public/assets/trio.png').toString('base64');
const css=readFileSync('public/style.css','utf8').replaceAll('assets/trio.png',img);
let html=readFileSync('public/index.html','utf8').replace('<link rel="stylesheet" href="style.css?v=3">',()=>'<style>'+css+'</style>');
for(const src of ['vendor/three.min.js','brawl.js','arena3d.js','brawl-ui.js']){
 const license=src.startsWith('vendor/')?'/*\n'+readFileSync('public/vendor/three-LICENSE.txt','utf8')+'\n*/\n':'';
 const js=(license+readFileSync('public/'+src,'utf8')).replaceAll('assets/trio.png',img).replace(/<\/script/gi,'<\\/script');
 html=html.replace('<script src="'+src+'?v=3"></script>',()=>'<script>'+js+'</script>');
}
writeFileSync(resolve(output,'yellow-anomaly-brawl.html'),html);console.log('Built standalone offline HTML ('+Math.round(Buffer.byteLength(html)/1024)+' KB)');
