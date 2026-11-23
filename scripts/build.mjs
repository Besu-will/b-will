import {mkdir,copyFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
const root=process.cwd(),out=resolve(root,'dist');
for(const k of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','ADMIN_EMAIL'])if(!process.env[k])throw new Error('Missing required environment variable: '+k);
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ADMIN_EMAIL))throw new Error('ADMIN_EMAIL must be a valid email address');
await mkdir(out,{recursive:true});for(const f of ['index.html','styles.css','app.js','manifest.json','sw.js'])await copyFile(resolve(root,f),resolve(out,f));
await writeFile(resolve(out,'config.js'),'window.BW_CONFIG = '+JSON.stringify({supabaseUrl:process.env.SUPABASE_URL,supabaseKey:process.env.SUPABASE_PUBLISHABLE_KEY,adminEmail:process.env.ADMIN_EMAIL})+';\n');
console.log('B-Will build ready in dist/');