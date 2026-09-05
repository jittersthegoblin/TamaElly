(() => {
  'use strict';

  const STORAGE_KEY = 'elly-pocket-pal-v1';
  const TICK_MS = 1000;
  const MAX_OFFLINE_MS = 6 * 60 * 60 * 1000;

  const assets = {
    idle: 'assets/idle.png',
    happy: 'assets/happy.png',
    beg: 'assets/beg.png',
    eat: 'assets/eat.png',
    poop: 'assets/poop.png',
    pet: 'assets/pet.png',
    sleepy: 'assets/sleepy.png',
    sleep: 'assets/sleep.png',
    clean: 'assets/clean.png',
    play: 'assets/play.png',
    sad: 'assets/sad.png',
    laser: 'assets/laser.png'
  };

  const ui = {
    screen: document.getElementById('screen'),
    sprite: document.getElementById('ellySprite'),
    poop: document.getElementById('poopSprite'),
    speech: document.getElementById('speech'),
    statusChip: document.getElementById('statusChip'),
    message: document.getElementById('message'),
    soundBtn: document.getElementById('soundBtn'),
    resetBtn: document.getElementById('resetBtn'),
    feedBtn: document.getElementById('feedBtn'),
    playBtn: document.getElementById('playBtn'),
    petBtn: document.getElementById('petBtn'),
    showerBtn: document.getElementById('showerBtn'),
    sleepBtn: document.getElementById('sleepBtn'),
    cleanPoopBtn: document.getElementById('cleanPoopBtn'),
    clockText: document.getElementById('clockText'),
    saveText: document.getElementById('saveText'),
    bars: {
      fullness: document.getElementById('fullnessBar'),
      fun: document.getElementById('funBar'),
      clean: document.getElementById('cleanBar'),
      energy: document.getElementById('energyBar'),
      love: document.getElementById('loveBar')
    },
    texts: {
      fullness: document.getElementById('fullnessText'),
      fun: document.getElementById('funText'),
      clean: document.getElementById('cleanText'),
      energy: document.getElementById('energyText'),
      love: document.getElementById('loveText')
    }
  };

  const defaultState = () => ({
    fullness: 78,
    fun: 74,
    clean: 82,
    energy: 70,
    love: 76,
    sleeping: false,
    poopPresent: false,
    poopDueAt: null,
    poopSince: null,
    actionUntil: 0,
    actionSprite: null,
    actionMessage: null,
    actionSpeech: null,
    gameSeconds: 0,
    sound: true,
    lastSaved: Date.now(),
    lastInteraction: Date.now(),
    rageCooldownUntil: 0
  });

  let state = loadState();
  let audioCtx = null;
  let savePulseTimer = null;

  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function randomOf(list) { return list[Math.floor(Math.random() * list.length)]; }

  function loadState() {
    const fresh = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fresh;
      const saved = { ...fresh, ...JSON.parse(raw) };
      const now = Date.now();
      const elapsed = Math.min(MAX_OFFLINE_MS, Math.max(0, now - (saved.lastSaved || now)));
      applyOfflineDecay(saved, elapsed / 1000);
      saved.lastSaved = now;
      return saved;
    } catch (_) {
      return fresh;
    }
  }

  function applyOfflineDecay(s, seconds) {
    if (!seconds) return;
    const factor = seconds / 60;
    s.fullness = clamp(s.fullness - factor * 2.2);
    s.fun = clamp(s.fun - factor * 1.3);
    s.clean = clamp(s.clean - factor * (s.poopPresent ? 3.4 : 1.0));
    s.love = clamp(s.love - factor * 1.4);
    if (s.sleeping) s.energy = clamp(s.energy + factor * 8);
    else s.energy = clamp(s.energy - factor * 1.2);
    if (s.poopDueAt && Date.now() >= s.poopDueAt) {
      s.poopPresent = true;
      s.poopDueAt = null;
      s.poopSince = s.poopSince || Date.now();
    }
  }

  function saveState(showPulse = false) {
    state.lastSaved = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    if (showPulse) {
      ui.saveText.textContent = 'SAVED!';
      clearTimeout(savePulseTimer);
      savePulseTimer = setTimeout(() => { ui.saveText.textContent = 'AUTO-SAVED'; }, 900);
    }
  }

  function bleep(freq = 520, duration = 0.06, type = 'square') {
    if (!state.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.045, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function action(sprite, message, speech, duration = 2200, animation = 'bounce') {
    const now = Date.now();
    state.actionSprite = sprite;
    state.actionMessage = message;
    state.actionSpeech = speech;
    state.actionUntil = now + duration;
    state.lastInteraction = now;
    ui.sprite.classList.remove('bounce', 'shake');
    void ui.sprite.offsetWidth;
    if (animation) ui.sprite.classList.add(animation);
    render();
  }

  function criticalNeeds() {
    const items = [];
    if (state.fullness <= 10) items.push('nugget shortage');
    if (state.fun <= 8) items.push('boredom');
    if (state.clean <= 8) items.push('filth');
    if (state.energy <= 5) items.push('exhaustion');
    if (state.love <= 10) items.push('lack of pets');
    if (state.poopPresent && state.poopSince && Date.now() - state.poopSince > 45000) items.push('uncollected poop');
    return items;
  }

  function naturalMood() {
    const crit = criticalNeeds();
    if (crit.length) return { sprite: 'laser', speech: '> :(', label: 'LASER MODE', message: `Elly has had enough of the ${crit[0]}.` };
    if (state.sleeping) return { sprite: 'sleep', speech: 'zzz', label: 'SLEEPING', message: 'Tiny dog. Massive nap.' };
    if (state.energy < 24) return { sprite: 'sleepy', speech: ':(', label: 'SLEEPY', message: 'Elly is running on approximately one molecule of energy.' };
    if (state.fullness < 28) return { sprite: 'beg', speech: ':P', label: 'HUNGRY', message: 'Nugget negotiations have begun.' };
    if (state.poopPresent) return { sprite: 'idle', speech: ';)', label: 'SUSPICIOUS', message: 'Elly is pretending not to know who did that.' };
    if (state.clean < 32) return { sprite: 'sad', speech: ':(', label: 'GRUBBY', message: 'Elly could really use a shower.' };
    if (state.love < 34) return { sprite: 'sad', speech: '<3?', label: 'NEEDS PETS', message: 'She would like affection immediately, please.' };
    if (state.fun < 34) return { sprite: 'idle', speech: ':(', label: 'BORED', message: 'Elly is staring at you with recreational intent.' };
    if (state.fullness > 78 && state.fun > 68 && state.love > 68) return { sprite: 'happy', speech: randomOf(['<3', ':D', ';)', ':P']), label: 'DELIGHTED', message: 'Elly is thriving and knows she is adored.' };
    return { sprite: 'idle', speech: randomOf(['<3', ':)', ';)', ':D']), label: 'CONTENT', message: 'Elly is hanging out with you.' };
  }

  function render() {
    const now = Date.now();
    const actionActive = state.actionUntil > now && state.actionSprite;
    const mood = actionActive
      ? { sprite: state.actionSprite, speech: state.actionSpeech, label: 'BUSY', message: state.actionMessage }
      : naturalMood();

    ui.sprite.src = assets[mood.sprite];
    ui.sprite.classList.toggle('sleeping', state.sleeping && !actionActive);
    ui.speech.textContent = mood.speech;
    ui.statusChip.textContent = mood.label;
    ui.message.textContent = mood.message;

    const rage = criticalNeeds().length > 0 && !state.sleeping;
    ui.screen.classList.toggle('rage', rage);
    ui.poop.classList.toggle('hidden', !state.poopPresent);
    ui.cleanPoopBtn.disabled = !state.poopPresent || state.sleeping;

    const actionButtons = [ui.feedBtn, ui.playBtn, ui.petBtn, ui.showerBtn];
    actionButtons.forEach(btn => { btn.disabled = state.sleeping; });
    ui.sleepBtn.textContent = state.sleeping ? 'WAKE ELLY' : 'Z  SLEEP';

    for (const key of ['fullness', 'fun', 'clean', 'energy', 'love']) {
      const value = Math.round(clamp(state[key]));
      ui.bars[key].style.width = `${value}%`;
      ui.texts[key].textContent = String(value).padStart(2, '0');
      ui.bars[key].classList.toggle('low', value < 35 && value >= 15);
      ui.bars[key].classList.toggle('critical', value < 15);
    }

    const day = Math.floor(state.gameSeconds / 240) + 1;
    const mins = Math.floor((state.gameSeconds % 240) / 4) * 15;
    const hour = (8 + Math.floor(mins / 60)) % 24;
    const minute = mins % 60;
    ui.clockText.textContent = `DAY ${day} // ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
    ui.soundBtn.textContent = `SOUND: ${state.sound ? 'ON' : 'OFF'}`;
    ui.soundBtn.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
  }

  function tick() {
    const now = Date.now();
    state.gameSeconds += 1;

    if (state.poopDueAt && now >= state.poopDueAt) {
      state.poopDueAt = null;
      state.poopPresent = true;
      state.poopSince = now;
      state.clean = clamp(state.clean - 9);
      action('poop', 'A nugget has completed its mysterious journey.', ':D', 2600, null);
      bleep(230, .1, 'square');
    }

    if (state.sleeping) {
      state.energy = clamp(state.energy + 2.6);
      state.fullness = clamp(state.fullness - 0.05);
      if (state.energy >= 100) {
        state.sleeping = false;
        action('happy', 'Elly woke up fully charged.', ':D', 2400, 'bounce');
        bleep(700, .08);
      }
    } else {
      state.fullness = clamp(state.fullness - 0.028);
      state.fun = clamp(state.fun - 0.020);
      state.clean = clamp(state.clean - (state.poopPresent ? 0.060 : 0.010));
      state.energy = clamp(state.energy - 0.016);
      state.love = clamp(state.love - 0.018);
    }

    if (criticalNeeds().length && now > state.rageCooldownUntil) {
      state.rageCooldownUntil = now + 12000;
      bleep(110, .18, 'sawtooth');
      setTimeout(() => bleep(95, .18, 'sawtooth'), 120);
    }

    if (state.actionUntil && now >= state.actionUntil) {
      state.actionUntil = 0;
      state.actionSprite = null;
      state.actionMessage = null;
      state.actionSpeech = null;
      ui.sprite.classList.remove('bounce', 'shake');
    }

    render();
    if (state.gameSeconds % 5 === 0) saveState(false);
  }

  ui.feedBtn.addEventListener('click', () => {
    if (state.sleeping) return;
    if (state.fullness > 94) {
      action('idle', 'Elly is full. The nugget has been respectfully declined.', ':P', 2200, 'shake');
      bleep(260, .05);
      return;
    }
    state.fullness = clamp(state.fullness + 25);
    state.fun = clamp(state.fun + 3);
    state.love = clamp(state.love + 2);
    if (!state.poopPresent && !state.poopDueAt) state.poopDueAt = Date.now() + 7000 + Math.random() * 5000;
    action('eat', 'CRONCH. Elly has accepted one premium chicken nugget.', ':D', 2600, 'bounce');
    bleep(620, .06); setTimeout(() => bleep(760, .05), 90);
    saveState(true);
  });

  ui.playBtn.addEventListener('click', () => {
    if (state.sleeping) return;
    if (state.energy < 14) {
      action('sleepy', 'Elly tried to play, then remembered she is extremely tiny and tired.', ':(', 2600, null);
      bleep(240, .08);
      return;
    }
    state.fun = clamp(state.fun + 28);
    state.energy = clamp(state.energy - 18);
    state.clean = clamp(state.clean - 4);
    state.love = clamp(state.love + 5);
    action('play', 'ZOOMIES ACTIVATED.', ':D', 2500, 'bounce');
    bleep(700, .05); setTimeout(() => bleep(860, .05), 80); setTimeout(() => bleep(980, .05), 160);
    saveState(true);
  });

  ui.petBtn.addEventListener('click', () => {
    if (state.sleeping) return;
    state.love = clamp(state.love + 24);
    state.fun = clamp(state.fun + 6);
    action('pet', randomOf(['Elly leans directly into your hand.', 'The tiny ears have accepted scritches.', 'You have successfully pet the dog.']), randomOf(['<3', ';)', ':D']), 2300, 'bounce');
    bleep(820, .06, 'sine');
    saveState(true);
  });

  ui.showerBtn.addEventListener('click', () => {
    if (state.sleeping) return;
    state.clean = 100;
    state.fun = clamp(state.fun - 4);
    action('clean', 'Squeaky clean. Mildly offended. Very fluffy.', '> :P', 2900, 'shake');
    bleep(560, .05); setTimeout(() => bleep(610, .05), 90);
    saveState(true);
  });

  ui.sleepBtn.addEventListener('click', () => {
    state.sleeping = !state.sleeping;
    state.actionUntil = 0;
    state.actionSprite = null;
    if (state.sleeping) {
      state.lastInteraction = Date.now();
      bleep(330, .08, 'sine');
    } else {
      action('happy', 'Elly is awake again.', ':D', 1800, 'bounce');
      bleep(690, .06);
    }
    saveState(true);
    render();
  });

  ui.cleanPoopBtn.addEventListener('click', () => {
    if (!state.poopPresent || state.sleeping) return;
    state.poopPresent = false;
    state.poopSince = null;
    state.clean = clamp(state.clean + 8);
    state.love = clamp(state.love + 3);
    action('happy', 'Poop removed. Elly denies all involvement.', ';)', 2400, 'bounce');
    bleep(520, .06); setTimeout(() => bleep(720, .06), 100);
    saveState(true);
  });

  ui.soundBtn.addEventListener('click', () => {
    state.sound = !state.sound;
    if (state.sound) bleep(680, .06);
    saveState(true);
    render();
  });

  ui.resetBtn.addEventListener('click', () => {
    const ok = window.confirm('Reset Elly back to a fresh new game?');
    if (!ok) return;
    state = defaultState();
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    action('happy', 'Fresh start! Elly has forgotten all previous crimes.', ':D', 2600, 'bounce');
    saveState(true);
  });

  window.addEventListener('beforeunload', () => saveState(false));

  render();
  setInterval(tick, TICK_MS);
})();
