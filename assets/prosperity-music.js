/* Use the owner's two MP3s, never a synthesized substitute. */
const prosperityMusicBase=new URL('./music/',document.currentScript.src);
window.ProsperityMusic=class{
  constructor(context,output,{onError=()=>{},onTrack=()=>{}}={}){
    Object.assign(this,{context,output,onError,onTrack});this.index=0;this.version=Date.now();this.failed=new Set();this.started=false;
    this.tracks=['music1.mp3','music2.mp3'].map(name=>new URL(name,prosperityMusicBase).href);
  }
  start(){if(this.started)return;this.started=true;this.failed.clear();this.playTrack(this.index);}
  release(){if(this.el){this.el.onended=this.el.onerror=null;this.el.pause();this.el.removeAttribute('src');this.el.load();}this.source?.disconnect();this.el=null;this.source=null;}
  playTrack(index){
    this.release();if(!this.started)return;this.index=index%this.tracks.length;
    const el=this.el=new Audio(`${this.tracks[this.index]}?v=${this.version}`);el.preload='auto';
    this.source=this.context.createMediaElementSource(el);this.source.connect(this.output);
    const fail=()=>{if(el!==this.el)return;this.failed.add(this.index);if(this.failed.size===this.tracks.length){this.onError('Không tải được hai file nhạc. Kiểm tra assets/music/music1.mp3 và music2.mp3.');this.release();this.started=false;}else this.playTrack((this.index+1)%this.tracks.length);};
    el.onended=()=>{if(el===this.el)this.playTrack((this.index+1)%this.tracks.length);};el.onerror=fail;
    el.play().then(()=>{if(el===this.el){this.failed.delete(this.index);this.onTrack(this.index+1);}}).catch(error=>{if(el!==this.el)return;if(error.name==='NotAllowedError'){this.onError('Bấm bật âm thanh để phát nhạc.');this.release();this.started=false;}else fail();});
  }
  next(){this.failed.clear();if(!this.started){this.index=(this.index+1)%this.tracks.length;this.start();}else this.playTrack((this.index+1)%this.tracks.length);}
  stop(){this.started=false;this.release();}
};
