import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { completeSpeech,splitSpeech } from '../tts.mjs';
const settings={voice:'vi-VN-NamMinhNeural',pitch:-18,rate:-20};
test('discard truncated bytes, retry in a fresh client, and close all clients',async()=>{
 let clients=0,closed=0;
 const result=await completeSpeech('Xin vía tài lộc',settings,{wait:async()=>{},createClient:()=>{
  const attempt=++clients;return{setMetadata:async()=>{},toStream:()=>({audioStream:Readable.from((async function*(){yield Buffer.from(attempt===1?'PARTIAL':'COMPLETE');if(attempt===1)throw Error('no turn.end received');})())}),close(){closed++;}};
 }});
 assert.equal(result.toString(),'COMPLETE');assert.equal(clients,2);assert.equal(closed,2);
});
test('do not publish audio on repeated incomplete synthesis',async()=>{
 let closed=0;
 await assert.rejects(completeSpeech('Xin vía',settings,{wait:async()=>{},createClient:()=>({setMetadata:async()=>{},toStream:()=>({audioStream:Readable.from((async function*(){yield Buffer.from('broken');throw Error('no turn.end');})())}),close(){closed++;}})}),/no turn.end/);
 assert.equal(closed,2);
});
test('timeout releases the current request and empty responses fail',async()=>{
 let closed=0;
 await assert.rejects(completeSpeech('Xin vía',settings,{attempts:1,deadlineMs:5,createClient:()=>({setMetadata:()=>new Promise(()=>{}),close(){closed++;}})}),/thời gian/);assert.equal(closed,1);
 await assert.rejects(completeSpeech('Xin vía',settings,{attempts:1,createClient:()=>({setMetadata:async()=>{},toStream:()=>({audioStream:Readable.from([])}),close(){}})}),/rỗng/);
});
test('long Vietnamese announcements are split without dropping words',()=>{
 const text='Chúc gia đình bình an và tài lộc đủ đầy. '.repeat(15).trim();const parts=splitSpeech(text);assert.ok(parts.length>1);assert.ok(parts.every(p=>p.length<=160));assert.equal(parts.join(' '),text);
});
