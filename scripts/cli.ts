import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateCatalog, renderReadme } from './catalog.ts';
const checkout=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function main(){
 const [command]=process.argv.slice(2);
 const c=validateCatalog(JSON.parse(await readFile(path.join(checkout,'catalog.json'),'utf8')));
 if(command==='validate'){console.log(c.projects.length+' valid projects');return;}
 if(command==='render'){await writeFile(path.join(checkout,'README.md'),renderReadme(c));console.log('README generated');return;}
 if(command==='check'){
  if(await readFile(path.join(checkout,'README.md'),'utf8')!==renderReadme(c))throw Error('README is stale; run npm run render');
  console.log(c.projects.length+' valid projects; README matches catalog');return;
 }
 throw Error('Commands: validate, render, check');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});


