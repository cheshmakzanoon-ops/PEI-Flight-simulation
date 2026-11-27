const load=p=>{
 try{return require(p);}
 catch(e){
  if(e.code!=='MODULE_NOT_FOUND')throw e;
  throw new Error('Optional proof dependency '+p+' is missing. Run npm install with optional dependencies enabled.');
 }
};
const {chromium}=load('playwright');
const {PNG}=load('pngjs');
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'), http=require('node:http');
const {createHash}=require('node:crypto');
const root=path.join(__dirname,'dist'),loopback='127.0.0.1';
let origin;
const executablePath=process.env.BORDEN_CHROMIUM_EXECUTABLE;
if(executablePath&&!path.isAbsolute(executablePath))throw new Error('BORDEN_CHROMIUM_EXECUTABLE must be an absolute path');
const sha=a=>createHash('sha256').update(a).digest('hex'), names=['opening','reciprocal','medium'];

const server=http.createServer((req,res)=>{
 if((req.method!=='GET'&&req.method!=='HEAD')||req.headers.host!==new URL(origin).host){
  res.writeHead(403).end();return;
 }
 let n;
 try{
  const u=new URL(req.url,origin);
  if(u.origin!==origin||u.search||u.hash){res.writeHead(403).end();return;}
  n=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).replace(/^\//,'');
 }catch{res.writeHead(400).end();return;}
 if(!/^index\.html$|^assets\/index-[A-Za-z0-9_-]+\.js$/.test(n)){
  res.writeHead(404).end();return;
 }
 const f=path.join(root,n);
 if(!fs.existsSync(f)){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':n.endsWith('.js')?'text/javascript':'text/html','Cache-Control':'no-store'});
 if(req.method==='HEAD')res.end();else fs.createReadStream(f).pipe(res);
});
const imageDiff=(a,b,R,N)=>{
 const rows=[a,b,R,N].map(b=>PNG.sync.read(b));
 A(rows.every(x=>x.width===518&&x.height===580));
 const [old,next,r,n]=rows.map(x=>x.data);
 let alpha=0,outside=0,strong=0,unchangedRole=0,upperSash=0,lantern=0;
 for(let i=0;i<old.length;i+=4) {
  const d=Math.max(Math.abs(old[i]-next[i]),Math.abs(old[i+1]-next[i+1]),Math.abs(old[i+2]-next[i+2]));
  if(old[i+3]!==next[i+3])alpha++;
  if(!r[i]&&!r[i+1]&&!n[i]&&!n[i+1]){
   if(d)outside++;
   if(!Buffer.from(old.subarray(i,i+3)).equals(old.subarray(0,3)))unchangedRole++;
  }
  if(d>2)strong++;
  if(n[i+2])upperSash++;
  if(n[i+1]&&d)lantern++;
 }
 return {alpha,outside,strong,unchangedRole,upperSash,lantern};
};
(async()=>{
 let browser;
 const out=path.resolve(process.argv[2]??'borden-proof');
 if(fs.existsSync(out))throw new Error('Refusing to overwrite earlier studio receipt');
 fs.mkdirSync(out);
 try {
  const src=dir=>fs.readFileSync(path.join(__dirname,dir));
  A.equal(sha(src('../BORDEN-REAR-DETACHED-V2-PRELOCK.md')),'985942561de4ec68efcd3e07f8804fe4ee7952beffb54ecd41d62c89e61454bb');
  A.equal(sha(src('../studio/src/rear-range.ts')),'9ceb49c799b77b4812d94dc95cf0502dfd3e9c280a764fd81713d468df8e1a6b');
  A.equal(sha(src('src/rear-range.ts')),'b81f8eb972a3ea8c1dab55148fe741e162d58c383c9b03c663641b34fe166530');
  const wire=src('../v1-rgba-reference.json');
  A.equal(sha(wire),'81bc3cce3162a19010d20eb336945b16f964dc85438c31f97f8573232d91f629');
  const reference=JSON.parse(wire);
  A.equal(reference.schema,'borden-rear-detached-v1-rgba-v1');
  A.deepEqual(Object.keys(reference.views),names);
  A.deepEqual([reference.width,reference.height,reference.samples,reference.threeRevision],[518,580,4,187]);
  await new Promise((a,b)=>{server.once('error',b);server.listen(0,loopback,a);});
  origin='http://'+loopback+':'+server.address().port;
  browser=await chromium.launch({...(executablePath?{executablePath}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1680,height:852},deviceScaleFactor:1,colorScheme:'dark'});
  const requests=[],errors=[];
  page.on('request',r=>requests.push(r.url()));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const fail=new Promise((_,reject)=>page.once('pageerror',e=>{errors.push(String(e));reject(e);}));
  fail.catch(()=>{});
  await page.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await page.goto(origin+'/',{waitUntil:'networkidle'});
  await Promise.race([page.waitForFunction(()=>document.documentElement.dataset.studio==='ready',{},{timeout:30000}),fail]);
  A.deepEqual(errors,[]);
  const receipt=await page.evaluate(()=>({type:window.__bordenStudio.type,ready:window.__bordenStudio.ready,proof:window.__bordenStudio.proof}));
  A.deepEqual(receipt.proof.map(p=>p.id),names); A.deepEqual(receipt.proof.map(p=>p.draws.before.tris),[512,512,284]);
  A.deepEqual(receipt.proof.map(p=>p.draws.after.tris),[740,740,500]);
  const imageBytes=await page.evaluate(()=>window.__bordenStudio.read());
  A.deepEqual(imageBytes.map(p=>p.id),names);
  const images={},rawChecks={};
  for(const {id,rows} of imageBytes){
   const buf={};
   for(const [n,s] of Object.entries(rows)){
    const b=Buffer.from(s,'base64'),f=id+'-'+n+'.png';buf[n]=b;
    fs.writeFileSync(path.join(out,f),b);images[f]={bytes:b.length,sha:sha(b)};
   }
   A.deepEqual(Object.keys(buf),['v1','role-v1','role-v2','v2']);
   const decoded=PNG.sync.read(buf.v1);
   A.deepEqual([decoded.width,decoded.height],[reference.width,reference.height]);
   const baselineSha=sha(decoded.data);
   const historicalExact=baselineSha===reference.views[id];
   const raw={baselineSha,historicalExact,...imageDiff(buf.v1,buf.v2,buf['role-v1'],buf['role-v2'])};
   const native=receipt.proof.find(p=>p.id===id).stats;
   A.deepEqual([raw.alpha,raw.outside,raw.strong,raw.unchangedRole,raw.upperSash,raw.lantern],
    [native.alpha,native.outside,native.strong,native.protectedSeen,native.sash,native.lanternChanged]);
   rawChecks[id]=raw;
  }
  const book=await page.screenshot({path:path.join(out,'studio-triptych-v2.png')});
  images['studio-triptych-v2.png']={bytes:book.length,sha:sha(book)};
  A.equal(requests.length,2);A(requests.every(u=>u.startsWith(origin+'/')));
  const decision=receipt.ready&&Object.values(rawChecks).every(x=>x.historicalExact)?'TECHNICAL PASS / visual review pending':'HOLD';
  const run={...receipt,requests,errors,images,rawChecks,decision,browserVersion:browser.version(),referenceReceiptSha256:reference.referenceReceiptSha256,layout:'Same exact local studio camera/pose; not a flight or stock-site read'};
  fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(run,null,2)+'\n');
  console.log(JSON.stringify(run,null,2));
  if(decision==='HOLD')throw new Error('Frozen pixel or isolation gates differ. Receipt retained; do not treat this renderer as reference-qualified.');
 }catch(e){
  fs.writeFileSync(path.join(out,'failure.txt'),String(e.stack??e));
  throw e;
 }finally {
  if(browser)await browser.close();
  server.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
