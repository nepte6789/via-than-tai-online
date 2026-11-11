export function readChatText(data){
  for(const value of [data?.comment,data?.text,data?.content,data?.comment?.text]){
    if(typeof value==='string'&&value.trim())return value;
  }
  return '';
}
export function isXinVia(text){
  const clean=String(text).normalize('NFD').replace(/[\u0300-\u036f\u200b-\u200f\u2060\ufeff\ufe0f]/g,'').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
  return /(?:^|\s)xin\s+via(?:\s|$)/.test(clean);
}
