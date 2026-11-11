import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

test('like enters hall, xin vía is announced, and random bot timers stop cleanly',async()=>{
 let code=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 code=code.slice(code.indexOf('const settings ='),code.indexOf('/* -------------------------------------------------------------- server */'));
 const start=code.indexOf('const ttsQueue ='),end=code.indexOf('const CHANTS =',start);
 code=code.slice(0,start)+'const ttsQueue=[];function say(text,meta){announcements.push({text,meta});}\n'+code.slice(end);
 const messages=[],announcements=[],timeouts=new Map();let seq=0,instance;
 class Connection extends EventEmitter{constructor(){super();instance=this;}async connect(){return{roomId:'123'};}async disconnect(){}}
 const context=vm.createContext({console:{log(){}},Date,Math,messages,announcements,buildTikTokConnectionOptions:()=>({}),explainTikTokConnectionError:e=>e.message,setInterval:()=>++seq,clearInterval(){},setTimeout:(fn,ms)=>{timeouts.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timeouts.delete(id),broadcast:m=>messages.push(m),fakeLib:{TikTokLiveConnection:Connection,WebcastEvent:{LIKE:'like',CHAT:'chat',GIFT:'gift',MEMBER:'member'},ControlEvent:{ERROR:'error',DISCONNECTED:'disconnected'}}});
 vm.runInContext(fs.readFileSync(new URL('../../assets/fortunes.js',import.meta.url),'utf8'),context);vm.runInContext(code,context);vm.runInContext('TikTokLib=fakeLib',context);
 await vm.runInContext("connectTikTok('test.account')",context);
 assert.equal(vm.runInContext('settings.voice',context),'vi-VN-HoaiMyNeural');assert.equal(vm.runInContext('settings.pitch',context),0);assert.equal(vm.runInContext('settings.rate',context),2);
 instance.emit('like',{user:{uniqueId:'heart-only',nickname:'Thả Tim'},likeCount:2});
 assert.equal(vm.runInContext("viewers.get('heart-only').name",context),'Thả Tim');assert.ok(messages.some(m=>m.t==='like'&&m.id==='heart-only'));
 instance.emit('chat',{user:{uniqueId:'heart-only',nickname:'Thả Tim'},comment:'xin vía'});
 assert.ok(messages.some(m=>m.t==='fortune'&&m.id==='heart-only'));assert.equal(announcements.at(-1).meta.tag,'fortune');assert.match(announcements.at(-1).text,/xin vía tài lộc/);const drawn=messages.find(m=>m.t==='fortune');assert.equal(announcements.at(-1).meta.fortune,drawn.fortune);assert.ok(announcements.at(-1).text.includes(drawn.fortune.verse));
 instance.emit('gift',{user:{uniqueId:'gift',nickname:'Tặng Quà'},giftDetails:{giftName:'Hoa',diamondCount:20,giftType:0},repeatCount:1});assert.equal(announcements.at(-1).meta.tag,'gift');
 vm.runInContext("setBots(true,2,'mid',90)",context);const timer=[...timeouts.values()][0];assert.ok(timer.ms>=45000&&timer.ms<=150000);timer.fn();assert.ok(messages.some(m=>m.t==='chat'&&m.text==='xin vía'&&m.id.startsWith('bot_')));
 vm.runInContext("setBots(false,2,'mid',90)",context);assert.equal(vm.runInContext('autoViaTimer',context),null);
});
