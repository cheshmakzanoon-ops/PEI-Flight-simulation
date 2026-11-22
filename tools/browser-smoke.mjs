/** Run against a local production preview. Requires Playwright and Chromium. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173/';
const out = process.env.SMOKE_OUTPUT ?? 'artifacts/smoke';
await mkdir(out,{recursive:true});
console.log('Launching Chromium');
const browser = await chromium.launch({
  args:['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  const errors = [];
  page.setDefaultTimeout(60000);
  page.on('pageerror', error=>{errors.push(error.message); console.error(error.message);});
  page.on('console', entry=>{if(entry.type()==='error'){errors.push(entry.text()); console.error(entry.text());} else if (entry.type()==='warning') console.warn(entry.text());});
  page.on('response', response=>{
    if (response.status() >= 400 && response.url().startsWith(url)) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(new URL('?diagnostics', url).toString());
  const state=()=>page.evaluate(()=>window.islandAirDiagnostics);
  const waitState=(mode)=>page.waitForFunction(m=>window.islandAirDiagnostics?.mode===m,mode,{timeout:60000});
  await page.getByRole('button',{name:'Begin flight'}).waitFor({timeout:60000});
  console.log('Dispatch interface loaded');
  await page.waitForFunction(()=>window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.detail?.ready > 0 && window.islandAirDiagnostics?.drawCalls > 10,undefined,{timeout:60000});
  await page.screenshot({path:`${out}/01-dispatch.png`});
  await page.getByRole('button',{name:'Begin flight'}).click();
  await waitState('flight');
  const initial=await state();
  await page.waitForFunction(({x,z})=>Math.hypot(window.islandAirDiagnostics.x-x,window.islandAirDiagnostics.z-z)>15,initial,{timeout:30000});
  assert.equal((await state()).site,'cavendish');
  await page.screenshot({path:`${out}/02-cavendish.png`});
  await page.keyboard.press('v');
  await page.waitForFunction(()=>window.islandAirDiagnostics?.camera==='Cockpit');
  await page.screenshot({path:`${out}/03-cockpit.png`});
  for(const [option,id] of [['4','northcape'],['3','eastpoint'],['1','charlottetown']]){
    await page.keyboard.press('m');
    await waitState('map');
    await page.locator('#map-site').selectOption(option);
    await page.locator('#fly-here').click();
    await waitState('flight');
    assert.equal((await state()).site,id);
  }
  await page.keyboard.press('p'); await waitState('paused');
  const paused=await state();
  await page.waitForTimeout(250);
  const frozen=await state();
  assert.equal(frozen.x,paused.x); assert.equal(frozen.z,paused.z);
  await page.getByRole('button',{name:'Resume flight'}).click(); await waitState('flight');
  assert.deepEqual((await state()).layerWarnings, []);
  assert.deepEqual(errors, []);
  console.log('Browser smoke passed: hosted build, scenery layers, flight, three county routes, camera and pause.');
} finally {
  await browser.close();
}
