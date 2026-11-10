/* Original, looping pentatonic instrumental: bright plucked melody, bass and soft dance rhythm. */
window.ProsperityMusic = class {
  constructor(context, output) { this.context=context; this.output=output; this.step=0; this.timer=null; this.next=0; }
  note(midi,time,length,volume,type='triangle') {
    const c=this.context,o=c.createOscillator(),g=c.createGain(); o.type=type; o.frequency.value=440*2**((midi-69)/12);
    g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(volume,time+.008);g.gain.exponentialRampToValueAtTime(.0001,time+length);
    o.connect(g);g.connect(this.output);o.start(time);o.stop(time+length+.02);
  }
  beat(time,accent) {
    const c=this.context,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(accent?120:180,time);o.frequency.exponentialRampToValueAtTime(50,time+.09);
    g.gain.setValueAtTime(accent?.16:.06,time);g.gain.exponentialRampToValueAtTime(.0001,time+.12);o.connect(g);g.connect(this.output);o.start(time);o.stop(time+.14);
  }
  start() {
    if(this.timer) return;this.next=this.context.currentTime+.06;
    const melody=[72,76,79,81,79,76,74,76,79,81,84,81,79,76,74,72,76,79,81,84,86,84,81,79,76,74,72,74,76,79,76,72];
    const roots=[48,53,57,55];
    const schedule=()=>{while(this.next<this.context.currentTime+.25){const i=this.step++,t=this.next,root=roots[Math.floor(i/16)%4];
      this.note(melody[i%melody.length],t,.23,.13);
      if(i%2===0){this.note(root,t,.35,.15,'sine');this.beat(t,i%4===0);}
      if(i%4===2){this.note(root+12,t,.16,.045);this.note(root+19,t,.16,.04);}
      this.next+=60/112/2;
    }};schedule();this.timer=setInterval(schedule,80);
  }
  stop(){clearInterval(this.timer);this.timer=null;}
};
