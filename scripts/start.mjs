import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
if(Number(process.versions.node.split('.')[0])<24){console.error('LeVo needs Node.js 24 or newer. / Cần Node.js 24 trở lên: https://nodejs.org/');process.exit(1);}
if(!process.env.OPENAI_API_KEY?.trim())delete process.env.OPENAI_API_KEY;
if(existsSync('.env.local')){try{process.loadEnvFile('.env.local');}catch{console.error('Could not load .env.local. Check its format.');process.exit(1);}}
const build=spawnSync(process.execPath,['scripts/build.cjs'],{stdio:'inherit'});if(build.status!==0)process.exit(build.status||1);
if(process.argv.includes('--open'))process.env.LEVO_OPEN_BROWSER='1';
await import('./preview.mjs');
