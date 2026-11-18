import http from 'node:http';
import {mkdirSync,readFileSync,existsSync,lstatSync,writeFileSync,chmodSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import worker from '../dist/server/index.js';
import {localD1} from './d1-local.mjs';
import {localAudioBucket} from './r2-local.mjs';
const port=Number(process.env.LEVO_PORT)||4318;
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose a local port between 1024 and 65535.');
const origin='http://127.0.0.1:'+port;
const bucket=localAudioBucket(existsSync('audio/pronunciations-v2')?'audio/pronunciations':'.local/pronunciations');
mkdirSync('.local',{recursive:true});
const db=localD1('.local/classroom.sqlite');
if(!db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='classrooms'").get())db.raw.exec(readFileSync('drizzle/0000_classrooms.sql','utf8'));
if(!db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='speaking_checks'").get())db.raw.exec(readFileSync('drizzle/0001_speaking_checks.sql','utf8'));
if(!db.raw.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='speaking_checks_student_status_time'").get())db.raw.exec(readFileSync('drizzle/0002_speaking_reports_index.sql','utf8'));
const runtime={DB:db,BUCKET:bucket,OPENAI_API_KEY:process.env.OPENAI_API_KEY},setupToken=randomBytes(24).toString('hex');
const setupHTML=()=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LeVo · Connect AI</title><style>body{margin:0;background:#f3f7fc;font:16px/1.6 system-ui;color:#23476e}main{max-width:520px;margin:60px auto;padding:28px;background:white;border:1px solid #d6e2f0;border-radius:16px}input{display:block;width:100%;box-sizing:border-box;padding:14px;border:1px solid #b8cee5;border-radius:9px;margin:10px 0 22px}button,a{color:#245fa6}button{background:#245fa6;color:white;padding:13px 20px;border:0;border-radius:9px;cursor:pointer}small{display:block;color:#536f8b}label{display:block}.replace input{display:inline;width:auto;margin:10px}@media(max-width:600px){main{margin:20px 14px}}</style><main><h1>Connect AI</h1><p>Enable pronunciation feedback.<small lang="vi">Bật kiểm tra phát âm bằng OpenAI.</small></p><p>Audio and recording work without an API key.<small lang="vi">Nghe mẫu và ghi âm không cần API key.</small></p><form method="post" action="/setup"><input type="hidden" name="csrf" value="${setupToken}"><label>OpenAI API key<input type="password" name="key" autocomplete="off" required spellcheck="false" placeholder="sk-…"></label>${runtime.OPENAI_API_KEY?'<label class="replace"><input type="checkbox" name="replace" required>Replace the configured key / Thay key hiện có</label>':''}<p><small>Save to .env.local on this computer. The key stays on the local server; it is excluded from code exports.<br lang="vi">Lưu vào .env.local trên máy này, không đưa key vào bản ZIP. Khi bấm Check, audio được gửi đến OpenAI và có thể phát sinh phí API.</small></p><button type="submit">Save and enable / Lưu và bật</button></form><p><a href="/?practice=speaking">Back to Speaking</a></p><p><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI API keys ↗</a></p></main></html>`;
// This loopback-only server supplies a local teacher identity. Hosted deployment uses ChatGPT sign-in.
const server=http.createServer(async(req,res)=>{
  try{
    if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403);res.end('Invalid local host.');return;}
    const path=new URL(req.url,origin).pathname;
    if(path==='/health'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({app:'LeVo',local:true}));return;}
    if(path==='/setup'&&req.method==='GET'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"});res.end(setupHTML());return;}
    const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>2000000){res.writeHead(413);res.end('Recording is too large.');return;}chunks.push(c);}
    if(path==='/setup'){
      const form=new URLSearchParams(Buffer.concat(chunks).toString()),sameOrigin=req.headers.origin==='http://'+req.headers.host;
      if(req.method!=='POST'||!sameOrigin||form.get('csrf')!==setupToken||(runtime.OPENAI_API_KEY&&form.get('replace')!=='on')){res.writeHead(403);res.end('Reopen Connect AI and confirm the change.');return;}
      const key=(form.get('key')||'').trim();if(!/^sk-[a-zA-Z0-9_-]{16,}$/.test(key)){res.writeHead(400);res.end('Use a valid OpenAI API key. / API key không đúng định dạng.');return;}
      if(existsSync('.env.local')&&lstatSync('.env.local').isSymbolicLink()){res.writeHead(400);res.end('The settings file must be a regular local file.');return;}
      const before=existsSync('.env.local')?readFileSync('.env.local','utf8'):'';
      writeFileSync('.env.local',before.split(/\r?\n/).filter(line=>!/^\s*(export\s+)?OPENAI_API_KEY\s*=/.test(line)).join('\n').trimEnd()+'\nOPENAI_API_KEY='+key+'\n',{mode:0o600});chmodSync('.env.local',0o600);runtime.OPENAI_API_KEY=key;
      res.writeHead(303,{location:'/?practice=speaking','cache-control':'no-store'});res.end();return;
    }
    const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-preview-teacher');
    const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    let response=await worker.fetch(request,runtime);
    if(path==='/api/speaking/config'&&response.ok){const config=await response.json();response=new Response(JSON.stringify({...config,local:true}),{headers:response.headers});}
    if(response.status===404&&/^\/audio\/v[12]\/[a-f0-9]{24}\.(wav|m4a)$/.test(path))response=await fetch('https://lexilab-stem-vn-qn16.quynhthinhuto.chatgpt.site'+path,{headers:req.headers.range?{range:req.headers.range}:{},signal:AbortSignal.timeout(10000)});
    res.writeHead(response.status,{...Object.fromEntries(response.headers),'cache-control':'no-store'});res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:'Local request failed. Restart LeVo. / Hãy khởi động lại LeVo.'}));}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'LeVo is already using port '+port+'. Open '+origin:'Could not start LeVo.');process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
  console.log('LeVo: '+origin);console.log(runtime.OPENAI_API_KEY?'Speaking AI: configured':'Speaking AI: open '+origin+'/setup to connect. Audio and recording are ready.');
  if(process.env.LEVO_OPEN_BROWSER==='1'){const launch=process.platform==='darwin'?['open',[origin]]:process.platform==='win32'?['rundll32',['url.dll,FileProtocolHandler',origin]]:['xdg-open',[origin]];const child=spawn(...launch,{stdio:'ignore',detached:true});child.on('error',()=>{});child.unref();}
});
