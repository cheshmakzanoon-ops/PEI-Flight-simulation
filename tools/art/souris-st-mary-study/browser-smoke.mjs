import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const url=process.env.PEI_SOURIS_STUDIO_URL??'http://127.0.0.1:4174/tools/art/souris-st-mary-study/';
const out=process.env.PEI_SOURIS_STUDIO_OUT??'artifacts/smoke';
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:820}});
  const problems=[];
  page.on('pageerror',error=>problems.push(error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&!message.text().includes('favicon.ico'))problems.push(message.text());
  });
  await page.goto(url);
  const canvas=page.locator('#display canvas');
  await page.waitForFunction(()=>document.querySelector('#display canvas')?.dataset.orbitReady==='entry');
  const text=await page.locator('#load').textContent();
  assert.match(text,/^4886 model triangles · 7 model draws$/);
  assert.equal(await page.getByRole('button',{name:'Southwest entry'}).getAttribute('aria-pressed'),'true');
  await mkdir(out,{recursive:true});
  const entry=await canvas.screenshot();
  await page.getByText('Procedural stone and patina',{exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#display canvas')?.dataset.finish==='false');
  const flat=await canvas.screenshot();
  const p=PNG.sync.read(entry),q=PNG.sync.read(flat);
  assert.deepEqual([p.width,p.height],[q.width,q.height]);
  let delta=0;
  for(let i=0;i<p.data.length;i+=4)
    if(Math.max(...[0,1,2].map(j=>Math.abs(p.data[i+j]-q.data[i+j])))>2)delta++;
  assert(delta>1000,'Material toggle did not change the displayed exterior');
  await page.getByText('Procedural stone and patina',{exact:true}).click();
  for(const [key,name] of [['side','Side elevation'],['chase','Chase viewing angle'],['detail','Tower details']]){
    const b=page.getByRole('button',{name,exact:true});
    await b.click();
    await page.waitForFunction(k=>document.querySelector('#display canvas')?.dataset.orbitReady===k,key);
    assert.equal(await b.getAttribute('aria-pressed'),'true');
    if(key==='detail')await writeFile(out+'/souris-st-mary-towers.png',await canvas.screenshot());
  }
  await writeFile(out+'/souris-st-mary-entry.png',entry);
  await page.setViewportSize({width:390,height:810});
  await page.getByRole('button',{name:'Southwest entry'}).click();
  await page.waitForFunction(()=>document.querySelector('#display canvas')?.dataset.orbitReady==='entry');
  const mobile=await canvas.boundingBox();
  assert(mobile&&mobile.width>260&&mobile.width<=390&&mobile.height>=350);
  assert.deepEqual(problems,[]);
  console.log(JSON.stringify({scope:'detached art only',studio:text,materialPixelsBeyondTwoCodes:delta,mobileWidth:mobile.width}));
}finally{await browser.close();}
