import test from 'node:test';
import assert from 'node:assert/strict';
import {AutoConnect,channelName} from '../auto-connect.mjs';
import {pickBotGift} from '../bot-gifts.mjs';
function clock(){let time=0,id=0;const tasks=new Map();return{now:()=>time,setTimer:(fn,ms)=>{tasks.set(++id,{fn,at:time+ms});return id;},clearTimer:id=>tasks.delete(id),async advance(ms){const end=time+ms;for(;;){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;tasks.delete(next[0]);await next[1].fn();}time=end;},tasks};}
test('first attempt at five minutes, retry after two, healthy sessions stay connected and stop cancels timers',async()=>{
 const timer=clock();let count=0,status={status:'idle'};
 const controller=new AutoConnect({...timer,connect:async target=>{count++;status={status:count===1?'error':'connected',uniqueId:target,error:'test offline'};},getStatus:()=>status});
 controller.setTarget('https://www.tiktok.com/@mxun.682355/live');await timer.advance(299999);assert.equal(count,0);await timer.advance(1);assert.equal(count,1);assert.equal(controller.state.phase,'retry');
 await timer.advance(119999);assert.equal(count,1);await timer.advance(1);assert.equal(count,2);assert.equal(controller.state.phase,'connected');await timer.advance(120000);assert.equal(count,2);
 status.status='disconnected';controller.disconnected();await timer.advance(120000);assert.equal(count,3);controller.stop();await timer.advance(600000);assert.equal(count,3);assert.equal(timer.tasks.size,0);
});
test('manual connection is immediate and link validation rejects unrelated hosts',async()=>{
 const timer=clock();let count=0;const controller=new AutoConnect({...timer,connect:async()=>{count++;},getStatus:()=>({status:'error'})});controller.setTarget('@valid.name',{immediate:true});await timer.advance(0);assert.equal(count,1);controller.stop();
 assert.equal(channelName('https://www.tiktok.com/@name/live?x=1'),'name');assert.throws(()=>channelName('https://evil.test/@name/live'));assert.throws(()=>channelName(''));
});
test('bot gifts are infrequent, mostly small, and large amounts remain possible',()=>{
 assert.equal(pickBotGift(()=>.5),null);
 for(const [roll,amount] of [[.5,1],[.95,3],[.99,10],[.999,99]]){const draws=[.01,roll];assert.equal(pickBotGift(()=>draws.shift()).diamonds,amount);}
});
test('changing the channel during an attempt waits, then connects the new target once',async()=>{
 const timer=clock();const calls=[];let release,status={status:'idle'};
 const controller=new AutoConnect({...timer,getStatus:()=>status,connect:async target=>{calls.push(target);if(calls.length===1)await new Promise(r=>release=r);status={status:'connected',uniqueId:target};}});
 controller.setTarget('first',{immediate:true});const task=[...timer.tasks.values()][0];timer.tasks.clear();const pending=task.fn();
 controller.setTarget('second',{immediate:true});assert.equal(controller.state.phase,'waiting');release();await pending;await timer.advance(0);assert.deepEqual(calls,['first','second']);assert.equal(controller.state.phase,'connected');controller.stop();
});
