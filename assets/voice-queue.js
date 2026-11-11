window.FestivalVoiceQueue=class{
  constructor({context,output,duck,onWarning}){Object.assign(this,{context,output,duck,onWarning});this.items=[];this.busy=false;}
  enqueue(message){this.items.push(message);this.run();}
  async run(){
    if(this.busy||!this.items.length)return;this.busy=true;this.duck(true);
    const message=this.items.shift();
    try{
      if(message.url){try{await this.audio(message.url);}catch{await this.speech(message.text);}}
      else await this.speech(message.text);
    }catch(error){this.onWarning(error.message);}
    finally{this.duck(false);this.busy=false;this.run();}
  }
  audio(url){return new Promise((resolve,reject)=>{
    const el=new Audio(url),source=this.context.createMediaElementSource(el),gain=this.context.createGain();gain.gain.value=1.25;source.connect(gain);gain.connect(this.output);
    let settled=false;const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);el.onended=el.onerror=null;el.pause();source.disconnect();gain.disconnect();error?reject(error):resolve();};
    const timer=setTimeout(()=>finish(Error('Âm thanh không hoàn tất')),120000);
    el.onended=()=>finish();el.onerror=()=>finish(Error('Không tải được âm thanh'));
    el.play().catch(finish);
  });}
  async speech(text){
    if(!('speechSynthesis' in window)||!text)throw Error('Không có giọng đọc dự phòng. Hãy kiểm tra dịch vụ TTS.');
    const synth=window.speechSynthesis;
    let voice=synth.getVoices().find(v=>/^vi([-_]|$)/i.test(v.lang));
    if(!voice){await new Promise(resolve=>{const done=()=>{clearTimeout(timer);synth.removeEventListener('voiceschanged',done);resolve();};const timer=setTimeout(done,1000);synth.addEventListener('voiceschanged',done);});voice=synth.getVoices().find(v=>/^vi([-_]|$)/i.test(v.lang));}
    if(!voice)throw Error('Máy chưa có giọng đọc tiếng Việt dự phòng; hãy cài giọng Việt hoặc kiểm tra TTS.');
    return new Promise((resolve,reject)=>{
      const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.98;
      let done=false;const finish=error=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve();};
      const timer=setTimeout(()=>{synth.cancel();finish(Error('Giọng đọc dự phòng không hoàn tất'));},120000);
      utterance.onend=()=>finish();utterance.onerror=()=>finish(Error('Giọng đọc dự phòng bị gián đoạn'));synth.speak(utterance);
    });
  }
};
