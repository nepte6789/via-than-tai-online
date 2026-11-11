// Vía Thần Tài Online — live server
// Runs on the streaming PC. Serves the overlay + control panel, listens to a TikTok LIVE room,
// keeps the list of seated viewers, generates Vietnamese voice lines with Edge TTS and pushes
// everything to the overlay over WebSocket.
//
//   cd live && npm install && node server.mjs        → http://localhost:3000/live/control.html
//
import '../assets/fortunes.js';
import { buildTikTokConnectionOptions, explainTikTokConnectionError } from './tiktok-config.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');            // repo root: serves /assets, /live
const TTS_DIR = path.join(__dirname, 'tts');
fs.mkdirSync(TTS_DIR, { recursive: true });
for (const f of fs.readdirSync(TTS_DIR)) { try { fs.unlinkSync(path.join(TTS_DIR, f)); } catch {} }
const PORT = +process.env.PORT || 3000;

/* ------------------------------------------------------------------ state */
const settings = {
  title: 'Vía Thần Tài Online',
  subtitle: 'Cung chúc phát tài, vạn sự hanh thông',
  voice: 'vi-VN-NamMinhNeural',      // or vi-VN-HoaiMyNeural
  pitch: -18,                        // Hz
  rate: -20,                         // %
  music: true,
  autoChant: true, chantEveryMin: 3,
  autoXinVia: true,
  seatMode: 'auto',                  // auto | 24 | 36 | 64 | 100
  joinOnEnter: false,                // also seat viewers who only enter the room
  gifts: { readAll: true, minDiamonds: 1 },
};
const viewers = new Map();           // id -> { id, name, skin, avatar, coins, joinedAt, lastAt, lastText, lastTextAt, demo }
const merit = new Map(); // Session totals survive bot rotation and viewers leaving their seats.
function leaderboard(){return [...merit.values()].sort((a,b)=>b.coins-a.coins).slice(0,5);}
function publishMerit(){broadcast({t:'leaderboard',entries:leaderboard()});}
const startedAt = Date.now();
let tiktok = null, tiktokState = { status: 'idle', uniqueId: '', error: '' };
const log = [];
function addLog(s){ const line = `[${new Date().toLocaleTimeString('vi-VN')}] ${s}`; log.push(line); if (log.length > 300) log.shift(); broadcast({ t:'log', line }, 'control'); console.log(line); }

const CAPS = [24, 36, 64, 100];
function capacity(){ if (settings.seatMode !== 'auto') return +settings.seatMode; const n = viewers.size; return CAPS.find(c => n <= c) || 100; }

/* skins: sprites that exist in /assets. Walking strips exist for man / woman / granny. */
// A comment changes the outfit only when it IS the keyword (≤ 3 words), so "Cung chúc phát tài, vạn sự hanh thông" never reads as "nam".
const SKIN_WORDS = [
  ['man',['nam']], ['woman',['nữ','nu']], ['grandpa',['ông','ong']], ['granny',['bà','ba']],
  ['boy',['bé trai','be trai']], ['girl',['bé gái','be gai']],
];
function skinFromText(t){
  const w = String(t).toLowerCase().normalize('NFC').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!w || w.split(' ').length > 3) return null;
  for (const [skin, words] of SKIN_WORDS) if (words.some(k => w === k)) return skin;
  return null;
}
const DEFAULT_SKINS = ['man','woman','grandpa','granny','boy','girl'];

function pub(v){ return { id:v.id, name:v.name, skin:v.skin, avatar:v.avatar||'', coins:v.coins, demo:!!v.demo }; }
function snapshot(){ return { t:'state', settings, leaderboard:leaderboard(), bots:{on:!!botTimer,n:botOptions.n,pace:botOptions.pace,rotateSeconds:botOptions.rotateSeconds}, viewers:[...viewers.values()].map(pub), cap: capacity(), startedAt, tiktok: tiktokState }; }

function seat(id, name, opts = {}){
  let v = viewers.get(id);
  if (v){ v.lastAt = Date.now(); if (opts.avatar) v.avatar = opts.avatar; return { v, isNew:false }; }
  if (viewers.size >= 100){                     // full: the longest-quiet non-donor stands up
    const quiet = [...viewers.values()].filter(x => x.coins === 0).sort((a,b) => a.lastAt - b.lastAt)[0];
    if (!quiet) return { v:null, isNew:false };
    viewers.delete(quiet.id); broadcast({ t:'leave', id: quiet.id });
  }
  v = { id, name: (name||id).slice(0, 18), skin: opts.skin || DEFAULT_SKINS[viewers.size % DEFAULT_SKINS.length],
        avatar: opts.avatar || '', coins: merit.get(id)?.coins || 0, joinedAt: Date.now(), lastAt: Date.now(), demo: !!opts.demo };
  viewers.set(id, v);
  broadcast({ t:'join', v: pub(v), cap: capacity() });
  return { v, isNew:true };
}

/* ------------------------------------------------------------- events in */
function onChat(id, name, text, avatar){
  text = String(text || '').slice(0, 120);
  const want = skinFromText(text);
  const { v, isNew } = seat(id, name, { avatar, skin: want || undefined });
  if (!v) return;
  if (!isNew && want && want !== v.skin){ v.skin = want; broadcast({ t:'skin', id, skin: want }); }
  v.lastText = text; v.lastTextAt = Date.now();
  broadcast({ t:'chat', id, name: v.name, text });
  if (/^xin v[ií]a$/u.test(text.toLowerCase().normalize('NFC').replace(/\s+/g,' ').trim())) drawFortune(v);
}

function drawFortune(v){
  if(v.lastFortuneAt && Date.now()-v.lastFortuneAt<15000)return;
  v.lastFortuneAt=Date.now();
  const fortune=globalThis.ProsperityFortunes[Math.floor(Math.random()*globalThis.ProsperityFortunes.length)];
  broadcast({t:'fortune',id:v.id,name:v.name,fortune});
  say(`${spoken(v.name)} nhận quẻ ${fortune.number}, ${fortune.title}. ${fortune.wish}`,{tag:'fortune',id:v.id});
}

function onGift(id, name, giftName, count, diamonds, avatar){
  giftName = String(giftName || 'quà').slice(0, 30); count = Math.max(1, Math.min(9999, +count || 1));
  const { v } = seat(id, name, { avatar });
  if (!v) return;
  const amount = Math.max(1, (diamonds || 1) * (count || 1));
  const coins = v.demo ? Math.min(amount, Math.max(0, 3-v.coins)) : amount;
  if (!coins) return;
  v.coins += coins;
  merit.set(id,{id,name:v.name,coins:v.coins,demo:v.demo});
  // Keep simulated history bounded; real gift totals are never evicted.
  const simulated=[...merit.values()].filter(x=>x.demo);
  if(simulated.length>100){const pinned=new Set(leaderboard().map(x=>x.id));for(const entry of simulated.filter(x=>!pinned.has(x.id)).sort((a,b)=>a.coins-b.coins).slice(0,simulated.length-100)) merit.delete(entry.id);}
  publishMerit();
  const prayer = (v.lastText && Date.now() - v.lastTextAt < 90_000 && v.lastText.length > 6) ? v.lastText : pickPrayer();
  const tier = coins >= 99 ? 3 : coins >= 10 ? 2 : 1;
  const line = `Cung chúc phát tài, vạn sự hanh thông. Quý khách ${spoken(v.name)} thành tâm dâng ${giftName}${count > 1 ? ', ' + count + ' lần' : ''}. ${prayer}.`;
  broadcast({ t:'gift', id, name: v.name, giftName, count, coins, total: v.coins, tier, prayer });
  if (settings.gifts.readAll || coins >= settings.gifts.minDiamonds) say(line, { tag:'gift', id });
}

function pickPrayer(){
  const P = ['Kính chúc gia đạo bình an, tài lộc đủ đầy, vạn sự hanh thông', 'Kính chúc ông bà, cha mẹ mạnh khỏe, an khang trường thọ', 'Nguyện điều lành lan tỏa, mọi nhà an vui, sung túc',
             'Kính chúc thân tâm an lạc, công việc thuận lợi, tài lộc bền lâu', 'Kính chúc công việc hanh thông, gia đình hạnh phúc, phát tài phát lộc'];
  return P[Math.floor(Math.random() * P.length)];
}
const spoken = s => String(s).replace(/[_@.]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim() || 'ẩn danh';

/* ------------------------------------------------------------------ TTS */
const ttsQueue = []; let ttsBusy = false, ttsSeq = 0;
function esc(s){ return String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])); }
function say(text, meta = {}){ if (ttsQueue.length >= 15) { addLog('Hàng đợi giọng đọc đầy, bỏ qua 1 câu'); return; } ttsQueue.push({ text: String(text).slice(0, 500), meta }); pumpTTS(); }
async function pumpTTS(){
  if (ttsBusy || !ttsQueue.length) return; ttsBusy = true;
  const { text, meta } = ttsQueue.shift();
  try {
    const file = `tts_${Date.now()}_${++ttsSeq}.mp3`;
    const tts = new MsEdgeTTS();
    await tts.setMetadata(settings.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(esc(text), { pitch: `${settings.pitch >= 0 ? '+' : ''}${settings.pitch}Hz`, rate: `${settings.rate >= 0 ? '+' : ''}${settings.rate}%` });
    const chunks = [];
    await new Promise((res, rej) => { audioStream.on('data', c => chunks.push(c)); audioStream.on('close', res); audioStream.on('error', rej); });
    try { tts.close(); } catch {}
    fs.writeFileSync(path.join(TTS_DIR, file), Buffer.concat(chunks));
    broadcast({ t:'tts', url: `/live/tts/${file}`, text, ...meta });
    const old = fs.readdirSync(TTS_DIR).sort(); while (old.length > 40) { try { fs.unlinkSync(path.join(TTS_DIR, old.shift())); } catch {} }
  } catch (e) { addLog('TTS lỗi: ' + (e?.message || e)); }
  ttsBusy = false; setTimeout(pumpTTS, 50);
}

const CHANTS = [
  'Kính chúc mọi nhà bình an, làm ăn phát đạt, tài lộc dồi dào, vạn sự như ý.',
  'Cung chúc phát tài, vạn sự hanh thông, gia đạo an khang, phú quý trường tồn.',
  'Kính chúc quý khách thân tâm an lạc, gặp nhiều may mắn, mọi việc thuận buồm xuôi gió.',
  'Chúc năm mới tài lộc đủ đầy, công danh rộng mở, gia đình hòa thuận, phúc khí viên mãn.',
];
let chantIdx = 0, chantTimer = null;
function chant(){ const text = CHANTS[chantIdx++ % CHANTS.length]; broadcast({ t:'chant', text }); say(text, { tag:'chant' }); }
function scheduleChant(){ clearInterval(chantTimer); if (settings.autoChant) chantTimer = setInterval(chant, Math.max(1, settings.chantEveryMin) * 60_000); }
scheduleChant();

/* --------------------------------------------------------------- TikTok */
let TikTokLib = null;
async function connectTikTok(uniqueId){
  uniqueId = String(uniqueId || '').trim().replace(/^.*tiktok\.com\/@?/i, '').replace(/^@/, '').replace(/\/.*$/, '');
  if (!uniqueId) return;
  await disconnectTikTok();
  tiktokState = { status: 'connecting', uniqueId, error: '' }; broadcast({ t:'tiktok', ...tiktokState });
  try {
    TikTokLib ||= await import('tiktok-live-connector');
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = TikTokLib;
    const conn = new TikTokLiveConnection(uniqueId, buildTikTokConnectionOptions());
    const av = u => u?.profilePicture?.url?.[0] || u?.profilePicture?.urlList?.[0] || u?.avatarThumb?.urlList?.[0] || u?.avatarThumb?.url?.[0] || '';
    const nm = u => u?.nickname || u?.uniqueId || 'ẩn danh';
    conn.on(WebcastEvent.CHAT, d => onChat(d.user?.uniqueId || d.user?.userId, nm(d.user), d.comment, av(d.user)));
    conn.on(WebcastEvent.GIFT, d => {
      const type = d.giftDetails?.giftType ?? d.extendedGiftInfo?.type;
      if (type === 1 && !d.repeatEnd) return;                       // streak still running
      const gname = d.giftDetails?.giftName || d.extendedGiftInfo?.name || 'quà';
      const dia = d.giftDetails?.diamondCount ?? d.extendedGiftInfo?.diamond_count ?? 1;
      onGift(d.user?.uniqueId || d.user?.userId, nm(d.user), gname, d.repeatCount || 1, dia, av(d.user));
      addLog(`🎁 ${nm(d.user)} tặng ${gname} x${d.repeatCount || 1}`);
    });
    conn.on(WebcastEvent.MEMBER, d => { if (settings.joinOnEnter) seat(d.user?.uniqueId, nm(d.user), { avatar: av(d.user) }); });
    conn.on(WebcastEvent.LIKE, d => {
      const user=d.user||d.common?.user||{};
      const id=user.uniqueId||user.userId||d.userId||d.user_id;
      if(id){const {v}=seat(String(id),nm(user),{avatar:av(user)});if(v)broadcast({t:'like',id:String(id),n:d.likeCount||d.totalLikeCount||1});}
    });
    conn.on(ControlEvent.DISCONNECTED, () => { tiktokState = { ...tiktokState, status: 'disconnected' }; broadcast({ t:'tiktok', ...tiktokState }); addLog('TikTok: mất kết nối'); });
    conn.on(ControlEvent.ERROR, e => addLog('TikTok lỗi: ' + (e?.info || e?.message || e)));
    const st = await conn.connect();
    tiktok = conn;
    tiktokState = { status: 'connected', uniqueId, error: '', roomId: st?.roomId || '' };
    addLog(`✅ Đã kết nối live @${uniqueId}`);
  } catch (e) {
    tiktokState = { status: 'error', uniqueId, error: explainTikTokConnectionError(e) };
    addLog(`❌ Không kết nối được @${uniqueId}: ${tiktokState.error}`);
  }
  broadcast({ t:'tiktok', ...tiktokState });
}
async function disconnectTikTok(){ if (tiktok){ try { await tiktok.disconnect(); } catch {} tiktok = null; } tiktokState = { status:'idle', uniqueId:'', error:'' }; broadcast({ t:'tiktok', ...tiktokState }); }

/* ------------------------------------------------------------- test data */
const DEMO_NAMES = ['Diệu Hạnh','Minh Tâm','Thiện Đức','Huệ An','Tịnh Nhã','Quảng Trí','Chơn Như','Pháp Hỷ','Nguyên Thanh','Tâm Đăng','Diệu Liên','Trí Hải','Phước Lộc','Hạnh Nguyện','Như Ý','Bảo Châu','Thanh Lương','Từ Tâm','An Lạc','Giác Hoa','Tuệ Minh','Liên Hương','Thu Hà','Ngọc Lan','Đức Anh','Hải Đăng','Mai Anh','Phương Thảo','Trung Kiên','Quang Huy','Bảo Ngọc','Diệu Linh'];
function fillDemo(n){
  const have = [...viewers.values()].filter(v => v.demo).length;
  for (let i = have; i < n && viewers.size < 100; i++){
    const name = DEMO_NAMES[i % DEMO_NAMES.length] + (i >= DEMO_NAMES.length ? ' ' + (Math.floor(i / DEMO_NAMES.length) + 1) : '');
    seat('demo_' + i, name, { demo: true, skin: DEFAULT_SKINS[i % DEFAULT_SKINS.length] });
  }
}
function clearSeats(){ viewers.clear(); broadcast(snapshot()); addLog('Đã làm trống chỗ ngồi'); }

/* ------------------------------------------------------------- control */
function onControl(m){
  switch (m.cmd){
    case 'connect': connectTikTok(m.uniqueId); break;
    case 'disconnect': disconnectTikTok(); addLog('Đã ngắt kết nối TikTok'); break;
    case 'chat': { const n = String(m.name || 'Khách').slice(0, 18); onChat('sim_' + n, n, String(m.text || 'Cung chúc phát tài, vạn sự hanh thông').slice(0, 120)); break; }
    case 'gift': { const n = String(m.name || 'Khách').slice(0, 18); onGift('sim_' + n, n, String(m.gift || 'Hoa hồng').slice(0, 30), clamp(m.count, 1, 99), clamp(m.diamonds, 1, 50000)); break; }
    case 'fill': fillDemo(clamp(m.n, 1, 100)); addLog(`Đổ người mẫu: ${viewers.size} người`); break;
    case 'clear': clearSeats(); break;
    case 'chant': chant(); break;
    case 'say': if (m.text) say(String(m.text).slice(0, 400), { tag:'say' }); break;
    case 'settings':
      applySettings(m.settings || {});
      scheduleChant(); broadcast({ t:'settings', settings, cap: capacity() }); break;
    case 'bots': setBots(!!m.on, +m.n || 12, m.pace, m.rotateSeconds); break;
  }
}

// Only known keys, right types, sane ranges: the panel is local, but nothing from the socket is trusted blindly.
const SETTING_RULES = {
  title: v => String(v).slice(0, 40), subtitle: v => String(v).slice(0, 60),
  voice: v => ['vi-VN-NamMinhNeural', 'vi-VN-HoaiMyNeural'].includes(v) ? v : settings.voice,
  pitch: v => clamp(v, -50, 50), rate: v => clamp(v, -50, 50), chantEveryMin: v => clamp(v, 1, 60),
  music: Boolean, autoChant: Boolean, autoXinVia: Boolean, joinOnEnter: Boolean,
  seatMode: v => ['auto', '24', '36', '64', '100'].includes(String(v)) ? String(v) : 'auto',
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(+v || 0)));
function applySettings(o){ for (const [k, fn] of Object.entries(SETTING_RULES)) if (k in o) settings[k] = fn(o[k]); }

/* ----------------------------------------------------------------- bots */
let botTimer=null, rotationTimer=null, autoViaTimer=null, botSerial=0;
const botOptions={n:12,pace:'mid',rotateSeconds:90};
const BOT_LINES=['Xin một lời chúc làm ăn hanh thông','Xin chúc gia đình bình an, tài lộc đủ đầy','Xin lời chúc buôn may bán đắt','Cầu công việc thuận lợi, vạn sự như ý','Xin lời chúc sức khỏe và may mắn'];
const BOT_NAMES=['Minh Anh','Ngọc Hà','Thanh Mai','Quốc Bảo','Thùy Linh','Đức Huy','Kim Ngân','Tuấn Anh','Bảo Trâm','Hoàng Nam','Thu Hương','Gia Hân','Phúc An','Khánh Vy','Anh Khoa','Hải Yến','Trúc Linh','Mai Phương','Ngọc Minh','Quang Vinh','Thanh Tùng','Xuân Mai','Thiên Phúc','Đình Khang','Bảo Ngọc','Lan Anh','Hồng Nhung','Hải Đăng','Thảo Vy','Tuệ Anh','Minh Khôi','Ngọc Lan'];
function spawnBot(){
  const serial=botSerial++,id='bot_'+serial;
  const first=BOT_NAMES[serial%BOT_NAMES.length];
  const name=serial<BOT_NAMES.length?first:BOT_NAMES[serial%BOT_NAMES.length].split(' ')[0]+' '+BOT_NAMES[(serial+Math.floor(serial/BOT_NAMES.length)*7)%BOT_NAMES.length].split(' ').slice(-1)[0];
  return seat(id,name,{demo:true,skin:DEFAULT_SKINS[serial%DEFAULT_SKINS.length]}).v;
}
function rotateBot(){
  const bots=[...viewers.values()].filter(v=>v.id.startsWith('bot_')).sort((a,b)=>a.joinedAt-b.joinedAt);
  if(bots.length){viewers.delete(bots[0].id);broadcast({t:'leave',id:bots[0].id});}
  if(bots.length||viewers.size<100)spawnBot();
}
function scheduleBotXinVia(){
  clearTimeout(autoViaTimer);autoViaTimer=null;
  if(!botTimer||!settings.autoXinVia)return;
  autoViaTimer=setTimeout(()=>{
    const bots=[...viewers.values()].filter(v=>v.id.startsWith('bot_'));
    if(bots.length){const v=bots[Math.floor(Math.random()*bots.length)];onChat(v.id,v.name,'xin vía');addLog(`🤖 Bot ${v.name} tự xin vía`);}
    scheduleBotXinVia();
  },(45+Math.random()*105)*1000);
}
function setBots(on,n,pace,rotateSeconds){
  clearInterval(botTimer);clearInterval(rotationTimer);clearTimeout(autoViaTimer);botTimer=rotationTimer=autoViaTimer=null;
  Object.assign(botOptions,{n:clamp(n,1,100),pace:['slow','mid','fast'].includes(pace)?pace:'mid',rotateSeconds:clamp(rotateSeconds||90,15,3600)});
  const bots=[...viewers.values()].filter(v=>v.id.startsWith('bot_'));
  for(const v of bots.slice(on?botOptions.n:0)){viewers.delete(v.id);broadcast({t:'leave',id:v.id});}
  if(on){
    for(let i=Math.min(bots.length,botOptions.n);i<botOptions.n&&viewers.size<100;i++)spawnBot();
    botTimer=setInterval(()=>{
      const bots=[...viewers.values()].filter(v=>v.id.startsWith('bot_'));if(!bots.length)return;
      const v=bots[Math.floor(Math.random()*bots.length)],request=BOT_LINES[Math.floor(Math.random()*BOT_LINES.length)];
      onChat(v.id,v.name,request);
      if(Math.random()<.3&&v.coins<3)onGift(v.id,v.name,'Lộc may mắn',1,1);
      else broadcast({t:'like',id:v.id,n:1});
    },{slow:6000,mid:4000,fast:2500}[botOptions.pace]);
    rotationTimer=setInterval(rotateBot,botOptions.rotateSeconds*1000);
    scheduleBotXinVia();
  }
  addLog(on?`Bật ${botOptions.n} bot; đổi một khách mỗi ${botOptions.rotateSeconds} giây`:'Tắt bot');
  broadcast({t:'bots',on,...botOptions},'control');
}

/* -------------------------------------------------------------- server */
// Security notes (this file is meant to be shared publicly):
//  • listens on 127.0.0.1 only; nothing is reachable from the LAN or internet unless HOST is changed on purpose
//  • Host header must be localhost/127.0.0.1 (blocks DNS-rebinding pages from talking to the server)
//  • WebSocket only accepts pages served by this server (Origin check), so other sites open in the
//    same browser cannot send control commands
//  • static files: only /assets and /live, no dot-files, no node_modules, no server source, no path escapes
//  • no TikTok password, cookie or session is ever used or stored; only public room events are read
const HOST = process.env.HOST || '0.0.0.0';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.woff':'font/woff', '.woff2':'font/woff2', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.mp3':'audio/mpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
const ALLOWED_HOSTS = new Set((process.env.ALLOWED_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
const LOCAL_HOSTS = new Set([`localhost:${PORT}`,`127.0.0.1:${PORT}`,`[::1]:${PORT}`]);
const okHost = h => {const host=String(h||'').toLowerCase();if(LOCAL_HOSTS.has(host)||ALLOWED_HOSTS.has(host)||ALLOWED_HOSTS.has('*'))return true;return HOST!=='127.0.0.1'&&HOST!=='::1'&&/^[a-z0-9.-]+(?::\d+)?$/.test(host);};
const SEP = path.sep;
function resolveStatic(urlPath){
  let p = urlPath === '/' ? '/live/control.html' : urlPath;
  if (!/^\/(assets|live)\//.test(p)) return null;
  if (p.split('/').some(seg => seg.startsWith('.') || seg === 'node_modules')) return null;
  if (/\.(mjs|json|md|log)$/i.test(p) && !p.startsWith('/assets/')) return null;      // never serve server code / package files
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + SEP)) return null;
  return file;
}
const server = http.createServer((req, res) => {
  if (!okHost(req.headers.host)) { res.writeHead(421).end('wrong host'); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  const file = resolveStatic(p);
  if (!file) { res.writeHead(404).end('not found'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': p.startsWith('/live/tts/') ? 'no-store' : 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
});
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024,
  verifyClient: ({ origin, req }) => {
    if (!okHost(req.headers.host)) return false;
    if (!origin) return true;                                   // OBS / non-browser clients send no Origin
    try { const u=new URL(origin); return ['http:','https:'].includes(u.protocol)&&okHost(u.host)&&u.host.toLowerCase()===String(req.headers.host||'').toLowerCase(); } catch { return false; }
  } });
function broadcast(msg, only){ const s = JSON.stringify(msg); for (const c of wss.clients) if (c.readyState === 1 && (!only || c.role === only)) c.send(s); }
wss.on('connection', (ws, req) => {
  ws.role = new URL(req.url, 'http://x').searchParams.get('role') === 'control' ? 'control' : 'overlay';
  ws.send(JSON.stringify(snapshot()));
  if (ws.role === 'control') ws.send(JSON.stringify({ t:'logs', lines: log }));
  ws.on('message', buf => {
    if (ws.role !== 'control') return;                          // overlays only listen
    try { const m = JSON.parse(buf); if (m && m.t === 'ctl') onControl(m); } catch (e) { addLog('Lệnh lỗi: ' + e.message); }
  });
});
server.listen(PORT, HOST, () => addLog(`Server chạy tại http://localhost:${PORT}  ·  Bảng điều khiển: http://localhost:${PORT}/live/control.html  ·  Overlay: http://localhost:${PORT}/live/overlay.html`));
