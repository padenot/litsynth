litsynth
=========

Introduction and scope
----------------------

*litsynth* is the simplest Web Audio API synth module that can be used for
demoscene purposes. It simply plays back a tune using *instruments*, according
to a *score*, using a *scheduler*.

The important parts of the code are therefore:
- The instruments. Here, a kick drum, a hi-hat and a acid bass synth are
  included, perfect for a simple techno tune ;
- The scheduler. It is responsible to schedule the notes, and is the core of the
  synth ;
- The score. It tells the scheduler which instrument should be played and when ;
- Effect sends, like reverb and delays.

A real synth will have much more features. In no particular order:
- Effect automation and LFOs (Low Frequency Oscillators), to be able to modulate
  effects and parameters over time ;
- Patterns and playlist instead of this `simplistic` track structure ;
- More instruments, maybe using more advanced synthesis techniques ;
- Being able to decide on the note length, velocity, and to change instrument
  parameters for each note ;

Utility functions
-----------------

This utility functions allows us to convert a MIDI note number to a frequency
value. It'll be useful when we'll try to write melodies.

    function note2freq(note) {
      return Math.pow(2, (note - 69) / 12) * 440;
    }

The synth
---------

This is our main object. It takes an
[AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
(`ac`) and a `track`. A `track` is a JavaScript object that contains a tempo, a
list of instruments, and the notes they have to play.

`this.sink` will be the
[AudioNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode) to which
all instruments will be connected. This level of indirection will allow us to
easily add global effects, like a reverb, later on if we feel the tune need it.

`this.clap` is an `AudioBuffer` containing a 808 clap sample.

    function S(ac, clap, track) {
       this.ac = ac;
       this.clap = clap;
       this.track = track;

We get a convolver to have a global reverb, and we set the sink to a gain node,
that is just here to make a junction:

       this.rev = ac.createConvolver();
       this.rev.buffer = this.ReverbBuffer();
       this.sink = ac.createGain();
       this.sink.connect(this.rev);
       this.rev.connect(ac.destination);

       this.sink.connect(ac.destination);
    }

Noises (here, Gaussian noise), are very useful when doing audio synthesis. Here,
we will use noise to create a hi-hat cymbal.

    S.prototype.NoiseBuffer = function() {

It would be wasteful to recompute a noise buffer each time the hi-hat hits, so
we compute it once and store it.

      if (!S._NoiseBuffer) {

[AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer) hold
samples, associated with a number of channels and a sample rate. They are to be
used with a variety of nodes (they can't simply take, say, a `Float32Array`, but
it is easy to set a `Float32Array` to be the content of an `AudioBuffer` like
so: `AudioBuffer.getChannelData(0).set(float32array)`.

        S._NoiseBuffer = this.ac.createBuffer(1, this.ac.sampleRate / 10, this.ac.sampleRate);

To be able to write into an `AudioBuffer`, you need to use the
`getChannelData(channel)` method. This gives you a `Float32Array` that you can
modify at will.

        var cd = S._NoiseBuffer.getChannelData(0);
        for (var i = 0; i < cd.length; i++) {

`Math.random()` is in the [0.0; 1.0] interval. Audio samples, in the Web Audio
API, are in the [-1.0; 1.0] interval, so we need to rescale our random noise.

          cd[i] = Math.random() * 2 - 1;
        }
      }
      return S._NoiseBuffer;
    }


Then, we'll just get a simple decreasing exponential curve, with some noise, to
simulate a reverb, still in an `AudioBuffer`:

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

The instruments
---------------

Here is our kick drum. Here, we will simply use a pure sine wave, with a
decaying frequency and volume. The `t` parameters tells us when the kick is
supposed to be triggered.

    S.prototype.Kick = function(t) {

First, we need an
[OscillatorNode](https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode)
to create the sine wave (it defaults to a sine wave shape, so we don't have to
set anything), and a
[GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode) to be able
to alter the volume of sine wave over time.
In the Web Audio API, you always create new `AudioNode` using the `AudioContext`.
`AudioNode`s can't be used in multiple context, but `AudioBuffer` can.
Here, we connect the oscillator to the gain node, and the gain node to the
destination of the synth, in order for the oscillator to be processed by the
gain node.

      var o = this.ac.createOscillator();
      var g = this.ac.createGain();
      o.connect(g);
      g.connect(this.sink);

We start by setting the gain (volume) of the `GainNode` to 1.0, which is the
default. A `GainNode` can be used to amplify or reduce the volume: a value
greater than 1.0 will amplify the volume of the input, whereas a value lesser
than 1.0 will reduce it.

      g.gain.setValueAtTime(1.0, t);

Percussions sound better when the decay curve is exponential, and not linear. We
use the `setTargetAtTime` method on the `gain`
[AudioParam](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam) to do
so. Here, we reduce the volume to 0.0 (silence), starting a time `t`, with a
linear constant of `0.1`. This third parameter can be thought of as the number
of seconds it takes to reach `1 - 1/Math.E` (around 63.2%).

      g.gain.setTargetAtTime(0.0, t, 0.1);

Then the pitch. Kick drums are sometimes called bass drum, so they have to have
a low frequency. Let's start at 100Hz, and decay to 30Hz using a time constant
of 0.15.

      o.frequency.value = 100;
      o.frequency.setTargetAtTime(30, t, 0.15);

Finally, we want to start the `OscillatorNode` at `t`, and we want to stop it
sometimes later. Here, we just want to stop it later than the decay envelope,
one second will do.

      o.start(t);
      o.stop(t + 1);

To add a bit more "bite" to the sound, we repeat the same technique, but with a
very short 40Hz square wave. This will add some attack to the sound.

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

Now, onto the hi-hats. This also demonstrate how to play samples with the Web
Audio API.

    S.prototype.Hats = function(t) {

First, we need to get an
[AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode).
It can be though of as an `AudioBuffer` player. We set its `buffer` property to
the noise buffer we prepared earlier.

      var s = this.ac.createBufferSource();
      s.buffer = this.NoiseBuffer();

Next, a `GainNode` to do an envelope, like for the kick drum.

      var g = this.ac.createGain();

Finally, we need to get rid of all the low frequency that are present in our
noise buffer. To do so, we will use a
[BiquadFilterNode](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode),
set to be a high-pass (that lets all the high frequency though, but cuts the low
frequencies), with a cutoff frequency of 5000Hz. The cutoff frequency can be
tuned, different music genre call for different hi-hats.

      var hpf = this.ac.createBiquadFilter();
      hpf.type = "highpass";
      hpf.frequency.value = 5000;

Once again, we do an exponential envelope, with a time constant chosen by ear.

      g.gain.setValueAtTime(1.0, t);
      g.gain.setTargetAtTime(0.0, t, 0.02);

Then we connect all the nodes, and we start to play the buffer at time `t`. It
will stop playing automatically when the end is reached.

      s.connect(g);
      g.connect(hpf);
      hpf.connect(this.sink);

      s.start(t);
    }

Onto the clap sound. This is just playing back a buffer:

    S.prototype.Clap = function(t) {
      var s = this.ac.createBufferSource();
      var g = this.ac.createGain();

      s.buffer = this.clap;

      s.connect(g);
      g.connect(this.sink);

      g.gain.value = 0.5;

      s.start(t);
    }

Finally, a simple acid bass synth completes our trio of instruments.

    S.prototype.Bass = function(t, note) {

We need two `OscillatorNode`, a `GainNode` for the envelope, and another gain
node for the volume:

      var o = this.ac.createOscillator();
      var o2 = this.ac.createOscillator();
      var g = this.ac.createGain();
      var g2 = this.ac.createGain();

We set the frequency of the oscillators to the current note, and the shape of the
waveform to be a sawtooth.

      o.frequency.value = o2.frequency.value = note2freq(note);
      o.type = o2.type = "sawtooth";

Once again, a simple envelope. The time constant here is longer than for
percussions.

      g.gain.setValueAtTime(1.0, t);
      g.gain.setTargetAtTime(0.0, t, 0.1);

We set the volume a bit lower: we have two sawtooth wave:

      g2.gain.value = 0.5;

Now we need a low-pass filter so it sounds good. We add a bit of resonnance to
the filter so that we have an harsh overtone:

      var lp = this.ac.createBiquadFilter();
      lp.Q.value = 25;

We automate the filter so it has an attack portion: it takes some time to open
up, the beginning of the sound being a bit more soft:

      lp.frequency.setValueAtTime(300, t);
      lp.frequency.setTargetAtTime(3000, t, 0.05);

Connect all the nodes, and start and stop the `OscillatorNode` as previously
explained.

      o.connect(g);
      o2.connect(g);
      g.connect(lp);
      lp.connect(g2);
      g2.connect(this.sink);

      o.start(t);
      o.stop(t + 1);
    }

The scheduler
-------------

This function allows the caller to know when in the tune the synth is, and
possibly to schedule scenes, and the like. It is very important to schedule the
graphics from the music, and not the inverse.

    S.prototype.clock = function() {
      var beatLen = 60 / this.track.tempo;
      return (this.ac.currentTime  - this.startTime) / beatLen;
    }

This function allows to start the synth. It calls the `scheduler` function for
the first time, that will do all the work.

    S.prototype.start = function() {
      this.startTime = this.ac.currentTime;
      this.nextScheduling = 0;
      this.scheduler();
    }

 Now the more complicated part. This function, called repeatedly, will schedule
 the instruments to play the right notes at the right time.

    S.prototype.scheduler = function() {

We need the current time, and we like to have it in beats, and not in seconds,
as it's easier to deal with. `beatLen` tells us how long a beat
is, and allows to convert between beats and seconds.

      var beatLen = 60 / this.track.tempo;
      var current = this.clock();

Since, when doing demoscene stuff, the main thread is often busy with other
things (graphics, physics, procedural generation of various textures and
geometry, etc.), we want to schedule a little bit ahead, in case the main thread
locks up for some time. We don't really care about latency, here, so let's say
one second is good.

      var lookahead = 0.5;

If it's time to schedule more sounds, do so, otherwise, just do nothing apart
scheduling this function to be called again soon.

      if (current + lookahead > this.nextScheduling) {

This synth can schedule notes in quarter beats. We schedule a beat at a time. We
start by storing the time values for quarter beats in an array

        var steps = [];
        for (var i = 0; i < 4; i++) {
          steps.push(this.nextScheduling + i * beatLen / 4);
        }

Then, for each tracks, and for each quarter beats, we find where in the score we
are, and if there is a note (if the value is not zero), we play it.

        for (var i in this.track.tracks) {
          for (var j = 0; j < steps.length; j++) {
            var idx = Math.round(steps[j] / ((beatLen / 4)));

Here, we loop the tune forever.

            var note = this.track.tracks[i][idx % this.track.tracks[i].length];
            if (note != 0) {
              this[i](steps[j], note);
            }
          }
        }

Since we just scheduled some notes, we change the time of the next scheduling to
be a beat further in time.

        this.nextScheduling += (60 / this.track.tempo);
      }

Then, we call this function again soon. In a real demoscene synth, it can be
interesting to simply put the `scheduler` function in the main rendering loop,
as it is supposed to be called once every 16 milliseconds.

      setTimeout(this.scheduler.bind(this), 100);
    }

The score
---------

Then, we need to decide on a tempo, and write a score. Here, we are doing
techno, so 140 bpm is good. Kick goes on the beat, and the hi-hat is off-beat.
Clap is every two beats.

Then, we have a little bass theme. It can be interesting to have patterns and
a playlist instead of directly the notes, so that patterns can be reused.


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

Finally, we get an AudioContext, pass it to the synth along with a track, and
start the tune.


    fetch('clap.ogg').then((response) => {
      response.arrayBuffer().then((arraybuffer) => {
        var ac = new AudioContext();
        ac.decodeAudioData(arraybuffer).then((clap) => {
          var s = new S(ac, clap, track);
          s.start();
        });
      });
    });
