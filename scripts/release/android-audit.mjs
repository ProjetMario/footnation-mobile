import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {encrypt,decrypt,releaseKey} from './envelope.mjs';
process.umask(0o077);
const base=path.join(process.env.RUNNER_TEMP||'', 'footnation-android-audit');
const output=path.join(process.env.RUNNER_TEMP||'', 'footnation-android-proof');
const key=releaseKey(process.env.FN_ANDROID_AUDIT_KEY);
if(!process.env.RUNNER_TEMP||!process.env.GITHUB_WORKSPACE)throw Error('CI runner required');
function run(command,args){const result=spawnSync(command,args,{cwd:base,encoding:'utf8',maxBuffer:32e6});fs.appendFileSync(path.join(base,'commands.log'),(result.stdout||'')+'\n'+(result.stderr||''));if(result.status!==0)throw Error('Audit command failed');return result.stdout;}
try {
 if(process.argv[2]==='prepare'){
  fs.mkdirSync(base,{mode:0o700});
  const payload=process.env.FN_PAYLOAD_PATH;
  if(!/^release\/[a-zA-Z0-9.-]+\.enc$/.test(payload||''))throw Error('Invalid payload path');
  const encrypted=fs.readFileSync(path.join(process.env.GITHUB_WORKSPACE,payload));
  if(crypto.createHash('sha256').update(encrypted).digest('hex')!==process.env.FN_PAYLOAD_SHA256)throw Error('Payload hash mismatch');
  const data=JSON.parse(decrypt(encrypted,key));
  const url=new URL(data.aabUrl);
  if(url.protocol!=='https:'||!['expo.dev','expo.io','eas-build-artifacts.s3.us-east-1.amazonaws.com'].some(h=>url.hostname===h||url.hostname.endsWith('.'+h)))throw Error('Unexpected build artifact host');
  const response=await fetch(url);
  if(!response.ok)throw Error('Build download failed');
  const aab=Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(path.join(base,'app.aab'),aab);
  fs.writeFileSync(path.join(base,'private.json'),JSON.stringify(data));
  fs.writeFileSync(path.join(base,'provenance.json'),JSON.stringify({version:data.version,build:data.build,buildId:data.buildId,aabSha256:crypto.createHash('sha256').update(aab).digest('hex')}));
  const bundletool=await fetch('https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar');
  if(!bundletool.ok)throw Error('Official bundletool download failed');
  fs.writeFileSync(path.join(base,'bundletool.jar'),Buffer.from(await bundletool.arrayBuffer()));
  run('java',['-jar','bundletool.jar','validate','--bundle=app.aab']);
  const manifest=run('java',['-jar','bundletool.jar','dump','manifest','--bundle=app.aab']);
  if(!manifest.includes('package="com.footnation.app"')||!manifest.includes('android:versionName="'+data.version+'"')||!manifest.includes('android:versionCode="'+data.build+'"'))throw Error('Wrong app identity');
  if(/android.permission.READ_MEDIA_(IMAGES|VIDEO|VISUAL_USER_SELECTED)\b/.test(manifest))throw Error('Broad media permission present');
  run('java',['-jar','bundletool.jar','build-apks','--bundle=app.aab','--output=app.apks','--mode=universal']);
  run('unzip',['-q','app.apks','universal.apk']);
  console.log('Android store bundle validated; native audit APK prepared.');
 }else if(process.argv[2]==='finalize'){
  fs.mkdirSync(output,{mode:0o700});
  if(fs.existsSync(base)){
   const entries=['provenance.json','commands.log','ui.log','report.json','screens','hierarchies','failure.png','failure.xml'].filter(f=>fs.existsSync(path.join(base,f)));
   if(entries.length){run('tar',['-czf','proof.tar.gz',...entries]);fs.writeFileSync(path.join(output,'proof.tar.gz.enc'),encrypt(fs.readFileSync(path.join(base,'proof.tar.gz')),key));}
   fs.rmSync(base,{recursive:true,force:true});
  }
 }else throw Error('Unknown audit phase');
}catch{console.error('Android audit phase failed. Details remain private.');process.exitCode=1;}finally{key.fill(0);}
