function note2freq(note) {
  return Math.pow(2, (note - 69) / 12) * 440;
}
function S(ac, clap, track) {
   this.ac = ac;
   this.clap = clap;
   this.track = track;
   this.rev = ac.createConvolver();
   this.rev.buffer = this.ReverbBuffer();
   this.sink = ac.createGain();
   this.sink.connect(this.rev);
   this.rev.connect(ac.destination);
   this.sink.connect(ac.destination);
}
S.prototype.NoiseBuffer = function() {
  if (!S._NoiseBuffer) {
    S._NoiseBuffer = this.ac.createBuffer(1, this.ac.sampleRate / 10, this.ac.sampleRate);
    var cd = S._NoiseBuffer.getChannelData(0);
    for (var i = 0; i < cd.length; i++) {
      cd[i] = Math.random() * 2 - 1;
    }
  }
  return S._NoiseBuffer;
}
S.prototype.ReverbBuffer = function() {
  var len = 0.5 * this.ac.sampleRate,
      decay = 0.5;
  var buf = this.ac.createBuffer(2, len, this.ac.sampleRate);
  for (var c = 0; c < 2; c++) {
    var channelData = buf.getChannelData(c);
    for (var i = 0; i < channelData.length; i++) {
       channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}
S.prototype.Kick = function(t) {
  var o = this.ac.createOscillator();
  var g = this.ac.createGain();
  o.connect(g);
  g.connect(this.sink);
  g.gain.setValueAtTime(1.0, t);
  g.gain.setTargetAtTime(0.0, t, 0.1);
  o.frequency.value = 100;
  o.frequency.setTargetAtTime(30, t, 0.15);
  o.start(t);
  o.stop(t + 1);
  var osc2 = this.ac.createOscillator();
  var gain2 = this.ac.createGain();
  osc2.frequency.value = 40;
  osc2.type = "square";
  osc2.connect(gain2);
  gain2.connect(this.sink);
  gain2.gain.setValueAtTime(0.5, t);
  gain2.gain.setTargetAtTime(0.0, t, 0.01);
  osc2.start(t);
  osc2.stop(t + 1);
}
S.prototype.Hats = function(t) {
  var s = this.ac.createBufferSource();
  s.buffer = this.NoiseBuffer();
  var g = this.ac.createGain();
  var hpf = this.ac.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 5000;
  g.gain.setValueAtTime(1.0, t);
  g.gain.setTargetAtTime(0.0, t, 0.02);
  s.connect(g);
  g.connect(hpf);
  hpf.connect(this.sink);
  s.start(t);
}
S.prototype.Clap = function(t) {
  var s = this.ac.createBufferSource();
  var g = this.ac.createGain();
  s.buffer = this.clap;
  s.connect(g);
  g.connect(this.sink);
  g.gain.value = 0.5;
  s.start(t);
}
S.prototype.Bass = function(t, note) {
  var o = this.ac.createOscillator();
  var o2 = this.ac.createOscillator();
  var g = this.ac.createGain();
  var g2 = this.ac.createGain();
  o.frequency.value = o2.frequency.value = note2freq(note);
  o.type = o2.type = "sawtooth";
  g.gain.setValueAtTime(1.0, t);
  g.gain.setTargetAtTime(0.0, t, 0.1);
  g2.gain.value = 0.5;
  var lp = this.ac.createBiquadFilter();
  lp.Q.value = 25;
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.setTargetAtTime(3000, t, 0.05);
  o.connect(g);
  o2.connect(g);
  g.connect(lp);
  lp.connect(g2);
  g2.connect(this.sink);
  o.start(t);
  o.stop(t + 1);
}
S.prototype.clock = function() {
  var beatLen = 60 / this.track.tempo;
  return (this.ac.currentTime  - this.startTime) / beatLen;
}
S.prototype.start = function() {
  this.startTime = this.ac.currentTime;
  this.nextScheduling = 0;
  this.scheduler();
}
S.prototype.scheduler = function() {
  var beatLen = 60 / this.track.tempo;
  var current = this.clock();
  var lookahead = 0.5;
  if (current + lookahead > this.nextScheduling) {
    var steps = [];
    for (var i = 0; i < 4; i++) {
      steps.push(this.nextScheduling + i * beatLen / 4);
    }
    for (var i in this.track.tracks) {
      for (var j = 0; j < steps.length; j++) {
        var idx = Math.round(steps[j] / ((beatLen / 4)));
        var note = this.track.tracks[i][idx % this.track.tracks[i].length];
        if (note != 0) {
          this[i](steps[j], note);
        }
      }
    }
    this.nextScheduling += (60 / this.track.tempo);
  }
  setTimeout(this.scheduler.bind(this), 100);
}
var track = {
  tempo: 135,
  tracks: {
    Kick: [ 1, 0, 0, 0, 1, 0, 0, 0,
            1, 0, 0, 0, 1, 0, 0, 0,
            1, 0, 0, 0, 1, 0, 0, 0,
            1, 0, 0, 0, 1, 0, 0, 0],
    Hats: [ 0, 0, 1, 0, 0, 0, 1, 0,
            0, 0, 1, 0, 0, 0, 1, 1,
            0, 0, 1, 0, 0, 0, 1, 0,
            0, 0, 1, 0, 0, 0, 1, 0 ],
    Clap: [ 0, 0, 0, 0, 1, 0, 0, 0,
            0, 0, 0, 0, 1, 0, 0, 0,
            0, 0, 0, 0, 1, 0, 0, 0,
            0, 0, 0, 0, 1, 0, 0, 0],
    Bass: [36, 0,38,36,36,38,41, 0,
           36,60,36, 0,39, 0,48, 0,
           36, 0,24,60,40,40,24,24,
           36,60,36, 0,39, 0,48, 0 ]
  }
};
fetch('clap.ogg').then((response) => {
  response.arrayBuffer().then((arraybuffer) => {
    var ac = new AudioContext();
    ac.decodeAudioData(arraybuffer).then((clap) => {
      var s = new S(ac, clap, track);
      s.start();
    });
  });
});
