import test from 'node:test';
import assert from 'node:assert/strict';
import {isXinVia,readChatText} from '../chat-command.mjs';
test('recognize real comments with accents, invisible characters, punctuation and emoji',()=>{
 for(const text of ['xin vía','Xin vía!','xin vía ❤️','xin via','Xin vía tài lộc','cho em xin vía','xin\u200b vía','XIN VÍA'])assert.equal(isXinVia(text),true,text);
 for(const text of ['nữ','xin viag','via','xin việc'])assert.equal(isXinVia(text),false,text);
});
test('non-empty legacy text is used when comment is blank or structured',()=>{
 assert.equal(readChatText({comment:'',text:'xin vía'}),'xin vía');
 assert.equal(readChatText({comment:{text:'xin vía'}}),'xin vía');
});
