export type Sound = 'select'|'hint'|'play'|'discard'|'fail'|'complete'|'start'|'win'|'end';
// Original synthesized sounds: no recordings, remote assets, or hidden card data.
class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  enabled = localStorage.getItem('hanabi-sound') !== 'off';
  unlock = () => {
    if (!this.enabled) return;
    try {
      const Context = window.AudioContext || (window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
      if (!Context) return;
      if (!this.context) { this.context = new Context(); this.master = this.context.createGain(); this.master.gain.value = .32; this.master.connect(this.context.destination); }
      if (this.context.state === 'suspended') void this.context.resume().catch(()=>{});
    } catch { /* Audio is optional; game interaction remains available. */ }
  };
  setEnabled(enabled:boolean) {
    this.enabled=enabled; localStorage.setItem('hanabi-sound',enabled?'on':'off');
    // Cancel even already-scheduled notes when muting.
    if(this.context&&this.master) this.master.gain.setValueAtTime(enabled?.32:0,this.context.currentTime);
    if(enabled)this.unlock();
  }
  private tone(frequency:number,offset:number,duration:number,volume=.3,type:OscillatorType='sine',endFrequency?:number) {
    const ctx=this.context!, t=ctx.currentTime+offset;
    const oscillator=ctx.createOscillator(), gain=ctx.createGain();
    oscillator.type=type; oscillator.frequency.setValueAtTime(frequency,t);
    if(endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency,t+duration);
    gain.gain.setValueAtTime(.0001,t); gain.gain.exponentialRampToValueAtTime(volume,t+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    oscillator.connect(gain);gain.connect(this.master!);oscillator.start(t);oscillator.stop(t+duration+.015);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
  private noise(duration:number,volume:number,frequency:number) {
    const ctx=this.context!, source=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), gain=ctx.createGain();
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate), data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);
    source.buffer=buffer;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.value=volume;
    source.connect(filter);filter.connect(gain);gain.connect(this.master!);source.start();
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  play(sound:Sound) {
    if(!this.enabled||!this.context||this.context.state!=='running'||document.hidden)return;
    switch(sound){
      case 'select': this.tone(700,0,.07,.12,'triangle',340);break;
      case 'hint': this.tone(880,0,.23,.24);this.tone(1320,.075,.3,.19);break;
      case 'discard': this.noise(.14,.18,2100);this.tone(280,.02,.11,.16,'triangle',140);break;
      case 'play': this.noise(.065,.19,1100);this.tone(100,0,.16,.35,'sine',55);this.tone(523.25,.04,.19,.23,'triangle');this.tone(783.99,.1,.24,.2);break;
      case 'fail': this.noise(.2,.2,700);this.tone(160,0,.26,.3,'triangle',60);this.tone(120,.09,.2,.18,'sine',45);break;
      case 'complete': [523.25,659.25,783.99,1046.5].forEach((f,i)=>this.tone(f,i*.075,.42,.22));this.noise(.12,.12,4000);break;
      case 'start': [392,523.25,659.25].forEach((f,i)=>this.tone(f,i*.085,.27,.19,'triangle'));break;
      case 'win': [523.25,659.25,783.99,1046.5,1318.5,1568].forEach((f,i)=>this.tone(f,i*.095,.5,.22));break;
      case 'end': [659.25,523.25,392].forEach((f,i)=>this.tone(f,i*.13,.42,.17));break;
    }
  }
}
export const audio=new GameAudio();
