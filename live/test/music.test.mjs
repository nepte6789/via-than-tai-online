import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function player(){
 const errors=[];class Audio{constructor(src){this.src=src;}play(){return Promise.resolve();}pause(){}load(){}removeAttribute(){}}
 const scope=vm.createContext({window:{},URL,Date,Audio,document:{currentScript:{src:'https://example.test/assets/prosperity-music.js'}}});
 vm.runInContext(fs.readFileSync(new URL('../../assets/prosperity-music.js',import.meta.url),'utf8'),scope);
 const music=new scope.window.ProsperityMusic({createMediaElementSource:()=>({connect(){},disconnect(){}})},{},{onError:m=>errors.push(m)});return{music,errors};
}
test('play owner MP3s in order, loop and release on stop',async()=>{
 const {music}=player();music.start();await Promise.resolve();assert.match(music.el.src,/assets\/music\/music1.mp3\?v=\d+/);music.el.onended();await Promise.resolve();assert.match(music.el.src,/music2.mp3/);music.el.onended();await Promise.resolve();assert.match(music.el.src,/music1.mp3/);music.stop();assert.equal(music.el,null);assert.equal(music.started,false);
});
test('missing files stop after trying each track instead of an endless retry loop',async()=>{
 const {music,errors}=player();music.start();await Promise.resolve();music.el.onerror();await Promise.resolve();music.el.onerror();assert.equal(music.el,null);assert.equal(music.started,false);assert.equal(errors.length,1);
});
