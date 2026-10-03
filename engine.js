/* The band: everything is synthesised in the browser, no audio files, no licences.
   Shared by the studio page and the console page. */
(function () {
  const KEY = "domanov.tape";

  const DRUMS = ["kick", "snare", "hat", "tom", "clap", "crash"];
  // Am - F - C - G, the four chords everyone learns first
  const CHORDS = [[110.00, "Am"], [87.31, "F"], [130.81, "C"], [98.00, "G"]];

  let noise = null;
  function noiseBuf(ctx) {
    if (noise && noise.sampleRate === ctx.sampleRate) return noise;
    const n = ctx.sampleRate * 1.5;
    noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  }
  function env(ctx, t, a, d, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  }
  function tone(ctx, out, t, f0, f1, dur, peak, type) {
    const o = ctx.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = env(ctx, t, 0.004, dur, peak);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function noiseHit(ctx, out, t, hp, dur, peak, q) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx);
    s.playbackRate.value = 1;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp; f.Q.value = q || 0.8;
    const g = env(ctx, t, 0.002, dur, peak);
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.05);
  }

  function drum(ctx, out, name, t, gain) {
    const v = (gain === undefined ? 1 : gain);
    switch (name) {
      case "kick":   tone(ctx, out, t, 150, 44, 0.20, 1.0 * v); noiseHit(ctx, out, t, 2000, 0.02, 0.25 * v); break;
      case "snare":  noiseHit(ctx, out, t, 1400, 0.15, 0.55 * v, 0.9); tone(ctx, out, t, 190, 150, 0.10, 0.30 * v, "triangle"); break;
      case "hat":    noiseHit(ctx, out, t, 8500, 0.04, 0.30 * v, 1.2); break;
      case "tom":    tone(ctx, out, t, 240, 120, 0.24, 0.70 * v); noiseHit(ctx, out, t, 900, 0.05, 0.18 * v); break;
      case "clap":   for (let i = 0; i < 3; i++) noiseHit(ctx, out, t + i * 0.011, 1100, 0.05, 0.30 * v, 1.6); break;
      case "crash":  noiseHit(ctx, out, t, 5200, 1.1, 0.35 * v, 0.7); break;
    }
  }

  function shaper(ctx) {
    const c = ctx.createWaveShaper();
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 4.5);
    }
    c.curve = curve; c.oversample = "2x";
    return c;
  }

  function powerChord(ctx, out, t, root, gain, dur) {
    const d = dur || 0.85, v = gain === undefined ? 1 : gain;
    const dist = shaper(ctx);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200; lp.Q.value = 0.7;
    const g = env(ctx, t, 0.012, d, 0.30 * v);
    dist.connect(lp); lp.connect(g); g.connect(out);
    [root, root * 1.4983, root * 2].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = i === 2 ? 0.5 : 1;
      o.connect(og); og.connect(dist); o.start(t); o.stop(t + d + 0.1);
    });
    tone(ctx, out, t, root / 2, null, 0.32, 0.35 * v, "triangle");   // bass
  }

  /* ---------- a lead voice with a riff on it ---------- */
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    return PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
  }
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);

  function lead(ctx, out, t, note, dur, gain) {
    const f = hz(midi(note)), d = Math.max(0.1, dur), v = gain === undefined ? 1 : gain;
    const dist = shaper(ctx), lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 2600; lp.Q.value = 0.8;
    const g = env(ctx, t, 0.008, d, 0.24 * v);
    dist.connect(lp); lp.connect(g); g.connect(out);
    [1, 1.006].forEach(k => {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f * k;
      const og = ctx.createGain(); og.gain.value = 0.7;
      o.connect(og); og.connect(dist); o.start(t); o.stop(t + d + 0.08);
    });
  }

  // note letters checked against three sources; the two marked copyrighted are a choice, not a default
  const Q = 4, E8 = 2;
  const RIFFS = {
    none:    { label: "no riff", steps: 0, notes: [] },
    toccata: { label: "toccata in d minor \u00b7 bach \u00b7 public domain", steps: 16,
      notes: [[0,"A4",1],[1,"G4",1],[2,"A4",2],[4,"G4",1],[5,"F4",1],[6,"E4",1],[7,"D4",1],
              [8,"C#4",1],[9,"D4",4],[14,"A4",1],[15,"E4",1]] },
    mountain:{ label: "in the hall of the mountain king \u00b7 grieg \u00b7 public domain", steps: 32,
      notes: [[0,"A3",E8],[2,"B3",E8],[4,"C4",E8],[6,"D4",E8],[8,"E4",E8],[10,"C4",E8],[12,"E4",E8],
              [16,"D4",E8],[18,"E4",E8],[20,"F4",E8],[22,"G4",E8],[24,"A4",E8],[26,"F4",E8],[28,"A4",E8]] },
    ode:     { label: "ode to joy \u00b7 beethoven \u00b7 public domain", steps: 16,
      notes: [[0,"E4",E8],[2,"E4",E8],[4,"F4",E8],[6,"G4",E8],[8,"G4",E8],[10,"F4",E8],[12,"E4",E8],
              [14,"D4",E8]] },
    seven:   { label: "seven nation army \u00b7 the white stripes \u00b7 copyrighted", steps: 16,
      notes: [[0,"E2",E8],[2,"E2",E8],[4,"G2",E8],[6,"E2",E8],[8,"D2",E8],[10,"C2",E8],[12,"B1",E8]] },
    smoke:   { label: "smoke on the water \u00b7 deep purple \u00b7 copyrighted", steps: 16,
      notes: [[0,"G2",E8],[2,"Bb2",E8],[4,"C3",E8],[6,"G2",E8],[8,"Bb2",E8],[10,"Db3",E8],[12,"C3",E8]] }
  };
  const riffName = p => (p && p.melody && RIFFS[p.melody]) ? RIFFS[p.melody].label.split(" \u00b7 ")[0] : "";
  const riffLen = p => (p && p.melody && RIFFS[p.melody]) ? RIFFS[p.melody].steps : 0;

  function emptyPattern() {
    const p = { bpm: 128, steps: 16, drums: {}, chords: [], melody: "toccata", saved: null, title: "tape 01" };
    DRUMS.forEach(d => p.drums[d] = new Array(16).fill(0));
    p.chords = new Array(16).fill(0);
    return p;
  }
  function demoPattern() {
    const p = emptyPattern();
    const on = (d, list) => list.forEach(i => p.drums[d][i] = 1);
    on("kick", [0, 6, 8, 11]);
    on("snare", [4, 12]);
    on("hat", [0, 2, 4, 6, 8, 10, 12, 14]);
    on("crash", [0]);
    on("tom", [14]);
    [0, 4, 8, 12].forEach(i => p.chords[i] = 1);
    p.melody = "toccata";
    return p;
  }

  // schedule one 16th step; shared by the live loop and the offline render
  function step(ctx, out, pattern, i, t, gain, mstep) {
    DRUMS.forEach(d => { if (pattern.drums[d] && pattern.drums[d][i]) drum(ctx, out, d, t, gain); });
    const spb = 60 / (pattern.bpm || 128) / 4;
    if (pattern.chords[i]) {
      const g = Math.floor(i / 4) % CHORDS.length;
      powerChord(ctx, out, t, CHORDS[g][0], gain, spb * 6);
    }
    const j = (mstep === undefined || mstep === null) ? i : mstep;
    const R = pattern.melody ? RIFFS[pattern.melody] : null;
    if (R && R.steps) {
      R.notes.forEach(([at, note, len]) => {
        if (at === (j % R.steps)) lead(ctx, out, t, note, len * spb, gain);
      });
    }
  }
  function hitsOf(pattern) {
    let n = 0;
    DRUMS.forEach(d => (pattern.drums[d] || []).forEach(v => { if (v) n++; }));
    (pattern.chords || []).forEach(v => { if (v) n++; });
    return n;
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function save(p) {
    p.saved = new Date().toISOString().slice(0, 16).replace("T", " ");
    localStorage.setItem(KEY, JSON.stringify(p));
    return p.saved;
  }
  function clear() { localStorage.removeItem(KEY); }

  function wavBytes(buffer) {
    const ch = buffer.numberOfChannels, len = buffer.length, rate = buffer.sampleRate;
    const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); data.setUint32(4, 36 + len * ch * 2, true); str(8, "WAVE");
    str(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
    data.setUint16(22, ch, true); data.setUint32(24, rate, true);
    data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true);
    data.setUint16(34, 16, true); str(36, "data"); data.setUint32(40, len * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        let s = Math.max(-1, Math.min(1, chans[c][i]));
        data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
      }
    }
    return new Uint8Array(data.buffer);
  }

  // renders the tape to a real audio file, in the browser, with no server
  async function renderWav(pattern, loops) {
    const n = loops || 2, bpm = pattern.bpm || 128;
    const spb = 60 / bpm / 4;
    const rate = 44100, dur = n * 16 * spb + 1.6;
    const ctx = new OfflineAudioContext(2, Math.ceil(dur * rate), rate);
    const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    for (let l = 0; l < n; l++) {
      for (let i = 0; i < 16; i++) step(ctx, master, pattern, i, l * 16 * spb + i * spb, 1, l * 16 + i);
    }
    const rendered = await ctx.startRendering();
    return wavBytes(rendered);
  }

  window.BAND = { DRUMS, CHORDS, RIFFS, drum, powerChord, lead, step, emptyPattern, demoPattern, hitsOf,
    riffName, riffLen, midi, hz, load, save, clear, renderWav, KEY };
})();
