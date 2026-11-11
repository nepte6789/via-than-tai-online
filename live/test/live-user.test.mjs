import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLiveUser} from '../live-user.mjs';
test('nested, legacy and bigint identities use serializable stable keys',()=>{
 const aliases=new Map();
 assert.equal(resolveLiveUser({user:{userId:123n,nickname:'Khách'}},aliases).id,'123');
 assert.equal(resolveLiveUser({user:{uniqueId:'real.user',userId:'123',nickname:'Tên thật'}},aliases).id,'123');
 const legacy=resolveLiveUser({uniqueId:'real.user',nickname:'Tên thật'},aliases);assert.equal(legacy.id,'123');assert.doesNotThrow(()=>JSON.stringify(legacy));
 assert.equal(resolveLiveUser({userInfo:{user_id:'456',nickName:'Khách 2'}}).name,'Khách 2');
 assert.equal(resolveLiveUser({comment:'hello'}),null);
});
