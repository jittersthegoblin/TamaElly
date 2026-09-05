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

  const achievements = [
    { id: 'poop20', icon: '◆', name: 'POOP TROOPER', desc: 'Pick up 20 poops.', stat: 'poopsPicked', target: 20 },
    { id: 'wash10', icon: '≋', name: 'SQUEAKY CLEAN', desc: 'Wash Elly 10 times.', stat: 'showers', target: 10 },
    { id: 'nugget25', icon: '▰', name: 'NUGGET BARON', desc: 'Feed Elly 25 nuggets.', stat: 'nuggetsFed', target: 25 },
    { id: 'pets25', icon: '♥', name: 'SCRITCH WIZARD', desc: 'Pet Elly 25 times.', stat: 'petsGiven', target: 25 },
    { id: 'play15', icon: '●', name: 'ZOOMIE MANAGER', desc: 'Play with Elly 15 times.', stat: 'playSessions', target: 15 },
    { id: 'naps10', icon: 'Z', name: 'NAP SUPERVISOR', desc: 'Put Elly down for 10 naps.', stat: 'napsStarted', target: 10 },
    { id: 'wins10', icon: '★', name: 'ELLY GAME CHAMP', desc: 'Win 10 mini games.', stat: 'minigameWins', target: 10 },
    { id: 'loss5', icon: '!', name: 'TACTICAL ACCIDENT', desc: 'Lose 5 mini games. Mop not included.', stat: 'minigameLosses', target: 5 },
    { id: 'laser1', icon: '⚡', name: 'LASER SURVIVOR', desc: 'Witness Elly enter laser mode.', stat: 'laserEncounters', target: 1 }
  ];

  const ui = {
    screen: document.getElementById('screen'),
    sprite: document.getElementById('ellySprite'),
    poop: document.getElementById('poopSprite'),
    speech: document.getElementById('speech'),
    statusChip: document.getElementById('statusChip'),
    message: document.getElementById('message'),
    achievementToast: document.getElementById('achievementToast'),
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
    higherLowerBtn: document.getElementById('higherLowerBtn'),
    directionBtn: document.getElementById('directionBtn'),
    minigameText: document.getElementById('minigameText'),
    minigameDisplay: document.getElementById('minigameDisplay'),
    minigameActions: document.getElementById('minigameActions'),
    achievementCount: document.getElementById('achievementCount'),
    achievementList: document.getElementById('achievementList'),
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

  const defaultStats = () => ({
    nuggetsFed: 0,
    playSessions: 0,
    petsGiven: 0,
    showers: 0,
    napsStarted: 0,
    poopsPicked: 0,
    minigameWins: 0,
    minigameLosses: 0,
    laserEncounters: 0
  });

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
    rageCooldownUntil: 0,
    wasInLaserMode: false,
    miniFacing: null,
    stats: defaultStats(),
    unlockedAchievements: []
  });

  let state = loadState();
  let audioCtx = null;
  let savePulseTimer = null;
  let achievementToastTimer = null;
  let miniGame = null;
  let directionRevealTimer = null;

  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function randomOf(list) { return list[Math.floor(Math.random() * list.length)]; }
  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function loadState() {
    const fresh = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fresh;
      const parsed = JSON.parse(raw);
      const saved = {
        ...fresh,
        ...parsed,
        stats: { ...fresh.stats, ...(parsed.stats || {}) },
        unlockedAchievements: Array.isArray(parsed.unlockedAchievements) ? parsed.unlockedAchievements : []
      };
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

  function showAchievementToast(achievement) {
    ui.achievementToast.textContent = `ACHIEVEMENT UNLOCKED // ${achievement.name}`;
    ui.achievementToast.classList.remove('hidden');
    clearTimeout(achievementToastTimer);
    achievementToastTimer = setTimeout(() => ui.achievementToast.classList.add('hidden'), 3300);
    bleep(880, .07, 'square');
    setTimeout(() => bleep(1100, .08, 'square'), 100);
  }

  function checkAchievements() {
    const newlyUnlocked = [];
    for (const achievement of achievements) {
      const current = Number(state.stats[achievement.stat] || 0);
      if (current >= achievement.target && !state.unlockedAchievements.includes(achievement.id)) {
        state.unlockedAchievements.push(achievement.id);
        newlyUnlocked.push(achievement);
      }
    }
    renderAchievements();
    if (newlyUnlocked.length) showAchievementToast(newlyUnlocked[newlyUnlocked.length - 1]);
  }

  function renderAchievements() {
    ui.achievementCount.textContent = `${state.unlockedAchievements.length} / ${achievements.length}`;
    ui.achievementList.innerHTML = achievements.map((achievement) => {
      const current = Math.max(0, Number(state.stats[achievement.stat] || 0));
      const progress = Math.min(current, achievement.target);
      const percent = Math.round((progress / achievement.target) * 100);
      const unlocked = state.unlockedAchievements.includes(achievement.id);
      return `
        <article class="achievement-card ${unlocked ? 'unlocked' : ''}">
          <div class="achievement-icon" aria-hidden="true">${achievement.icon}</div>
          <div class="achievement-info">
            <div class="achievement-name-row">
              <strong>${achievement.name}</strong>
              <span>${unlocked ? 'UNLOCKED' : `${progress}/${achievement.target}`}</span>
            </div>
            <p>${achievement.desc}</p>
            <div class="achievement-progress" aria-hidden="true"><span style="width:${percent}%"></span></div>
          </div>
        </article>`;
    }).join('');
  }

  function makeGameButton(label, actionName) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-btn';
    button.textContent = label;
    button.dataset.gameAction = actionName;
    return button;
  }

  function resetMiniGamePanel(message = 'Pick a game. Elly is extremely confident for someone with no money at stake.') {
    clearTimeout(directionRevealTimer);
    directionRevealTimer = null;
    miniGame = null;
    state.miniFacing = null;
    ui.minigameText.textContent = message;
    ui.minigameDisplay.textContent = '?';
    ui.minigameActions.replaceChildren(ui.higherLowerBtn, ui.directionBtn);
    ui.higherLowerBtn.disabled = state.sleeping;
    ui.directionBtn.disabled = state.sleeping;
  }

  function startHigherLower() {
    if (state.sleeping) {
      resetMiniGamePanel('Elly is asleep. Gambling with a sleeping chihuahua is frowned upon.');
      return;
    }
    const current = randomInt(2, 8);
    miniGame = { type: 'higher-lower', current, active: true };
    ui.minigameText.textContent = 'Will Elly\'s next number be HIGHER or LOWER?';
    ui.minigameDisplay.textContent = String(current);
    const higher = makeGameButton('HIGHER ▲', 'higher');
    const lower = makeGameButton('LOWER ▼', 'lower');
    ui.minigameActions.replaceChildren(higher, lower);
    action('idle', `The number is ${current}. Choose wisely.`, '?', 1700, null);
  }

  function resolveHigherLower(guess) {
    if (!miniGame || miniGame.type !== 'higher-lower' || !miniGame.active) return;
    let next = randomInt(1, 9);
    while (next === miniGame.current) next = randomInt(1, 9);
    const correctDirection = next > miniGame.current ? 'higher' : 'lower';
    const won = guess === correctDirection;
    miniGame.active = false;
    ui.minigameDisplay.textContent = `${miniGame.current} → ${next}`;
    ui.minigameText.textContent = won
      ? `Correct! ${next} was ${correctDirection.toUpperCase()}. Elly is delighted.`
      : `Nope! ${next} was ${correctDirection.toUpperCase()}. Elly has chosen biological retaliation.`;
    finishMiniGame(won);
  }

  function startDirectionGame() {
    if (state.sleeping) {
      resetMiniGamePanel('Elly is asleep and therefore looking approximately nowhere.');
      return;
    }
    miniGame = { type: 'direction', active: true };
    ui.minigameText.textContent = 'Guess which way Elly will look.';
    ui.minigameDisplay.textContent = 'ELLY ↔';
    const left = makeGameButton('← LEFT', 'left');
    const right = makeGameButton('RIGHT →', 'right');
    ui.minigameActions.replaceChildren(left, right);
    action('play', 'Left? Right? Tiny dog secrets.', ';)', 1800, null);
  }

  function resolveDirection(guess) {
    if (!miniGame || miniGame.type !== 'direction' || !miniGame.active) return;
    miniGame.active = false;
    const actual = Math.random() < 0.5 ? 'left' : 'right';
    const won = guess === actual;
    state.miniFacing = actual;
    ui.minigameDisplay.textContent = actual === 'left' ? '← ELLY' : 'ELLY →';
    ui.minigameText.textContent = `Elly looked ${actual.toUpperCase()}!`;
    action('play', `Elly looked ${actual.toUpperCase()}!`, actual === 'left' ? '<-' : '->', 1000, null);
    directionRevealTimer = setTimeout(() => {
      state.miniFacing = null;
      ui.minigameText.textContent = won
        ? 'You guessed it! Elly is impressed by your tiny-dog intuition.'
        : 'Wrong direction. Elly has issued one immediate poop penalty.';
      finishMiniGame(won);
    }, 1050);
  }

  function finishMiniGame(won) {
    const previousType = miniGame ? miniGame.type : 'higher-lower';
    const again = makeGameButton('PLAY AGAIN', 'again');
    const menu = makeGameButton('GAME MENU', 'menu');
    ui.minigameActions.replaceChildren(again, menu);

    if (won) {
      state.stats.minigameWins += 1;
      state.fun = clamp(state.fun + 12);
      state.love = clamp(state.love + 4);
      action('happy', randomOf(['ELLY WINS! Technically you also helped.', 'Victory! Elly has decided you may remain.', 'Correct! Tiny champion mode activated.']), ':D', 2700, 'bounce');
      bleep(720, .05); setTimeout(() => bleep(920, .06), 90); setTimeout(() => bleep(1080, .07), 180);
    } else {
      state.stats.minigameLosses += 1;
      state.poopPresent = true;
      state.poopDueAt = null;
      state.poopSince = Date.now();
      state.clean = clamp(state.clean - 10);
      action('poop', randomOf(['You lost. Elly has left a formal complaint.', 'Incorrect. A poop has appeared. Coincidence? No.', 'Elly loses gracefully. By pooping.']), '> :P', 3000, 'shake');
      bleep(210, .11, 'square');
    }

    miniGame = { type: previousType, active: false };
    checkAchievements();
    saveState(true);
    render();
  }

  function render() {
    const now = Date.now();
    const actionActive = state.actionUntil > now && state.actionSprite;
    const mood = actionActive
      ? { sprite: state.actionSprite, speech: state.actionSpeech, label: 'BUSY', message: state.actionMessage }
      : naturalMood();

    ui.sprite.src = assets[mood.sprite];
    ui.sprite.classList.toggle('sleeping', state.sleeping && !actionActive);
    ui.sprite.classList.toggle('look-left', state.miniFacing === 'left');
    ui.sprite.classList.toggle('look-right', state.miniFacing === 'right');
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
    ui.higherLowerBtn.disabled = state.sleeping;
    ui.directionBtn.disabled = state.sleeping;

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
        resetMiniGamePanel();
        bleep(700, .08);
      }
    } else {
      state.fullness = clamp(state.fullness - 0.028);
      state.fun = clamp(state.fun - 0.020);
      state.clean = clamp(state.clean - (state.poopPresent ? 0.060 : 0.010));
      state.energy = clamp(state.energy - 0.016);
      state.love = clamp(state.love - 0.018);
    }

    const inLaserMode = criticalNeeds().length > 0 && !state.sleeping;
    if (inLaserMode && !state.wasInLaserMode) {
      state.wasInLaserMode = true;
      state.stats.laserEncounters += 1;
      checkAchievements();
    } else if (!inLaserMode) {
      state.wasInLaserMode = false;
    }

    if (inLaserMode && now > state.rageCooldownUntil) {
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
    state.stats.nuggetsFed += 1;
    if (!state.poopPresent && !state.poopDueAt) state.poopDueAt = Date.now() + 7000 + Math.random() * 5000;
    action('eat', 'CRONCH. Elly has accepted one premium chicken nugget.', ':D', 2600, 'bounce');
    bleep(620, .06); setTimeout(() => bleep(760, .05), 90);
    checkAchievements();
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
    state.stats.playSessions += 1;
    action('play', 'ZOOMIES ACTIVATED.', ':D', 2500, 'bounce');
    bleep(700, .05); setTimeout(() => bleep(860, .05), 80); setTimeout(() => bleep(980, .05), 160);
    checkAchievements();
    saveState(true);
  });

  ui.petBtn.addEventListener('click', () => {
    if (state.sleeping) return;
    state.love = clamp(state.love + 24);
    state.fun = clamp(state.fun + 6);
    state.stats.petsGiven += 1;
    action('pet', randomOf(['Elly leans directly into your hand.', 'The tiny ears have accepted scritches.', 'You have successfully pet the dog.']), randomOf(['<3', ';)', ':D']), 2300, 'bounce');
    bleep(820, .06, 'sine');
    checkAchievements();
    saveState(true);
  });

  ui.showerBtn.addEventListener('click', () => {
    if (state.sleeping) return;
    state.clean = 100;
    state.fun = clamp(state.fun - 4);
    state.stats.showers += 1;
    action('clean', 'Squeaky clean. Mildly offended. Very fluffy.', '> :P', 2900, 'shake');
    bleep(560, .05); setTimeout(() => bleep(610, .05), 90);
    checkAchievements();
    saveState(true);
  });

  ui.sleepBtn.addEventListener('click', () => {
    const startingNap = !state.sleeping;
    state.sleeping = !state.sleeping;
    state.actionUntil = 0;
    state.actionSprite = null;
    if (state.sleeping) {
      state.lastInteraction = Date.now();
      if (startingNap) state.stats.napsStarted += 1;
      resetMiniGamePanel('Elly is sleeping. The arcade will reopen after nap time.');
      bleep(330, .08, 'sine');
    } else {
      action('happy', 'Elly is awake again.', ':D', 1800, 'bounce');
      resetMiniGamePanel();
      bleep(690, .06);
    }
    checkAchievements();
    saveState(true);
    render();
  });

  ui.cleanPoopBtn.addEventListener('click', () => {
    if (!state.poopPresent || state.sleeping) return;
    state.poopPresent = false;
    state.poopSince = null;
    state.clean = clamp(state.clean + 8);
    state.love = clamp(state.love + 3);
    state.stats.poopsPicked += 1;
    action('happy', 'Poop removed. Elly denies all involvement.', ';)', 2400, 'bounce');
    bleep(520, .06); setTimeout(() => bleep(720, .06), 100);
    checkAchievements();
    saveState(true);
  });

  ui.higherLowerBtn.addEventListener('click', startHigherLower);
  ui.directionBtn.addEventListener('click', startDirectionGame);

  ui.minigameActions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-game-action]');
    if (!button) return;
    const command = button.dataset.gameAction;
    if (command === 'higher' || command === 'lower') resolveHigherLower(command);
    else if (command === 'left' || command === 'right') resolveDirection(command);
    else if (command === 'again') {
      if (miniGame && miniGame.type === 'direction') startDirectionGame();
      else startHigherLower();
    } else if (command === 'menu') resetMiniGamePanel();
  });

  ui.soundBtn.addEventListener('click', () => {
    state.sound = !state.sound;
    if (state.sound) bleep(680, .06);
    saveState(true);
    render();
  });

  ui.resetBtn.addEventListener('click', () => {
    const ok = window.confirm('Reset Elly back to a fresh new game? This also clears achievements.');
    if (!ok) return;
    clearTimeout(directionRevealTimer);
    miniGame = null;
    state = defaultState();
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    resetMiniGamePanel();
    action('happy', 'Fresh start! Elly has forgotten all previous crimes and trophies.', ':D', 2600, 'bounce');
    renderAchievements();
    saveState(true);
  });

  window.addEventListener('beforeunload', () => saveState(false));

  checkAchievements();
  resetMiniGamePanel();
  render();
  setInterval(tick, TICK_MS);
})();
