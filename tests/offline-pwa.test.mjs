import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('sw.js', root), 'utf8');
const assets = JSON.parse(source.match(/const ASSETS = (\{[\s\S]*?\});/)[1]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('manifest, icons, subdirectory URLs and release hashes describe the complete local shell', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest',root)));
  assert.equal(manifest.name, 'H4 Goal Quest'); assert.equal(manifest.display,'standalone');
  for (const key of ['id','start_url','scope']) assert.equal(manifest[key],'./');
  assert.equal(manifest.theme_color,'#111b36'); assert.equal(manifest.background_color,'#f5f7fd');
  assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));
  for (const icon of [...manifest.icons,{src:'./icons/apple-touch-icon.png',sizes:'180x180'}]) {
    const bytes = await readFile(new URL(icon.src,root));
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,icon.sizes);
  }
  for (const [path,digest] of Object.entries(assets)) {
    assert.match(path,/^\.\//); assert.equal(hash(await readFile(new URL(path,root))),digest,`${path}: run node tools/update-offline-cache.mjs`);
    assert.ok(new URL(path,'https://example.test/goal-quest/').pathname.startsWith('/goal-quest/'));
  }
  for (const file of (await readdir(new URL('js/',root))).filter(f=>f.endsWith('.js'))) assert.ok(assets['./js/'+file]);
  const html=await readFile(new URL('index.html',root),'utf8');
  for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) if(url!=='#main') {assert.match(url,/^\.\//);assert.ok(assets[url]);}
  assert.equal(source.match(/const RELEASE = '([^']+)'/)[1],hash(JSON.stringify(assets)).slice(0,16));
  assert.doesNotMatch(source,/localStorage|indexedDB|skipWaiting\(|clients\.claim\(/);
});

// Execute the real worker event handlers, with failure-capable CacheStorage.
async function worker({base='/goal-quest/', version='test', cacheStore=new Map(), fail, corrupt, quota=false, blocked=false, controls={}}={}) {
  const handlers={}, requests=[];
  const prefix=`h4-goal-quest-shell:${base}:`;
  const cacheAPI={
    keys:async()=>[...cacheStore.keys()], delete:async key=>cacheStore.delete(key),
    open:async name=>{
      if(blocked || controls.blocked) throw new Error('CacheStorage blocked');
      if(!cacheStore.has(name))cacheStore.set(name,new Map());
      const data=cacheStore.get(name);
      return {match:async url=>data.get(String(url))?.clone(),put:async(url,response)=>{if(quota || controls.quota)throw new Error('quota');data.set(String(url),response.clone());}};
    }
  };
  runInNewContext(source.replace(/const RELEASE = '[^']+'/,`const RELEASE = '${version}'`),{
    self:{location:{href:'https://example.test'+base+'sw.js'},addEventListener:(type,fn)=>{handlers[type]=fn;}},
    caches:cacheAPI,crypto:webcrypto,URL,Request,Response,Uint8Array,
    fetch:async request=>{
      requests.push(request.url);
      if(controls.offline)throw new TypeError('Network unavailable');
      if(controls.downloadGate)await controls.downloadGate;
      const path='./'+new URL(request.url).pathname.slice(base.length);
      if(path===(controls.fail || fail))return new Response('missing',{status:404});
      if(controls.redirect)return Response.redirect('https://example.test/newer/',302);
      return new Response(path===(controls.corrupt || corrupt)?'wrong release':await readFile(new URL(path,root)));
    }
  });
  return {cacheStore,requests,prefix,cacheName:prefix+version,
    ready:async()=>{let pending,value;handlers.message({data:'CHECK_OFFLINE_CACHE',ports:[{postMessage:v=>{value=v;}}],waitUntil:p=>{pending=p;}});await pending;return value;},
    dispatch:async type=>{let pending;handlers[type]({waitUntil:p=>{pending=p;}});await pending;},
    fetch:async(path,{mode='navigate',method='GET'}={})=>{let pending;handlers.fetch({request:{url:'https://example.test'+path,mode,method},respondWith:p=>{pending=p;}});return pending;}
  };
}
for(const base of ['/','/goal-quest/']) test(`install and offline navigation cache every verified asset at ${base}`,async()=>{
  const w=await worker({base});await w.dispatch('install');await w.dispatch('activate');
  assert.equal(w.requests.length,Object.keys(assets).length);
  assert.equal(w.cacheStore.get(w.cacheName).size,Object.keys(assets).length);
  for(const path of [base,base+'index.html',base+'?installed=1']) assert.match(await (await w.fetch(path)).text(),/H4 Goal Quest/);
  for(const path of Object.keys(assets)) assert.ok((await w.fetch(base+path.slice(2),{mode:'cors'})).ok);
  assert.equal(await w.fetch('/outside/'),undefined);
  assert.equal(await w.fetch(base+'unknown.json',{mode:'cors'}),undefined);
  assert.equal(await w.fetch(base,{method:'POST'}),undefined);
});
for(const failure of [{fail:'./js/planner.js'},{corrupt:'./styles.css'},{quota:true},{blocked:true}]) test(`failed install retains previous release: ${JSON.stringify(failure)}`,async()=>{
  const old=await worker({version:'old'});await old.dispatch('install');
  const next=await worker({...failure,version:'next',cacheStore:old.cacheStore});
  await assert.rejects(next.dispatch('install'));
  assert.ok(old.cacheStore.has(old.cacheName));assert.ok(!old.cacheStore.has(next.cacheName));
  assert.match(await (await old.fetch('/goal-quest/')).text(),/H4 Goal Quest/);
});
test('activation verifies before cleanup and deletes only obsolete caches belonging to this scope',async()=>{
  const old=await worker({version:'old'});await old.dispatch('install');
  old.cacheStore.set('unrelated',new Map());old.cacheStore.set('h4-goal-quest-shell:/:other',new Map());
  const next=await worker({version:'next',cacheStore:old.cacheStore});await next.dispatch('install');
  const cache=next.cacheStore.get(next.cacheName),url=[...cache.keys()][0],response=cache.get(url);cache.delete(url);
  await assert.rejects(next.dispatch('activate'));assert.ok(old.cacheStore.has(old.cacheName));
  cache.set(url,response);await next.dispatch('activate');assert.ok(!old.cacheStore.has(old.cacheName));
  assert.ok(old.cacheStore.has('unrelated'));assert.ok(old.cacheStore.has('h4-goal-quest-shell:/:other'));
});
test('same release reinstall never deletes or overwrites its cache; lost assets fail closed',async()=>{
  const controls={},old=await worker({controls});await old.dispatch('install');
  const same=await worker({cacheStore:old.cacheStore,fail:'./index.html'});await same.dispatch('install');assert.equal(same.requests.length,0);
  old.cacheStore.get(old.cacheName).delete('https://example.test/goal-quest/index.html');
  await assert.rejects(same.dispatch('install'));assert.ok(old.cacheStore.has(old.cacheName));
  controls.offline=true;
  assert.equal((await old.fetch('/goal-quest/')).type,'error');
});

for(const base of ['/','/goal-quest/']) test(`missing index/modules fail offline and recover exact active-release bytes online at ${base}`,async()=>{
  const controls={},w=await worker({base,controls});await w.dispatch('install');
  const cache=w.cacheStore.get(w.cacheName),before=new Map(cache);
  for(const path of ['index.html','js/planner.js'])cache.delete('https://example.test'+base+path);
  controls.offline=true;
  for(const path of ['', 'index.html?retry=1', 'js/planner.js']) assert.equal((await w.fetch(base+path,{mode:path.endsWith('.js')?'cors':'navigate'})).type,'error');
  assert.equal(cache.size,before.size-2);
  controls.offline=false;
  for(const path of ['index.html','js/planner.js']) {
    const response=await w.fetch(base+path,{mode:path.endsWith('.js')?'cors':'navigate'});
    assert.equal(hash(Buffer.from(await response.arrayBuffer())),assets['./'+path]);
  }
  assert.deepEqual([...cache.keys()].sort(),[...before.keys()].sort());
  for(const [url,response] of cache)assert.equal(await response.clone().text(),await before.get(url).clone().text());
  controls.offline=true;assert.ok((await w.fetch(base)).ok);
});
for(const failure of [{fail:'./index.html'},{corrupt:'./index.html'},{redirect:true}]) test(`failed/unverified recovery preserves all remaining caches and can retry: ${JSON.stringify(failure)}`,async()=>{
  const controls={},w=await worker({controls});await w.dispatch('install');
  w.cacheStore.set(w.prefix+'previous',new Map([['keep',new Response('older valid release')]]));
  const cache=w.cacheStore.get(w.cacheName);cache.delete('https://example.test/goal-quest/index.html');
  const names=[...w.cacheStore.keys()],entries=[...cache.keys()];Object.assign(controls,failure);
  assert.equal((await w.fetch('/goal-quest/')).type,'error');
  assert.deepEqual([...cache.keys()],entries);assert.deepEqual([...w.cacheStore.keys()],names);
  for(const key of Object.keys(failure))delete controls[key];
  assert.ok((await w.fetch('/goal-quest/')).ok,'failed promise is removed so the next request can repair');
});
test('simultaneous misses share one download/write and each caller can consume its complete response',async()=>{
  const controls={},w=await worker({controls});await w.dispatch('install');
  w.cacheStore.get(w.cacheName).delete('https://example.test/goal-quest/js/planner.js');
  let release;controls.downloadGate=new Promise(resolve=>{release=resolve;});const count=w.requests.length;
  const pending=Promise.all(Array.from({length:8},()=>w.fetch('/goal-quest/js/planner.js',{mode:'cors'})));
  await new Promise(setImmediate);
  try {assert.equal(w.requests.length,count+1);} finally {release();}
  for(const response of await pending)assert.equal(hash(Buffer.from(await response.arrayBuffer())),assets['./js/planner.js']);
  assert.ok((await w.fetch('/goal-quest/js/planner.js',{mode:'cors'})).ok);assert.equal(w.requests.length,count+1);
});
for(const failure of ['quota','blocked'])test(`verified online recovery remains usable when cache is ${failure}, without claiming offline readiness`,async()=>{
  const controls={},w=await worker({controls});await w.dispatch('install');
  const cache=w.cacheStore.get(w.cacheName),url='https://example.test/goal-quest/index.html';cache.delete(url);
  const keys=[...cache.keys()];controls[failure]=true;
  assert.equal(hash(Buffer.from(await (await w.fetch('/goal-quest/')).arrayBuffer())),assets['./index.html']);
  assert.deepEqual([...cache.keys()],keys);assert.equal(await w.ready(),false);
  controls.offline=true;assert.equal((await w.fetch('/goal-quest/')).type,'error');
  controls.offline=false;controls[failure]=false;assert.ok((await w.fetch('/goal-quest/')).ok);assert.equal(await w.ready(),true);
});
