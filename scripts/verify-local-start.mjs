import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,cpSync,existsSync,statSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
const root=mkdtempSync(join(tmpdir(),'levo-release-test-')),port=45000+Math.floor(Math.random()*10000),origin='http://127.0.0.1:'+port;
const audioDirectory=existsSync('audio/pronunciations-v2')?'audio/pronunciations':'.local/pronunciations';
const excluded=new Set(['node_modules','.git','.local','audio','outputs']);
function copySources(folder=''){
 for(const item of readdirSync(folder||'.',{withFileTypes:true})){if(excluded.has(item.name)||item.name.startsWith('.env')||item.isSymbolicLink())continue;const relative=join(folder,item.name);if(item.isDirectory()){mkdirSync(join(root,relative),{recursive:true});copySources(relative);}else{mkdirSync(dirname(join(root,relative)),{recursive:true});cpSync(relative,join(root,relative));}}
}
copySources();
const key='3be1c35b06af0eb8a9e58e72';mkdirSync(join(root,'audio/pronunciations-v2'),{recursive:true});cpSync(audioDirectory+'-v2/'+key+'.wav',join(root,'audio/pronunciations-v2/'+key+'.wav'));
let child,log='';const launch=async()=>{
 child=spawn(process.execPath,['scripts/start.mjs'],{cwd:root,env:{...process.env,OPENAI_API_KEY:'',LEVO_OPEN_BROWSER:'',LEVO_PORT:String(port)},stdio:['ignore','pipe','pipe']});child.stdout.on('data',v=>log+=v);child.stderr.on('data',v=>log+=v);
 for(let i=0;i<100;i++){try{const r=await fetch(origin+'/health');if(r.ok){assert.equal((await r.json()).app,'LeVo');return;}}catch{}if(child.exitCode!==null)throw new Error('Local startup failed');await new Promise(r=>setTimeout(r,50));}throw new Error('Local startup timed out');
};
const stop=async()=>{if(!child||child.exitCode!==null)return;const closed=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await closed;};
try{
 await launch();let config=await(await fetch(origin+'/api/speaking/config')).json();assert.equal(config.enabled,false);assert.equal(config.reason,'api_key_missing');assert.equal(config.local,true);
 const wave=Buffer.from(await(await fetch(origin+'/audio/v2/'+key+'.wav')).arrayBuffer());assert.deepEqual(wave,readFileSync(audioDirectory+'-v2/'+key+'.wav'),'Bundled audio is served without a remote dependency');
 const setup=await(await fetch(origin+'/setup')).text(),token=setup.match(/name="csrf" value="([a-f0-9]+)"/)[1],keyValue='sk-local-test-only-12345678901234567890';
 const post=(csrf,remoteOrigin=origin)=>fetch(origin+'/setup',{method:'POST',headers:{origin:remoteOrigin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,key:keyValue}),redirect:'manual'});
 assert.equal((await post(token,'https://external.example')).status,403);assert.equal(existsSync(join(root,'.env.local')),false);
 assert.equal((await post('wrong-token')).status,403);assert.equal((await post(token)).status,303);assert.equal((await(await fetch(origin+'/api/speaking/config')).json()).enabled,true,'Setup enables the same local server without restarting');
 const settings=readFileSync(join(root,'.env.local'),'utf8');assert.ok(settings.includes('OPENAI_API_KEY='));if(process.platform!=='win32')assert.equal(statSync(join(root,'.env.local')).mode&0o777,0o600);assert.ok(!(await(await fetch(origin+'/setup')).text()).includes(keyValue),'The UI never echoes the saved key');assert.ok(!log.includes(keyValue));
 await stop();await launch();assert.equal((await(await fetch(origin+'/api/speaking/config')).json()).enabled,true,'npm start reloads saved settings');
 console.log('PASS: clean-folder startup; bundled audio bytes; explicit missing-key setup; same-origin and CSRF protection; private settings file; immediate enablement; automatic settings reload; no key in HTML or logs.');
}finally{await stop();rmSync(root,{recursive:true,force:true});}
