// 8% of bot activity ticks give a gift; large gifts are intentionally very rare.
export function pickBotGift(random=Math.random){
  if(random()>=.08)return null;
  const roll=random();
  const diamonds=roll<.9?1:roll<.98?3:roll<.998?10:99;
  return{diamonds,name:diamonds>=99?'Túi tài lộc':diamonds>=10?'Thỏi vàng':'Lộc may mắn'};
}
