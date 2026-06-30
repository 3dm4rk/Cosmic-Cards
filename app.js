/* Premium Gacha — split files + LocalStorage
   - Shop sells packs (rarity-based)
   - Inventory stores packs (counts)
   - Opening packs gives CARDS ONLY (NO GOLD)
   - Cards modal shows your owned cards
*/

const LS_KEY_BASE = "gotcha_state_v1";
function getUserStorageKey(){
  try{
    const u = (window.__USER__||{});
    const id = u.id ?? u.user_id ?? null;
    if (id !== null && id !== undefined && String(id).trim() !== "") return `${LS_KEY_BASE}_uid_${id}`;
    if (u.username) return `${LS_KEY_BASE}_u_${String(u.username).toLowerCase()}`;
  }catch(_){ }
  return LS_KEY_BASE;
}
const LS_KEY = getUserStorageKey();
const HOWTO_LS_KEY = "cc_howtoplay_seen_v1";

/* ===============================
   SOUND EFFECTS + MUSIC SYSTEM
   - BGM loops: sfx/bg-music.mp3
   - General click: sfx/click.mp3
   - Purchase: sfx/purchase.mp3
   - Tower collect: sfx/earn-gold.mp3
   - Passive/ability gold: sfx/ability-gold.mp3
   - Card opening (Inventory + Lucky Draw): sfx/opening-card.mp3
   =============================== */
const AudioSystem = (() => {
  const safeAudio = (src) => {
    const a = new Audio(src);
    a.preload = "auto";
    return a;
  };

  const sys = {
    bgm: safeAudio("sfx/bg-music.mp3"),
    click: safeAudio("sfx/click.mp3"),
    purchase: safeAudio("sfx/purchase.mp3"),
    tower: safeAudio("sfx/earn-gold.mp3"),
    ability: safeAudio("sfx/ability-gold.mp3"),
    openCard: safeAudio("sfx/opening-card.mp3"),
    strike: safeAudio("sfx/strike.mp3"),
    initialized: false,
    _bgmStarted: false,

    init() {
      if (this.initialized) return;
      this.initialized = true;

      this.bgm.loop = true;
      this.bgm.volume = 0.35;

      const startBgmOnce = () => {
        if (this._bgmStarted) return;
        this._bgmStarted = true;
        this.bgm.play().catch(() => {});
      };

      // Autoplay-safe: start on first user gesture
      window.addEventListener("pointerdown", startBgmOnce, { once: true });
      window.addEventListener("keydown", startBgmOnce, { once: true });
    },

    play(aud) {
      if (!aud) return;
      try {
        aud.currentTime = 0;
        aud.play().catch(() => {});
      } catch (_) {}
    }
  };

  return sys;
})();
AudioSystem.init();

/* ===============================
   ANTI-RIGHT-CLICK / ANTI-LONG-PRESS (Light deterrent)
   - Desktop: blocks right-click context menu
   - Mobile: blocks long-press callout on interactive elements without breaking scroll
   NOTE: This does NOT provide real security (source can still be viewed). It's just UX.
   =============================== */
function setupAntiCheeseUX(){
  // 1) Block context menu (desktop + many mobile browsers)
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  }, { capture:true });

  // 2) Prevent dragging images/cards (stops "save image" drag on desktop)
  document.addEventListener("dragstart", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.tagName === "IMG" || t.closest?.("img") || t.closest?.(".card,.cardThumb,.rewardTile,.slot,.deckCard,.deckPickItem")){
      e.preventDefault();
    }
  }, { capture:true });

  // 3) Mobile long-press suppression (only on interactive targets; keep scrolling usable)
  let lpTimer = null;
  let startX = 0, startY = 0;
  let active = false;

  const cancel = () => {
    active = false;
    if (lpTimer){ clearTimeout(lpTimer); lpTimer = null; }
  };

  const isInteractiveTarget = (target) => {
    if (!target) return false;
    return !!target.closest?.("button,[role='button'],.clickable,.card,.cardThumb,.rewardTile,.slot,.deckSlot,.deckCard,.deckPickItem,img");
  };

  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    if (!isInteractiveTarget(e.target)) return;

    active = true;
    startX = e.clientX;
    startY = e.clientY;

    lpTimer = setTimeout(() => {
      if (!active) return;
      try { e.preventDefault(); } catch(_){}
      try { e.stopPropagation(); } catch(_){}
    }, 420);
  }, { passive:false, capture:true });

  document.addEventListener("pointermove", (e) => {
    if (!active) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > 10 || dy > 10) cancel();
  }, { passive:true, capture:true });

  document.addEventListener("pointerup", cancel, { passive:true, capture:true });
  document.addEventListener("pointercancel", cancel, { passive:true, capture:true });
}
// Detect hoverless touch devices (mobile/tablet). Used to switch hover UI to long-press on touch.
const IS_HOVERLESS_TOUCH = (() => {
  try { return window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches; }
  catch(_) { return false; }
})();

function setupMobileHoverReplacements(){
  if (!IS_HOVERLESS_TOUCH) return;

  // Tower hover tooltip -> long-press (hold)
  const towerWrap = document.getElementById("openGoldPanel");
  const towerTip  = document.getElementById("towerTooltip");
  if (towerWrap && towerTip){
    const show = () => {
      towerWrap.classList.add("lpShow");
      towerTip.setAttribute("aria-hidden","false");
    };
    const hide = () => {
      towerWrap.classList.remove("lpShow");
      towerTip.setAttribute("aria-hidden","true");
    };
    bindLongPressHold(towerWrap, show, hide);
  }

  // Weather hover tooltip -> long-press (hold)
  const wChip = document.getElementById("weatherChip");
  const wTip  = document.getElementById("weatherTooltip");
  if (wChip && wTip){
    const show = () => {
      wChip.classList.add("lpShow");
      wTip.setAttribute("aria-hidden","false");
      weatherTipPinned = true; // long-press pins (better on touch)
      showWeatherTooltipPortal();
    };
    const hide = () => {
      wChip.classList.remove("lpShow");
      wTip.setAttribute("aria-hidden","true");
      weatherTipPinned = false;
      hideWeatherTooltipPortal();
    };
    bindLongPressHold(wChip, show, hide);
  }
}

setupAntiCheeseUX();
setupMobileHoverReplacements();

// Dedicated SFX helpers (call these inside logic)
function playClickSFX(){ AudioSystem.play(AudioSystem.click); }
function playPurchaseSFX(){ AudioSystem.play(AudioSystem.purchase); }
function playTowerGoldSFX(){ AudioSystem.play(AudioSystem.tower); }
function playAbilityGoldSFX(){ AudioSystem.play(AudioSystem.ability); }
function playCardOpeningSFX(){ AudioSystem.play(AudioSystem.openCard); }

// Global click SFX (all clickable UI), except elements flagged with data-sfx
document.addEventListener("click", (e) => {
  const el = e.target && e.target.closest && e.target.closest("button,[role='button'],.clickable,.card,.slot,.deckSlot,.deckCard");
  if (!el) return;

  const flagged = el.closest("[data-sfx]"); // purchase/tower/open-card/etc
  if (flagged) return;

  playClickSFX();
}, true);

// ======================== 🔥 PERFORMANCE: UNIFIED ANIMATION MANAGER ========================
const FrameAnimationManager = {
  _items: new Map(),      // key: imgElement, value: { frames, currentIdx, interval, lastFrameTime }
  _rafId: null,
  _lastTimestamp: 0,

  // Start or update an animation for an image
  animate(img, frames, interval = 150) {
    if (!img || !frames?.length) return;
    // If already animating, update the frames/interval
    const existing = this._items.get(img);
    if (existing) {
      existing.frames = frames;
      existing.interval = interval;
      existing.currentIdx = 0;
      existing.lastFrameTime = 0;
      return;
    }
    this._items.set(img, {
      frames,
      currentIdx: 0,
      interval,
      lastFrameTime: 0,
    });
    this._startLoop();
  },

  // Stop animation for a specific image
  stop(img) {
    if (this._items.has(img)) {
      this._items.delete(img);
      if (this._items.size === 0) this._stopLoop();
    }
  },

  // Stop all animations (e.g., when modal closes)
  stopAll() {
    this._items.clear();
    this._stopLoop();
  },

  _startLoop() {
    if (this._rafId) return;
    this._lastTimestamp = performance.now();
    this._rafId = requestAnimationFrame((now) => this._tick(now));
  },

  _stopLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  },

  _tick(now) {
    const delta = now - this._lastTimestamp;
    this._lastTimestamp = now;

    // Update each animated image
    for (const [img, data] of this._items) {
      // If image is detached or not visible, skip updating (but keep it in the map)
      if (!img.isConnected) continue;

      data.lastFrameTime += delta;
      if (data.lastFrameTime >= data.interval) {
        data.lastFrameTime = 0;
        data.currentIdx = (data.currentIdx + 1) % data.frames.length;
        img.src = data.frames[data.currentIdx];
      }
    }

    // Continue loop only if there are active animations
    if (this._items.size > 0) {
      this._rafId = requestAnimationFrame((now) => this._tick(now));
    } else {
      this._rafId = null;
    }
  },
};
// ======================== END ANIMATION MANAGER ========================

// 🔥 PERFORMANCE: UI update batching
let _uiDirty = false;

function requestUIUpdate() {
  if (_uiDirty) return;
  _uiDirty = true;
  requestAnimationFrame(() => {
    _uiDirty = false;
    if (document.hidden) return; // skip if tab is hidden
    performUIUpdate();
  });
}

function performUIUpdate() {
  // This contains all the work that was in syncUINow()
  updateGoldUI();
  try{ applyProfileTheme(); }catch(_){ }
  try{ if (profileNameEl) profileNameEl.textContent = getCurrentUsername(); }catch(_){ }
  try{ const a = state?.profile?.avatar || 'profile/profile.png'; if (profileAvatarImg) profileAvatarImg.src = a; }catch(_){ }
  renderInventory();
  updateCardsBadge();
  updatePetsBadge();
  updateTowersUI();
  buildSlots();
  syncSummonerHeroUI();
  updateWeatherUI();
  updateNotificationsBadges();
  try{ valUpdateHeaderChips(); }catch(_){ }
}

// Legacy syncUI now uses batching
function syncUI(){
  requestUIUpdate();
}

// For immediate updates after user actions, we can still call performUIUpdate directly
// but most cases can use requestUIUpdate.

const RARITIES = [
  {k:"common",      w:60,  price:2000},
  {k:"rare",        w:40,  price:3500},
  {k:"epic",        w:15,  price:5000},
  {k:"mythical",    w:3,  price:10000},
  {k:"legendary",   w:10,   price:8500},
  {k:"cosmic",      w:1,   price:25000},
  {k:"interstellar",w:0.5, price:1000000},
  {k:"dragon",      w:0.2, price:500000000},
  {k:"cny",      w:0.2, price:900000000},
];
const totalW = RARITIES.reduce((a,r)=>a+r.w,0);

// Admin Shop Lock support (includes Dragon rarity)
function getLockedOrRolledRarity(){
  try{
    const lock = state?.adminShopLock;
    if (lock && CARD_REWARDS && CARD_REWARDS[lock]) return lock;
  }catch(_){}
  let roll = Math.random() * totalW;
  for (const r of RARITIES){
    roll -= r.w;
    if (roll <= 0) return r.k;
  }
  return "common";
}

// 🔥 ANIMATION: helper to generate frame paths for a given folder and count
function getFrames(folder, count) {
  const frames = [];
  for (let i = 1; i <= count; i++) {
    frames.push(`${folder}/frame${i}.png`);
  }
  return frames;
}

// 👇 add dre ang mga cards na butangan og animation sa deck slot
function ensureCardAnimationData(card) {
  if (!card) return;
  const name = card.name;
  if (name === "Yrol") {
    const base = CARD_REWARDS.legendary?.find(c => c.name === "Yrol");
    if (base) {
      card.animated = true;
      card.frames = base.frames || getFrames("frame-animation/yrol", 4);
      card.frameInterval = base.frameInterval || 50;
      if (card.img && !card.img.includes("frame")) {
        card.img = base.img || "frame-animation/yrol/frame1.png";
      }
    }
  } else if (name === "Portia the God of Love") {
    const base = CARD_REWARDS["limited edition"]?.find(c => c.name === "Portia the God of Love");
    if (base) {
      card.animated = true;
      card.frames = base.frames || getFrames("frame-animation/portia", 12);
      card.frameInterval = base.frameInterval || 10;
      if (card.img && !card.img.includes("frame")) {
        card.img = base.img || "frame-animation/portia/frame1.png";
      }
    }
  }else if (name === "Anti Matter") {
    const base = CARD_REWARDS.cosmic?.find(c => c.name === "Anti Matter");
    if (base) {
      card.animated = true;
      card.frames = base.frames || getFrames("frame-animation/am", 4);
      card.frameInterval = base.frameInterval || 150;
      if (card.img && !card.img.includes("frame")) {
        card.img = base.img || "frame-animation/am/frame1.png";
      }
    }
  }else if (name === "3dm4rk") {
    const base = CARD_REWARDS.epic?.find(c => c.name === "3dm4rk");
    if (base) {
      card.animated = true;
      card.frames = base.frames || getFrames("frame-animation/3dm4rk", 4);
      card.frameInterval = base.frameInterval || 150;
      if (card.img && !card.img.includes("frame")) {
        card.img = base.img || "frame-animation/3dm4rk/frame1.png";
      }
    }
  }else if (name === "Abarskie") {
    const base = CARD_REWARDS.legendary?.find(c => c.name === "Abarskie");
    if (base) {
      card.animated = true;
      card.frames = base.frames || getFrames("frame-animation/Abarskie", 7);
      card.frameInterval = base.frameInterval || 150;
      if (card.img && !card.img.includes("frame")) {
        card.img = base.img || "frame-animation/Abarskie/frame1.png";
      }
    }
  }else if (name === "LeiRality") {
    const base = CARD_REWARDS.legendary?.find(c => c.name === "LeiRality");
    if (base) {
      card.animated = true;
      card.frames = base.frames || getFrames("frame-animation/leirality", 5);
      card.frameInterval = base.frameInterval || 150;
      if (card.img && !card.img.includes("frame")) {
        card.img = base.img || "frame-animation/leirality/frame1.png";
      }
    }
  }
}

const CARD_REWARDS = {
  common: [
    { name:"Daysi", img:"cards/daysi.png", w:25 },
    { name:"Patrick the Destroyer", img:"cards/patrick-the-destroyer.png", w:10 },
    { name:"Angelo", img:"cards/angelo.png", w:50 },
    { name:"Lucky Cat", img:"cards/lucky-cat.png", w:50 },
    { name:"Space Patrol", img:"cards/space-patrol.png", w:50 }
  ],
  rare: [
    { name:"Baltrio", img:"cards/baltrio.png", w:50 },
    { name:"Nebula Gunslinger", img:"cards/nebula-gunslinger.png", w:20 },
    { name:"Nova Empress", img:"cards/nova-empress.png", w:20 },
    { name:"Celestial Priestess", img:"cards/celestial-priestess.png", w:50 },
    { name:"Dr. Nemesis", img:"cards/dr-nemesis.png", w:0.7 },
    { name:"Otehnsahorse", img:"cards/ohtensahorse.png", w:10 }
  ],
  epic: [
    { name:"3dm4rk", img:"cards/3dm4rk.png", w:5, animated: true, frames: getFrames("frame-animation/3dm4rk", 4), frameInterval: 150 },
    { name:"Tremo", img:"cards/tremo.png", w:20 },
    { name:"Holly Child", img:"cards/holly-child.png", w:20 },
    { name:"Ey-Ji-Es", img:"cards/eyjies.png", w:10 },
    { name:"Stakes Staker", img:"cards/stakesStaker.png", w:5 },
    { name:"Diablo", img:"cards/diablo.png", w:50 },
    { name:"Spidigong", img:"cards/spidigong.png", w:1 }
  ],
  mythical: [
    { name:"Halaka", img:"cards/halaka1.png", w:50 },
    { name:"Void Samurai", img:"cards/void-samurai.png", w:20 },
    { name:"Space Duelist", img:"cards/space-duelist.png", w:1 },
    { name:"Void Chronomancer", img:"cards/void-chronomancer.png", w:40 },
    { name:"Starbreaker Null King", img:"cards/start-breaker-null-king.png", w:5 },
    { name:"Astro Witch", img:"cards/astro-witch.png", w:60 }
  ],
  legendary: [
    { name:"Yrol", img:"cards/yrol.png", w:5, animated: true, frames: getFrames("frame-animation/yrol", 4), frameInterval: 50 },
    { name:"Zukinimato", img:"cards/zukinimato1.png", w:60 },
    { name:"Abarskie", img:"cards/abarskie.png", w:5, animated: true, frames: getFrames("frame-animation/Abarskie", 7), frameInterval: 150 },
    { name:"LeiRality", img:"cards/LeiRality.png", w:1, animated: true, frames: getFrames("frame-animation/leirality", 5), frameInterval: 150 },
    { name:"621", img:"cards/621.png", w:40 },
    { name:"Alric", img:"cards/alric.png", w:8 }
  ],
  cosmic: [
    { name:"Omni", img:"cards/omni.png", w:0.1 },
    { name:"Entity", img:"cards/entity.png", w:5 },
    { name:"Awakened Monster", img:"cards/am.png", w:1 },
    { name:"Anti Matter", img:"cards/anti-matter.png", w:4, animated: true, frames: getFrames("frame-animation/am", 4), frameInterval: 150 },
    { name:"Rah Bill", img:"cards/rah-bill.png", w:60 },
    { name:"Cosmo Revelation", img:"cards/cm.png", w:0.5 },
    { name:"Cosmic God", img:"cards/cosmic-god.png", w:10 }
  ],
  interstellar: [
    { name:"Joe", img:"cards/joe.png", w:60 },
    { name:"Meowl", img:"cards/meowl.png", w:0.2 },
    { name:"Emerald Emperor", img:"cards/ee.png", w:0.1 },
    { name:"Skwikik", img:"cards/skwikik.png", w:40 },
    { name:"Space Hen", img:"cards/spacehen.png", w:50 }
  ],
  valentines: [
    { name:"Chibi",   img:"cards/chibi.png",   w:600, chance:60,   gps:150 },
    { name:"Lucia",   img:"cards/lucia.png",   w:400, chance:40,   gps:450 },
    { name:"Darvie",  img:"cards/darvie.png",  w:9,   chance:0.9,  gps:70000 },
    { name:"Ivy",     img:"cards/ivy.png",     w:10,  chance:1.0,  gps:50000 },
    { name:"Luke",    img:"cards/luke.png",    w:0.5,   chance:0.5,  gps:80000 },
    { name:"Omnight", img:"cards/omnight.png", w:0.1,   chance:0.1,  gps:100000 }
  ],
  "limited edition": [
    { name:"Portia the God of Love", img:"cards/portia.png", w:1, chance:0, gps:500000, animated: true, frames: getFrames("frame-animation/portia", 12), frameInterval: 40 }
  ],
  dragon: [
    { name:"Ai",          img:"cards/ai.png",           w:0.1 },
    { name:"Neo",         img:"cards/neo.png",          w:0.5 },
    { name:"Wix",         img:"cards/wix.png",          w:5 },
    { name:"Emre",        img:"cards/emre.png",         w:2 },
    { name:"Paladin",     img:"cards/paladin.png",      w:0.2 },
    { name:"Draco",       img:"cards/draco.png",        w:1 },
    { name:"Zukinimato6", img:"cards/zukinimato6.png",  w:0.3 },
    { name:"Zukinimato2", img:"cards/zukinimato2.png",  w:60 },
    { name:"Zukinimato4", img:"cards/zukinimato4.png",  w:30 }
  ],
  cny: [
    { name:"Nian",        img:"cards/nian.png",         w:1 },
    { name:"Azure Dragon",     img:"cards/azure.png",      w:0.1 },
    { name:"Long",       img:"cards/long.png",        w:0.2 },
    { name:"Fire God DRagon", img:"cards/fdg.png",  w:2 },
    { name:"Shin", img:"cards/shin.png",  w:60 },
    { name:"Xiao", img:"cards/xiao.png",  w:30 }
  ]
};

// === FIXED Gold per Second per Card (balanced + predictable) ===
const CARD_GPS = {
  "Daysi": 11,
  "Patrick the Destroyer": 90,
  "Angelo": 12,
  "Lucky Cat": 12,
  "Space Patrol": 8,
  "Baltrio": 15,
  "Nebula Gunslinger": 100,
  "Nova Empress": 17,
  "Celestial Priestess": 16,
  "Dr. Nemesis": 1000,
  "Otehnsahorse": 12,
  "Phantom Thief": 30,
  "3dm4rk": 120,
  "Tremo": 25,
  "Holly Child": 25,
  "Ey-Ji-Es": 27,
  "Stakes Staker": 30,
  "Diablo": 24,
  "Spidigong": 500,
  "Slime King": 120,
  "Halaka": 30,
  "Void Samurai": 110,
  "Space Duelist": 1800,
  "Void Chronomancer": 60,
  "Starbreaker Null King": 400,
  "Astro Witch": 35,
  "Yrol": 400,
  "Zukinimato": 45,
  "Abarskie": 400,
  "LeiRality": 1500,
  "621": 60,
  "Alric": 250,
  "Omni": 5000,
  "Entity": 800,
  "Awakened Monster": 2500,
  "Anti Matter": 3500,
  "Rah Bill": 500,
  "Cosmo Revelation": 4500,
  "Cosmic God": 550,
  "The World": 1500,
  "Joe": 200,
  "Meowl": 100000,
  "Emerald Emperor": 200000,
  "Skwikik": 250,
  "Space Hen": 150,
  "Chibi": 150,
  "Lucia": 450,
  "Darvie": 70000,
  "Ivy": 50000,
  "Luke": 80000,
  "Omnight": 100000,
  "Portia the God of Love": 500000,
  "Ai": 200,
  "Neo": 175000,
  "Wix": 75000,
  "Emre": 90000,
  "Paladin": 180000,
  "Draco": 85000,
  "Zukinimato6": 120000,
  "Zukinimato2": 5000,
  "Zukinimato4": 6000,
  "Azure Dragon": 1000000,
  "Nian": 2500,
  "Long": 100000,
  "Fire God DRagon": 1000,
  "Shin": 500,
  "Xiao": 250
};

const RARITY_GPS_MULT = {
  common: 1,
  rare: 2,
  epic: 3,
  mythical: 4,
  legendary: 6,
  cosmic: 10,
  valentines: 12,
  interstellar: 15,
  dragon: 18,
  cny: 12
};

const MUTATIONS = [
  { k: "Normal",   chance: 0.695, mult: 1.0 },
  { k: "Silver",   chance: 0.10,  mult: 1.3 },
  { k: "Gold",     chance: 0.05,  mult: 2.0 },
  { k: "Diamond",  chance: 0.03,  mult: 3.0 },
  { k: "Rainbow",  chance: 0.01,  mult: 5.0 },
  { k: "Neon",     chance: 0.009, mult: 8.0 },
  { k: "Galactic", chance: 0.005, mult: 10.0 },
];

/* ================= Weather System (stateful events) =================
   - Rolls every 5 minutes (no extra cooldown after an event)
   - Special events last 30s with 3 strike attempts (every 10s)
   - Strikes can add STACKABLE mutations (unique per mutation key)
*/
const WEATHER_EVENT_INTERVAL_MS = 5 * 60 * 1000;
const WEATHER_EVENT_DURATION_MS = 90 * 1000; // 1m30s
const WEATHER_STRIKE_INTERVAL_MS = 10 * 1000;
const WEATHER_STRIKE_ATTEMPTS = 9; // every 10s for 1m30s
const WEATHER_STRIKE_CHANCE = 0.10;

const WEATHER_TABLE = [
  { key:"normal",      name:"Normal Weather", icon:"☀", chance:60, special:false },
  { key:"spacestorm",  name:"Space Storm",    icon:"🌩", chance:40, special:true, mutation:"Thunder",  mult:2 },
  { key:"antigravity", name:"Anti-Gravity",   icon:"🪐", chance:25,  special:true, mutation:"Blackhole", mult:3 },
  { key:"ascension",   name:"Ascension",      icon:"✨", chance:15,  special:true, mutation:"Godly",    mult:4 },
  { key:"multiverse",  name:"Multiverse",     icon:"🌌", chance:1,  special:true, mutation:"Heavenly", mult:5 },
  { key:"cupid",      name:"Cupid",          icon:"💘", chance:11, special:true, mutation:"Love",      mult:3 },
  { key:"bloodmoon",  name:"Blood Moon",     icon:"🌑", chance:20, special:true, mutation:"BloodMoon", mult:2 },
  { key:"solarflare", name:"Solar Flare",    icon:"☀️", chance:10, special:true, mutation:"SolarFlare", mult:6 },
  { key:"eclipse",    name:"Eclipse",        icon:"🌘", chance:4,  special:true, mutation:"Eclipse",   mult:7 },
  { key:"secret",     name:"Secret",         icon:"🕳️", chance:1,  special:true, mutation:"Secret",    mult:10 },
];

const MUTATION_MULTS = {
  normal: 1.0,
  silver: 1.3,
  gold: 2.0,
  diamond: 3.0,
  rainbow: 5.0,
  neon: 8.0,
  galactic: 10.0,
  thunder: 2.0,
  blackhole: 3.0,
  godly: 4.0,
  heavenly: 5.0,
  love: 3.0,
  bloodmoon: 2.0,
  solarflare: 6.0,
  eclipse: 7.0,
  secret: 10.0,
};

const auraVarByRarity = {
  common:   "var(--common)",
  rare:     "var(--rare)",
  epic:     "var(--epic)",
  mythical: "var(--mythical)",
  legendary:"var(--legendary)",
  cosmic:   "var(--cosmic)",
  interstellar: "var(--interstellar)",
  dragon: "var(--dragon)",
  cny: "var(--cny)"
};

const invOrder = ["limited edition","dragon","interstellar","valentines","cny","cosmic","legendary","mythical","epic","rare","common"];

/* ================= STATE (persisted) ================= */
if (window.__FRESH_LOGIN__){
  try{
    localStorage.removeItem(LS_KEY_BASE);
    try{ localStorage.removeItem(LS_KEY); }catch(__){}
  }catch(_){ }
}
let state = loadState();
ensureDecks();
ensureTowers();
ensureWeather();
ensureNotifications();
migrateCards();
ensureAdmin();
ensureProfile();

forceHeaderProfileAvatar();
try{ setupProfileCosmeticButtons(); }catch(_){ }
if (!state.profile) state.profile = {};
if (!state.profile.cosmetics) state.profile.cosmetics = {};
if (!Array.isArray(state.profile.cosmetics.ownedFrames)) state.profile.cosmetics.ownedFrames = ["default"];
if (!Array.isArray(state.profile.cosmetics.ownedTitles)) state.profile.cosmetics.ownedTitles = [];
if (!Array.isArray(state.profile.cosmetics.ownedAuras)) state.profile.cosmetics.ownedAuras = ["none"];
if (!state.profile.cosmetics.frame) state.profile.cosmetics.frame = "default";
if (state.profile.cosmetics.title === undefined) state.profile.cosmetics.title = null;
if (!state.profile.cosmetics.aura) state.profile.cosmetics.aura = "none";

if (!Number.isFinite(Number(state.lastBroadcastId))) state.lastBroadcastId = 0;
if (state.adminShopLock === undefined) state.adminShopLock = null;
ensureDeckSlotPurchases();
ensureDeckCardLocations();
if (!state.summoners || typeof state.summoners !== 'object') state.summoners = {selectedId:'3dm4rk', owned:['3dm4rk'], levels:{'3dm4rk':1}, nextBonusAt: Date.now()+15000, nextZenoAt: Date.now()+60000};
if (!Number.isFinite(state.summoners.nextBonusAt)) state.summoners.nextBonusAt = Date.now()+15000;
if (!Number.isFinite(state.summoners.nextZenoAt)) state.summoners.nextZenoAt = Date.now()+60000;

/* ================= DOM ================= */
const track = document.getElementById("track");
const goldEl = document.getElementById("gold");
const diamondEl = document.getElementById("diamond");
const goldPlusBtn = document.getElementById("goldPlusBtn");
const diamondPlusBtn = document.getElementById("diamondPlusBtn");
const openGalleryBtn = document.getElementById("openGalleryBtn");
const galleryOverlay = document.getElementById("galleryOverlay");
const galleryGrid = document.getElementById("galleryGrid");
const gallerySearch = document.getElementById("gallerySearch");
const galleryEmpty = document.getElementById("galleryEmpty");
const galleryCount = document.getElementById("galleryCount");
const closeGalleryBtn = document.getElementById("closeGalleryBtn");
const galleryTabs = document.getElementById("galleryTabs");

const heroImg = document.querySelector(".heroImg");

const openInvBtn = document.getElementById("openInvBtn");
const invBadge = document.getElementById("invBadge");
const invOverlay = document.getElementById("invOverlay");
const invModalGrid = document.getElementById("invModalGrid");
const invModalEmpty = document.getElementById("invModalEmpty");
const invTotalEl = document.getElementById("invTotal");
const invOkBtn = document.getElementById("invOkBtn");
const closeInvBtn = document.getElementById("closeInvBtn");

const giftSendOverlay = document.getElementById("giftSendOverlay");
const closeGiftSendBtn = document.getElementById("closeGiftSendBtn");
const giftReceiverInput = document.getElementById("giftReceiverInput");
const giftPreviewCard = document.getElementById("giftPreviewCard");
const giftSendBtn = document.getElementById("giftSendBtn");

let giftSelectedCardId = null;

const openHowToBtn = document.getElementById("openHowToBtn");
const howtoOverlay = document.getElementById("howtoOverlay");
const closeHowToBtn = document.getElementById("closeHowToBtn");
const howtoTabs = document.getElementById("howtoTabs");
const howtoStepTitle = document.getElementById("howtoStepTitle");
const howtoDots = document.getElementById("howtoDots");
const howtoContent = document.getElementById("howtoContent");
const howtoBackBtn = document.getElementById("howtoBackBtn");
const howtoNextBtn = document.getElementById("howtoNextBtn");
const howtoDontShow = document.getElementById("howtoDontShow");

const openCardsBtn = document.getElementById("openCardsBtn");
const cardsBadge = document.getElementById("cardsBadge");

const weatherWrap = document.getElementById("weatherWrap");
const weatherChip = document.getElementById("weatherChip");
const weatherIconBox = document.getElementById("weatherIconBox");
const weatherIcon = document.getElementById("weatherIcon");
const weatherTimer = document.getElementById("weatherTimer");
const weatherCountdownText = document.getElementById("weatherCountdownText");
const weatherTooltip = document.getElementById("weatherTooltip");
const weatherTicker = document.getElementById("weatherTicker");

let weatherTipPinned = false;
let weatherTipPortal = null;
let weatherTipHideTimer = null;

function ensureWeatherTooltipPortal(){
  if (weatherTipPortal) return weatherTipPortal;
  const el = document.createElement("div");
  el.id = "weatherTooltipPortal";
  el.className = "weatherTooltipPortal";
  el.setAttribute("role","tooltip");
  el.setAttribute("aria-hidden","true");
  document.body.appendChild(el);
  weatherTipPortal = el;

  if (el) el.addEventListener("mouseenter", ()=>{
    if (weatherTipHideTimer){ clearTimeout(weatherTipHideTimer); weatherTipHideTimer=null; }
  });
  if (el) el.addEventListener("mouseleave", ()=>{
    if (!weatherTipPinned) hideWeatherTooltipPortal();
  });
  if (el) el.addEventListener("click",(e)=>{ e.stopPropagation(); });
  return el;
}

function positionWeatherTooltipPortal(){
  if (!weatherChip) return;
  const p = ensureWeatherTooltipPortal();
  const r = weatherChip.getBoundingClientRect();
  const pad = 10;

  p.style.left = "0px";
  p.style.top = "0px";
  p.classList.add("show");
  const w = p.getBoundingClientRect().width || 340;
  const ph = p.getBoundingClientRect().height || 140;
  const vh = window.innerHeight || 800;
  const vw = window.innerWidth || 1200;

  let top = r.bottom + pad;
  if (top + ph > vh - pad){
    top = Math.max(pad, r.top - pad - ph);
  }
  let left = Math.min(vw - pad - w, Math.max(pad, r.right - w));
  p.style.top = `${Math.round(top)}px`;
  p.style.left = `${Math.round(left)}px`;
}

function showWeatherTooltipPortal(){
  if (!weatherChip || !weatherTooltip) return;
  const p = ensureWeatherTooltipPortal();
  p.innerHTML = weatherTooltip.innerHTML || "";
  p.classList.add("show");
  p.setAttribute("aria-hidden","false");
  positionWeatherTooltipPortal();
}

function hideWeatherTooltipPortal(){
  if (!weatherTipPortal) return;
  weatherTipPortal.classList.remove("show");
  weatherTipPortal.setAttribute("aria-hidden","true");
}

function refreshWeatherTooltipPortalIfOpen(){
  if (weatherTipPortal && weatherTipPortal.classList.contains("show")){
    showWeatherTooltipPortal();
  }
}

if (weatherChip && weatherTooltip){
  if (weatherChip) weatherChip.addEventListener("mouseenter", ()=>{
    if (weatherTipHideTimer){ clearTimeout(weatherTipHideTimer); weatherTipHideTimer=null; }
    if (!weatherTipPinned) showWeatherTooltipPortal();
  });
  if (weatherChip) weatherChip.addEventListener("mouseleave", ()=>{
    if (weatherTipPinned) return;
    if (weatherTipHideTimer) clearTimeout(weatherTipHideTimer);
    weatherTipHideTimer = setTimeout(()=>hideWeatherTooltipPortal(), 120);
  });

  if (weatherChip) weatherChip.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    weatherTipPinned = !weatherTipPinned;
    if (weatherTipPinned){
      showWeatherTooltipPortal();
    }else{
      hideWeatherTooltipPortal();
    }
  });

  if (weatherChip) weatherChip.addEventListener("focus", ()=>{ showWeatherTooltipPortal(); });
  if (weatherChip) weatherChip.addEventListener("blur", ()=>{ if (!weatherTipPinned) hideWeatherTooltipPortal(); });

  window.addEventListener("scroll", ()=>{ if (weatherTipPortal && weatherTipPortal.classList.contains("show")) positionWeatherTooltipPortal(); }, {passive:true});
  window.addEventListener("resize", ()=>{ if (weatherTipPortal && weatherTipPortal.classList.contains("show")) positionWeatherTooltipPortal(); });

  document.addEventListener("click", ()=>{
    weatherTipPinned = false;
    hideWeatherTooltipPortal();
  });
}

const adminTicker = document.getElementById("adminTicker");

const openNotifBtn = document.getElementById("openNotifBtn");
const notifBadge = document.getElementById("notifBadge");
const notifOverlay = document.getElementById("notifOverlay");
const notifTabs = document.getElementById("notifTabs");
const notifContent = document.getElementById("notifContent");
const notifOkBtn = document.getElementById("notifOkBtn");
const closeNotifBtn = document.getElementById("closeNotifBtn");
const notifRewardsBadge = document.getElementById("notifRewardsBadge");
const notifMessagesBadge = document.getElementById("notifMessagesBadge");

const openLeaderboardBtn = document.getElementById("openLeaderboardBtn");
const leaderboardOverlay = document.getElementById("leaderboardOverlay");
const leaderboardBody = document.getElementById("leaderboardBody");
const leaderboardOkBtn = document.getElementById("leaderboardOkBtn");
const closeLeaderboardBtn = document.getElementById("closeLeaderboardBtn");

const openValentinesBtn = document.getElementById("openValentinesBtn");
const valentinesOverlay = document.getElementById("valentinesOverlay");
const closeValentinesBtn = document.getElementById("closeValentinesBtn");
const valTabs = document.getElementById("valTabs");
const valBody = document.getElementById("valBody");
const valEndsIn = document.getElementById("valEndsIn");
const valHeartsEl = document.getElementById("valHearts");
const valTokensEl = document.getElementById("valTokens");
const openValHelpBtn = document.getElementById("openValHelpBtn");
const valentinesHelpOverlay = document.getElementById("valentinesHelpOverlay");
const closeValHelpBtn = document.getElementById("closeValHelpBtn");
const valHelpOkBtn = document.getElementById("valHelpOkBtn");
const valHelpHeartsEl = document.getElementById("valHelpHearts");
const valHelpTokensEl = document.getElementById("valHelpTokens");

const openProfileBtn = document.getElementById("openProfileBtn");
const profileOverlay = document.getElementById("profileOverlay");
const closeProfileBtn = document.getElementById("closeProfileBtn");
const profileOkBtn = document.getElementById("profileOkBtn");
const profileNameEl = document.getElementById("profileName");
const profileUserNameEl = document.getElementById("profileUserName");
const profileStatusDotEl = document.getElementById("profileStatusDot");
const profileModalStatusDotEl = document.getElementById("profileModalStatusDot");
const profileTotalCardsEl = document.getElementById("profileTotalCards");
const profileCurGpsEl = document.getElementById("profileCurGps");
const profileTowerMultEl = document.getElementById("profileTowerMult");
const profileTowerStoredEl = document.getElementById("profileTowerStored");
const profileTopRarityEl = document.getElementById("profileTopRarity");
const profileRarityCountEl = document.getElementById("profileRarityCount");
const profileThemeGridEl = document.getElementById("profileThemeGrid");
const profileBadgesGridEl = document.getElementById("profileBadgesGrid");
const profileCosmeticsGridEl = document.getElementById("profileCosmeticsGrid");
const profileEquippedTitleEl = document.getElementById("profileEquippedTitle");
const profileAvatarFrameWrapEl = document.getElementById("profileAvatarFrameWrap");
const profileAvatarImg = document.getElementById("profileAvatarImg");
const profileModalAvatarImg = document.getElementById("profileModalAvatarImg");

const profileAvatarWrapHeader = document.getElementById("profileAvatarWrapHeader");
const profileAvatarWrapModal = document.getElementById("profileAvatarWrapModal");

const flexSel0 = document.getElementById("flexSel0");
const flexSel1 = document.getElementById("flexSel1");
const flexSel2 = document.getElementById("flexSel2");
const flexImg0 = document.getElementById("flexImg0");
const flexImg1 = document.getElementById("flexImg1");
const flexImg2 = document.getElementById("flexImg2");

const luckyResultOverlay = document.getElementById("luckyResultOverlay");
const luckyResultName = document.getElementById("luckyResultName");
const luckyResultImg = document.getElementById("luckyResultImg");
const luckyResultMeta = document.getElementById("luckyResultMeta");
const luckyResultOkBtn = document.getElementById("luckyResultOkBtn");
const closeLuckyResultBtn = document.getElementById("closeLuckyResultBtn");

const deckOverlay = document.getElementById("deckOverlay");
const closeDeckBtn = document.getElementById("closeDeckBtn");
const deckPickGrid = document.getElementById("deckPickGrid");
const deckEmpty = document.getElementById("deckEmpty");
const deckHint = document.getElementById("deckHint");
const deckSelectBtn = document.getElementById("deckSelectBtn");
const deckDetailsImg = document.getElementById("deckDetailsImg");
const deckDetailsName = document.getElementById("deckDetailsName");
const deckDetailsRarity = document.getElementById("deckDetailsRarity");
const deckDetailsChance = document.getElementById("deckDetailsChance");
const deckDetailsMutation = document.getElementById("deckDetailsMutation");
const deckDetailsGps = document.getElementById("deckDetailsGps");

const deckSearchInput = document.getElementById("deckSearchInput");
const deckSearchClear = document.getElementById("deckSearchClear");
const deckSearchDropdown = document.getElementById("deckSearchDropdown");

let deckPicking = null; // { deckKey, idx, selectedCardId }

const mmSelectOverlay = document.getElementById("mmSelectOverlay");
const closeMmSelectBtn = document.getElementById("closeMmSelectBtn");
const mmPickGrid = document.getElementById("mmPickGrid");
const mmPickEmpty = document.getElementById("mmPickEmpty");

const mmSearchInput = document.getElementById("mmSearchInput");
const mmSearchClear = document.getElementById("mmSearchClear");
const mmSelectBtn = document.getElementById("mmSelectBtn");

const mmDetailsImg = document.getElementById("mmDetailsImg");
const mmDetailsName = document.getElementById("mmDetailsName");
const mmDetailsRarity = document.getElementById("mmDetailsRarity");
const mmDetailsChance = document.getElementById("mmDetailsChance");
const mmDetailsMutation = document.getElementById("mmDetailsMutation");
const mmDetailsGps = document.getElementById("mmDetailsGps");

const mmResultOverlay = document.getElementById("mmResultOverlay");
const closeMmResultBtn = document.getElementById("closeMmResultBtn");
const mmResultName = document.getElementById("mmResultName");
const mmResultImg = document.getElementById("mmResultImg");
const mmResultMeta = document.getElementById("mmResultMeta");
const mmResultOkBtn = document.getElementById("mmResultOkBtn");
const mmResultImgWrap = document.getElementById("mmResultImgWrap");

let mmRevealPending = false;
let mmPicking = null; // { selectedCardId }

const tradeSelectOverlay = document.getElementById("tradeSelectOverlay");
const closeTradeSelectBtn = document.getElementById("closeTradeSelectBtn");
const tradePickGrid = document.getElementById("tradePickGrid");
const tradePickEmpty = document.getElementById("tradePickEmpty");
const tradeSelectBtn = document.getElementById("tradeSelectBtn");
const tradeDetailsImg = document.getElementById("tradeDetailsImg");
const tradeDetailsName = document.getElementById("tradeDetailsName");
const tradeDetailsRarity = document.getElementById("tradeDetailsRarity");
const tradeDetailsChance = document.getElementById("tradeDetailsChance");
const tradeDetailsMutation = document.getElementById("tradeDetailsMutation");
const tradeDetailsGps = document.getElementById("tradeDetailsGps");

let tradePicking = null; // { selectedCardId }
let tradeSelectedCardId = null;

const cardsOverlay = document.getElementById("cardsOverlay");
const cardsGrid = document.getElementById("cardsGrid");
const cardsSearchInput = document.getElementById("cardsSearchInput");
const cardsTotalCount = document.getElementById("cardsTotalCount");
const cardsHeartedCount = document.getElementById("cardsHeartedCount");
const cardsEmpty = document.getElementById("cardsEmpty");
const cardsOkBtn = document.getElementById("cardsOkBtn");
const closeCardsBtn = document.getElementById("closeCardsBtn")
const openPetShopBtn = document.getElementById("openPetShopBtn");
const petShopOverlay = document.getElementById("petShopOverlay");
const petShopGrid = document.getElementById("petShopGrid");
const petRestockTimer = document.getElementById("petRestockTimer");
const petShopOkBtn = document.getElementById("petShopOkBtn");
const closePetShopBtn = document.getElementById("closePetShopBtn");

const invTabs = document.getElementById("invTabs");
const invPanelPacks = document.getElementById("invPanelPacks");
const invPanelPets = document.getElementById("invPanelPets");
const invPacksBadge = document.getElementById("invPacksBadge");
const invPetsBadge = document.getElementById("invPetsBadge");

const invPanelCards = document.getElementById("invPanelCards");
const invCardsBadge = document.getElementById("invCardsBadge");
const invPetsGrid = document.getElementById("invPetsGrid");
const invPetsEmpty = document.getElementById("invPetsEmpty");

const openSummoners = document.getElementById("openSummoners");
const summonersOverlay = document.getElementById("summonersOverlay");
const summonersList = document.getElementById("summonersList");
const selectedSummonerName = document.getElementById("selectedSummonerName");
const summonerDetailName = document.getElementById("summonerDetailName");
const summonerDetailLevel = document.getElementById("summonerDetailLevel");
const summonerDetailText = document.getElementById("summonerDetailText");
const summonerBonusText = document.getElementById("summonerBonusText");
const summonerUpgradeCost = document.getElementById("summonerUpgradeCost");
const summonerReqText = document.getElementById("summonerReqText");
const upgradeSummonerBtn = document.getElementById("upgradeSummonerBtn");
const summonersOkBtn = document.getElementById("summonersOkBtn");
const closeSummonersBtn = document.getElementById("closeSummonersBtn");

const openGoldPanel = document.getElementById("openGoldPanel");

const rewardsOverlay = document.getElementById("rewardsOverlay");
const rewardGrid = document.getElementById("rewardGrid");
const rewardsOkBtn = document.getElementById("rewardsOkBtn");
const closeRewardsBtn = document.getElementById("closeRewardsBtn");

const toasts = document.getElementById("toasts");

/* ================= SHOP SCROLLER ================= */
let stock = [];
let x = 0;
const speed = 120;
let lastTime = performance.now();

function fmt(n){
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  const sign = num < 0 ? "-" : "";
  let v = Math.abs(num);

  const units = [
    { v: 1e12, s: "t" },
    { v: 1e9,  s: "b" },
    { v: 1e6,  s: "m" },
    { v: 1e3,  s: "k" },
  ];

  for (const u of units){
    if (v >= u.v){
      const raw = v / u.v;
      const dec = raw < 10 ? 1 : 0;
      let out = raw.toFixed(dec);
      if (out.endsWith(".0")) out = out.slice(0,-2);
      return sign + out + u.s;
    }
  }

  return sign + String(Math.floor(v));
}

function titleCase(str){
  str = String(str||"");
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

let __goldPulseTimer = null;
function updateGoldUI(){
  if (!goldEl && !diamondEl) return;

  if (goldEl){
    const next = fmt(state.gold);
    if (goldEl.textContent !== next) goldEl.textContent = next;
  }

  if (diamondEl){
    const dnext = fmt(state.diamond ?? 0);
    if (diamondEl.textContent !== dnext) diamondEl.textContent = dnext;
  }
  if (goldEl){
    if (!goldEl.classList.contains("goldPulse")){
      goldEl.classList.add("goldPulse");
    }
    if (__goldPulseTimer) clearTimeout(__goldPulseTimer);
    __goldPulseTimer = setTimeout(()=>{ try{ goldEl.classList.remove("goldPulse"); }catch(_){ } }, 360);
  }
}

function uid(){
  return (crypto?.randomUUID?.() ?? (Math.random().toString(16).slice(2) + "-" + Date.now().toString(16)));
}

/* ================= PETS + SUMMONERS CATALOG ================= */
const PET_CATALOG = [
  { id:"test1", name:"Test 1", img:"card.png", price:100 },
  { id:"test2", name:"Test 2", img:"card.png", price:200 }
];

const SUMMONER_CATALOG = [
  { id:"3dm4rk", name:"Roylier", img:"summoners/roylier.png", heroImg:"summoners/roylier.png", free:true, desc:"Free summoner. A calm, efficient commander who boosts your collection journey." },
  { id:"nova",  name:"Nova",  img:"summoners/nova.png",  heroImg:"summoners/nova.png",  free:false, desc:"A star-forged tactician. Specializes in quick upgrades and shiny loot." },
  { id:"ember", name:"Ember", img:"summoners/ember.png", heroImg:"summoners/ember.png", free:false, desc:"A blazing duelist. Brings aggressive momentum to your pulls." },
  { id:"aegis", name:"Aegis", img:"summoners/aegis.png", heroImg:"summoners/aegis.png", free:false, desc:"A defensive guardian. Keeps you stable when luck is cold." },
  { id:"void",  name:"Void",  img:"summoners/void.png",  heroImg:"summoners/void.png",  free:false, desc:"A cosmic anomaly. High risk, high reward vibes." },
  { id:"zioti", name:"Zioti", img:"summoners/zioti.png", heroImg:"summoners/zioti.png", free:false, desc:"A tower-blooded architect. Unlocks Deck B slots 7–9 (purchase-only) and grants strong tower income." },
  { id:"zeno",  name:"Zeno",  img:"summoners/zeno.png",  heroImg:"summoners/zeno.png",  free:false, desc:"Final summoner. Every minute: 50% chance to gain +1,000,000 gold." }
];

/* ================= SUMMONER PROGRESSION RULES ================= */
const SUMMONER_ORDER = ["3dm4rk","nova","ember","aegis","void","zioti","zeno"];

function getSummonerIdForTier(tier){
  const i = clamp((Number(tier)||1)-1, 0, SUMMONER_ORDER.length-1);
  return SUMMONER_ORDER[i];
}

function summonerTierOfId(id){
  const idx = SUMMONER_ORDER.indexOf(String(id||""));
  return (idx >= 0) ? (idx + 1) : 1;
}

function getActiveSummonerId(){
  const owned = state?.summoners?.owned || [];
  const sel = state?.summoners?.selectedId || "3dm4rk";
  if (owned.includes(sel)) return sel;
  return owned[0] || "3dm4rk";
}

function getSummonerTier(){
  return summonerTierOfId(getActiveSummonerId());
}

function getProgressionTier(){
  const owned = state?.summoners?.owned || [];
  let maxTier = 1;
  for (const id of owned){
    maxTier = Math.max(maxTier, summonerTierOfId(id));
  }
  return maxTier;
}

function getSummonerDef(id){
  return SUMMONER_CATALOG.find(x=>x.id===id) || SUMMONER_CATALOG[0];
}

function petLimitForTier(tier){
  if (tier >= 6) return 6;
  if (tier >= 5) return 5;
  if (tier >= 4) return 4;
  if (tier >= 3) return 3;
  if (tier >= 2) return 2;
  return 1;
}
function towerMultiplierForTier(tier){
  if (tier >= 5) return 2.5;
  if (tier >= 3) return 2.0;
  if (tier >= 2) return 1.5;
  return 1.0;
}
function towerCapForTier(tier){
  if (tier >= 7) return 1000000;
  if (tier >= 6) return 200000;
  if (tier >= 5) return 200000;
  if (tier >= 4) return 150000;
  if (tier >= 3) return 100000;
  if (tier >= 2) return 50000;
  return 20000;
}
function bonusGoldPer15sForTier(tier){
  if (tier >= 7) return 0;
  if (tier >= 6) return 1500;
  if (tier >= 5) return 2000;
  if (tier >= 4) return 1000;
  if (tier >= 3) return 1000;
  if (tier >= 2) return 500;
  return 0;
}

function onActiveSummonerChanged(){
  if (state?.summoners){
    state.summoners.nextBonusAt = Date.now() + 15000;
    state.summoners.nextZenoAt = Date.now() + 60000;
  }

  const cap = towerCapForTier(getSummonerTier());
  if (state?.towers && Number.isFinite(state.towers.stored) && state.towers.stored > cap){
    state.towers.stored = cap;
  }

  saveState(state);
  syncUI();
}

function getMainSummonerId(){
  return "3dm4rk";
}

function getUpgradeRequirementsForLevel(lv){
  const cost = summonerUpgradeCostForLevel(lv);
  const nextTier = lv + 1;
  const reqs = [];
  if (cost === Infinity) return { cost, nextTier, reqs, max:true };

  reqs.push({ key:"gold", label:`Have ${fmt(cost)} gold`, ok: (state.gold >= cost) });

  if (lv === 1){
    const rarest = getRarestCardDefByRarity("common");
    reqs.push({ key:"card_common", label:`Own the rarest Common card (${rarest ? rarest.name : "?"})`, ok: ownsRarestCardOfRarity("common") });
  } else if (lv === 2){
    const rarest = getRarestCardDefByRarity("rare");
    reqs.push({ key:"card_rare", label:`Own the rarest Rare card (${rarest ? rarest.name : "?"})`, ok: ownsRarestCardOfRarity("rare") });
  } else if (lv === 3){
    const rarest = getRarestCardDefByRarity("epic");
    reqs.push({ key:"card_epic", label:`Own the rarest Epic card (${rarest ? rarest.name : "?"})`, ok: ownsRarestCardOfRarity("epic") });
  } else if (lv === 4){
    const rarest = getRarestCardDefByRarity("mythical");
    reqs.push({ key:"card_mythical", label:`Own the rarest Mythical card (${rarest ? rarest.name : "?"})`, ok: ownsRarestCardOfRarity("mythical") });
  } else if (lv === 5){
    const rarest = getRarestCardDefByRarity("legendary");
    reqs.push({ key:"card_legendary", label:`Own the rarest Legendary card (${rarest ? rarest.name : "?"})`, ok: ownsRarestCardOfRarity("legendary") });
  } else if (lv === 6){
    const rLeg = getRarestCardDefByRarity("legendary");
    const rCos = getRarestCardDefByRarity("cosmic");
    reqs.push({ key:"card_legendary", label:`Own the rarest Legendary card (${rLeg ? rLeg.name : "?"})`, ok: ownsRarestCardOfRarity("legendary") });
    reqs.push({ key:"card_cosmic", label:`Own the rarest Cosmic card (${rCos ? rCos.name : "?"})`, ok: ownsRarestCardOfRarity("cosmic") });
  }

  return { cost, nextTier, reqs, max:false };
}

function getRarestCardDefByRarity(rarityKey){
  const pool = CARD_REWARDS[rarityKey];
  if (!Array.isArray(pool) || pool.length === 0) return null;
  let best = pool[0];
  for (const c of pool){
    const cw = Number(c.pullChance ?? c.w ?? 0);
    const bw = Number(best.pullChance ?? best.w ?? 0);
    if (cw < bw) best = c;
  }
  return best;
}
function ownsRarestCardOfRarity(rarityKey){
  const rarest = getRarestCardDefByRarity(rarityKey);
  if (!rarest) return false;
  const targetName = String(rarest.name||"").toLowerCase();
  return state.cardsOwned.some(c => String(c.name||"").toLowerCase() === targetName && String(c.rarity||"").toLowerCase() === String(rarityKey).toLowerCase());
}
function canUpgradeMainSummoner(){
  const id = getMainSummonerId();
  const lv = getSummonerLevel(id);
  const cost = summonerUpgradeCostForLevel(lv);
  if (!Number.isFinite(cost) || cost === Infinity) return { ok:false, reason:"Max level reached." };

  if (lv === 1){
    if (!ownsRarestCardOfRarity("common")) return { ok:false, reason:"Need the rarest Common card." };
  } else if (lv === 2){
    if (!ownsRarestCardOfRarity("rare")) return { ok:false, reason:"Need the rarest Rare card." };
  } else if (lv === 3){
    if (!ownsRarestCardOfRarity("epic")) return { ok:false, reason:"Need the rarest Epic card." };
  } else if (lv === 4){
    if (!ownsRarestCardOfRarity("mythical")) return { ok:false, reason:"Need the rarest Mythical card." };
  } else if (lv === 5){
    if (!ownsRarestCardOfRarity("legendary")) return { ok:false, reason:"Need the rarest Legendary card." };
  } else if (lv === 6){
    if (!ownsRarestCardOfRarity("legendary")) return { ok:false, reason:"Need the rarest Legendary card." };
    if (!ownsRarestCardOfRarity("cosmic")) return { ok:false, reason:"Need the rarest Cosmic card." };
  }

  if (state.gold < cost) return { ok:false, reason:`Need ${fmt(cost)} gold.` };
  return { ok:true, reason:"" };
}

const DECK_B_SLOT_COSTS = [
  5000, 5000, 5000,
  5000, 5000, 5000,
  15000,15000,15000
];

function ensureDeckSlotPurchases(){
  if (!state.deckSlotPurchases || typeof state.deckSlotPurchases !== "object"){
    state.deckSlotPurchases = { A: Array(9).fill(false), B: Array(9).fill(false) };
  }
  if (!Array.isArray(state.deckSlotPurchases.A)) state.deckSlotPurchases.A = Array(9).fill(false);
  if (!Array.isArray(state.deckSlotPurchases.B)) state.deckSlotPurchases.B = Array(9).fill(false);
  if (state.deckSlotPurchases.A.length !== 9) state.deckSlotPurchases.A = Array(9).fill(false).map((_,i)=>!!state.deckSlotPurchases.A[i]);
  if (state.deckSlotPurchases.B.length !== 9) state.deckSlotPurchases.B = Array(9).fill(false).map((_,i)=>!!state.deckSlotPurchases.B[i]);

  for (let i=0;i<3;i++){
    state.deckSlotPurchases.A[i] = true;
  }
}

function getDeckSlotStatus(deckKey, idx){
  ensureDeckSlotPurchases();
  ensureDeckCardLocations();

  const purchased = !!state.deckSlotPurchases?.[deckKey]?.[idx];
  const progTier = getProgressionTier();

  if (deckKey === "A"){
    if (idx <= 2) return { status:"unlocked", purchased:true, price:0 };

    if (idx >= 3 && idx <= 5){
      if (progTier < 2) return { status:"locked", purchased:false, price:5000, reason:"Requires Nova" };
      if (purchased) return { status:"unlocked", purchased:true, price:0 };
      return { status:"purchasable", purchased:false, price:5000 };
    }

    if (idx >= 6 && idx <= 8){
      if (progTier < 3) return { status:"locked", purchased:false, price:15000, reason:"Requires Ember" };
      if (purchased) return { status:"unlocked", purchased:true, price:0 };
      return { status:"purchasable", purchased:false, price:15000 };
    }
  }

  if (deckKey === "B"){
    if (progTier < 4){
      return { status:"locked", purchased:false, price:0, reason:"Requires Aegis" };
    }

    if (idx >= 0 && idx <= 2){
      const price = DECK_B_SLOT_COSTS[idx] || 0;
      if (purchased) return { status:"unlocked", purchased:true, price:0 };
      return { status:"purchasable", purchased:false, price };
    }

    if (idx >= 3 && idx <= 5){
      const price = DECK_B_SLOT_COSTS[idx] || 0;
      if (progTier < 5) return { status:"locked", purchased:false, price, reason:"Requires Void" };
      if (purchased) return { status:"unlocked", purchased:true, price:0 };
      return { status:"purchasable", purchased:false, price };
    }

    if (idx >= 6 && idx <= 8){
      const price = DECK_B_SLOT_COSTS[idx] || 0;
      if (progTier < 6) return { status:"locked", purchased:false, price, reason:"Requires Zioti" };
      if (purchased) return { status:"unlocked", purchased:true, price:0 };
      return { status:"purchasable", purchased:false, price };
    }
  }

  return { status:"locked", purchased:false, price:0 };
}

function purchaseDeckSlot(deckKey, idx){
  const info = getDeckSlotStatus(deckKey, idx);
  if (info.status !== "purchasable") return false;
  const price = info.price || 0;
  if (state.gold < price){
    toast("Not enough gold", `Need ${fmt(price)} gold to unlock this slot.`);
    return false;
  }
  state.gold -= price;
  state.deckSlotPurchases[deckKey][idx] = true;
  saveState(state);
  syncUI();

  playPurchaseSFX();
  toast("Slot Unlocked", `Unlocked Deck ${deckKey} Slot ${idx+1}.`);
  return true;
}

function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

function mmss(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const m = String(Math.floor(s/60)).padStart(2,"0");
  const r = String(s%60).padStart(2,"0");
  return `${m}:${r}`;
}
function toast(title, msg, opts={}){
  const { type="", duration=3100, iconHtml="", imageUrl="" } = (opts||{});
  const el = document.createElement("div");
  el.className = "toast" + (type ? (" " + type) : "");

  const img = imageUrl ? `<img class="toastImg" src="${escapeHtml(imageUrl)}" alt="">` : "";
  const icon = iconHtml ? `<div class="toastIcon">${iconHtml}</div>` : "";

  el.innerHTML = `
    <div class="toastRow">
      ${img || icon}
      <div class="toastBody">
        <b>${escapeHtml(String(title||""))}</b>
        <div class="tSmall">${escapeHtml(String(msg||""))}</div>
      </div>
    </div>
  `;

  toasts.appendChild(el);

  const fadeAt = Math.max(900, duration - 650);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(6px)"; }, fadeAt);
  setTimeout(()=>{ el.remove(); }, duration);
}

function giftToast(fromUsername, card){
  const name = card?.name ? String(card.name) : "a card";
  const rarity = card?.rarity ? String(card.rarity) : "";
  const img = card?.img ? String(card.img) : "cards/card.png";
  const title = "🎁 Gift received!";
  const msg = `${fromUsername || "Someone"} sent you ${name}${rarity ? " ("+rarity.toUpperCase()+")" : ""}.`;
  toast(title, msg, { type:"toastGift", duration:6500, imageUrl: img });
}

function showGoldPop(amount, anchorEl){
  try{
    const pop = document.createElement("div");
    pop.className = "goldPop";
    pop.textContent = `+${fmt(Math.floor(amount))} gold`;

    let x = window.innerWidth/2;
    let y = 120;
    if (anchorEl && anchorEl.getBoundingClientRect){
      const r = anchorEl.getBoundingClientRect();
      x = r.left + r.width/2;
      y = r.top + r.height/2;
    }

    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
    document.body.appendChild(pop);

    requestAnimationFrame(()=> pop.classList.add("show"));
    setTimeout(()=>{ pop.classList.remove("show"); pop.classList.add("hide"); }, 700);
    setTimeout(()=>{ pop.remove(); }, 1200);
  }catch(_){}
}

/* ================= LocalStorage ================= */
function defaultState(){
  return {
    gold: 20000,
    diamond: 0,
    invCounts: { common:0, rare:0, epic:0, mythical:0, legendary:0, cosmic:0, interstellar:0, dragon:0, valentines:0, cny:0 },
    cardsOwned: [],
    cardsInDeck: [],
    petsOwned: [],
    petShopRestockAt: Date.now() + 5*60*1000,
    summoners: {
      selectedId: "3dm4rk",
      owned: ["3dm4rk"],
      levels: {"3dm4rk": 1},
      nextBonusAt: Date.now() + 15000,
      nextZenoAt: Date.now() + 60000
    },
    towers: { stored: 0, lastTs: Date.now() },
    decks: {
      A: Array(9).fill(null),
      B: Array(9).fill(null)
    },
    deckSlotPurchases: {
      A: [true,true,true,false,false,false,false,false,false],
      B: [false,false,false,false,false,false,false,false,false]
    },
    weather: {
      currentKey: "normal",
      active: false,
      endsAt: 0,
      nextEventAt: Date.now() + WEATHER_EVENT_INTERVAL_MS,
      nextStrikeAt: 0,
      strikesDone: 0,
      nextAnnounceAt: 0,
      nextPreviewKey: null
    },
    notifications: {
      tickets: 0,
      claimed: {}
    },
    valentines: {
      hearts: 0,
      tokens: 0,
      xp: 0,
      level: 0,
      fateScore: 0,
      claimedMilestones: {},
      cosmetics: { badge:false, roseFrame:false, heartEmblem:false, crimsonAura:false, fateboundTitle:false },
      buffs: { bondBoostUntil:0, heartsMultUntil:0 },
      lastMutationPolishDay: "",
      daily: {
        dayKey: "",
        missions: [],
        claimed: {},
        goldDonations: 0,
        loginClaimed: false
      }
    }
  };
}
function loadState(){
  try{
    const injected = (typeof window !== "undefined" && window.__SERVER_STATE__ && typeof window.__SERVER_STATE__ === "object")
      ? window.__SERVER_STATE__
      : null;

    const injectedTs = (typeof window !== "undefined")
      ? (Number(window.__SERVER_STATE_UPDATED_AT__) || 0)
      : 0;

    let local = null;
    const raw = localStorage.getItem(LS_KEY);
    if (raw){
      try{ local = JSON.parse(raw); }catch(_){ local = null; }
    }

    let parsed = null;
    const localTs = local && Number(local._clientTs) ? Number(local._clientTs) : 0;

    if (local && injected && localTs > injectedTs){
      parsed = local;
    }else{
      parsed = injected || local;
    }

    if(!parsed) return defaultState();
    const s = defaultState();

    s.gold = Number.isFinite(parsed.gold) ? parsed.gold : s.gold;
    s.diamond = Number.isFinite(parsed.diamond) ? parsed.diamond : s.diamond;
    s.invCounts = {...s.invCounts, ...(parsed.invCounts||{})};
    s.cardsOwned = Array.isArray(parsed.cardsOwned) ? parsed.cardsOwned : [];
    s.cardsInDeck = Array.isArray(parsed.cardsInDeck) ? parsed.cardsInDeck : [];

    if (parsed.notifications && typeof parsed.notifications === "object"){
      const pn = parsed.notifications;
      const pt = Number(pn.tickets);
      const pc = (pn.claimed && typeof pn.claimed === "object") ? pn.claimed : {};
      const pm = (pn.mutationMachine && typeof pn.mutationMachine === "object") ? pn.mutationMachine : (s.notifications?.mutationMachine||null);
      s.notifications = {
        tickets: Number.isFinite(pt) ? pt : (s.notifications?.tickets||0),
        claimed: pc,
        mutationMachine: pm ? { ...pm } : (s.notifications?.mutationMachine ? { ...s.notifications.mutationMachine } : undefined)
      };
    }

    if (parsed.valentines && typeof parsed.valentines === "object"){
      const ev = parsed.valentines;
      if (!s.valentines || typeof s.valentines !== "object") s.valentines = defaultState().valentines;
      s.valentines.hearts = Number(ev.hearts) || 0;
      s.valentines.tokens = Number(ev.tokens) || 0;
      s.valentines.xp = Number(ev.xp) || 0;
      s.valentines.level = Number(ev.level) || 0;
      s.valentines.fateScore = Number(ev.fateScore) || 0;
      s.valentines.claimedMilestones = (ev.claimedMilestones && typeof ev.claimedMilestones === "object") ? ev.claimedMilestones : {};
      s.valentines.cosmetics = (ev.cosmetics && typeof ev.cosmetics === "object") ? { ...s.valentines.cosmetics, ...ev.cosmetics } : s.valentines.cosmetics;
      s.valentines.buffs = (ev.buffs && typeof ev.buffs === "object") ? { ...s.valentines.buffs, ...ev.buffs } : s.valentines.buffs;
      s.valentines.lastMutationPolishDay = typeof ev.lastMutationPolishDay === "string" ? ev.lastMutationPolishDay : "";
      if (ev.daily && typeof ev.daily === "object"){
        s.valentines.daily = {
          dayKey: typeof ev.daily.dayKey === "string" ? ev.daily.dayKey : "",
          missions: Array.isArray(ev.daily.missions) ? ev.daily.missions : [],
          claimed: (ev.daily.claimed && typeof ev.daily.claimed === "object") ? ev.daily.claimed : {},
          goldDonations: Number(ev.daily.goldDonations) || 0,
          loginClaimed: !!ev.daily.loginClaimed,
          progress: (ev.daily.progress && typeof ev.daily.progress === "object") ? ev.daily.progress : { packsOpened:0, cardsSacrificed:0, towerCollects:0, dominionActions:0 }
        };
      }
    }

    s.petsOwned = Array.isArray(parsed.petsOwned) ? parsed.petsOwned : [];
    s.petShopRestockAt = Number.isFinite(parsed.petShopRestockAt) ? parsed.petShopRestockAt : (Date.now() + 5*60*1000);

    const ps = parsed.summoners || {};
    s.summoners = {
      selectedId: typeof ps.selectedId === "string" ? ps.selectedId : s.summoners.selectedId,
      owned: Array.isArray(ps.owned) ? ps.owned : s.summoners.owned,
      levels: (ps.levels && typeof ps.levels === "object") ? ps.levels : s.summoners.levels
    };

    s.towers = (parsed.towers && typeof parsed.towers==="object") ? { stored: Number(parsed.towers.stored)||0, lastTs: Date.now() } : s.towers;

    if (parsed.decks && typeof parsed.decks === "object"){
      if (Array.isArray(parsed.decks.A)) s.decks.A = parsed.decks.A;
      if (Array.isArray(parsed.decks.B)) s.decks.B = parsed.decks.B;
    }

    if (parsed.deckSlotPurchases && typeof parsed.deckSlotPurchases === "object"){
      const a = Array.isArray(parsed.deckSlotPurchases.A) ? parsed.deckSlotPurchases.A : [];
      const b = Array.isArray(parsed.deckSlotPurchases.B) ? parsed.deckSlotPurchases.B : [];
      s.deckSlotPurchases = {
        A: Array(9).fill(false).map((_,i)=> !!a[i]),
        B: Array(9).fill(false).map((_,i)=> !!b[i])
      };
    }

    try{
      if (!s.deckSlotPurchases || typeof s.deckSlotPurchases !== "object"){
        s.deckSlotPurchases = { A: Array(9).fill(false), B: Array(9).fill(false) };
      }
      if (!Array.isArray(s.deckSlotPurchases.A)) s.deckSlotPurchases.A = Array(9).fill(false);
      if (!Array.isArray(s.deckSlotPurchases.B)) s.deckSlotPurchases.B = Array(9).fill(false);
      if (s.deckSlotPurchases.A.length !== 9) s.deckSlotPurchases.A = Array(9).fill(false).map((_,i)=>!!s.deckSlotPurchases.A[i]);
      if (s.deckSlotPurchases.B.length !== 9) s.deckSlotPurchases.B = Array(9).fill(false).map((_,i)=>!!s.deckSlotPurchases.B[i]);
      for (let i=0;i<3;i++) s.deckSlotPurchases.A[i] = true;
    }catch(_){}

    try{
      const pn = parsed.notifications || {};
      const claimed = (pn.claimed && typeof pn.claimed === "object") ? pn.claimed : {};
      const pm = (pn.mutationMachine && typeof pn.mutationMachine === "object") ? pn.mutationMachine : (s.notifications?.mutationMachine||null);
      s.notifications = {
        tickets: Number(pn.tickets)||0,
        claimed: { ...claimed },
        mutationMachine: pm ? { ...pm } : (s.notifications?.mutationMachine ? { ...s.notifications.mutationMachine } : undefined)
      };
    }catch(_){
      s.notifications = s.notifications || { tickets: 0, claimed: {} };
    }

    try{
      if (parsed.weather && typeof parsed.weather === "object"){
        s.weather = { ...(s.weather||{}), ...(parsed.weather||{}) };
      }
    }catch(_){}

    try{
      if (parsed.admin && typeof parsed.admin === "object"){
        s.admin = { ...(parsed.admin||{}) };
      }
    }catch(_){ }

    try{
      const lb = Number(parsed.lastBroadcastId);
      s.lastBroadcastId = Number.isFinite(lb) ? Math.max(0, lb) : 0;
    }catch(_){
      s.lastBroadcastId = 0;
    }
    if (parsed.adminShopLock !== undefined) s.adminShopLock = parsed.adminShopLock;

    try{
      if (parsed.profile && typeof parsed.profile === "object"){
        const pp = parsed.profile;
        if (!s.profile || typeof s.profile !== "object") s.profile = {};

        if (Array.isArray(pp.featured)){
          const arr = [null,null,null];
          for (let i=0;i<3;i++){
            const v = pp.featured[i];
            arr[i] = (typeof v === "string" && v.trim()) ? v : null;
          }
          s.profile.featured = arr;
        }

        if (typeof pp.theme === "string" && pp.theme.trim()) s.profile.theme = pp.theme;
        if (pp.achievements && typeof pp.achievements === "object"){
          s.profile.achievements = { ...(s.profile.achievements||{}), ...pp.achievements };
        }

        if (pp.cosmetics && typeof pp.cosmetics === "object"){
          if (!s.profile.cosmetics || typeof s.profile.cosmetics !== "object") s.profile.cosmetics = {};
          s.profile.cosmetics = { ...s.profile.cosmetics, ...pp.cosmetics };
        }
      }
    }catch(_){ }

    return s;
  }catch{
    return defaultState();
  }
}

let __saveTimer = null;
let __saveInFlight = false;
let __saveQueued = false;

async function postJSON(url, data){
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(data || {})
  });
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (ct.includes("application/json")) return await res.json();
  return await res.text();
}

function getCurrentGpsValue(){
  try{
    const tier = getSummonerTier();
    const mult = towerMultiplierForTier(tier);
    const baseRate = computeDeckGps();
    return Math.max(0, Math.round(baseRate * mult));
  }catch(_){
    return 0;
  }
}

function saveState(){
  try{ state._clientTs = Date.now(); }catch(_){}

  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(_){}

  if (__saveTimer) clearTimeout(__saveTimer);
  __saveTimer = setTimeout(async ()=>{
    if (__saveInFlight){ __saveQueued = true; return; }
    __saveInFlight = true;
    try{
      const resp = await postJSON("api/save_state.php", { state, current_gps: getCurrentGpsValue() });
      if (resp && typeof resp === "object" && (resp.ok === false || resp.success === false || resp.error)){
        throw new Error(resp.error || "save_state failed");
      }
    }catch(_){
    }finally{
      __saveInFlight = false;
      if (__saveQueued){ __saveQueued = false; saveState(); }
    }
  }, 350);
}

window.resetGotcha = async function(){
  try{
    await postJSON("api/reset_state.php", {});
    location.reload();
  }catch(_){
    try{ localStorage.removeItem(LS_KEY); }catch(__){}
    state = defaultState();
    syncUI();
  }
};;

/* ================= Card Gold/sec + Mutation helpers ================= */
function rollMutation(){
  const r = Math.random();
  let acc = 0;
  for (const m of MUTATIONS){
    acc += m.chance;
    if (r <= acc) return m;
  }
  return MUTATIONS[0];
}

function computeBaseGpsFromPullChance(pullChancePct){
  const pc = Math.max(0, Number(pullChancePct) || 0);
  let base = pc;
  if (pc >= 1 && pc <= 10) base *= 100;
  return base;
}

function normMutKey(k){
  return String(k||"")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
function titleMutKey(k){
  const s = String(k||"").trim();
  if (!s) return "Normal";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function getMutationList(card){
  if (!card || typeof card !== "object") return [];

  let list = Array.isArray(card.mutations) ? card.mutations.slice() : [];

  const legacyField = card.mutation;

  const pushLegacy = (v)=>{
    const nk = normMutKey(v);
    if (nk && nk !== "normal") list.push(titleMutKey(v));
  };

  if (typeof legacyField === "string"){
    pushLegacy(legacyField);
  }else if (Array.isArray(legacyField)){
    for (const v of legacyField) pushLegacy(v);
  }else if (legacyField && typeof legacyField === "object"){
    if (typeof legacyField.k === "string") pushLegacy(legacyField.k);
    else if (typeof legacyField.key === "string") pushLegacy(legacyField.key);
    else if (typeof legacyField.name === "string") pushLegacy(legacyField.name);
  }

  const seen = new Set();
  const out = [];
  for (const raw of list){
    const nk = normMutKey(raw);
    if (!nk || nk === "normal") continue;
    if (seen.has(nk)) continue;
    seen.add(nk);
    out.push(titleMutKey(raw));
  }
  return out;
}

function clearAllMutations(card){
  if (!card || typeof card !== "object") return;
  card.mutations = [];
  try{ delete card.mutation; }catch(_){ card.mutation = undefined; }
}
function getTotalMutationMult(card){
  const muts = getMutationList(card);
  let mult = 1.0;
  for (const m of muts){
    const k = normMutKey(m);
    mult *= (Number(MUTATION_MULTS[k]) || 1.0);
  }
  return mult;
}
function mutationLabel(card){
  const muts = getMutationList(card);
  return muts.length ? muts.join(" + ") : "Normal";
}
function primaryGlowKey(card){
  const muts = getMutationList(card).map(normMutKey);
  const priority = ["secret","love","eclipse","solarflare","bloodmoon","heavenly","godly","blackhole","thunder","galactic","neon","rainbow","diamond","gold","silver"];
  for (const p of priority){
    if (muts.includes(p)) return p;
  }
  return "normal";
}
function recomputeCardStats(card){
  if (!card || typeof card !== "object") return card;
  if (!Number.isFinite(card.baseGps)) card.baseGps = Number(CARD_GPS[card.name]) || 0;

  const mult = getTotalMutationMult(card);
  card.gps = Math.round((Number(card.baseGps) || 0) * mult);

  card.mutation = { k: titleMutKey(primaryGlowKey(card)), mult };
  return card;
}

function computeCardGps(card){
  if (!card || !card.name) return 0;
  if (!Number.isFinite(card.baseGps)) card.baseGps = Number(CARD_GPS[card.name]) || 0;
  return Math.round((Number(card.baseGps) || 0) * getTotalMutationMult(card));
}

/* ================= Mutation glow helpers ================= */
function applyMutationGlow(el, card){
  if (!el) return;

  try{
    el.classList.remove("mutGlow");
    [...el.classList].forEach(cls=>{
      if (cls && cls.startsWith("mut-")) el.classList.remove(cls);
    });
    el.style.removeProperty("--mut-glow");
    el.style.removeProperty("--mut-speed");
    el.style.removeProperty("--mut-gradient");
  }catch(_){}

  if (!card) return;

  const mk = primaryGlowKey(card);
  if (mk === "normal") return;

  el.classList.add("mutGlow", `mut-${mk}`);

  if (mk === "silver") el.style.setProperty("--mut-glow", "0.55");
  else if (mk === "gold") el.style.setProperty("--mut-glow", "0.70");
  else if (mk === "diamond") el.style.setProperty("--mut-glow", "0.78");
  else if (mk === "rainbow") el.style.setProperty("--mut-glow", "0.90");
  else if (mk === "neon") el.style.setProperty("--mut-glow", "0.98");
  else if (mk === "galactic") el.style.setProperty("--mut-glow", "1.10");
  else if (mk === "bloodmoon") el.style.setProperty("--mut-glow", "0.95");
  else if (mk === "solarflare") el.style.setProperty("--mut-glow", "1.08");
  else if (mk === "eclipse") el.style.setProperty("--mut-glow", "1.12");
  else if (mk === "love") el.style.setProperty("--mut-glow", "1.10");
  else if (mk === "secret") el.style.setProperty("--mut-glow", "1.22");
  else if (mk === "thunder") el.style.setProperty("--mut-glow", "0.98");
  else if (mk === "blackhole") el.style.setProperty("--mut-glow", "1.05");
  else if (mk === "godly") el.style.setProperty("--mut-glow", "1.10");
  else el.style.setProperty("--mut-glow", "1.18");
}

function findRarityByName(name){
  const n = String(name||"").toLowerCase();
  for (const [rar, pool] of Object.entries(CARD_REWARDS)){
    for (const c of pool){
      if (String(c.name).toLowerCase() === n) return rar;
    }
  }
  return "common";
}

function migrateCards(){
  if (!Array.isArray(state.cardsOwned)) state.cardsOwned = [];
  state.cardsOwned = state.cardsOwned.map(c=>{
    const cc = (c && typeof c === "object") ? {...c} : { name:"Unknown", img:"cards/card.png", w:1 };

    if (!cc.id) cc.id = uid();
    if (!cc.rarity) cc.rarity = findRarityByName(cc.name);
    if (!Number.isFinite(cc.pullChance)) cc.pullChance = Number(cc.w) || 0;
    const muts = getMutationList(cc);
    cc.mutations = muts;
    cc.baseGps = Number(CARD_GPS[cc.name]) || Number(cc.baseGps) || 0;
    if (!cc.location) cc.location = "inventory";
    if (typeof cc.fav !== "boolean") cc.fav = false;

    recomputeCardStats(cc);
    ensureCardAnimationData(cc);
    return cc;
  });
}

function ensureTowers(){
  if (!state.towers || typeof state.towers !== "object"){
    state.towers = { stored: 0, lastTs: Date.now() };
  }
  if (!Number.isFinite(state.towers.stored)) state.towers.stored = 0;
  state.towers.lastTs = Date.now();
}
function ensureDecks(){
  if (!state.decks || typeof state.decks !== "object") state.decks = {A:Array(9).fill(null), B:Array(9).fill(null)};
  if (!Array.isArray(state.decks.A)) state.decks.A = Array(9).fill(null);
  if (!Array.isArray(state.decks.B)) state.decks.B = Array(9).fill(null);
  if (state.decks.A.length !== 9) state.decks.A = Array(9).fill(null).map((_,i)=>state.decks.A[i] ?? null);
  if (state.decks.B.length !== 9) state.decks.B = Array(9).fill(null).map((_,i)=>state.decks.B[i] ?? null);
}

function ensureWeather(){
  if (!state.weather || typeof state.weather !== "object"){
    state.weather = {
      currentKey: "normal",
      active: false,
      endsAt: 0,
      nextEventAt: Date.now() + WEATHER_EVENT_INTERVAL_MS,
      nextStrikeAt: 0,
      strikesDone: 0,
      nextAnnounceAt: 0,
      nextPreviewKey: null
    };
  }

  if (typeof state.weather.currentKey !== "string") state.weather.currentKey = "normal";
  if (!Number.isFinite(state.weather.nextEventAt)) state.weather.nextEventAt = Date.now() + WEATHER_EVENT_INTERVAL_MS;
  if (!Number.isFinite(state.weather.endsAt)) state.weather.endsAt = 0;
  if (typeof state.weather.active !== "boolean") state.weather.active = false;
  if (!Number.isFinite(state.weather.nextStrikeAt)) state.weather.nextStrikeAt = 0;
  if (!Number.isFinite(state.weather.strikesDone)) state.weather.strikesDone = 0;
  if (!Number.isFinite(state.weather.nextAnnounceAt)) state.weather.nextAnnounceAt = 0;
  if (state.weather.nextPreviewKey && typeof state.weather.nextPreviewKey !== "string") state.weather.nextPreviewKey = null;
}

function ensureNotifications(){
  if (!state.notifications || typeof state.notifications !== "object"){
    state.notifications = { tickets: 0, claimed: {} };
  }
  if (!Number.isFinite(state.notifications.tickets)) state.notifications.tickets = 0;
  if (!state.notifications.claimed || typeof state.notifications.claimed !== "object"){
    state.notifications.claimed = {};
  }

  if (!state.notifications.mutationMachine || typeof state.notifications.mutationMachine !== "object"){
    state.notifications.mutationMachine = {
      cardId: null,
      startAt: 0,
      endAt: 0,
      status: "idle",
      speedOption: "wait",
      resultMutation: null,
      revealed: false,
      doneNotified: false
    };
  }
  const mm = state.notifications.mutationMachine;
  if (!Number.isFinite(mm.startAt)) mm.startAt = 0;
  if (!Number.isFinite(mm.endAt)) mm.endAt = 0;
  if (typeof mm.status !== "string") mm.status = "idle";
  if (typeof mm.revealed !== "boolean") mm.revealed = false;
  if (typeof mm.speedOption !== "string") mm.speedOption = "wait";
  if (typeof mm.doneNotified !== "boolean") mm.doneNotified = false;
}

function ensureAdmin(){
  if (!state.admin || typeof state.admin !== "object") state.admin = {};
  if (!Array.isArray(state.admin.broadcasts)) state.admin.broadcasts = [];
  if (typeof state.admin.lastSeenId !== "string") state.admin.lastSeenId = "";
}

function ensureProfile(){
  if (!state.profile || typeof state.profile !== "object") state.profile = {};
  if (!Array.isArray(state.profile.featured)) state.profile.featured = [null,null,null];
  for (let i=0;i<3;i++){
    if (state.profile.featured[i] !== null && typeof state.profile.featured[i] !== "string"){
      state.profile.featured[i] = null;
    }
  }

  if (!state.profile.theme) state.profile.theme = "cosmic";
  if (!state.profile.achievements || typeof state.profile.achievements !== "object") state.profile.achievements = {};
  if (!state.profile.cosmetics || typeof state.profile.cosmetics !== "object"){
    state.profile.cosmetics = { frame:"default", title:null };
  }else{
    if (!state.profile.cosmetics.frame) state.profile.cosmetics.frame = "default";
    if (state.profile.cosmetics.title === undefined) state.profile.cosmetics.title = null;
  }
}

/* ================= Profile Flex Picker ================= */
function getCardByName(name){
  return (Array.isArray(state.cardsOwned)? state.cardsOwned: []).find(c=>c && c.name===name) || null;
}
function getFeaturedCard(slotIdx){
  ensureProfile();
  const key = state.profile.featured[slotIdx];
  if (!key) return null;
  return getCardByName(key);
}

function ensureFlexPickerDom(){
  let ov = document.getElementById("flexPickOverlay");
  if (ov) return ov;

  ov = document.createElement("div");
  ov.id = "flexPickOverlay";
  ov.className = "modalOverlay";
  ov.setAttribute("aria-hidden", "true");
  ov.innerHTML = `
    <div class="modal flexPickModal" role="dialog" aria-modal="true" aria-labelledby="flexPickTitle">
      <div class="modalHead">
        <b id="flexPickTitle">Pick a Flex Card</b>
        <button class="closeBtn" id="flexPickCloseBtn" type="button">Close</button>
      </div>
      <div class="modalBody">
        <div class="flexPickTop">
          <input id="flexPickSearch" class="input flexPickSearch" type="text" placeholder="Search your cards..." autocomplete="off"/>
          <button class="btn btnGhost flexPickClear" id="flexPickClearBtn" type="button">Clear</button>
        </div>
        <div class="flexPickGrid cardsGrid" id="flexPickGrid"></div>
        <div class="flexPickEmpty" id="flexPickEmpty" style="display:none;">No cards found.</div>
        <div class="modalActions flexPickActions">
          <button class="btn btnPrimary" id="flexPickCancelBtn" type="button">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  if (ov) ov.addEventListener("click", (e)=>{ if(e.target===ov) closeFlexPicker(); });

  const closeBtn = ov.querySelector("#flexPickCloseBtn");
  const cancelBtn = ov.querySelector("#flexPickCancelBtn");
  const clearBtn = ov.querySelector("#flexPickClearBtn");
  const search = ov.querySelector("#flexPickSearch");

  if (closeBtn) closeBtn.addEventListener("click", closeFlexPicker);
  if (cancelBtn) cancelBtn.addEventListener("click", closeFlexPicker);
  if (clearBtn) clearBtn.addEventListener("click", ()=>{ if(search){ search.value=""; renderFlexPicker(); search.focus(); } });

  if (search){
    if (search) search.addEventListener("input", ()=>renderFlexPicker());
    if (search) search.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeFlexPicker(); });
  }
  return ov;
}

let flexPickingSlot = null;

function openFlexPicker(slotIdx){
  flexPickingSlot = Number(slotIdx);
  const ov = ensureFlexPickerDom();
  try{ ov.style.display = "flex"; }catch(_){}
  ov.classList.add("show");
  ov.setAttribute("aria-hidden","false");
  renderFlexPicker();
  const search = document.getElementById("flexPickSearch");
  if (search){
    search.focus();
    const v = search.value;
    search.value = "";
    search.value = v;
  }
}
function closeFlexPicker(){
  const ov = document.getElementById("flexPickOverlay");
  if (!ov) return;
  ov.classList.remove("show");
  ov.setAttribute("aria-hidden","true");
  ov.style.display = "none";
  flexPickingSlot = null;
  FrameAnimationManager.stopAll(); // stop any animations
}

function renderFlexPicker(){
  const ov = document.getElementById("flexPickOverlay");
  if (!ov) return;
  const grid = ov.querySelector("#flexPickGrid");
  const empty = ov.querySelector("#flexPickEmpty");
  const search = ov.querySelector("#flexPickSearch");
  if (!grid) return;

  const q = String(search?.value||"").trim().toLowerCase();

  const cards = (Array.isArray(state.cardsOwned)? state.cardsOwned: [])
    .filter(c=>c && c.name)
    .slice()
    .sort((a,b)=> String(a.rarity||"").localeCompare(String(b.rarity||"")) || String(a.name).localeCompare(String(b.name)));

  const filtered = q ? cards.filter(c=>{
    const muts = getMutationList(c).join(" ");
    return (String(c.name).toLowerCase().includes(q) ||
            String(c.rarity||"").toLowerCase().includes(q) ||
            String(muts).toLowerCase().includes(q));
  }) : cards;

  grid.innerHTML = "";

  if (!filtered.length){
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  const currentPick = (flexPickingSlot!==null && state?.profile?.featured) ? String(state.profile.featured[flexPickingSlot]||"") : "";
  let pendingName = ov.dataset.pendingPick || "";

  const frag = document.createDocumentFragment();

  for (const c of filtered){
    const name = String(c.name||"");
    const muts = getMutationList(c);
    const tile = document.createElement("div");
    tile.className = "cardThumb flexPickThumb";
    tile.setAttribute("role","button");
    tile.setAttribute("tabindex","0");
    tile.dataset.cardName = name;

    if (currentPick && name === currentPick) tile.classList.add("isSelected");
    if (pendingName && name === pendingName) tile.classList.add("isPending");

    try{ applyMutationGlow(tile, c); }catch(_){}

    const img = document.createElement("img");
    img.src = c?.img || "cards/card.png";
    img.alt = name || "Card";
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = ()=>{ img.src = "cards/card.png"; };
    tile.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "cardThumbMeta";
    meta.innerHTML = `
      <div class="ctName">${escapeHtml(name || "Unknown")}</div>
      <div class="ctInfo">${escapeHtml(titleCase(String(c.rarity||"common")))}${muts.length ? " • "+escapeHtml(muts[0]) : ""}</div>
    `;
    tile.appendChild(meta);

    try{ bindTooltip(tile, ()=>c); }catch(_){}

    const activate = ()=>{
      if (flexPickingSlot===null) return;
      ensureProfile();
      state.profile.featured[flexPickingSlot] = name;
      saveState();
      updateFlexUI();
      closeFlexPicker();
      ov.dataset.pendingPick = "";
    };

    tile.addEventListener("click", (e)=>{
      if (flexPickingSlot===null) return;

      if (IS_HOVERLESS_TOUCH){
        if (ov.dataset.pendingPick !== name){
          ov.dataset.pendingPick = name;
          try{
            const r = tile.getBoundingClientRect();
            showTooltipHtml(formatCardDetails(c), r.left + r.width/2, r.top + 10);
            tooltipOwnerEl = tile;
          }catch(_){}
          renderFlexPicker();
          try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
          return;
        }
        activate();
        return;
      }

      activate();
    });

    tile.addEventListener("keydown", (e)=>{
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      tile.click();
    });

    frag.appendChild(tile);
  }

  grid.appendChild(frag);
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}
function escapeHtmlAttr(s){
  return escapeHtml(s).replace(/`/g,"");
}
function titleCase(s){
  s = String(s||"");
  return s ? s.charAt(0).toUpperCase()+s.slice(1) : s;
}

function updateFlexThumb(slotIdx){
  const card = getFeaturedCard(slotIdx);
  const imgEl = document.getElementById("flexImg"+slotIdx);
  if (imgEl){
    if (card && card.img){
      imgEl.src = card.img;
      imgEl.style.display = "";
    }else{
      imgEl.src = "cards/card.png";
      imgEl.style.display = "";
    }
  }
  const slotEl = document.querySelector(`.profileFlexSlot[data-slot="${slotIdx}"]`);
  if (slotEl){
    const nameEl = slotEl.querySelector(".flexName");
    const subEl = slotEl.querySelector(".flexSub");
    if (nameEl) nameEl.textContent = card ? card.name : "Empty";
    if (subEl) subEl.textContent = card ? "Tap to change" : "Tap to pick";

    try{ applyMutationGlow(slotEl, card); }catch(_){ }

    if (!slotEl.dataset.tooltipBound){
      slotEl.dataset.tooltipBound = "1";
      try{ bindTooltip(slotEl, ()=>getFeaturedCard(slotIdx)); }catch(_){ }
    }
  }
}

function updateFlexUI(){
  for (let i=0;i<3;i++) updateFlexThumb(i);
}

/* ================= Deck helpers ================= */
function getUsedDeckCardIdSet(exceptId=null){
  const used = new Set();
  const add = (id)=>{ if (id && id !== exceptId) used.add(id); };
  if (state.decks && Array.isArray(state.decks.A)) state.decks.A.forEach(add);
  if (state.decks && Array.isArray(state.decks.B)) state.decks.B.forEach(add);
  return used;
}
function getUnassignedCards(){
  ensureDeckCardLocations();
  return getInventoryCards();
}

function getCardById(id){
  return (Array.isArray(state.cardsOwned) ? state.cardsOwned : []).find(c=>c && c.id===id) || null;
}

function getInventoryCards(){
  migrateCards();
  return (Array.isArray(state.cardsOwned) ? state.cardsOwned : []).filter(c=>c && (c.location||"inventory")==="inventory");
}

function moveCardToInventory(cardId){
  const c = getCardById(cardId);
  if (!c) return false;
  c.location = "inventory";
  return true;
}

function moveCardToDeck(cardId, deckKey, idx){
  const c = getCardById(cardId);
  if (!c) return false;
  c.location = `deck:${deckKey}:${idx}`;
  return true;
}

function ensureDeckCardLocations(){
  ensureDecks();
  migrateCards();

  const byId = new Map((state.cardsOwned||[]).map(c=>[c.id, c]));
  (state.cardsOwned||[]).forEach(c=>{
    if (!c.location || typeof c.location !== "string") c.location = "inventory";
    if (c.location.startsWith("deck:")) c.location = "inventory";
  });

  const seen = new Set();
  for (const deckKey of ["A","B"]){
    for (let idx=0; idx<9; idx++){
      const id = state.decks?.[deckKey]?.[idx] || null;
      if (!id) continue;
      const card = byId.get(id);
      if (!card){
        state.decks[deckKey][idx] = null;
        continue;
      }
      if (seen.has(id)){
        state.decks[deckKey][idx] = null;
        continue;
      }
      seen.add(id);
      card.location = `deck:${deckKey}:${idx}`;
    }
  }

  (state.cardsOwned||[]).forEach(c=>{
    if (!c.location || !c.location.startsWith("deck:")) return;
    const parts = c.location.split(":");
    if (parts.length !== 3){ c.location = "inventory"; return; }
    const dk = parts[1];
    const i = Number(parts[2]);
    if (!state.decks?.[dk] || state.decks[dk][i] !== c.id) c.location = "inventory";
  });
}

function removeCardEverywhere(cardId){
  if (!cardId) return false;

  ensureDecks();
  state.decks.A = (state.decks.A||[]).map(id => id === cardId ? null : id);
  state.decks.B = (state.decks.B||[]).map(id => id === cardId ? null : id);

  state.cardsOwned = (state.cardsOwned||[]).filter(c => c && c.id !== cardId);

  if (Array.isArray(state.cardsInDeck)){
    state.cardsInDeck = state.cardsInDeck.filter(c => c && c.id !== cardId);
  }
  return true;
}

function computeDeckGps(){
  let total = 0;

  const progTier = getProgressionTier();

  const addFromDeck = (deckKey)=>{
    const deckArr = state.decks?.[deckKey] || [];
    for (let idx=0; idx<deckArr.length; idx++){
      const id = deckArr[idx];
      if (!id) continue;

      if (deckKey === "B" && progTier < 4) continue;

      const purchased = !!state.deckSlotPurchases?.[deckKey]?.[idx];
      if (!purchased) continue;

      const c = getCardById(id);
      if (c) total += Number(c.gps)||0;
    }
  };

  addFromDeck("A");
  addFromDeck("B");
  return total;
}

/* ================= Deck Card Actions (right panel) ================= */
const dca = document.getElementById("deckCardActions");
const dcaTitle = document.getElementById("dcaTitle");
const dcaMeta = document.getElementById("dcaMeta");
const dcaClose = document.getElementById("dcaClose");
const dcaKeep = document.getElementById("dcaKeep");
const dcaSell = document.getElementById("dcaSell");

let dcaCtx = null;

function closeDeckCardActions(){
  if (!dca) return;
  dca.classList.add("hidden");
  dca.setAttribute("aria-hidden","true");
  dcaCtx = null;
}

function computeSellGold(card){
  const gps = Number(card?.gps) || 0;
  const mult = Number(getTotalMutationMult(card)) || 1;
  const base = Math.max(1, Math.round(gps / mult));
  return Math.max(1, Math.round(base * mult));
}
/* ================= Deck Card Inline Overlay (on-card details + actions) ================= */
let deckInlineCtx = null;

function isDeckInlineSelected(deckKey, idx){
  return !!deckInlineCtx && deckInlineCtx.deckKey === deckKey && deckInlineCtx.idx === idx;
}
function setDeckInlineSelected(deckKey, idx){
  deckInlineCtx = { deckKey, idx };
  try{ closeDeckCardActions(); }catch(_){}
}
function clearDeckInlineSelected(){
  deckInlineCtx = null;
  try{ closeDeckCardActions(); }catch(_){}
}

document.addEventListener("keydown", (e)=>{
  if (e.key === "Escape" && deckInlineCtx){
    clearDeckInlineSelected();
    buildSlots();
  }
});
function openDeckCardActions(deckKey, idx, card){
  if (!dca || !card) return;
  dcaCtx = { deckKey, idx, cardId: card.id };

  if (dcaTitle) dcaTitle.textContent = card.name || "Card";
  const rarity = (card.rarity || "common").toUpperCase();
  const mut = mutationLabel(card);
  const gps = Number(card.gps)||0;
  const sellGold = computeSellGold(card);

  if (dcaMeta){
    dcaMeta.innerHTML = `
      <div><b>Rarity:</b> ${escapeHtml(rarity)}</div>
      <div><b>Mutation:</b> ${escapeHtml(mut)}</div>
      <div><b>Gold/sec:</b> ${fmt(gps)}</div>
      <div style="opacity:.85;margin-top:8px"><b>Sell value:</b> ${fmt(sellGold)} gold</div>
    `;
  }

  dca.classList.remove("hidden");
  dca.setAttribute("aria-hidden","false");
}

if (dcaClose) dcaClose.addEventListener("click", closeDeckCardActions);
document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeDeckCardActions(); });

if (dcaKeep) dcaKeep.addEventListener("click", ()=>{
  if (!dcaCtx) return;
  const id = state.decks[dcaCtx.deckKey][dcaCtx.idx];
  state.decks[dcaCtx.deckKey][dcaCtx.idx] = null;
  moveCardToInventory(id);
  saveState();
  buildSlots();
  syncUI();
  closeDeckCardActions();
});

if (dcaSell) dcaSell.addEventListener("click", ()=>{
  if (!dcaCtx) return;
  const card = getCardById(dcaCtx.cardId);
  if (!card) { closeDeckCardActions(); return; }

  if (card.fav){
    toast("Protected", "Unheart (unfavorite) this card before selling.");
    return;
  }

  const sellGold = computeSellGold(card);
  state.gold += sellGold;

  state.decks.A = state.decks.A.map(id => id === card.id ? null : id);
  state.decks.B = state.decks.B.map(id => id === card.id ? null : id);

  state.cardsOwned = state.cardsOwned.filter(c => c.id !== card.id);

  saveState();
  buildSlots();
  renderCardsModal();
  syncUI();
  closeDeckCardActions();
});

function updateTowersUI(){
  const tier = getSummonerTier();
  const mult = towerMultiplierForTier(tier);
  const cap = towerCapForTier(tier);

  const baseRate = computeDeckGps();
  const rate = Math.round(baseRate * mult);

  const rateEl = document.getElementById("towersRate");
  if (rateEl) rateEl.textContent = fmt(rate);

  const stored = Math.floor(state.towers?.stored || 0);
  const storedEl = document.getElementById("towersStored");
  if (storedEl) storedEl.textContent = fmt(stored);

  const capEl = document.getElementById("towersCap");
  if (capEl) capEl.textContent = fmt(cap);

  const pctEl = document.getElementById("towerPercent");
  if (pctEl){
    const storedRaw = Number(state.towers?.stored || 0);
    const pct = clamp(Math.round((storedRaw / cap) * 100), 1, 100);
    pctEl.textContent = `${pct}%`;
  }

  const multEl = document.getElementById("towersMult");
  if (multEl) multEl.textContent = `${mult.toFixed(1)}x`;
}

/* ================= Tooltip helpers ================= */
const tooltipEl = document.getElementById("cardTooltip");
let tooltipPinned = false;
let tooltipOwnerEl = null;

function tooltipIsShown(){
  return !!(tooltipEl && tooltipEl.classList.contains("show") && tooltipEl.getAttribute("aria-hidden") !== "true");
}

document.addEventListener("pointerdown", (e)=>{
  if (e.pointerType !== "touch") return;
  if (!tooltipIsShown()) return;

  const t = e.target;
  try{
    if (tooltipEl && (t === tooltipEl || tooltipEl.contains(t))) return;
  }catch(_){}

  try{
    if (tooltipOwnerEl && (t === tooltipOwnerEl || tooltipOwnerEl.contains(t))) return;
  }catch(_){}

  tooltipOwnerEl = null;
  hideTooltip();
}, { passive:true, capture:true });

function positionTooltip(x, y){
  if (!tooltipEl) return;
  const pad = 14;
  const maxX = window.innerWidth - tooltipEl.offsetWidth - pad;
  const maxY = window.innerHeight - tooltipEl.offsetHeight - pad;
  const left = Math.max(pad, Math.min(x + 16, maxX));
  const top  = Math.max(pad, Math.min(y + 16, maxY));
  tooltipEl.style.left = left + "px";
  tooltipEl.style.top = top + "px";
}

function hideTooltip(){
  tooltipOwnerEl = null;
  hideCardTooltip();
}

function bindLongPressHold(el, onShow, onHide){
  if (!el) return;
  if (!IS_HOVERLESS_TOUCH) return;

  let lpTimer = null;
  let startX = 0, startY = 0;
  let active = false;
  let triggered = false;

  const clear = () => {
    active = false;
    if (lpTimer){ clearTimeout(lpTimer); lpTimer = null; }
  };

  if (el) el.addEventListener("pointerdown", (e)=>{
    if (e.pointerType !== "touch") return;
    clear();
    active = true;
    triggered = false;
    startX = e.clientX; startY = e.clientY;

    lpTimer = setTimeout(()=>{
      if (!active) return;
      triggered = true;
      try { onShow && onShow(e); } catch(_){}
      try { e.preventDefault(); } catch(_){}
      try { e.stopPropagation(); } catch(_){}
    }, 240);
  }, { passive:false });

  if (el) el.addEventListener("pointermove", (e)=>{
    if (!active) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > 10 || dy > 10){
      clear();
      if (triggered){ try{ onHide && onHide(e);}catch(_){} }
    }
  }, { passive:true });

  const end = (e) => {
    const wasTriggered = triggered;
    clear();
    if (wasTriggered){
      try { onHide && onHide(e);} catch(_){}
    }
  };
  if (el) el.addEventListener("pointerup", end, { passive:true });
  if (el) el.addEventListener("pointercancel", end, { passive:true });
}

function bindLongPressTooltip(el, getHtml){
  if (!el) return;
  if (!IS_HOVERLESS_TOUCH) return;

  let lpTimer = null;
  let startX = 0, startY = 0;
  let active = false;
  let triggered = false;

  const clear = () => {
    active = false;
    if (lpTimer){ clearTimeout(lpTimer); lpTimer = null; }
  };

  if (el) el.addEventListener("pointerdown", (e)=>{
    if (e.pointerType !== "touch") return;
    clear();
    active = true;
    triggered = false;
    startX = e.clientX; startY = e.clientY;

    lpTimer = setTimeout(()=>{
      if (!active) return;
      triggered = true;
      tooltipPinned = true;

      const html = (typeof getHtml === "function") ? getHtml() : "";
      showTooltipHtml(html, e.clientX, e.clientY);

      try { e.preventDefault(); } catch(_){}
      try { e.stopPropagation(); } catch(_){}
    }, 280);
  }, { passive:false });

  if (el) el.addEventListener("pointermove", (e)=>{
    if (!active) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > 10 || dy > 10){
      clear();
      return;
    }
    if (triggered){
      positionTooltip(e.clientX, e.clientY);
    }
  }, { passive:true });

  const end = () => {
    const wasTriggered = triggered;
    clear();
    if (wasTriggered){
      tooltipPinned = false;
      hideTooltip();
    }
  };
  if (el) el.addEventListener("pointerup", end, { passive:true });
  if (el) el.addEventListener("pointercancel", end, { passive:true });
}

function formatCardDetails(card){
  if (!card) return "";
  const name = escapeHtml(card.name || "Unknown");
  const rarity = escapeHtml((card.rarity || "common").toUpperCase());

  const muts = getMutationList(card);
  let mutBadgeHtml = "";
  if (!muts.length){
    mutBadgeHtml = `<span class="ttBadge ttMutationGroup"><span class="ttMutWord mutation-normal">NORMAL</span></span>`;
  }else{
    const parts = muts.map((m)=>{
      const key = normMutKey(m) || "normal";
      const txt = escapeHtml(String(m).toUpperCase());
      return `<span class="ttMutWord mutation-${key}">${txt}</span>`;
    });
    mutBadgeHtml = `<span class="ttBadge ttMutationGroup">${parts.join('<span class="ttMutSep"> + </span>')}</span>`;
  }

  const gps = (Number.isFinite(Number(card.gps)) && Number(card.gps) > 0) ? Number(card.gps) : computeCardGps(card);
  return `
    <div class="ttName">${name}</div>
    <div class="ttRow"><span class="ttBadge">${rarity}</span>${mutBadgeHtml}</div>
    <div class="ttRow">Gold/sec: <b>${fmt(gps)}</b></div>
  `;
}
function showTooltipHtml(html, x, y){
  if (!tooltipEl) return;
  tooltipEl.innerHTML = html || "";
  const pad = 14;
  const maxX = window.innerWidth - tooltipEl.offsetWidth - pad;
  const maxY = window.innerHeight - tooltipEl.offsetHeight - pad;
  const left = Math.max(pad, Math.min(x + 16, maxX));
  const top  = Math.max(pad, Math.min(y + 16, maxY));
  tooltipEl.style.left = left + "px";
  tooltipEl.style.top = top + "px";
  tooltipEl.classList.add("show");
  tooltipEl.setAttribute("aria-hidden","false");
}

function showCardTooltip(card, x, y){
  showTooltipHtml(formatCardDetails(card), x, y);
}

function formatSummonerTooltip(){
  const tier = getSummonerTier();
  const activeId = getActiveSummonerId();
  const s = getSummonerDef(activeId);

  const mult = towerMultiplierForTier(tier);
  const cap = towerCapForTier(tier);
  const petLimit = petLimitForTier(tier);
  const bonus15 = bonusGoldPer15sForTier(tier);

  const lines = [];
  lines.push(bonus15 > 0 ? `+${fmt(bonus15)} gold / 15s` : "No bonus gold");
  lines.push(`Pets: ${petLimit}`);
  lines.push(`Tower: ${mult.toFixed(1)}x • Cap ${fmt(cap)}`);
  lines.push(`Deck: ${activeId==="3dm4rk" ? "Only Deck A slots 1–3" : "Tier-based slots + Deck B"}`);

  return `
    <div class="ttName">${escapeHtml(s.name || "Summoner")}</div>
    <div class="ttRow"><span class="ttBadge">SUMMONER</span><span class="ttBadge">Tier ${tier}</span></div>
    <div class="ttRow">${escapeHtml(lines.join(" • "))}</div>
    <div class="ttRow" style="opacity:.82">${escapeHtml(s.desc || "")}</div>
  `;
}

function bindSummonerTooltip(el){
  if (!el) return;
  if (el) el.addEventListener("mouseenter", (e)=> showTooltipHtml(formatSummonerTooltip(), e.clientX, e.clientY));
  if (el) el.addEventListener("mousemove", (e)=> showTooltipHtml(formatSummonerTooltip(), e.clientX, e.clientY));
  if (el) el.addEventListener("mouseleave", hideCardTooltip);
  bindLongPressTooltip(el, ()=>formatSummonerTooltip());

  if (IS_HOVERLESS_TOUCH){
    if (el) el.addEventListener("click", (e)=>{
      const html = formatSummonerTooltip();

      if (tooltipIsShown() && tooltipOwnerEl === el){
        tooltipOwnerEl = null;
        hideTooltip();
        try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
        return;
      }

      tooltipOwnerEl = el;
      let x = e.clientX, y = e.clientY;
      if (!Number.isFinite(x) || !Number.isFinite(y)){
        const r = el.getBoundingClientRect();
        x = r.left + r.width/2;
        y = r.top + r.height/2;
      }
      showTooltipHtml(html, x, y);
    }, true);
  }
}

function hideCardTooltip(){
  if (!tooltipEl) return;
  tooltipEl.classList.remove("show");
  tooltipEl.setAttribute("aria-hidden","true");
}

function bindTooltip(el, getCard){
  if (!el) return;
  if (el) el.addEventListener("mouseenter", (e)=>{
    const c = getCard();
    if (!c) return;
    showCardTooltip(c, e.clientX, e.clientY);
  });
  if (el) el.addEventListener("mousemove", (e)=>{
    const c = getCard();
    if (!c) return;
    showCardTooltip(c, e.clientX, e.clientY);
  });
  if (el) el.addEventListener("mouseleave", ()=>{
    hideCardTooltip();
  });

  bindLongPressTooltip(el, ()=>{
    const c = getCard();
    return c ? formatCardDetails(c) : "";
  });

  if (IS_HOVERLESS_TOUCH){
    if (el) el.addEventListener("click", (e)=>{
      const c = getCard();
      if (!c) return;

      if (tooltipIsShown() && tooltipOwnerEl === el){
        tooltipOwnerEl = null;
        hideTooltip();
        try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
        return;
      }

      tooltipOwnerEl = el;

      let x = e.clientX, y = e.clientY;
      if (!Number.isFinite(x) || !Number.isFinite(y)){
        const r = el.getBoundingClientRect();
        x = r.left + r.width/2;
        y = r.top + r.height/2;
      }
      showTooltipHtml(formatCardDetails(c), x, y);
    }, true);
  }
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

function escapeAttr(str){
  return escapeHtml(str).replace(/`/g, "");
}

/* ================= RNG helpers ================= */
function pickRarity(){
  const lock = (state && state.adminShopLock) ? String(state.adminShopLock).toLowerCase().trim() : "";
  if (lock){
    const hit = RARITIES.find(r => String(r.k).toLowerCase() === lock);
    if (hit) return hit;
  }

  const r = Math.random();
  let acc = 0;
  for (const o of RARITIES){
    acc += o.w / totalW;
    if (r <= acc) return o;
  }
  return RARITIES[0];
}
function newItem(){
  const r = pickRarity();
  return { id: uid(), rarity: r.k, price: r.price };
}
function pickFromWeighted(list){
  const total = list.reduce((s,i)=>s + (i.w ?? 1), 0);
  let r = Math.random() * total;
  for (const item of list){
    r -= (item.w ?? 1);
    if (r <= 0) return item;
  }
  return list[0];
}

function rollCardForRarity(rarity){
  if (String(rarity||"").toLowerCase() === "valentines"){
    const pool = CARD_REWARDS.valentines || [];
    const mut = rollMutation();
    const mk = normMutKey(mut.k);
    const muts = (mk && mk !== "normal") ? [titleMutKey(mut.k)] : [];
    if (!pool.length){
      const fallback = { id: uid(), rarity:"valentines", name:"Unknown", img:"cards/card.png", pullChance:1, w:1, baseGps:0, mutations:muts, location:"inventory", fav:false };
      recomputeCardStats(fallback);
      return fallback;
    }
    const base = pickFromWeighted(pool);
    const card = {
      id: uid(),
      rarity: "valentines",
      name: base.name,
      img: base.img || "card.png",
      pullChance: Number(base.chance) || 0,
      w: Number(base.chance) || 0,
      baseGps: Number(base.gps) || Number(CARD_GPS[base.name]) || 0,
      mutations: muts,
      location: "inventory",
      fav: false
    };
    recomputeCardStats(card);
    return card;
  }

  const pool = CARD_REWARDS[rarity] || [];
  const mut = rollMutation();

  const mk = normMutKey(mut.k);
  const muts = (mk && mk !== "normal") ? [titleMutKey(mut.k)] : [];

  if (!pool.length){
    const fallback = {
      id: uid(),
      rarity,
      name:"Unknown",
      img:"cards/card.png",
      pullChance: 1,
      w:1,
      baseGps: 0,
      mutations: muts,
      location: "inventory",
      fav: false
    };
    recomputeCardStats(fallback);
    return fallback;
  }

  const base = pickFromWeighted(pool);

  const card = {
    id: uid(),
    rarity,
    name: base.name,
    img: base.img || "cards/card.png",
    pullChance: Number(base.w) || 0,
    w: Number(base.w) || 0,
    baseGps: Number(CARD_GPS[base.name]) || 0,
    mutations: muts,
    location: "inventory",
    fav: false,
    animated: base.animated || false,
    frames: base.frames || [],
    frameInterval: base.frameInterval || 150
  };

  recomputeCardStats(card);
  return card;
}

/* ================= Shop Cards ================= */
function setCardVisual(el, item){
  el.className = `card r-${item.rarity}`;
  el.querySelector(".price").textContent = `${fmt(item.price)} Gold`;
}
function updateIndexDOM(idx){
  document.querySelectorAll(`.card[data-i="${idx}"]`).forEach(node=>{
    setCardVisual(node, stock[idx]);
    node.classList.remove("restock");
    void node.offsetWidth;
    node.classList.add("restock");
  });
}

function createCardElement(item, baseIndex){
  const el = document.createElement("div");
  el.className = `card r-${item.rarity}`;
  el.dataset.i = String(baseIndex);

  el.dataset.sfx = "purchase";
  el.innerHTML = `
    <div class="aura"></div>
    <div class="cardBack" aria-hidden="true"></div>
    <div class="meta"><span>CARD</span><span class="price">${fmt(item.price)} Gold</span></div>
  `;

  if (el) el.addEventListener("click", ()=>{
    const idx = Number(el.dataset.i);
    const cur = stock[idx];
    if (!cur) return;

    if (state.gold < cur.price){
      toast("Not enough gold", `Need ${fmt(cur.price)} gold.`);
      return;
    }

    state.gold -= cur.price;
    state.invCounts[cur.rarity] = (state.invCounts[cur.rarity] || 0) + 1;
    saveState();
    syncUI();

    playPurchaseSFX();
    el.classList.add("pulse");
    setTimeout(()=>el.classList.remove("pulse"), 240);
    toast("Purchased!", `+1 ${cur.rarity.toUpperCase()} pack`);

    stock[idx] = newItem();
    updateIndexDOM(idx);
  });

  return el;
}

function buildMarquee(){
  stock = Array.from({length:22}, newItem);
  track.innerHTML = "";
  for (let rep=0; rep<2; rep++){
    stock.forEach((it, i)=> track.appendChild(createCardElement(it, i)));
  }
}

/* ================= Inventory UI ================= */
function rarityLabel(r){ return String(r).toUpperCase(); }
function dotColor(r){ return auraVarByRarity[r] ?? "var(--common)"; }

function makeInvRow(rarity, count){
  const row = document.createElement("div");
  row.className = "invRow";

  const left = document.createElement("div");
  left.className = "invLeft";

  const dot = document.createElement("div");
  dot.className = "dot";
  dot.style.background = dotColor(rarity);
  dot.style.boxShadow = `0 0 16px color-mix(in srgb, ${dotColor(rarity)} 60%, transparent)`;

  const name = document.createElement("div");
  name.className = "invName";
  name.innerHTML = `<b>${rarityLabel(rarity)} PACK</b><small>x${fmt(count)} owned</small>`;

  left.appendChild(dot);
  left.appendChild(name);

  const actions = document.createElement("div");
  actions.className = "actions";

  const btn1 = document.createElement("button");
  btn1.className = "btn btnPrimary";
  btn1.dataset.sfx = "open-card";
  btn1.textContent = "Open 1x";
  btn1.disabled = count < 1;
  btn1.onclick = ()=> openPacks(rarity, 1);

  const btn5 = document.createElement("button");
  btn5.className = "btn";
  btn5.dataset.sfx = "open-card";
  btn5.textContent = "Open 5x";
  btn5.disabled = count < 5;
  btn5.onclick = ()=> openPacks(rarity, 5);

  const btnAll = document.createElement("button");
  btnAll.className = "btn";
  btnAll.dataset.sfx = "open-card";
  btnAll.textContent = "Reveal All";
  btnAll.disabled = count < 1;
  btnAll.onclick = ()=> openPacks(rarity, count);

  actions.appendChild(btn1);
  actions.appendChild(btn5);
  actions.appendChild(btnAll);

  row.appendChild(left);
  row.appendChild(actions);
  return row;
}

function updateInvBadge(){
  const total = Object.values(state.invCounts || {}).reduce((a,n)=>a+(Number(n)||0),0);

  if (invBadge){
    invBadge.textContent = String(total);
  }
  if (invTotalEl){
    invTotalEl.textContent = fmt(total);
  }
  if (invPacksBadge){
    invPacksBadge.textContent = String(total);
    invPacksBadge.style.display = total > 0 ? "inline-flex" : "none";
  }

  if (!invModalGrid || !invModalEmpty) return;

  if (total === 0){
    invModalGrid.innerHTML = "";
    invModalEmpty.style.display = "block";
    return;
  }
  invModalEmpty.style.display = "none";
}

function renderInventory(){
  invModalGrid.innerHTML = "";
  const total = Object.values(state.invCounts).reduce((a,n)=>a+n,0);
  updateInvBadge();
  if (total === 0) return;

  invOrder.forEach(r=>{
    const c = state.invCounts[r] || 0;
    if (c > 0) invModalGrid.appendChild(makeInvRow(r, c));
  });
}

/* ================= Rewards (CARDS ONLY) ================= */
let opening = null; // {rarity, count}

function renderRewardGrid(cards, rarity){
  rewardGrid.innerHTML = "";
  const n = cards.length;
  let cols = 4;
  if (n === 1) cols = 1;
  else if (n <= 4) cols = 2;
  else if (n <= 9) cols = 3;
  rewardGrid.style.setProperty("--cols", String(Math.max(1, Math.min(cols, 5))));

  cards.forEach((c, idx)=>{
    const tile = document.createElement("div");
    tile.className = `rewardTile r-${rarity}`;
    tile.style.animationDelay = (idx * 0.04) + "s";

    applyMutationGlow(tile, c);

    const img = document.createElement("img");
    img.loading = "eager";
    img.decoding = "async";
    img.alt = c?.name || "Card";
    img.src = c?.img || "cards/card.png";
    img.onerror = ()=>{ img.src = "cards/card.png"; };

    // Start animation if needed
    startCardAnimation(img, c);

    tile.appendChild(img);

    bindTooltip(tile, ()=>c);

    rewardGrid.appendChild(tile);
  });
}

function openPacks(rarity, count){
  const have = state.invCounts[rarity] || 0;
  if (have <= 0) return;

  playCardOpeningSFX();

  try{
    if (invOverlay && !invOverlay.classList.contains("show")) openInventory();
    setInventoryTab("packs");
  }catch(_){ }

  opening = {
    rarity,
    countToOpen: Math.max(1, Math.min(count, have)),
    revealed: false
  };

  rewardsOkBtn.disabled = true;
  rewardGrid.innerHTML = "";
  openRewards();

  setTimeout(()=>doReveal(), 220);
}

function doReveal(){
  if (!opening || opening.revealed) return;
  opening.revealed = true;

  const cards = [];
  for (let i=0; i<opening.countToOpen; i++){
    const card = rollCardForRarity(opening.rarity);
    cards.push(card);
    state.cardsOwned.push(card);
  }

  try{
    ensureValentines();
    if (state.valentines?.daily?.progress){
      state.valentines.daily.progress.packsOpened = (Number(state.valentines.daily.progress.packsOpened)||0) + opening.countToOpen;
    }
  }catch(_){ }

  state.invCounts[opening.rarity] = Math.max(0, (state.invCounts[opening.rarity] || 0) - opening.countToOpen);

  saveState();
  syncUI();

  renderRewardGrid(cards, opening.rarity);

  setTimeout(()=>{ rewardsOkBtn.disabled = false; }, 220);
  toast("Cards obtained", `${opening.countToOpen} pack(s) opened • Added to Cards`);
}

/* ================= Cards modal ================= */
function updateCardsBadge(){
  const available = getUnassignedCards();
  const n = available.length;

  if (cardsBadge){
    cardsBadge.textContent = String(n);
    cardsBadge.style.display = n > 0 ? "inline-flex" : "none";
  }

  if (invCardsBadge){
    invCardsBadge.textContent = String(n);
    invCardsBadge.style.display = n > 0 ? "inline-flex" : "none";
  }
}

function getHeartedInventoryCount(){
  return getInventoryCards().filter(c=>c && c.fav===true).length;
}

function updateCardsModalCounts(){
  if (cardsTotalCount) cardsTotalCount.textContent = String(getInventoryCards().length);
  if (cardsHeartedCount) cardsHeartedCount.textContent = String(getHeartedInventoryCount());
}

// 🔥 PERFORMANCE: new animation functions using FrameAnimationManager
function startCardAnimation(imgEl, card) {
  if (!imgEl || !card || !card.animated || !Array.isArray(card.frames) || card.frames.length < 2) return;
  FrameAnimationManager.animate(imgEl, card.frames, card.frameInterval || 150);
}

function stopCardAnimation(imgEl) {
  if (imgEl) FrameAnimationManager.stop(imgEl);
}

function preloadCardFrames(card) {
  if (card && card.animated && Array.isArray(card.frames)) {
    card.frames.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }
}

Object.values(CARD_REWARDS).forEach(pool => {
  if (Array.isArray(pool)) {
    pool.forEach(card => preloadCardFrames(card));
  }
});

function renderCardsModal(){
  ensureDeckCardLocations();

  const q = (cardsSearchInput?.value || "").trim().toLowerCase();

  let available = getInventoryCards();
  if (q){
    available = available.filter(c => String(c?.name||"").toLowerCase().includes(q));
  }

  // Stop any old animations (cleanup)
  cardsGrid.querySelectorAll('img').forEach(stopCardAnimation);

  cardsGrid.innerHTML = "";
  updateCardsModalCounts();

  if (!available.length){
    cardsEmpty.style.display = "block";
    return;
  }
  cardsEmpty.style.display = "none";

  if (!cardsGrid._delegatedCardsModal){
    cardsGrid._delegatedCardsModal = true;

    const onActivate = (evt)=>{
      const favEl = evt.target?.closest?.('[data-action="fav"]');
      if (favEl && cardsGrid.contains(favEl)){
        evt.preventDefault();
        evt.stopPropagation();
        const id = favEl.getAttribute("data-card-id");
        const card = getCardById(id);
        if (!card) return;
        card.fav = !card.fav;
        saveState();
        renderCardsModal();
        return;
      }

      const sendEl = evt.target?.closest?.('[data-action="send"]');
      if (sendEl && cardsGrid.contains(sendEl)){
        evt.preventDefault();
        evt.stopPropagation();
        const id = sendEl.getAttribute("data-card-id");
        const card = getCardById(id);
        if (!card) return;
        openGiftSendModal(id);
        return;
      }

      const tile = evt.target?.closest?.(".cardThumb");
      if (!tile || !cardsGrid.contains(tile)) return;

      const id = tile.getAttribute("data-card-id");
      const card = getCardById(id);
      if (!card) return;

      if (card.fav){
        toast("Protected", "Unheart (unfavorite) this card before selling.");
        return;
      }

      const sellGold = computeSellGold(card);
      const ok = confirm(`Sell ${card?.name||"this card"} for ${sellGold} gold?`);
      if (!ok) return;

      removeCardEverywhere(card.id);
      state.gold = (Number(state.gold)||0) + sellGold;
      saveState();
      syncUI();
      renderCardsModal();
      buildSlots();
      updateTowersUI();
    };

    if (cardsGrid) cardsGrid.addEventListener("click", onActivate);

    if (cardsGrid) cardsGrid.addEventListener("keydown", (evt)=>{
      if (evt.key !== "Enter" && evt.key !== " ") return;
      const t = evt.target;
      if (!t) return;
      evt.preventDefault();
      t.click?.();
    });
  }

  available.forEach(c=>{
    const d = document.createElement("div");
    d.className = "cardThumb";
    d.setAttribute("role","button");
    d.setAttribute("tabindex","0");
    d.setAttribute("data-card-id", c.id);
    d.title = "Click to sell this card";

    applyMutationGlow(d, c);

    const img = document.createElement("img");
    img.src = c?.img || "cards/card.png";
    img.onerror = ()=>{ img.src = "cards/card.png"; };
    startCardAnimation(img, c);
    d.appendChild(img);

    const fav = document.createElement("div");
    fav.className = "cardFavBtn" + (c.fav ? " isOn" : "");
    fav.setAttribute("role","button");
    fav.setAttribute("tabindex","0");
    fav.setAttribute("data-action","fav");
    fav.setAttribute("data-card-id", c.id);
    fav.setAttribute("aria-label", c.fav ? "Unfavorite" : "Favorite");
    fav.textContent = c.fav ? "❤" : "♡";
    d.appendChild(fav);

    const send = document.createElement("div");
    send.className = "cardSendBtn" + (c.fav ? " isDisabled" : "");
    send.setAttribute("role","button");
    send.setAttribute("tabindex","0");
    send.setAttribute("data-action","send");
    send.setAttribute("data-card-id", c.id);
    send.setAttribute("aria-label","Send gift");
    send.title = c.fav ? "Unheart to send" : "Send as gift";
    send.textContent = "✈";
    d.appendChild(send);

    bindTooltip(d, ()=>getCardById(c.id) || c);

    cardsGrid.appendChild(d);
  });
}

function setModalScrollLock(forceLock){
  try{
    const anyOpen = forceLock || document.querySelector(".modalOverlay.show");
    document.documentElement.classList.toggle("noScroll", !!anyOpen);
    document.body.classList.toggle("noScroll", !!anyOpen);
  }catch(e){}
}

function openDeckPicker(deckKey, idx){
  ensureDecks();
  migrateCards();

  deckPicking = { deckKey, idx, selectedCardId: null };

  if (deckSearchInput) deckSearchInput.value = "";
  if (deckSearchDropdown){ deckSearchDropdown.style.display = "none"; deckSearchDropdown.innerHTML = ""; }

  if (deckHint){
    deckHint.textContent = `Choose a card for Deck ${deckKey} • Slot ${idx+1}`;
  }

  renderDeckPicker();
  deckOverlay.classList.add("show");
  deckOverlay.setAttribute("aria-hidden","false");
  setModalScrollLock(true);
}

function closeDeckPicker(){
  deckPickGrid.querySelectorAll('img').forEach(stopCardAnimation);
  stopCardAnimation(deckDetailsImg);

  deckOverlay.classList.remove("show");
  deckOverlay.setAttribute("aria-hidden","true");
  deckPicking = null;

  setModalScrollLock(false);
  if (deckSearchInput) deckSearchInput.value = "";
  if (deckSearchDropdown){ deckSearchDropdown.style.display = "none"; deckSearchDropdown.innerHTML = ""; }
  FrameAnimationManager.stopAll(); // extra cleanup
}

function renderDeckPicker(){
  if (!deckPickGrid) return;

  deckPickGrid.innerHTML = "";

  if (!getInventoryCards().length){
    deckEmpty.style.display = "block";
    deckSelectBtn.disabled = true;
    setDeckDetails(null);
    return;
  }

  deckEmpty.style.display = "none";

  const curId = state.decks?.[deckPicking.deckKey]?.[deckPicking.idx] || null;
  const used = getUsedDeckCardIdSet(curId);
  const pool = getInventoryCards().filter(c=>c && !c.fav && !used.has(c.id));

  const qRaw = (deckSearchInput?.value || "").trim().toLowerCase();
  let shown = pool;
  if (qRaw){
    shown = pool.filter(c=>{
      const nm = String(c.name||"").toLowerCase();
      const rr = String(c.rarity||"").toLowerCase();
      const muts = String(mutationLabel(c)||"").toLowerCase();
      return nm.includes(qRaw) || rr.includes(qRaw) || muts.includes(qRaw);
    });
  }

  if (!shown.length){
    if (deckEmpty){
      if (!deckEmpty.dataset.baseText) deckEmpty.dataset.baseText = deckEmpty.textContent || "No cards available.";
      deckEmpty.style.display = "block";
      deckEmpty.textContent = qRaw ? `No cards match "${(deckSearchInput?.value||"").trim()}"` : deckEmpty.dataset.baseText;
    }
    deckSelectBtn.disabled = true;
    setDeckDetails(null);
    if (deckSearchDropdown) deckSearchDropdown.style.display = "none";
    return;
  }

  const selectCard = (c)=>{
    document.querySelectorAll(".deckPickItem.sel").forEach(n=>n.classList.remove("sel"));
    const el = deckPickGrid.querySelector(`.deckPickItem[data-id="${c.id}"]`);
    if (el) el.classList.add("sel");
    deckPicking.selectedCardId = c.id;
    deckSelectBtn.disabled = false;
    setDeckDetails(c);
  };

  shown.forEach(c=>{
    const item = document.createElement("div");
    item.className = "deckPickItem";
    item.dataset.id = c.id;

    applyMutationGlow(item, c);

    const img = document.createElement("img");
    img.src = c.img || "cards/card.png";
    img.onerror = ()=>{ img.src = "cards/card.png"; };
    startCardAnimation(img, c);

    const meta = document.createElement("div");
    meta.className = "deckPickMeta";

    const name = document.createElement("div");
    name.className = "deckPickName";
    name.textContent = c.name || "Unknown";

    const tag = document.createElement("div");
    tag.className = "deckPickTag";
    tag.textContent = (c.rarity || "common").toUpperCase();

    meta.appendChild(name);
    meta.appendChild(tag);

    item.appendChild(img);
    item.appendChild(meta);

    bindTooltip(item, ()=>c);

    if (item) item.addEventListener("click", ()=>{
      selectCard(c);
      if (deckSearchDropdown) deckSearchDropdown.style.display = "none";
    });

    deckPickGrid.appendChild(item);
  });

  if (deckSearchDropdown){
    const qv = (deckSearchInput?.value || "").trim();
    if (qv){
      const top = shown.slice(0, 8);
      deckSearchDropdown.innerHTML = top.map(c=>{
        const nm = escapeHtml(String(c.name||"Unknown"));
        const sub = escapeHtml(`${String(c.rarity||"common").toUpperCase()} • ${mutationLabel(c)} • ${fmt(Number(c.gps)||0)}/s`);
        const img = escapeAttr(c.img || "cards/card.png");
        return `
          <button type="button" class="deckSearchRow" data-id="${escapeAttr(c.id)}">
            <img class="deckSearchImg" src="${img}" alt="${nm}" onerror="this.src='cards/card.png'"/>
            <div class="deckSearchMid">
              <div class="deckSearchName">${nm}</div>
              <div class="deckSearchSub">${sub}</div>
            </div>
          </button>
        `;
      }).join("") + `<div class="deckSearchMeta">Showing ${top.length} of ${shown.length} match${shown.length===1?"":"es"}</div>`;
      deckSearchDropdown.style.display = "block";

      deckSearchDropdown.querySelectorAll(".deckSearchRow").forEach(btn=>{
        if (btn) btn.addEventListener("click", ()=>{
          const id = btn.getAttribute("data-id");
          const card = shown.find(x=>String(x.id)===String(id));
          if (card) selectCard(card);
          deckSearchDropdown.style.display = "none";
        });
      });
    }else{
      deckSearchDropdown.style.display = "none";
      deckSearchDropdown.innerHTML = "";
    }
  }

  if (curId){
    const cur = getCardById(curId);
    if (cur){
      setDeckDetails(cur);
      deckPicking.selectedCardId = curId;
      deckSelectBtn.disabled = false;
      const el = deckPickGrid.querySelector(`.deckPickItem[data-id="${curId}"]`);
      if (el) el.classList.add("sel");
    }
  }else{
    setDeckDetails(null);
    deckSelectBtn.disabled = true;
  }
}

function setDeckDetails(card){
  if (!deckDetailsImg) return;
  stopCardAnimation(deckDetailsImg);

  if (!card){
    deckDetailsImg.src = "cards/card.png";
    deckDetailsName.textContent = "—";
    deckDetailsRarity.textContent = "—";
    deckDetailsChance.textContent = "—";
    deckDetailsMutation.textContent = "—";
    deckDetailsGps.textContent = "—";
    return;
  }
  deckDetailsImg.src = card.img || "cards/card.png";
  startCardAnimation(deckDetailsImg, card);
  deckDetailsName.textContent = card.name || "Unknown";
  deckDetailsRarity.textContent = (card.rarity || "common").toUpperCase();
  deckDetailsChance.textContent = `${Number(card.pullChance ?? card.w ?? 0)}%`;
  deckDetailsMutation.textContent = mutationLabel(card);
  deckDetailsGps.textContent = `${fmt(Number(card.gps)||0)} / sec`;
}

/* ================= Modals open/close ================= */
function setInventoryTab(tab){
  const t = (tab === "pets" || tab === "cards") ? tab : "packs";

  if (invTabs){
    invTabs.querySelectorAll(".invTab").forEach(btn=>{
      btn.classList.toggle("isActive", btn.dataset.tab === t);
    });
  }

  if (invPanelPacks) invPanelPacks.style.display = (t === "packs") ? "block" : "none";
  if (invPanelPets)  invPanelPets.style.display  = (t === "pets")  ? "block" : "none";
  if (invPanelCards) invPanelCards.style.display = (t === "cards") ? "block" : "none";

  if (t === "packs") renderInventory();
  else if (t === "pets") renderPets();
  else renderCardsModal();

  updatePetsBadge();
  updateCardsBadge();

  if (invPacksBadge){
    const total = Object.values(state.invCounts || {}).reduce((a,n)=>a+(Number(n)||0),0);
    invPacksBadge.textContent = String(total);
    invPacksBadge.style.display = total > 0 ? "inline-flex" : "none";
  }
}

function openInventory(){
  if (!invOverlay) return;
  setInventoryTab(state.ui?.invTab || "packs");
  invOverlay.classList.add("show");
  invOverlay.setAttribute("aria-hidden","false");
  setTimeout(()=> invTabs?.querySelector?.(".invTab.isActive")?.focus?.(), 0);
}
function closeInventory(){
  if (!invOverlay) return;
  const active = invTabs?.querySelector?.(".invTab.isActive");
  const tab = active?.dataset?.tab;
  if (tab){
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.invTab = tab;
    saveState(state);
  }

  invOverlay.classList.remove("show");
  invOverlay.setAttribute("aria-hidden","true");
  FrameAnimationManager.stopAll(); // stop any animations in inventory panels
}

function openGiftSendModal(cardId){
  if (!giftSendOverlay) return;
  const card = getCardById(cardId);
  if (!card) return;

  if (card.fav){
    toast("Protected", "Unheart (unlock) this card before sending it as a gift.");
    return;
  }

  giftSelectedCardId = cardId;

  if (giftReceiverInput) giftReceiverInput.value = "";
  renderGiftPreviewCard();

  giftSendOverlay.classList.add("show");
  giftSendOverlay.setAttribute("aria-hidden","false");
  try{ giftReceiverInput?.focus?.(); }catch(_){}

  syncGiftSendDisabled();
}

function closeGiftSendModal(){
  if (!giftSendOverlay) return;
  giftSendOverlay.classList.remove("show");
  giftSendOverlay.setAttribute("aria-hidden","true");
  giftSelectedCardId = null;
  if (giftPreviewCard) giftPreviewCard.innerHTML = "";
}

function renderGiftPreviewCard(){
  if (!giftPreviewCard) return;
  giftPreviewCard.innerHTML = "";

  const card = giftSelectedCardId ? getCardById(giftSelectedCardId) : null;
  if (!card){
    giftPreviewCard.innerHTML = `<div class="muted small">No card selected.</div>`;
    return;
  }

  const tile = document.createElement("div");
  tile.className = "giftCardTile";
  tile.setAttribute("role","button");
  tile.setAttribute("tabindex","0");

  applyMutationGlow(tile, card);

  const img = document.createElement("img");
  img.src = card?.img || "cards/card.png";
  img.onerror = ()=>{ img.src = "cards/card.png"; };
  startCardAnimation(img, card);
  tile.appendChild(img);

  const badges = document.createElement("div");
  badges.className = "giftBadgeRow";

  const rarity = document.createElement("span");
  rarity.className = "giftBadge giftBadgeRarity";
  rarity.textContent = String(card?.rarity || "COMMON").toUpperCase();

  const gps = document.createElement("span");
  gps.className = "giftBadge giftBadgeGps";
  gps.textContent = `${Number(card?.gps||0)} GPS`;

  badges.appendChild(rarity);
  badges.appendChild(gps);
  tile.appendChild(badges);

  bindTooltip(tile, ()=>getCardById(card.id) || card);

  giftPreviewCard.appendChild(tile);
}

function syncGiftSendDisabled(){
  if (!giftSendBtn) return;
  const to = (giftReceiverInput?.value || "").trim();
  const ok = to.length >= 3 && !!giftSelectedCardId;
  giftSendBtn.disabled = !ok;
}

function openRewards(){
  try{ rewardsOverlay.style.zIndex = "2000"; }catch(_){ }
  rewardsOverlay.classList.add("show");
  rewardsOverlay.setAttribute("aria-hidden","false");
}
function closeRewards(){
  rewardsOverlay.classList.remove("show");
  rewardsOverlay.setAttribute("aria-hidden","true");
  try{ rewardsOverlay.style.zIndex = ""; }catch(_){ }
  opening = null;

  try{
    if (invOverlay){
      if (!invOverlay.classList.contains("show")) openInventory();
      setInventoryTab("packs");
      setTimeout(()=> invTabs?.querySelector?.('[data-tab="packs"]')?.focus?.(), 0);
    }
  }catch(_){ }
  FrameAnimationManager.stopAll(); // stop any animations in rewards grid
}

function openNotifications(){
  notifOverlay.classList.add("show");
  notifOverlay.setAttribute("aria-hidden","false");
  setNotifTab("rewards");
  renderNotifTab();
}
function closeNotifications(){
  notifOverlay.classList.remove("show");
  notifOverlay.setAttribute("aria-hidden","true");
  try{ stopMmCoreAnimation(); }catch(_){ }
  FrameAnimationManager.stopAll(); // mutation machine animations
}

async function openLeaderboards(){
  if (!leaderboardOverlay) return;
  try{ playClickSFX(); }catch(_){}
  leaderboardOverlay.classList.add("show");
  leaderboardOverlay.setAttribute("aria-hidden","false");

  if (leaderboardBody){
    leaderboardBody.innerHTML = '<div class="small muted" style="padding:10px 2px;">Loading leaderboard…</div>';
  }

  try{
    const data = await postJSON("api/leaderboard.php", {});
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    renderLeaderboards(rows);
  }catch(_){
    if (leaderboardBody){
      leaderboardBody.innerHTML = '<div class="small" style="padding:10px 2px;">Failed to load leaderboard. Please try again.</div>';
    }
  }
}

function closeLeaderboards(){
  if (!leaderboardOverlay) return;
  try{ playClickSFX(); }catch(_){}
  leaderboardOverlay.classList.remove("show");
  leaderboardOverlay.setAttribute("aria-hidden","true");
}

function renderLeaderboards(rows){
  if (!leaderboardBody) return;
  if (!rows.length){
    leaderboardBody.innerHTML = '<div class="small muted" style="padding:10px 2px;">No scores yet.</div>';
    return;
  }

  const me = String(window.__USER__?.username || "");
  const safe = (s)=> String(s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtNum = (n)=> (Number(n)||0).toLocaleString();

  const html = `
    <div class="lbTable">
      <div class="lbRow lbHead">
        <div>#</div>
        <div>Player</div>
        <div class="lbRight">Highest GPS</div>
      </div>
      ${rows.map(r=>{
        const isMe = me && String(r.username) === me;
        return `<div class="lbRow${isMe?' isMe':''}">
          <div class="lbRank">${r.rank}</div>
          <div class="lbName">${safe(r.username)}</div>
          <div class="lbGps lbRight">${fmtNum(r.highest_gps)}</div>
        </div>`;
      }).join("")}
    </div>
  `;
  leaderboardBody.innerHTML = html;
}

/* ================= Valentines Event 2026 — Bonds of Fate ================= */
const VAL_EVENT_END_MS = new Date("2026-02-15T23:59:59+08:00").getTime();

const VAL_SACRIFICE_BASE = {
  common:1,
  rare:3,
  epic:8,
  mythical:20,
  legendary:50,
  cosmic:120,
  interstellar:300,
  valentines:25
};

const VAL_MUT_BONUS_MULT = {
  normal: 1.0,
  silver: 1.10,
  gold: 1.25,
  diamond: 1.50,
  rainbow: 2.00,
  neon: 2.50,
  galactic: 3.50,
  thunder: 3.00,
  blackhole: 3.00,
  godly: 3.00,
  heavenly: 3.00
};

const VAL_MILESTONES = [
  { level:1,  title:"Valentine Badge",      desc:"Permanent cosmetic badge.",       reward:{ cosmetic:"badge" } },
  { level:3,  title:"Rose Frame",          desc:"Permanent rose frame cosmetic.", reward:{ cosmetic:"roseFrame" } },
  { level:5,  title:"Valentine Pack x3",   desc:"3 Valentines packs.",            reward:{ packs: { valentines:3 } } },
  { level:7,  title:"Heart Emblem",        desc:"Emblem overlay cosmetic.",       reward:{ cosmetic:"heartEmblem" } },
  { level:10, title:"Guaranteed Valentine",desc:"1 guaranteed Valentines card.", reward:{ guaranteed:"valentines_card" } },
  { level:15, title:"Crimson Aura",        desc:"Premium aura cosmetic.",         reward:{ cosmetic:"crimsonAura" } },
  { level:20, title:"Fatebound Title",     desc:"Title + premium frame.",         reward:{ cosmetic:"fateboundTitle" } }
];

let valActiveTab = "overview";
let valSacSel = new Set();
let valForgeA = null;
let valForgeB = null;
let valPolishId = null;

function valDayKey(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function ensureValentines(){
  if (!state.valentines || typeof state.valentines !== "object") state.valentines = defaultState().valentines;
  if (!state.valentines.daily || typeof state.valentines.daily !== "object") state.valentines.daily = defaultState().valentines.daily;

  const dk = valDayKey();
  if (state.valentines.daily.dayKey !== dk){
    state.valentines.daily.dayKey = dk;
    state.valentines.daily.claimed = {};
    state.valentines.daily.goldDonations = 0;
    state.valentines.daily.loginClaimed = false;
    state.valentines.daily.missions = buildValDailyMissions(dk);
    state.valentines.daily.progress = { packsOpened:0, cardsSacrificed:0, towerCollects:0, dominionActions:0 };
    saveState();
  }else{
    if (!state.valentines.daily.missions || !Array.isArray(state.valentines.daily.missions) || state.valentines.daily.missions.length===0){
      state.valentines.daily.missions = buildValDailyMissions(dk);
      saveState();
    }
    if (!state.valentines.daily.progress || typeof state.valentines.daily.progress !== "object"){
      state.valentines.daily.progress = { packsOpened:0, cardsSacrificed:0, towerCollects:0, dominionActions:0 };
    }
  }
}

function seededRand(seedStr){
  let h = 2166136261;
  for (let i=0;i<seedStr.length;i++) h = (h ^ seedStr.charCodeAt(i)) * 16777619;
  let x = h >>> 0;
  return ()=>{
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

function buildValDailyMissions(dayKey){
  const r = seededRand(`val-${dayKey}`);
  const templates = [
    { id:"open3",   label:"Open 3 packs",              type:"packsOpened",  target:3,  hearts:10, tokens:0 },
    { id:"open5",   label:"Open 5 packs",              type:"packsOpened",  target:5,  hearts:15, tokens:0 },
    { id:"sac10",   label:"Sacrifice 10 cards",         type:"cardsSacrificed", target:10, hearts:15, tokens:2 },
    { id:"sac20",   label:"Sacrifice 20 cards",         type:"cardsSacrificed", target:20, hearts:25, tokens:3 },
    { id:"tower5",  label:"Collect tower gold 5x",      type:"towerCollects", target:5, hearts:10, tokens:0 }
  ];
  const picked = [];
  const pool = templates.slice();
  while (picked.length < 3 && pool.length){
    const idx = Math.floor(r() * pool.length);
    picked.push(pool.splice(idx,1)[0]);
  }
  return picked;
}

function valIsLive(){
  return Date.now() < VAL_EVENT_END_MS;
}

function valUpdateHeaderChips(){
  if (!state.valentines) return;
  const h = Math.floor(Number(state.valentines.hearts)||0);
  const t = Math.floor(Number(state.valentines.tokens)||0);
  if (valHeartsEl) valHeartsEl.textContent = String(h);
  if (valTokensEl) valTokensEl.textContent = String(t);
  if (valHelpHeartsEl) valHelpHeartsEl.textContent = String(h);
  if (valHelpTokensEl) valHelpTokensEl.textContent = String(t);
  if (valEndsIn){
    const ms = Math.max(0, VAL_EVENT_END_MS - Date.now());
    const s = Math.floor(ms/1000);
    const d = Math.floor(s/86400);
    const h = Math.floor((s%86400)/3600);
    const m = Math.floor((s%3600)/60);
    valEndsIn.textContent = ms<=0 ? "Ended" : `${d}d ${h}h ${m}m`;
  }
  if (openValentinesBtn){
    openValentinesBtn.classList.toggle("isLive", valIsLive());
  }
}

function xpForNextLevel(level){
  const l = Math.max(0, Number(level)||0);
  return 120 + l * 80;
}

function valTryLevelUp(){
  const ev = state.valentines;
  while (ev.xp >= xpForNextLevel(ev.level)){
    ev.xp -= xpForNextLevel(ev.level);
    ev.level += 1;
  }
}

function mutationKeyFromCard(card){
  const list = getMutationList(card);
  if (!list.length) return "normal";
  return String(list[list.length-1]).trim().toLowerCase();
}

function valHeartsMult(){
  const until = Number(state.valentines?.buffs?.heartsMultUntil)||0;
  return Date.now() < until ? 1.25 : 1.0;
}

function valComputeSacrificeHearts(card){
  const rk = String(card?.rarity||"common").toLowerCase();
  const base = Number(VAL_SACRIFICE_BASE[rk] || 1);
  const mk = mutationKeyFromCard(card);
  const mult = Number(VAL_MUT_BONUS_MULT[mk] || 1.0);
  return Math.floor(base * mult * valHeartsMult());
}

function valRarityWeightForBond(rk){
  return Number(VAL_SACRIFICE_BASE[String(rk||"common").toLowerCase()] || 1);
}

function openValentines(){
  if (!valentinesOverlay) return;
  ensureValentines();
  valUpdateHeaderChips();
  try{ playClickSFX(); }catch(_){ }
  valentinesOverlay.classList.add("show");
  valentinesOverlay.setAttribute("aria-hidden","false");
  valActiveTab = "overview";
  valSacSel = new Set();
  valForgeA = null;
  valForgeB = null;
  valPolishId = null;
  renderValTab();
}

function closeValentines(){
  if (!valentinesOverlay) return;
  try{ playClickSFX(); }catch(_){ }
  valentinesOverlay.classList.remove("show");
  valentinesOverlay.setAttribute("aria-hidden","true");
  FrameAnimationManager.stopAll();
}

function openValHelp(){
  if (!valentinesHelpOverlay) return;
  ensureValentines();
  valUpdateHeaderChips();
  try{ playClickSFX(); }catch(_){}
  valentinesHelpOverlay.classList.add("show");
  valentinesHelpOverlay.setAttribute("aria-hidden","false");
}

function closeValHelp(){
  if (!valentinesHelpOverlay) return;
  try{ playClickSFX(); }catch(_){}
  valentinesHelpOverlay.classList.remove("show");
  valentinesHelpOverlay.setAttribute("aria-hidden","true");
}
function setValTab(t){
  valActiveTab = t;
  if (valTabs){
    valTabs.querySelectorAll(".valTab").forEach(b=>{
      const on = b.getAttribute("data-tab") === t;
      b.classList.toggle("isActive", on);
      b.setAttribute("aria-selected", on ? "true":"false");
    });
  }
  renderValTab();
}

function renderValTab(){
  if (!valBody) return;
  ensureValentines();
  valUpdateHeaderChips();
  if (!valIsLive()){
    valBody.innerHTML = `<div class="valCard"><div class="valCardTitle"><b>Event ended</b></div><div class="valSmall">Bonds of Fate ended on Feb 28, 2026. Your rewards and progress remain in your account.</div></div>`;
    return;
  }
  if (valActiveTab === "forge") return renderValForge();
  if (valActiveTab === "shop") return renderValShop();
  if (valActiveTab === "milestones") return renderValMilestones();
  if (valActiveTab === "leader") return renderValLeader();
  return renderValOverview();
}

function renderValOverview(){
  const ev = state.valentines;
  valTryLevelUp();
  const need = xpForNextLevel(ev.level);
  const pct = Math.max(0, Math.min(100, (need ? (ev.xp/need*100) : 0)));

  const daily = ev.daily || {};
  const prog = daily.progress || { packsOpened:0, cardsSacrificed:0, towerCollects:0, dominionActions:0 };
  const missions = Array.isArray(daily.missions) ? daily.missions : [];

  const missionsHtml = missions.map(m=>{
    const cur = Number(prog[m.type]) || 0;
    const done = cur >= Number(m.target||0);
    const claimed = !!daily.claimed?.[m.id];
    const can = done && !claimed;
    return `
      <div class="valShopItem">
        <div class="left">
          <b>${escapeHtml(m.label)}</b>
          <div class="valSmall">Progress: <b>${cur}</b> / ${m.target} • Reward: <b>${m.hearts}</b> Hearts${m.tokens?` • <b>${m.tokens}</b> Tokens`:""}</div>
        </div>
        <button class="valBtnSmall primary" type="button" ${can?"":"disabled"} data-claim="${m.id}">${claimed?"Claimed":(done?"Claim":"In progress")}</button>
      </div>
    `;
  }).join("");

  const loginCan = !daily.loginClaimed;
  valBody.innerHTML = `
    <div class="valGrid2">
      <div class="valCard">
        <div class="valCardTitle"><b>Bond Level</b><span class="valSmall">Level <b>${ev.level}</b></span></div>
        <div class="valProgress" title="Bond XP"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="valRowBetween" style="margin-top:10px;">
          <div class="valSmall">XP: <b>${Math.floor(ev.xp)}</b> / ${need}</div>
          <div class="valSmall">Fate Score: <b>${Math.floor(ev.fateScore||0)}</b></div>
        </div>
        <div class="valWarn" style="margin-top:12px;">Core loops: <b>Card Sacrifice</b> (Hearts) + <b>Bond Forge</b> (Bond XP & Fate). Use Love Shop to turn Hearts into power and cosmetics.</div>
      </div>

      <div class="valCard">
        <div class="valCardTitle"><b>Daily Valentine Missions</b><span class="valSmall">Resets daily</span></div>
        <div class="valList">${missionsHtml || `<div class="valSmall">No missions found. Re-open the event modal.</div>`}</div>
        <div class="valShopItem" style="margin-top:10px;">
          <div class="left">
            <b>Daily Login Claim</b>
            <div class="valSmall">Claim <b>25 Hearts</b> once per day.</div>
          </div>
          <button class="valBtnSmall primary" type="button" ${loginCan?"":"disabled"} data-login="1">${loginCan?"Claim":"Claimed"}</button>
        </div>
      </div>
    </div>

    <div class="valCard" style="margin-top:14px;">
      <div class="valCardTitle"><b>Earn Hearts</b><span class="valSmall">Grind loops + sinks</span></div>
      <div class="valRow">
        <button class="valBtnSmall primary" type="button" data-jump="sac">Open Card Sacrifice</button>
        <button class="valBtnSmall" type="button" data-jump="forge">Open Bond Forge</button>
        <button class="valBtnSmall" type="button" data-jump="shop">Open Love Shop</button>
      </div>
      <div class="valSmall" style="margin-top:8px; opacity:.85;">
        <b>Gold Donation:</b> 25,000 gold → +10 Hearts (limit 5/day). <span style="opacity:.8">(Optional Love Storm boosts Hearts for a short time.)</span>
      </div>
    </div>
  `;

  valBody.querySelectorAll("[data-claim]").forEach(btn=>{
    if (btn) btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-claim");
      valClaimMission(id);
    });
  });
  const loginBtn = valBody.querySelector("[data-login]");
  if (loginBtn){
    if (loginBtn) loginBtn.addEventListener("click", ()=> valDailyLoginClaim());
  }
  valBody.querySelectorAll("[data-jump]").forEach(btn=>{
    if (btn) btn.addEventListener("click", ()=>{
      const t = btn.getAttribute("data-jump");
      if (t === "forge") setValTab("forge");
      else if (t === "shop") setValTab("shop");
      else renderValSacrifice();
    });
  });
}

function valDailyLoginClaim(){
  ensureValentines();
  const ev = state.valentines;
  if (ev.daily.loginClaimed) return;
  ev.daily.loginClaimed = true;
  ev.hearts += Math.floor(25 * valHeartsMult());
  ev.fateScore += 10;
  saveState();
  syncUI();
  valUpdateHeaderChips();
  toast("Valentine Login", "+25 Hearts");
  renderValTab();
}

function valClaimMission(id){
  ensureValentines();
  const ev = state.valentines;
  const daily = ev.daily;
  const m = (daily.missions || []).find(x=>x.id===id);
  if (!m) return;
  if (daily.claimed?.[id]) return;
  const prog = daily.progress || {};
  const cur = Number(prog[m.type]) || 0;
  if (cur < Number(m.target||0)) return;

  if (!daily.claimed || typeof daily.claimed !== "object") daily.claimed = {};
  daily.claimed[id] = true;
  ev.hearts += Math.floor(Number(m.hearts||0) * valHeartsMult());
  ev.tokens += Number(m.tokens||0);
  ev.fateScore += 15;
  saveState();
  syncUI();
  toast("Mission claimed", `+${m.hearts} Hearts${m.tokens?` • +${m.tokens} Tokens`:""}`);
  renderValTab();
}

function renderValSacrifice(){
  const ev = state.valentines;
  const inv = getInventoryCards();
  const list = inv.slice().sort((a,b)=>{
    const ra = invOrder.indexOf(String(a?.rarity||"common").toLowerCase());
    const rb = invOrder.indexOf(String(b?.rarity||"common").toLowerCase());
    return ra - rb;
  }).slice(0, 24);

  const selCards = inv.filter(c=> valSacSel.has(c.id));
  const totalHearts = selCards.reduce((s,c)=> s + valComputeSacrificeHearts(c), 0);

  valBody.innerHTML = `
    <div class="valGrid2">
      <div class="valCard">
        <div class="valCardTitle"><b>Card Sacrifice</b><span class="valSmall">Turn cards into Hearts</span></div>
        <div class="valWarn">Selected cards are <b>permanently removed</b>. Hearts gain scales with rarity + mutation bonus.</div>
        <div class="valRowBetween" style="margin-top:12px;">
          <div class="valSmall">Selected: <b>${selCards.length}</b></div>
          <div class="valPrice"><span class="heartGem" aria-hidden="true"></span><span><b>+${fmt(totalHearts)}</b> Hearts</span></div>
        </div>
        <div class="valRow" style="margin-top:12px;">
          <button class="valBtnSmall primary" type="button" ${selCards.length?"":"disabled"} id="valDoSac">Sacrifice Selected</button>
          <button class="valBtnSmall" type="button" id="valSacClear">Clear</button>
          <button class="valBtnSmall" type="button" id="valSacBack">Back</button>
        </div>
        <div class="valSmall" style="margin-top:10px; opacity:.85;">Tip: Mutated cards give bonus Hearts. Love Storm boosts Hearts gains.</div>
      </div>

      <div class="valCard">
        <div class="valCardTitle"><b>Quick Gold Donation</b><span class="valSmall">Gold sink</span></div>
        <div class="valShopItem">
          <div class="left">
            <b>Donate 25,000 gold</b>
            <div class="valSmall">+10 Hearts • Limit 5/day • Today: <b>${ev.daily.goldDonations||0}</b>/5</div>
          </div>
          <button class="valBtnSmall primary" type="button" id="valDonateBtn" ${(ev.daily.goldDonations>=5 || state.gold < 25000)?"disabled":""}>Donate</button>
        </div>
      </div>
    </div>

    <div class="valCard" style="margin-top:14px;">
      <div class="valCardTitle"><b>Pick cards to sacrifice</b><span class="valSmall">Showing 24 (highest priority)</span></div>
      <div class="valSelectGrid">
        ${list.map(c=>{
          const sel = valSacSel.has(c.id);
          const hearts = valComputeSacrificeHearts(c);
          const name = escapeHtml(c.name||"Card");
          const rk = String(c.rarity||"common").toLowerCase();
          return `
            <div class="valPick ${sel?"isSel":""} ${(c.fav===true)?"isProtected":""}" data-cid="${escapeAttr(c.id)}">
              <div class="aura r-${rk}" style="position:absolute; inset:0; opacity:.9; pointer-events:none;"></div>
              <img src="${escapeAttr(c.img||"cards/card.png")}" alt="${name}" loading="lazy" decoding="async" onerror="this.style.display='none'"/>
              <div class="tag"><span>${name}${c.fav===true?" ❤️":""}</span><span>+${fmt(hearts)}💎</span></div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  valBody.querySelectorAll(".valPick").forEach(el=>{
    if (el) el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-cid");
      if (!id) return;

      const card = getCardById(id);
      if (card && card.fav === true){
        toast("Protected", "Unheart (unfavorite) this card before sacrificing.");
        return;
      }

      if (valSacSel.has(id)) valSacSel.delete(id); else valSacSel.add(id);
      renderValSacrifice();
    });
  });
  const btnSac = document.getElementById("valDoSac");
  if (btnSac) btnSac.addEventListener("click", valDoSacrifice);
  const btnClear = document.getElementById("valSacClear");
  if (btnClear) btnClear.addEventListener("click", ()=>{ valSacSel = new Set(); renderValSacrifice(); });
  const btnBack = document.getElementById("valSacBack");
  if (btnBack) btnBack.addEventListener("click", ()=> setValTab("overview"));
  const btnDonate = document.getElementById("valDonateBtn");
  if (btnDonate) btnDonate.addEventListener("click", valDonateGold);
}

function valDonateGold(){
  ensureValentines();
  const ev = state.valentines;
  if (ev.daily.goldDonations >= 5) return;
  if (state.gold < 25000){ toast("Not enough gold", "Need 25,000 gold."); return; }
  state.gold -= 25000;
  ev.daily.goldDonations += 1;
  ev.hearts += Math.floor(10 * valHeartsMult());
  ev.fateScore += 8;
  saveState();
  syncUI();
  toast("Donation complete", "+10 Hearts");
  renderValSacrifice();
}

function valDoSacrifice(){
  const inv = getInventoryCards();
  const picked = inv.filter(c=> valSacSel.has(c.id));
  if (!picked.length) return;

  const selected = picked.filter(c=> !(c && c.fav === true));
  if (!selected.length){
    toast("Protected", "All selected cards are hearted. Unheart them to sacrifice.");
    return;
  }
  if (selected.length !== picked.length){
    toast("Protected", "Some selected cards are hearted and were skipped.");
  }

  let totalHearts = 0;
  for (const c of selected) totalHearts += valComputeSacrificeHearts(c);

  const kill = new Set(selected.map(c=>c.id));
  state.cardsOwned = (state.cardsOwned||[]).filter(c=> !kill.has(c.id));
  if (state.decks && typeof state.decks === "object"){
    ["A","B"].forEach(dk=>{
      if (Array.isArray(state.decks[dk])){
        state.decks[dk] = state.decks[dk].map(cid => kill.has(cid) ? null : cid);
      }
    });
  }

  ensureValentines();
  state.valentines.hearts += totalHearts;
  state.valentines.fateScore += Math.min(120, selected.length * 3);
  if (state.valentines.daily?.progress){
    state.valentines.daily.progress.cardsSacrificed = Number(state.valentines.daily.progress.cardsSacrificed||0) + selected.length;
  }

  valSacSel = new Set();
  saveState();
  syncUI();
  toast("Sacrifice complete", `+${fmt(totalHearts)} Hearts`);
  renderValSacrifice();
}

function renderValForge(){
  const ev = state.valentines;
  valTryLevelUp();
  const inv = getInventoryCards();
  const pickable = inv.slice().sort((a,b)=>{
    const ra = invOrder.indexOf(String(a?.rarity||"common").toLowerCase());
    const rb = invOrder.indexOf(String(b?.rarity||"common").toLowerCase());
    return ra - rb;
  }).slice(0, 16);

  const a = inv.find(c=> c.id===valForgeA) || null;
  const b = inv.find(c=> c.id===valForgeB) || null;

  const base = (a?valRarityWeightForBond(a.rarity):0) + (b?valRarityWeightForBond(b.rarity):0);
  let mult = 1.0;
  let bonusLines = [];
  if (a && b){
    if (String(a.rarity).toLowerCase() === String(b.rarity).toLowerCase()){ mult *= 1.20; bonusLines.push("Same rarity +20%" ); }
    if (String(a.name) === String(b.name)){ mult *= 1.30; bonusLines.push("True Love (duplicate) +30%" ); }
    const am = mutationKeyFromCard(a) !== "normal";
    const bm = mutationKeyFromCard(b) !== "normal";
    if (am && bm){ mult *= 1.25; bonusLines.push("Both mutated +25%" ); }
    if (am && bm && mutationKeyFromCard(a) === mutationKeyFromCard(b)){ mult *= 1.15; bonusLines.push("Same mutation +15%" ); }
    if (Date.now() < Number(ev.buffs?.bondBoostUntil)||0){ mult *= 1.25; bonusLines.push("Bond Booster +25%" ); }
  }
  const xpGain = Math.floor(base * mult);

  valBody.innerHTML = `
    <div class="valGrid2">
      <div class="valCard">
        <div class="valCardTitle"><b>Bond Forge</b><span class="valSmall">Consume 2 cards → Bond XP + Fate</span></div>
        <div class="valRowBetween">
          <div class="valSmall">Select Card A + Card B. Both are consumed.</div>
          <div class="valPrice"><span class="heartGem" aria-hidden="true"></span><span><b>+${fmt(xpGain)}</b> Bond XP</span></div>
        </div>
        ${bonusLines.length?`<div class="valWarn" style="margin-top:12px;">Bonuses: <b>${escapeHtml(bonusLines.join(" • "))}</b></div>`:""}
        <div class="valRow" style="margin-top:12px;">
          <button class="valBtnSmall primary" type="button" id="valBindBtn" ${(a&&b)?"":"disabled"}>Bind</button>
          <button class="valBtnSmall" type="button" id="valForgeClear">Clear</button>
        </div>
        <div class="valSmall" style="margin-top:10px; opacity:.85;">Bonus roll can drop Fate Tokens or an extra Valentines pack.</div>
      </div>

      <div class="valCard">
        <div class="valCardTitle"><b>Selected</b><span class="valSmall">A & B</span></div>
        <div class="valRow" style="gap:12px;">
          <div class="valPick ${a?"isSel":""}" style="width:140px;" data-pick="A">
            ${a?`<img src="${escapeAttr(a.img||"cards/card.png")}" alt="${escapeAttr(a.name||"Card")}"/>`:`<div class="tag" style="justify-content:center;">Pick A</div>`}
          </div>
          <div class="valPick ${b?"isSel":""}" style="width:140px;" data-pick="B">
            ${b?`<img src="${escapeAttr(b.img||"cards/card.png")}" alt="${escapeAttr(b.name||"Card")}"/>`:`<div class="tag" style="justify-content:center;">Pick B</div>`}
          </div>
        </div>
      </div>
    </div>

    <div class="valCard" style="margin-top:14px;">
      <div class="valCardTitle"><b>Pick cards for the Forge</b><span class="valSmall">Showing 16 (highest priority)</span></div>
      <div class="valSelectGrid">
        ${pickable.map(c=>{
          const sel = (c.id===valForgeA || c.id===valForgeB);
          const rk = String(c.rarity||"common").toLowerCase();
          const name = escapeHtml(c.name||"Card");
          const muts = getMutationList(c);
          return `
            <div class="valPick ${sel?"isSel":""}" data-fid="${escapeAttr(c.id)}">
              <div class="aura r-${rk}" style="position:absolute; inset:0; opacity:.9; pointer-events:none;"></div>
              <img src="${escapeAttr(c.img||"cards/card.png")}" alt="${name}" loading="lazy" decoding="async" onerror="this.style.display='none'"/>
              <div class="tag"><span>${name}</span><span>${escapeHtml(String(c.rarity||"").toUpperCase())}${muts.length?" • ✨":""}</span></div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  valBody.querySelectorAll(".valPick[data-fid]").forEach(el=>{
    if (el) el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-fid");
      if (!id) return;
      if (valForgeA === id) valForgeA = null;
      else if (valForgeB === id) valForgeB = null;
      else if (!valForgeA) valForgeA = id;
      else if (!valForgeB) valForgeB = id;
      else valForgeA = id;
      renderValForge();
    });
  });
  const bindBtn = document.getElementById("valBindBtn");
  if (bindBtn) bindBtn.addEventListener("click", ()=> valDoBind(xpGain));
  const clr = document.getElementById("valForgeClear");
  if (clr) clr.addEventListener("click", ()=>{ valForgeA=null; valForgeB=null; renderValForge(); });
}

function valDoBind(xpGain){
  const inv = getInventoryCards();
  const a = inv.find(c=>c.id===valForgeA);
  const b = inv.find(c=>c.id===valForgeB);
  if (!a || !b || a.id===b.id) return;

  const kill = new Set([a.id, b.id]);
  state.cardsOwned = (state.cardsOwned||[]).filter(c=> !kill.has(c.id));
  if (state.decks && typeof state.decks === "object"){
    ["A","B"].forEach(dk=>{
      if (Array.isArray(state.decks[dk])) state.decks[dk] = state.decks[dk].map(cid => kill.has(cid) ? null : cid);
    });
  }

  ensureValentines();
  const ev = state.valentines;
  ev.xp += Math.max(1, Number(xpGain)||1);
  ev.fateScore += Math.max(1, Math.floor((Number(xpGain)||1) / 2));
  valTryLevelUp();

  const roll = Math.random();
  let bonusMsg = "";
  if (roll < 0.18){
    const t = 1 + Math.floor(Math.random()*3);
    ev.tokens += t;
    bonusMsg = ` • Bonus: +${t} Tokens`;
  }else if (roll < 0.21){
    state.invCounts.valentines = (state.invCounts.valentines||0) + 1;
    bonusMsg = " • Bonus: +1 Valentines pack";
  }

  saveState();
  syncUI();
  toast("Bond forged", `+${fmt(xpGain)} Bond XP${bonusMsg}`);
  valForgeA = null; valForgeB = null;
  renderValForge();
}

function renderValMilestones(){
  const ev = state.valentines;
  valTryLevelUp();
  const claimed = ev.claimedMilestones || {};
  valBody.innerHTML = `
    <div class="valCard">
      <div class="valCardTitle"><b>Milestone Track</b><span class="valSmall">Guaranteed rewards</span></div>
      <div class="valSmall">Reach Bond Levels to unlock rewards. Your progress always matters — no bad RNG streaks.</div>
    </div>
    <div class="valList" style="margin-top:14px;">
      ${VAL_MILESTONES.map(m=>{
        const unlocked = ev.level >= m.level;
        const isClaimed = !!claimed[m.level];
        const can = unlocked && !isClaimed;
        return `
          <div class="valShopItem">
            <div class="left">
              <b>Level ${m.level} • ${escapeHtml(m.title)}</b>
              <div class="valSmall">${escapeHtml(m.desc)}</div>
            </div>
            <button class="valBtnSmall primary" type="button" data-ms="${m.level}" ${can?"":"disabled"}>${isClaimed?"Claimed":(unlocked?"Claim":"Locked")}</button>
          </div>
        `;
      }).join("")}
    </div>
  `;
  valBody.querySelectorAll("[data-ms]").forEach(btn=>{
    if (btn) btn.addEventListener("click", ()=>{
      const lvl = Number(btn.getAttribute("data-ms"));
      valClaimMilestone(lvl);
    });
  });
}

function valClaimMilestone(level){
  ensureValentines();
  const ev = state.valentines;
  if (ev.level < level) return;
  if (!ev.claimedMilestones || typeof ev.claimedMilestones !== "object") ev.claimedMilestones = {};
  if (ev.claimedMilestones[level]) return;
  const m = VAL_MILESTONES.find(x=>x.level===level);
  if (!m) return;
  ev.claimedMilestones[level] = true;

  if (m.reward?.packs){
    for (const k of Object.keys(m.reward.packs)){
      state.invCounts[k] = (state.invCounts[k]||0) + (Number(m.reward.packs[k])||0);
    }
  }
  if (m.reward?.cosmetic){
    if (!ev.cosmetics || typeof ev.cosmetics !== "object") ev.cosmetics = defaultState().valentines.cosmetics;
    ev.cosmetics[m.reward.cosmetic] = true;
  }
  if (m.reward?.guaranteed === "valentines_card"){
    const c = rollCardForRarity("valentines");
    state.cardsOwned.push(c);
  }
  ev.fateScore += 40;
  saveState();
  syncUI();
  toast("Milestone claimed", `Level ${level} reward unlocked`);
  renderValMilestones();
}

function renderValShop(){
  const ev = state.valentines;
  const hearts = Number(ev.hearts)||0;
  const bondBoostOn = Date.now() < Number(ev.buffs?.bondBoostUntil||0);
  const heartsBoostOn = Date.now() < Number(ev.buffs?.heartsMultUntil||0);
  const todayKey = valDayKey();
  const polishUsed = (ev.lastMutationPolishDay === todayKey);

  const items = [
    { key:"val_pack", name:"Valentines Pack", cost:50, desc:"Event pack from the Bonds of Fate pool.", buy:()=>{ state.invCounts.valentines = (state.invCounts.valentines||0)+1; } },
    { key:"bond_boost", name:"Bond Booster (10 mins)", cost:30, desc:"+25% Bond XP for 10 minutes.", buy:()=>{ ev.buffs.bondBoostUntil = Date.now()+10*60*1000; } },
    { key:"polish", name:"Mutation Polish (1/day)", cost:40, desc:"Reroll a card's mutation once per day.", buy:()=>{ /* handled via select */ } },
    { key:"tokens", name:"Fate Tokens Bundle", cost:25, desc:"Get +5 Fate Tokens.", buy:()=>{ ev.tokens += 5; } },
    { key:"rose_frame", name:"Rose Frame (Permanent)", cost:150, desc:"Luxury cosmetic frame.", buy:()=>{ ev.cosmetics.roseFrame = true; } },
    { key:"love_storm", name:"Love Storm Summon", cost:60, desc:"Boost Hearts gains for 10 minutes.", buy:()=>{ ev.buffs.heartsMultUntil = Date.now()+10*60*1000; } }
  ];

  const craft = [
    {
      key:"portia_god_of_love",
      name:"Portia the God of Love",
      desc:"Limited Edition card. Generates +500,000 Gold/sec.",
      costs:{ tokens:5000, hearts:20000, gold:10000000 },
      img:"cards/portia.png",
      showImg:true,
      action:()=>{
        if ((Number(ev.tokens)||0) < 5000) return toast("Not enough Fate Tokens", "Need 5,000 Fate Tokens.");
        if ((Number(ev.hearts)||0) < 20000) return toast("Not enough Heart Crystals", "Need 20,000 Hearts.");
        if ((Number(state.gold)||0) < 10000000) return toast("Not enough Gold", "Need 10,000,000 Gold.");

        ev.tokens -= 5000;
        ev.hearts -= 20000;
        state.gold -= 10000000;

        const card = {
          id: uid(),
          rarity: "limited edition",
          name: "Portia the God of Love",
          img: "cards/portia.png",
          pullChance: 0,
          w: 0,
          baseGps: 500000,
          mutations: [],
          location: "inventory",
          fav: false,
          animated: true,
          frames: getFrames("portia", 12),
          frameInterval: 150
        };
        recomputeCardStats(card);
        state.cardsOwned.push(card);
      }
    },

    { need:10, name:"Guaranteed Valentine Card", desc:"Spend 10 tokens → 1 Valentines card.", action:()=>{ ev.tokens -= 10; state.cardsOwned.push(rollCardForRarity("valentines")); } },
    { need:25, name:"Guaranteed Mutation Seed", desc:"Spend 25 tokens → +1 Mutation Polish charge (resets today).", action:()=>{ ev.tokens -= 25; ev.lastMutationPolishDay = ""; } },
    { need:40, name:"Premium Frame / Title", desc:"Spend 40 tokens → unlock Fatebound Title cosmetic.", action:()=>{ ev.tokens -= 40; ev.cosmetics.fateboundTitle = true; } }
  ];

  valBody.innerHTML = `
    <div class="valGrid2">
      <div class="valCard">
        <div class="valCardTitle"><b>Love Shop</b><span class="valSmall">Spend Hearts</span></div>
        <div class="valList">
          ${items.map(it=>{
            const disabled = hearts < it.cost;
            const extraDisabled = (it.key==="polish" && polishUsed);
            const label = (it.key==="polish" && polishUsed) ? "Used today" : "Buy";
            return `
              <div class="valShopItem">
                <div class="left">
                  <b>${escapeHtml(it.name)}</b>
                  <div class="valSmall">${escapeHtml(it.desc)}${it.key==="bond_boost" && bondBoostOn?" • <b>Active</b>":""}${it.key==="love_storm" && heartsBoostOn?" • <b>Active</b>":""}</div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
                  <div class="valPrice"><span class="heartGem" aria-hidden="true"></span><span><b>${it.cost}</b></span></div>
                  <button class="valBtnSmall primary" type="button" data-buy="${escapeAttr(it.key)}" ${(disabled||extraDisabled)?"disabled":""}>${label}</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <div class="valCard" style="margin-top:14px; padding:12px;">
          <div class="valCardTitle"><b>Mutation Polish</b><span class="valSmall">Select a card</span></div>
          <div class="valSmall">Once per day, reroll the selected card's mutation. (Normal may reroll into mutated, and vice versa.)</div>
          <div class="valRow" style="margin-top:10px;">
            <button class="valBtnSmall" type="button" id="valPickPolish">Choose Card</button>
            <button class="valBtnSmall primary" type="button" id="valDoPolish" ${(polishUsed||!valPolishId)?"disabled":""}>Apply Polish</button>
            <span class="valSmall" id="valPolishStatus" style="margin-left:auto;">${polishUsed?"Used today":"Ready"}</span>
          </div>
        </div>
      </div>

      <div class="valCard">
        <div class="valCardTitle"><b>Token Crafting</b><span class="valSmall">Anti-RNG</span></div>
        <div class="valSmall">Fate Tokens guarantee value — no quitting from bad luck.</div>
        <div class="valList" style="margin-top:12px;">
          ${craft.map((c,i)=>{
            const costs = c.costs || { tokens: Number(c.need)||0, hearts:0, gold:0 };
            const hasCosts = !!c.costs;
            const canTokens = (Number(ev.tokens)||0) >= (Number(costs.tokens)||0);
            const canHearts = (Number(ev.hearts)||0) >= (Number(costs.hearts)||0);
            const canGold = (Number(state.gold)||0) >= (Number(costs.gold)||0);
            const can = hasCosts ? (canTokens && canHearts && canGold) : canTokens;

            const costLine = hasCosts
              ? `Cost: <b>${Number(costs.tokens||0).toLocaleString("en-US")}</b> Tokens • <b>${Number(costs.hearts||0).toLocaleString("en-US")}</b> Hearts • <b>${Number(costs.gold||0).toLocaleString("en-US")}</b> Gold`
              : `Cost: <b>${Number(c.need||0).toLocaleString("en-US")}</b> Tokens`;

            const imgHtml = (c.showImg && c.img)
              ? `<div class="valShopPreview"><img src="${escapeAttr(c.img)}" alt="${escapeAttr(c.name)}" loading="lazy" decoding="async" onerror="this.style.display='none'"/></div>`
              : "";

            return `
              <div class="valShopItem">
                <div class="left">
                  <b>${escapeHtml(c.name)}</b>
                  <div class="valSmall">${escapeHtml(c.desc)}<div style="margin-top:6px;opacity:.9;">${costLine}</div></div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
                  ${imgHtml}
                  <button class="valBtnSmall primary" type="button" data-craft="${i}" ${can?"":"disabled"}>Craft</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;

  valBody.querySelectorAll("[data-buy]").forEach(btn=>{
    if (btn) btn.addEventListener("click", ()=>{
      const key = btn.getAttribute("data-buy");
      const it = items.find(x=>x.key===key);
      if (!it) return;
      if ((Number(ev.hearts)||0) < it.cost) return;
      if (key === "polish"){
        toast("Select a card", "Use the 'Choose Card' button below.");
        return;
      }
      ev.hearts -= it.cost;
      it.buy();
      ev.fateScore += 10;
      saveState();
      syncUI();
      toast("Purchased", it.name);
      renderValShop();
    });
  });

  valBody.querySelectorAll("[data-craft]").forEach(btn=>{
    if (btn) btn.addEventListener("click", ()=>{
      const idx = Number(btn.getAttribute("data-craft"));
      const c = craft[idx];
      if (!c) return;

      const costs = c.costs || { tokens: Number(c.need)||0, hearts:0, gold:0 };
      if ((Number(ev.tokens)||0) < (Number(costs.tokens)||0)) return;
      if ((Number(ev.hearts)||0) < (Number(costs.hearts)||0)) return;
      if ((Number(state.gold)||0) < (Number(costs.gold)||0)) return;

      c.action();
      ev.fateScore += 15;
      saveState();
      syncUI();
      toast("Crafted", c.name);
      renderValShop();
    });
  });

  const pickBtn = document.getElementById("valPickPolish");
  if (pickBtn) pickBtn.addEventListener("click", ()=> renderValPolishPicker());
  const doBtn = document.getElementById("valDoPolish");
  if (doBtn) doBtn.addEventListener("click", ()=> valApplyPolish());
}

function renderValPolishPicker(){
  const ev = state.valentines;
  const inv = getInventoryCards();
  const list = inv.slice().sort((a,b)=>{
    const ra = invOrder.indexOf(String(a?.rarity||"common").toLowerCase());
    const rb = invOrder.indexOf(String(b?.rarity||"common").toLowerCase());
    return ra - rb;
  }).slice(0, 24);

  valBody.innerHTML = `
    <div class="valCard">
      <div class="valCardTitle"><b>Choose a card to Polish</b><span class="valSmall">Back to shop after selection</span></div>
      <div class="valSelectGrid">
        ${list.map(c=>{
          const sel = (c.id === valPolishId);
          const rk = String(c.rarity||"common").toLowerCase();
          const name = escapeHtml(c.name||"Card");
          const mk = mutationKeyFromCard(c);
          return `
            <div class="valPick ${sel?"isSel":""}" data-pid="${escapeAttr(c.id)}">
              <div class="aura r-${rk}" style="position:absolute; inset:0; opacity:.9; pointer-events:none;"></div>
              <img src="${escapeAttr(c.img||"cards/card.png")}" alt="${name}" loading="lazy" decoding="async" onerror="this.style.display='none'"/>
              <div class="tag"><span>${name}</span><span>${escapeHtml(mk==="normal"?"Normal":mk)}</span></div>
            </div>
          `;
        }).join("")}
      </div>
      <div class="valRow" style="margin-top:12px;">
        <button class="valBtnSmall primary" type="button" id="valPolishDone">Done</button>
        <button class="valBtnSmall" type="button" id="valPolishCancel">Cancel</button>
      </div>
    </div>
  `;

  valBody.querySelectorAll(".valPick").forEach(el=>{
    if (el) el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-pid");
      if (!id) return;
      valPolishId = id;
      renderValPolishPicker();
    });
  });
  const done = document.getElementById("valPolishDone");
  if (done) done.addEventListener("click", ()=> renderValShop());
  const cancel = document.getElementById("valPolishCancel");
  if (cancel) cancel.addEventListener("click", ()=>{ valPolishId=null; renderValShop(); });
}

function valApplyPolish(){
  ensureValentines();
  const ev = state.valentines;
  const todayKey = valDayKey();
  if (ev.lastMutationPolishDay === todayKey) return;
  if (!valPolishId){ toast("Pick a card", "Choose a card first."); return; }
  if ((Number(ev.hearts)||0) < 40){ toast("Not enough Hearts", "Mutation Polish costs 40 Hearts."); return; }

  ev.hearts -= 40;

  const card = (state.cardsOwned||[]).find(c=>c.id===valPolishId);
  if (!card){ toast("Card not found", "It may have moved."); renderValShop(); return; }
  const mut = rollMutation();
  const mk = normMutKey(mut.k);
  card.mutations = (mk && mk !== "normal") ? [titleMutKey(mut.k)] : [];
  recomputeCardStats(card);
  ev.lastMutationPolishDay = todayKey;
  ev.fateScore += 18;
  saveState();
  syncUI();
  toast("Polished", `${card.name} mutation rerolled`);
  renderValShop();
}

function renderValLeader(){
  const ev = state.valentines;
  valBody.innerHTML = `
    <div class="valCard">
      <div class="valCardTitle"><b>Event Leaderboard</b><span class="valSmall">Optional</span></div>
      <div class="valSmall">For now, this event uses your normal global leaderboard (Highest GPS). An event-specific leaderboard can be added later without breaking saves.</div>
      <div class="valWarn" style="margin-top:12px;">Your current Fate Score: <b>${fmt(Math.floor(ev.fateScore||0))}</b></div>
    </div>
  `;
}

function openLuckyResultModal(){
  luckyResultOverlay.classList.add("show");
  luckyResultOverlay.setAttribute("aria-hidden","false");
}
function closeLuckyResultModal(){
  luckyResultOverlay.classList.remove("show");
  luckyResultOverlay.setAttribute("aria-hidden","true");
  FrameAnimationManager.stopAll();
}

function openCards(){
  if (invOverlay){
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.invTab = "cards";
    saveState(state);
    openInventory();
    return;
  }

  renderCardsModal();
  if (cardsOverlay){
    cardsOverlay.classList.add("show");
    cardsOverlay.setAttribute("aria-hidden","false");
  }
}
function closeCards(){
  if (invOverlay && invOverlay.classList.contains("show")){
    closeInventory();
    return;
  }
  if (cardsOverlay){
    cardsOverlay.classList.remove("show");
    cardsOverlay.setAttribute("aria-hidden","true");
  }
}
/* ================= Animation loop ================= */
function loop(now){
  if (document.hidden){
    lastTime = now;
    requestAnimationFrame(loop);
    return;
  }
  if (!track || !Array.isArray(stock) || stock.length === 0){
    requestAnimationFrame(loop);
    return;
  }

  const dt = Math.min(0.05, (now - lastTime)/1000);
  lastTime = now;

  x -= speed * dt;

  const cardW = 210;
  const gap = 22;
  const step = cardW + gap;
  const w = stock.length * step;

  if (w > 0 && x <= -w) x += w;

  const tx = Math.round(x * 1000) / 1000;
  track.style.transform = `translate3d(${tx}px,-50%,0)`;

  requestAnimationFrame(loop);
}

/* ================= Deck slots ================= */
function buildSlots(){
  document.querySelectorAll('.slot img').forEach(stopCardAnimation);

  const deckAEl = document.getElementById("deckA");
  const deckBEl = document.getElementById("deckB");
  if (!deckAEl || !deckBEl) return;

  deckAEl.innerHTML = "";
  deckBEl.innerHTML = "";

  const makeSlot = (deckKey, idx)=>{
    const s = document.createElement("div");
    s.className = "slot";
    s.dataset.deck = deckKey;
    s.dataset.idx = String(idx);

    const slotInfo = getDeckSlotStatus(deckKey, idx);

    const assignedId = state.decks?.[deckKey]?.[idx] || null;
    if (assignedId){
      const c = getCardById(assignedId);
      if (c){
        s.classList.add("assigned");

        s.dataset.cardId = assignedId;

        applyMutationGlow(s, c);

        const img = document.createElement("img");
        img.src = c.img || "cards/card.png";
        img.onerror = ()=>{ img.src = "cards/card.png"; };
        startCardAnimation(img, c);
        const badge = document.createElement("div");
        badge.className = "slotBadge";
        badge.textContent = `${fmt(c.gps)}/s`;
        s.appendChild(img);
        s.appendChild(badge);

        if (isDeckInlineSelected(deckKey, idx)){
          s.classList.add("selected");
          const ov = document.createElement("div");
          ov.className = "slotOverlay";
          const rarity = (c.rarity || "common").toUpperCase();
          const mut = mutationLabel(c);
          const gps = Number(c.gps)||0;
          const sellGold = computeSellGold(c);

          ov.innerHTML = `
            <div class="slotOverlayBtns onlyActions">
              <button class="slotBtn" type="button" data-act="keep">Keep</button>
              <button class="slotBtn danger" type="button" data-act="sell">Sell • ${fmt(sellGold)}g</button>
            </div>
          `;

          if (ov) ov.addEventListener("click", (e)=> e.stopPropagation());

          ov.querySelector('[data-act="keep"]')?.addEventListener("click", (e)=>{
            e.stopPropagation();
            const id = state.decks?.[deckKey]?.[idx] || null;
            if (!id) return;
            state.decks[deckKey][idx] = null;
            moveCardToInventory(id);
            saveState();
            clearDeckInlineSelected();
            buildSlots();
            syncUI();
          });

          ov.querySelector('[data-act="sell"]')?.addEventListener("click", (e)=>{
            e.stopPropagation();
            const id = state.decks?.[deckKey]?.[idx] || null;
            const cardNow = id ? getCardById(id) : null;
            if (!cardNow) return;
            const sg = computeSellGold(cardNow);
            state.gold += sg;

            state.decks.A = state.decks.A.map(x => x === cardNow.id ? null : x);
            state.decks.B = state.decks.B.map(x => x === cardNow.id ? null : x);

            state.cardsOwned = (state.cardsOwned||[]).filter(cc => cc && cc.id !== cardNow.id);

            saveState();
            clearDeckInlineSelected();
            buildSlots();
            renderCardsModal();
            syncUI();
            toast("Sold!", `You gained ${fmt(sg)} gold.`);
          });

          s.appendChild(ov);
        }
      }else{
        s.innerHTML = '<div class="slotPlus">+</div>';
      }
    }else{
      s.innerHTML = '<div class="slotPlus">+</div>';
    }

    if (assignedId){
      const cardForTip = getCardById(assignedId);
      if (cardForTip) bindTooltip(s, ()=>cardForTip);
    }
    if (!assignedId){
      if (slotInfo.status === "locked"){
        s.classList.add("locked");
        s.innerHTML = `<div class="slotLock">LOCKED</div>`;
      } else if (slotInfo.status === "purchasable"){
        s.classList.add("purchasable");
        s.innerHTML = `<div class="slotUnlock">UNLOCK<br><span>${fmt(slotInfo.price)}g</span></div>`;
      }
    }

    if (s) s.addEventListener("click", ()=>{
      if (s.classList.contains("locked")) return;
      if (s.classList.contains("purchasable")){ clearDeckInlineSelected(); purchaseDeckSlot(deckKey, idx); return; }

      const currentId = state.decks?.[deckKey]?.[idx] || null;
      if (currentId){
        if (isDeckInlineSelected(deckKey, idx)){
          clearDeckInlineSelected();
        }else{
          setDeckInlineSelected(deckKey, idx);
        }
        buildSlots();
        return;
      }
      clearDeckInlineSelected();
      openDeckPicker(deckKey, idx);
    });
    return s;
  };

  for(let i=0;i<9;i++) deckAEl.appendChild(makeSlot("A", i));
  for(let i=0;i<9;i++) deckBEl.appendChild(makeSlot("B", i));
}

/* ================= UI Sync ================= */

function syncSummonerHeroUI(){
  const activeId = getActiveSummonerId();
  const s = getSummonerDef(activeId);
  if(heroImg && s){
    const src = s.heroImg || s.img || "cards/card.png";
    heroImg.src = src;
    heroImg.alt = s.name || "Summoner";
    heroImg.style.display = "";
  }
}

let __uiSyncQueued = false;
function syncUINow(){
  updateGoldUI();
  try{ applyProfileTheme(); }catch(_){ }
  try{ if (profileNameEl) profileNameEl.textContent = getCurrentUsername(); }catch(_){ }
  try{ const a = state?.profile?.avatar || 'profile/profile.png'; if (profileAvatarImg) profileAvatarImg.src = a; }catch(_){ }

  renderInventory();
  updateCardsBadge();
  updatePetsBadge();
  updateTowersUI();
  buildSlots();
  syncSummonerHeroUI();
  updateWeatherUI();
  updateNotificationsBadges();
  try{ valUpdateHeaderChips(); }catch(_){ }
}

function syncUI(){
  requestUIUpdate();
}

/* ================= Notifications System ================= */

const RARITY_ORDER = ["common","rare","epic","mythical","legendary","cosmic","interstellar","valentines","cny","dragon"];
function rarityIndex(r){ return Math.max(0, RARITY_ORDER.indexOf(String(r||"common").toLowerCase())); }
function countOwnedByRarity(rarity){
  const rr = String(rarity||"").toLowerCase();
  return (Array.isArray(state.cardsOwned) ? state.cardsOwned : []).filter(c => String(c?.rarity||"").toLowerCase()===rr).length;
}
function countOwnedAtLeastRarity(minRarity){
  const minI = rarityIndex(minRarity);
  return (Array.isArray(state.cardsOwned) ? state.cardsOwned : []).filter(c => rarityIndex(c?.rarity) >= minI).length;
}
function countFilledDeckSlots(deckKey){
  const dk = deckKey === "B" ? "B" : "A";
  const arr = state.decks?.[dk];
  if (!Array.isArray(arr)) return 0;
  return arr.filter(x => x !== null && x !== undefined).length;
}
function countMutatedCardsAny(){
  let n = 0;
  for (const c of (Array.isArray(state.cardsOwned) ? state.cardsOwned : [])){
    const muts = getMutationList(c);
    if (Array.isArray(muts) && muts.length > 0){
      const hasNonNormal = muts.some(m=> normMutKey(m) !== "normal");
      if (hasNonNormal) n++;
    }
  }
  return n;
}

function describeReward(reward){
  if (typeof reward === "number"){
    const r = Number(reward)||0;
    return `Reward: ${r} free Lucky Draw ticket${r===1?"":"s"}`;
  }
  if (reward && typeof reward === "object"){
    if (reward.type === "pack"){
      const c = Number(reward.count)||1;
      return `Reward: ${c} ${titleCase(reward.rarity||"")} Pack${c===1?"":"s"}`;
    }
    if (reward.type === "premium_pack_random"){
      const c = Number(reward.count)||1;
      return `Reward: ${c} Random Premium Pack${c===1?"":"s"} (Legendary/Cosmic/Interstellar)`;
    }
    if (reward.type === "gold"){
      const a = Number(reward.amount)||0;
      return `Reward: ${fmt(a)} gold`;
    }
  }
  return "Reward: —";
}

function grantMissionReward(reward){
  try{
    ensureNotifications();

    if (typeof reward === "number"){
      const add = Number(reward)||0;
      state.notifications.tickets = Number(state.notifications.tickets)||0;
      state.notifications.tickets += add;
      return `+${add} Lucky Draw ticket${add===1?"":"s"}.`;
    }

    if (reward && typeof reward === "object"){
      if (reward.type === "gold"){
        const a = Math.max(0, Number(reward.amount)||0);
        state.gold = Number(state.gold)||0;
        state.gold += a;
        return `+${fmt(a)} gold.`;
      }

      const addPack = (rarity, count)=>{
        const r = String(rarity||"common").toLowerCase();
        const c = Math.max(1, Number(count)||1);
        if (!state.invCounts || typeof state.invCounts !== "object") state.invCounts = { common:0, rare:0, epic:0, mythical:0, legendary:0, cosmic:0, interstellar:0, valentines:0 };
        state.invCounts[r] = Number(state.invCounts[r])||0;
        state.invCounts[r] += c;
        return { rarity:r, count:c };
      };

      if (reward.type === "pack"){
        const g = addPack(reward.rarity, reward.count);
        return `+${g.count} ${titleCase(g.rarity)} Pack${g.count===1?"":"s"}.`;
      }

      if (reward.type === "premium_pack_random"){
        const pool = Array.isArray(reward.pool) ? reward.pool : ["legendary","cosmic","interstellar"];
        const pick = String(pool[Math.floor(Math.random()*pool.length)] || "legendary").toLowerCase();
        const g = addPack(pick, reward.count);
        return `+${g.count} ${titleCase(g.rarity)} Pack${g.count===1?"":"s"} (Random Premium).`;
      }
    }

    return "Reward granted.";
  }catch(err){
    console.error('[missions] reward grant failed', err);
    return 'Reward failed to grant (bug). Please refresh and try again.';
  }
}

const NOTIF_MISSIONS = [
  {
    id:"b_own_5_cards",
    group:"Beginner",
    label:()=>`Own 5 cards`,
    reward: 1,
    done:()=> (Array.isArray(state.cardsOwned) ? state.cardsOwned.length : 0) >= 5
  },
  {
    id:"b_fill_deck_a_3",
    group:"Beginner",
    label:()=>`Place 3 cards in Deck A`,
    reward: 1,
    done:()=> countFilledDeckSlots("A") >= 3
  },
  {
    id:"b_own_1_rare",
    group:"Beginner",
    label:()=>`Own 1 Rare card`,
    reward: 1,
    done:()=> countOwnedByRarity("rare") >= 1
  },
  {
    id:"b_reach_50k_gold",
    group:"Beginner",
    label:()=>`Reach 50,000 gold`,
    reward: 2,
    done:()=> (Number(state.gold)||0) >= 50000
  },
  {
    id:"b_get_1_mutation",
    group:"Beginner",
    label:()=>`Own 1 mutated card (any mutation)`,
    reward: 1,
    done:()=> countMutatedCardsAny() >= 1
  },
  {
    id:"b_premium_pack_random",
    group:"Beginner",
    label:()=>`Beginner Jackpot: claim a random Premium Pack`,
    reward: { type:"premium_pack_random", pool:["legendary","cosmic","interstellar"], count:1 },
    done:()=> (Array.isArray(state.cardsOwned) ? state.cardsOwned.length : 0) >= 10
  },
  {
    id:"m_own_25_cards",
    group:"Mid",
    label:()=>`Own 25 cards`,
    reward: 3,
    done:()=> (Array.isArray(state.cardsOwned) ? state.cardsOwned.length : 0) >= 25
  },
  {
    id:"m_fill_deck_a_9",
    group:"Mid",
    label:()=>`Fill all 9 slots in Deck A`,
    reward: 3,
    done:()=> countFilledDeckSlots("A") >= 9
  },
  {
    id:"m_own_3_epic_plus",
    group:"Mid",
    label:()=>`Own 3 Epic+ cards`,
    reward: 4,
    done:()=> countOwnedAtLeastRarity("epic") >= 3
  },
  {
    id:"m_mutated_5_any",
    group:"Mid",
    label:()=>`Own 5 mutated cards (any mutation)`,
    reward: 4,
    done:()=> countMutatedCardsAny() >= 5
  },
  {
    id:"m_reach_250k_gold",
    group:"Mid",
    label:()=>`Reach 250,000 gold`,
    reward: 5,
    done:()=> (Number(state.gold)||0) >= 250000
  },
  {
    id:"m_tower_100k_stored",
    group:"Mid",
    label:()=>`Have 100,000 gold stored in the Tower`,
    reward: 5,
    done:()=> (Number(state.towers?.stored)||0) >= 100000
  },
  {
    id:"h_rarest_common",
    group:"Hardcore",
    label:()=>`Get the rarest Common card`,
    reward: 2,
    done:()=> ownsRarestCardOfRarity("common")
  },
  {
    id:"h_rarest_rare",
    group:"Hardcore",
    label:()=>`Get the rarest Rare card`,
    reward: 3,
    done:()=> ownsRarestCardOfRarity("rare")
  },
  {
    id:"h_rarest_epic",
    group:"Hardcore",
    label:()=>`Get the rarest Epic card`,
    reward: 4,
    done:()=> ownsRarestCardOfRarity("epic")
  },
  {
    id:"h_rarest_legendary",
    group:"Hardcore",
    label:()=>`Get the rarest Legendary card`,
    reward: 6,
    done:()=> ownsRarestCardOfRarity("legendary")
  },
  {
    id:"h_rarest_cosmic",
    group:"Hardcore",
    label:()=>`Get the rarest Cosmic card`,
    reward: 8,
    done:()=> ownsRarestCardOfRarity("cosmic")
  },
  {
    id:"h_rarest_interstellar",
    group:"Hardcore",
    label:()=>`Get the rarest Interstellar card`,
    reward: 12,
    done:()=> ownsRarestCardOfRarity("interstellar")
  },
  {
    id:"h_rainbow_1",
    group:"Hardcore",
    label:()=>`Get 1 card with Rainbow mutation`,
    reward: 5,
    done:()=> countCardsWithMutation("rainbow") >= 1
  },
  {
    id:"h_rainbow_5",
    group:"Hardcore",
    label:()=>`Get 5 cards with Rainbow mutation`,
    reward: 10,
    done:()=> countCardsWithMutation("rainbow") >= 5
  },
  {
    id:"h_blackhole_1",
    group:"Hardcore",
    label:()=>`Get 1 card with Blackhole mutation`,
    reward: 12,
    done:()=> countCardsWithMutation("blackhole") >= 1
  },
  {
    id:"h_own_100_cards",
    group:"Hardcore",
    label:()=>`Own 100 cards`,
    reward: 15,
    done:()=> (Array.isArray(state.cardsOwned) ? state.cardsOwned.length : 0) >= 100
  },
];

const LUCKY_DRAW_COST_GOLD = 1000000;
const LUCKY_DRAW_POOL = [
  { name:"The World", img:"cards/tw.png", gps:1500, rarity:"cosmic", chance:0.01 },
  { name:"Slime King", img:"cards/sk.png", gps:120, rarity:"epic", chance:0.10 },
  { name:"Phantom Thief", img:"cards/pt.png", gps:30, rarity:"rare", chance:0.70 },
];

function countCardsWithMutation(mutKey){
  const nk = normMutKey(mutKey);
  let ctr = 0;
  for (const c of (state.cardsOwned||[])){
    const muts = getMutationList(c).map(normMutKey);
    if (muts.includes(nk)) ctr++;
  }
  return ctr;
}

function ownsRarestRarityWithMutation(rarityKey, mutKey){
  const rarest = getRarestCardDefByRarity(rarityKey);
  if (!rarest) return false;
  const nk = normMutKey(mutKey);
  const targetName = String(rarest.name||"").toLowerCase();
  return (state.cardsOwned||[]).some(c=>{
    if (String(c.rarity||"").toLowerCase() !== String(rarityKey).toLowerCase()) return false;
    if (String(c.name||"").toLowerCase() !== targetName) return false;
    const muts = getMutationList(c).map(normMutKey);
    return muts.includes(nk);
  });
}

function isMissionClaimed(id){
  ensureNotifications();
  return !!state.notifications.claimed?.[id];
}
function setMissionClaimed(id){
  ensureNotifications();
  state.notifications.claimed[id] = true;
  saveState();
  updateNotificationsBadges();
}

function unclaimedRewardsCount(){
  let n = 0;
  try{
    if (!Array.isArray(NOTIF_MISSIONS)) return 0;
    for (const m of NOTIF_MISSIONS){
      if (!m) continue;
      if (typeof m.done === "function" && m.done()){
        const id = m.id || m.key || m.title || "";
        if (id && typeof isMissionClaimed === "function" && isMissionClaimed(id)) continue;
        n++;
      }
    }
  }catch(_){}
  return n;
}

function updateNotificationsBadges(){
  if (!notifBadge || !notifRewardsBadge) return;

  const rewards = unclaimedRewardsCount();
  const unread = Number(window.__cc_unread_msgs || 0);

  const total = rewards + unread;

  if (total > 0){
    notifBadge.style.display = "";
    notifBadge.textContent = String(total);
  }else{
    notifBadge.style.display = "none";
  }

  if (rewards > 0){
    notifRewardsBadge.style.display = "";
    notifRewardsBadge.textContent = String(rewards);
  }else{
    notifRewardsBadge.style.display = "none";
  }

  if (typeof notifMessagesBadge !== "undefined" && notifMessagesBadge){
    if (unread > 0){
      notifMessagesBadge.style.display = "";
      notifMessagesBadge.textContent = String(unread);
    }else{
      notifMessagesBadge.style.display = "none";
    }
  }
}

let notifActiveTab = "rewards";
let notifUserSearchQuery = "";
let notifUserSearchResultData = null;
let notifUserSearchBusy = false;

function setNotifTab(tab){
  if (tab === "logout") tab = "rewards";
  notifActiveTab = tab;
  if (notifTabs){
    const btns = notifTabs.querySelectorAll(".notifTab");
    let activeBtn = null;
    btns.forEach(b=>{
      const t = b.getAttribute("data-tab");
      if (!t) return;
      const on = (t === tab);
      b.classList.toggle("isActive", on);
      if (on) activeBtn = b;
    });

    try{
      if (activeBtn && typeof activeBtn.scrollIntoView === "function"){
        activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }catch(_){ }
  }
}

async function fetchPublicProfile(username){
  const u = String(username || "").trim();
  const qs = new URLSearchParams({ username: u });
  const res = await fetch(`api/public_profile.php?${qs.toString()}`, { credentials:"same-origin" });
  const data = await res.json().catch(()=>null);
  if (!data || typeof data !== "object") return { ok:false, error:"Bad response" };
  return data;
}

window.__cc_search_user = window.__cc_search_user || "";

async function fetchOnlineStatus(username){
  const u = String(username || "").trim();
  if (!u) return null;
  const qs = new URLSearchParams({ username: u });
  qs.set("_", String(Date.now()));
  const res = await fetch(`api/online_status.php?${qs.toString()}`, {
    credentials: "same-origin",
    cache: "no-store"
  });
  const data = await res.json().catch(()=>null);
  if (!data || typeof data !== "object" || !data.ok) return null;
  return data;
}

function applyStatusDot(el, isOnline, lastSeenSecondsAgo){
  if (!el) return;
  const online = !!isOnline;
  el.classList.toggle("online", online);
  el.classList.toggle("offline", !online);
  const title = online
    ? "Online"
    : (typeof lastSeenSecondsAgo === "number" ? `Offline (last seen ${Math.max(0, lastSeenSecondsAgo)}s ago)` : "Offline");
  el.setAttribute("title", title);
  el.setAttribute("aria-label", online ? "Online" : "Offline");
}

(function startPresencePolling(){
  let busy = false;
  async function tick(){
    if (busy) return;
    busy = true;
    try{
      const me = (typeof getCurrentUsername === "function") ? String(getCurrentUsername() || "").trim() : "";
      if (me){
        const s = await fetchOnlineStatus(me);
        if (s){
          applyStatusDot(profileStatusDotEl, s.isOnline, s.lastSeenSecondsAgo);
          applyStatusDot(profileModalStatusDotEl, s.isOnline, s.lastSeenSecondsAgo);
        }
      }

      const su = String(window.__cc_search_user || "").trim();
      if (su){
        const s2 = await fetchOnlineStatus(su);
        const dot = document.getElementById("userSearchStatusDot");
        if (dot && s2) applyStatusDot(dot, s2.isOnline, s2.lastSeenSecondsAgo);
      }
    }catch(_){
    }finally{
      busy = false;
    }
  }

  setTimeout(()=>{
    tick();
    setInterval(tick, 1500);
  }, 1000);
})();

function renderReadOnlyUserProfile(container, payload){
  if (!container) return;
  container.innerHTML = "";
  const user = payload?.user || null;
  if (!user){
    container.innerHTML = `<div class="muted">No profile data.</div>`;
    return;
  }

  try{ window.__cc_search_user = String(user.username || "").trim(); }catch(_){ }

  const head = document.createElement("div");
  head.className = "userProfileHead";

  const avWrap = document.createElement("div");
  avWrap.className = "profileAvatarWrap userSearchAvatarWrap";
  const av = document.createElement("img");
  av.alt = user.username || "User";
  av.loading = "lazy";
  av.decoding = "async";
  av.src = user.avatar || "profile/profile.png";
  av.onerror = ()=>{ av.src = "profile/profile.png"; };
  avWrap.appendChild(av);

  const fKey = String(user.equippedFrame || "default");
  const aKey = String(user.equippedAura || "none");

  if (fKey === "rose"){
    avWrap.classList.add("hasFrame");
    try{ avWrap.style.setProperty("--avatarFrameUrl", "url('frame/valentines.png'), url('frames/valentines.png')"); }catch(_){}
  }
  if (aKey === "crimson"){
    avWrap.classList.add("auraCrimson");
  }

  const txt = document.createElement("div");
  txt.className = "userSearchHeadText";
  {
    const tKey = String(user.equippedTitle || "").toLowerCase();
    const tMeta = (PROFILE_COSMETICS?.titles || []).find(x=>String(x.key||"").toLowerCase()===tKey);
    const titleHtml = (tMeta && tMeta.key) ? `<div class="profileEquippedTitle"><span class="titleIcon">${escapeHtml(tMeta.emoji||"")}</span><span class="titleText">${escapeHtml(tMeta.name||"")}</span></div>` : "";
    txt.innerHTML = `
      <div class="uphTitle">🔎 Profile: <b>${escapeHtml(user.username || "Unknown")}</b><span class="statusDot offline" id="userSearchStatusDot" aria-label="Offline" title="Offline"></span><button class="chatIconBtn" id="userSearchChatBtn" type="button" title="Send message" aria-label="Send message">💬</button></div>
      ${titleHtml}
    `;
  }

  head.appendChild(avWrap);
  head.appendChild(txt);
  container.appendChild(head);

  const chatBtn = document.getElementById("userSearchChatBtn");
  if (chatBtn){
    chatBtn.onclick = ()=>{
      const uname = String(user.username || "").trim();
      if (!uname){ toast("Error","No user."); return; }
      openMsgCompose(uname);
    };
  }

  const cos = user.cosmeticsOwned || {};
  const frames = Array.isArray(cos.frames) ? cos.frames : [];
  const auras  = Array.isArray(cos.auras) ? cos.auras : [];
  const titles = Array.isArray(user.titlesOwned) ? user.titlesOwned : [];

  const ach = user.achievements && typeof user.achievements === "object" ? user.achievements : {};
  const unlocked = (Array.isArray(PROFILE_ACHIEVEMENTS) ? PROFILE_ACHIEVEMENTS : []).filter(a => !!ach[a.id]);

  const sec2 = document.createElement("div");
  sec2.className = "userProfileSection";
  sec2.innerHTML = `<div class="upsH">🏆 Achievement Badges</div>`;
  const grid = document.createElement("div");
  grid.className = "userBadgeGrid";
  if (!unlocked.length){
    grid.innerHTML = `<div class="muted">No badges unlocked yet.</div>`;
  }else{
    for (const a of unlocked){
      const b = document.createElement("div");
      b.className = "userBadge unlocked";
      b.title = `${a.name} — ${a.desc}`;
      b.innerHTML = `
        <div class="bTop">
          <div class="bIcon" aria-hidden="true">${escapeHtml(a.icon)}</div>
          <div class="bName">${escapeHtml(a.name)}</div>
        </div>
        <div class="bDesc">${escapeHtml(a.desc)}</div>
      `;
      if (b) b.addEventListener("click", ()=>toast(a.name, a.desc));
      grid.appendChild(b);
    }
  }
  sec2.appendChild(grid);
  container.appendChild(sec2);

  const flexCards = Array.isArray(user.flexCards) ? user.flexCards : [];
  const sec3 = document.createElement("div");
  sec3.className = "userProfileSection";
  sec3.innerHTML = `<div class="upsH">Flex Showcase</div>`;
  const flexRow = document.createElement("div");
  flexRow.className = "userFlexRow";
  for (let i=0;i<3;i++){
    const card = flexCards[i] || null;
    const slot = document.createElement("div");
    slot.className = "userFlexSlot";

    if (!card){
      slot.innerHTML = `<div class="userFlexEmpty">Empty</div>`;
      flexRow.appendChild(slot);
      continue;
    }

    const tile = document.createElement("div");
    tile.className = `userFlexCardTile r-${String(card.rarity||"").toLowerCase()}`;
    applyMutationGlow(tile, card);

    const img = document.createElement("img");
    img.className = "userFlexCardImg";
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = card.name || "Card";
    img.src = card.img || card.image || "cards/card.png";
    img.onerror = ()=>{ img.src = "cards/card.png"; };
    startCardAnimation(img, card);
    tile.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "userFlexCardMeta";
    const gps = computeCardGps(card);
    meta.innerHTML = `
      <div class="ufcmName">${escapeHtml(card.name || "Unknown")}</div>
      <div class="ufcmGps">${fmt(gps)} GPS</div>
    `;
    tile.appendChild(meta);

    bindTooltip(tile, ()=>card);

    slot.appendChild(tile);
    flexRow.appendChild(slot);
  }
  sec3.appendChild(flexRow);
  container.appendChild(sec3);
}

function renderNotifUserSearchPanel(){
  if (!notifContent) return;
  notifContent.innerHTML = "";

  const h = document.createElement("h3");
  h.textContent = "Search User";
  notifContent.appendChild(h);

  const p = document.createElement("div");
  p.className = "small muted";
  p.textContent = "Search a username to view a read-only profile (cosmetics, titles, unlocked badges, and flex showcase).";
  notifContent.appendChild(p);

  const row = document.createElement("div");
  row.className = "userSearchRow";

  const input = document.createElement("input");
  input.className = "userSearchInput";
  input.type = "text";
  input.placeholder = "Enter username…";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = notifUserSearchQuery || "";

  const btn = document.createElement("button");
  btn.className = "btn userSearchBtn";
  btn.type = "button";
  btn.textContent = "Search";

  row.appendChild(input);
  row.appendChild(btn);
  notifContent.appendChild(row);

  const result = document.createElement("div");
  result.className = "userSearchResults";
  notifContent.appendChild(result);

  const run = ()=> runNotifUserSearch(input.value, result);

  if (btn) btn.addEventListener("click", run);
  if (input) input.addEventListener("keydown", (e)=>{
    if (e.key === "Enter"){
      e.preventDefault();
      run();
    }
  });

  if (notifUserSearchResultData && notifUserSearchResultData.ok){
    try{ window.__cc_search_user = String(notifUserSearchResultData?.user?.username||"").trim(); }catch(_){ window.__cc_search_user = ""; }
    renderReadOnlyUserProfile(result, notifUserSearchResultData);
  }else{
    result.innerHTML = `<div class="muted">Type a username, then click Search.</div>`;
  }

  setTimeout(()=>{ try{ input.focus(); }catch(_){ } }, 0);
}

/* ================= Direct Messages ================= */

window.__cc_unread_msgs = window.__cc_unread_msgs || 0;
let __msgPollBusy = false;
let __msgLastSeenInboxId = 0;

async function pollDirectMessages(){
  if (__msgPollBusy) return;
  __msgPollBusy = true;
  try{
    const res = await fetch("api/messages_inbox.php?limit=25", { method:"GET", credentials:"same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(()=>null);
    if (!data || data.ok !== true) return;

    const unread = Number(data.unread_count || 0);
    window.__cc_unread_msgs = unread;

    const items = Array.isArray(data.messages) ? data.messages : [];
    if (items.length){
      const newestId = Number(items[0].id || 0);
      if (__msgLastSeenInboxId && newestId > __msgLastSeenInboxId){
        const newest = items[0];
        const from = String(newest.from_username || "Someone");
        toast("New Message", `From ${from}`);
      }
      __msgLastSeenInboxId = Math.max(__msgLastSeenInboxId, newestId);
    }

    updateNotificationsBadges();

    if (notifOverlay && notifOverlay.classList.contains("show") && notifActiveTab === "messages"){
      try{ renderNotifMessagesPanel({ keepScroll:true }); }catch(_){}
    }
  }catch(_){
  }finally{
    __msgPollBusy = false;
  }
}

setInterval(pollDirectMessages, 5000);
setTimeout(pollDirectMessages, 1200);

function ensureComposeOverlay(){
  if (document.getElementById("msgComposeOverlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "modalOverlay";
  overlay.id = "msgComposeOverlay";
  overlay.setAttribute("aria-hidden","true");
  overlay.innerHTML = `
    <div class="modal msgComposeModal" role="dialog" aria-modal="true" aria-labelledby="msgComposeTitle">
      <div class="modalHead">
        <b id="msgComposeTitle">Send Message</b>
        <button class="closeBtn" id="closeMsgComposeBtn" type="button">Close</button>
      </div>
      <div class="modalBody">
        <div class="msgComposeToRow">
          <span class="muted small">To:</span>
          <input id="msgComposeTo" class="msgComposeTo" type="text" readonly />
        </div>
        <textarea id="msgComposeBody" class="msgComposeBody" rows="5" placeholder="Type your message..."></textarea>
        <div class="msgComposeActions">
          <button class="btn" id="msgComposeCancelBtn" type="button">Cancel</button>
          <button class="btn btnPrimary" id="msgComposeSendBtn" type="button">Send</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = ()=> closeMsgCompose();
  overlay.addEventListener("click", (e)=>{ if (e.target === overlay) close(); });
  overlay.querySelector("#closeMsgComposeBtn")?.addEventListener("click", close);
  overlay.querySelector("#msgComposeCancelBtn")?.addEventListener("click", close);

  overlay.querySelector("#msgComposeSendBtn")?.addEventListener("click", async ()=>{
    const to = String(document.getElementById("msgComposeTo")?.value || "").trim();
    const body = String(document.getElementById("msgComposeBody")?.value || "").trim();
    if (!to){ toast("Missing receiver", "No target user."); return; }
    if (!body){ toast("Empty message", "Type something first."); return; }
    if (body.length > 500){ toast("Too long", "Max 500 characters."); return; }

    const btn = document.getElementById("msgComposeSendBtn");
    if (btn) btn.disabled = true;
    try{
      await postJSON("api/messages_send.php", { to_username: to, body });
      toast("Sent", `Message sent to ${to}.`);
      await pollMessagesSent();
      closeMsgCompose();
    }catch(err){
      toast("Send failed", (err && err.message) ? err.message : "Failed to send.");
    }finally{
      if (btn) btn.disabled = false;
    }
  });
}

function openMsgCompose(toUsername){
  ensureComposeOverlay();
  const overlay = document.getElementById("msgComposeOverlay");
  const to = document.getElementById("msgComposeTo");
  const body = document.getElementById("msgComposeBody");
  if (to) to.value = String(toUsername || "").trim();
  if (body) body.value = "";
  if (overlay){
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden","false");
  }
  setTimeout(()=>{ try{ body?.focus(); }catch(_){ } }, 0);
}

function closeMsgCompose(){
  const overlay = document.getElementById("msgComposeOverlay");
  if (!overlay) return;
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden","true");
}

let __messagesInboxCache = [];
let __messagesSentCache = [];
let __messagesBusy = false;

async function pollMessagesInbox(){
  const res = await fetch("api/messages_inbox.php?limit=50", { method:"GET", credentials:"same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json().catch(()=>null);
  if (!data || data.ok !== true) throw new Error(data?.error || "Failed");
  __messagesInboxCache = Array.isArray(data.messages) ? data.messages : [];
  window.__cc_unread_msgs = Number(data.unread_count || 0);
  updateNotificationsBadges();
  return data;
}

async function pollMessagesSent(){
  const res = await fetch("api/messages_sent.php?limit=50", { method:"GET", credentials:"same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json().catch(()=>null);
  if (!data || data.ok !== true) throw new Error(data?.error || "Failed");
  __messagesSentCache = Array.isArray(data.messages) ? data.messages : [];
  return data;
}

async function markAllInboxRead(){
  try{
    await postJSON("api/messages_mark_read.php", { mode:"all" });
    window.__cc_unread_msgs = 0;
    updateNotificationsBadges();
  }catch(_){}
}

async function renderNotifMessagesPanel(opts){
  if (!notifContent) return;
  const keepScroll = !!(opts && opts.keepScroll);
  let scrollTop = 0;
  if (keepScroll) scrollTop = notifContent.scrollTop || 0;

  notifContent.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "msgPanel";

  const head = document.createElement("div");
  head.className = "msgPanelHead";
  head.innerHTML = `
    <div class="msgPanelTitle">
      <b>Inbox</b>
      <span class="muted small">Direct messages</span>
    </div>
    <div class="msgPanelActions">
      <button class="btn msgSmallBtn" id="msgRefreshBtn" type="button">Refresh</button>
      <button class="btn msgSmallBtn" id="msgMarkReadBtn" type="button">Mark all read</button>
    </div>
  `;
  wrap.appendChild(head);

  const tabs = document.createElement("div");
  tabs.className = "msgSwitch";
  tabs.innerHTML = `
    <button class="msgSwitchBtn isActive" data-view="inbox" type="button">Inbox</button>
    <button class="msgSwitchBtn" data-view="sent" type="button">Sent</button>
  `;
  wrap.appendChild(tabs);

  const list = document.createElement("div");
  list.className = "msgList";
  wrap.appendChild(list);

  notifContent.appendChild(wrap);

  const renderList = (view)=>{
    list.innerHTML = "";
    const items = (view === "sent") ? (__messagesSentCache || []) : (__messagesInboxCache || []);
    if (!items.length){
      list.innerHTML = `<div class="muted">No ${view === "sent" ? "sent messages" : "messages"} yet.</div>`;
      return;
    }
    items.slice().sort((a,b)=>Number(b.created_at_ms||0)-Number(a.created_at_ms||0)).slice(0,80).forEach(m=>{
      const card = document.createElement("div");
      card.className = "msgItem";
      const dt = new Date(Number(m.created_at_ms||Date.now()));
      const who = (view === "sent") ? String(m.to_username||"") : String(m.from_username||"");
      const label = (view === "sent") ? `To ${who}` : `From ${who}`;
      const isUnread = (view !== "sent") && !Number(m.is_read||0);
      if (isUnread) card.classList.add("isUnread");
      card.innerHTML = `
        <div class="msgItemTop">
          <b>${escapeHtml(label)}</b>
          <span class="muted small">${dt.toLocaleString()}</span>
        </div>
        <div class="msgItemBody">${escapeHtml(String(m.body||""))}</div>
      `;
      list.appendChild(card);
    });
  };

  let currentView = "inbox";
  renderList(currentView);

  tabs.querySelectorAll(".msgSwitchBtn").forEach(b=>{
    b.addEventListener("click", ()=>{
      tabs.querySelectorAll(".msgSwitchBtn").forEach(x=>x.classList.remove("isActive"));
      b.classList.add("isActive");
      currentView = String(b.dataset.view || "inbox");
      if (currentView === "sent"){
        pollMessagesSent().then(()=>renderList("sent")).catch(()=>renderList("sent"));
      }else{
        pollMessagesInbox().then(()=>renderList("inbox")).catch(()=>renderList("inbox"));
      }
    });
  });

  wrap.querySelector("#msgRefreshBtn")?.addEventListener("click", async ()=>{
    if (__messagesBusy) return;
    __messagesBusy = true;
    try{
      await pollMessagesInbox();
      await pollMessagesSent();
      renderList(currentView);
      toast("Updated", "Messages refreshed.");
    }catch(_){
      toast("Error", "Failed to refresh messages.");
    }finally{
      __messagesBusy = false;
    }
  });

  wrap.querySelector("#msgMarkReadBtn")?.addEventListener("click", async ()=>{
    await markAllInboxRead();
    await pollMessagesInbox().catch(()=>{});
    renderList("inbox");
    toast("Done", "Inbox marked as read.");
  });

  if (keepScroll) notifContent.scrollTop = scrollTop;
}

async function runNotifUserSearch(query, resultEl){
  const q = String(query || "").trim();
  notifUserSearchQuery = q;
  notifUserSearchResultData = null;
  if (!resultEl) return;
  if (!q){
    resultEl.innerHTML = `<div class="muted">Type a username, then click Search.</div>`;
    return;
  }
  if (notifUserSearchBusy) return;
  notifUserSearchBusy = true;
  resultEl.innerHTML = `<div class="muted">Searching…</div>`;
  try{
    const data = await fetchPublicProfile(q);
    if (!data.ok){
      resultEl.innerHTML = `<div class="errText">${escapeHtml(data.error || "User not found")}</div>`;
      try{ window.__cc_search_user = ""; }catch(_){ }
      return;
    }
    notifUserSearchResultData = data;
    try{ window.__cc_search_user = String(data?.user?.username||"").trim(); }catch(_){ window.__cc_search_user = ""; }
    renderReadOnlyUserProfile(resultEl, data);
  }catch(err){
    resultEl.innerHTML = `<div class="errText">Search failed. Try again.</div>`;
    try{ window.__cc_search_user = ""; }catch(_){ }
  }finally{
    notifUserSearchBusy = false;
  }
}

function renderNotifTab(){
  if (!notifContent) return;
  updateNotificationsBadges();

  notifContent.innerHTML = "";

  if (notifActiveTab === "rewards"){
    const h = document.createElement("h3");
    h.textContent = "Rewards Missions";
    notifContent.appendChild(h);

    const p = document.createElement("div");
    p.className = "small muted";
    p.textContent = "Complete missions to claim rewards.";
    notifContent.appendChild(p);

    const list = document.createElement("div");
    list.className = "missionList";

    for (const m of NOTIF_MISSIONS){
      const done = !!m.done();
      const claimed = isMissionClaimed(m.id);

      const row = document.createElement("div");
      row.className = "missionItem";

      const left = document.createElement("div");
      left.className = "missionLeft";

      const t = document.createElement("div");
      t.className = "missionTitle";
      t.textContent = m.label();
      left.appendChild(t);

      const r = document.createElement("div");
      r.className = "missionReward";
      r.textContent = describeReward(m.reward);
      left.appendChild(r);

      const right = document.createElement("div");
      right.className = "missionRight";

      const pill = document.createElement("span");
      pill.className = "missionStatus";
      if (claimed){
        pill.textContent = "CLAIMED";
        pill.classList.add("claimed");
      }else if (done){
        pill.textContent = "READY";
        pill.classList.add("done");
      }else{
        pill.textContent = "IN PROGRESS";
      }
      right.appendChild(pill);

      if (done && !claimed){
        const btn = document.createElement("button");
        btn.className = "claimBtn";
        btn.type = "button";
        btn.textContent = "Claim";
        if (btn) btn.addEventListener("click", ()=>{
          const msg = grantMissionReward(m.reward);
          setMissionClaimed(m.id);
          saveState();
          toast("Reward Claimed", msg);
          renderNotifTab();
        });
        right.appendChild(btn);
      }

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    }

    notifContent.appendChild(list);
    return;
  }

  if (notifActiveTab === "howto"){
    try{ openHowToPlay(true); }catch(_){ }
    const h = document.createElement("h3");
    h.textContent = "How to Play";
    notifContent.appendChild(h);

    const p = document.createElement("div");
    p.className = "small muted";
    p.textContent = "Open the beginner guide anytime to learn packs, decks, mutations, weather, and events.";
    notifContent.appendChild(p);

    const box = document.createElement("div");
    box.className = "comingSoonBox";
    box.innerHTML = `
      <div class="comingSoonTitle">Beginner Guide</div>
      <div class="small muted" style="margin-top:6px;">
        This is the same guide as the old “How to Play” button — now moved inside Notifications.
      </div>
      <div class="okRow" style="margin-top:12px;">
        <button class="btn btnPrimary" id="notifHowtoOpenBtn" type="button">Open How to Play</button>
      </div>
    `;
    notifContent.appendChild(box);

    const btn = box.querySelector("#notifHowtoOpenBtn");
    if (btn){
      btn.dataset.sfx = "click";
      if (btn) btn.addEventListener("click", ()=> openHowToPlay(true));
    }
    return;
  }

  if (notifActiveTab === "lucky"){
    const h = document.createElement("h3");
    h.textContent = "Lucky Draw Gacha";
    notifContent.appendChild(h);

    const box = document.createElement("div");
    box.className = "luckyBox";

    const top = document.createElement("div");
    top.className = "luckyTop";

    const tickets = document.createElement("div");
    tickets.className = "luckyTickets";
    tickets.innerHTML = `<b>Tickets</b> <span>${fmt(state.notifications?.tickets||0)}</span>`;
    top.appendChild(tickets);

    const actions = document.createElement("div");
    actions.className = "luckyActions";

    const btnTicket = document.createElement("button");
    btnTicket.className = "btn btnPrimary";
    btnTicket.type = "button";
    btnTicket.textContent = "Spin (1 Ticket)";
    btnTicket.dataset.sfx = "open-card";
    btnTicket.disabled = (state.notifications?.tickets||0) < 1;
    if (btnTicket) btnTicket.addEventListener("click", ()=>doLuckyDraw("ticket"));
    actions.appendChild(btnTicket);

    const btnGold = document.createElement("button");
    btnGold.className = "btn btnGhost";
    btnGold.type = "button";
    btnGold.textContent = `Spin (${fmt(LUCKY_DRAW_COST_GOLD)} Gold)`;
    btnGold.dataset.sfx = "open-card";
    btnGold.disabled = state.gold < LUCKY_DRAW_COST_GOLD;
    if (btnGold) btnGold.addEventListener("click", ()=>doLuckyDraw("gold"));
    actions.appendChild(btnGold);

    top.appendChild(actions);
    box.appendChild(top);

    const note = document.createElement("div");
    note.className = "small muted";
    note.textContent = "Mutation chances are the same as opening cards from the inventory.";
    box.appendChild(note);

    const odds = document.createElement("div");
    odds.className = "luckyOdds";
    odds.innerHTML = `
      <div class="luckyOddsRow"><b>1% chance</b><span>The World (1500 GPS)</span></div>
      <div class="luckyOddsRow"><b>10% chance</b><span>Slime King (120 GPS)</span></div>
      <div class="luckyOddsRow"><b>70% chance</b><span>Phantom Thief (30 GPS)</span></div>
    `;
    box.appendChild(odds);

    notifContent.appendChild(box);
    return;
  }

  if (notifActiveTab === "mutation"){
    renderMutationMachinePanel();
    return;
  }

  if (notifActiveTab === "trade"){
    renderTradePanel();
    return;
  }

  if (notifActiveTab === "usersearch"){
    renderNotifUserSearchPanel();
    return;
  }

  const titleMap = {
    trade: "Trade",
    settings: "Settings"
  };
  const h = document.createElement("h3");
  h.textContent = titleMap[notifActiveTab] || "Coming Soon";
  notifContent.appendChild(h);

  const p = document.createElement("div");
  p.className = "small muted";
  p.textContent = "Coming Soon";
  notifContent.appendChild(p);
}

/* ================= Mutation Machine (Notifications) ================= */
const MUTATION_MACHINE_DURATION_MS = 25 * 60 * 1000;
const MUTATION_MACHINE_GOLD_SKIP_FULL = 1_000_000;
const MUTATION_MACHINE_GOLD_SKIP_MIN  = 10_000;

function calcMutationMachineSkipCost(remainingMs){
  const fullSec = MUTATION_MACHINE_DURATION_MS / 1000;
  const remSec = Math.max(0, Math.ceil((Number(remainingMs)||0) / 1000));
  const ratio = Math.min(1, remSec / fullSec);
  const curved = Math.pow(ratio, 0.65);
  const cost = MUTATION_MACHINE_GOLD_SKIP_MIN + (MUTATION_MACHINE_GOLD_SKIP_FULL - MUTATION_MACHINE_GOLD_SKIP_MIN) * curved;
  return Math.max(MUTATION_MACHINE_GOLD_SKIP_MIN, Math.round(cost));
}

const MM_IDLE_IMG   = "mm/grey.png";
const MM_FINISH_IMG = "mm/finish.png";
const MM_RUN_FRAMES = ["mm/red.png","mm/yellow.png","mm/blue.png","mm/green.png"];

let __mmCoreAnimTimer = null;
let __mmCoreAnimIdx = 0;
let __mmLastStatusForPanel = null;

function preloadMmAssets(){
  if (preloadMmAssets._done) return;
  preloadMmAssets._done = true;
  const all = [MM_IDLE_IMG, MM_FINISH_IMG, ...MM_RUN_FRAMES];
  all.forEach((src)=>{
    try{ const im = new Image(); im.src = src; }catch(_){}
  });
}

function setMmCoreImage(src){
  const img = document.getElementById("mmCoreImg");
  if (!img) return;
  if (img.dataset && img.dataset.src === src) return;

  img.classList.add("mmImgFade");
  setTimeout(()=>{
    img.src = src;
    if (img.dataset) img.dataset.src = src;
  }, 60);
  setTimeout(()=> img.classList.remove("mmImgFade"), 220);
}

function startMmCoreAnimation(){
  // Use the unified animation manager
  const img = document.getElementById("mmCoreImg");
  if (!img) return;
  preloadMmAssets();
  FrameAnimationManager.animate(img, MM_RUN_FRAMES, 650);
}

function stopMmCoreAnimation(){
  const img = document.getElementById("mmCoreImg");
  if (img) FrameAnimationManager.stop(img);
}

const MUTATION_MACHINE_TABLE = [
  { k: "Normal", w: 60 },
  { k: "Silver", w: 30 },
  { k: "Gold", w: 10 },
  { k: "Diamond", w: 7 },
  { k: "Rainbow", w: 3 },
  { k: "Neon", w: 1 },
  { k: "Galactic", w: 1 },
  { k: "Thunder", w: 15 },
  { k: "Blackhole", w: 1 }
];

function rollMutationMachineKey(){
  let total = 0;
  for (const it of MUTATION_MACHINE_TABLE) total += Number(it.w)||0;
  let r = Math.random() * (total || 1);
  for (const it of MUTATION_MACHINE_TABLE){
    r -= (Number(it.w)||0);
    if (r <= 0) return it.k;
  }
  return "Normal";
}

function mutationMachineEligibleCards(){
  const usedInDeck = getUsedDeckCardIdSet();
  const list = (state.cardsOwned||[]).filter(c=>{
    if (!c || !c.id) return false;
    if (String(c.location||"inventory") !== "inventory") return false;
    if (usedInDeck.has(c.id)) return false;
    if (c.fav === true) return false;

    const muts = getMutationList(c);
    return (muts.length === 0 || muts.length === 1);
  });

  list.sort((a,b)=>{
    const ga = computeCardGps(a);
    const gb = computeCardGps(b);
    if (gb !== ga) return gb - ga;
    const na = String(a.name||"").toLowerCase();
    const nb = String(b.name||"").toLowerCase();
    if (na < nb) return -1;
    if (na > nb) return 1;
    const ra = invOrder.indexOf(String(a.rarity||"common").toLowerCase());
    const rb = invOrder.indexOf(String(b.rarity||"common").toLowerCase());
    return ra - rb;
  });
  return list;
}

function rollMutationMachineKeyAvoid(excludeKey){
  const ex = normMutKey(excludeKey);
  for (let i=0;i<8;i++){
    const mk = rollMutationMachineKey();
    if (normMutKey(mk) !== ex) return mk;
  }
  return rollMutationMachineKey();
}

function openMmSelectModal(){
  if (!mmSelectOverlay) return;
  mmPicking = { selectedCardId: null };
  if (mmSearchInput){ mmSearchInput.value = ""; }

  mmSelectOverlay.classList.add("show");
  mmSelectOverlay.setAttribute("aria-hidden","false");
  renderMmPickGrid();
  setMmDetails(null);
  if (mmSelectBtn) mmSelectBtn.disabled = true;
}
function closeMmSelectModal(){
  if (!mmSelectOverlay) return;
  mmSelectOverlay.classList.remove("show");
  mmSelectOverlay.setAttribute("aria-hidden","true");
  mmPicking = null;
  FrameAnimationManager.stopAll();
}

function setMmDetails(card){
  if (!mmDetailsImg) return;
  if (!card){
    mmDetailsImg.src = "cards/card.png";
    mmDetailsName.textContent = "—";
    mmDetailsRarity.textContent = "—";
    mmDetailsChance.textContent = "—";
    mmDetailsMutation.textContent = "—";
    mmDetailsGps.textContent = "—";
    return;
  }
  mmDetailsImg.src = card.img || "cards/card.png";
  mmDetailsName.textContent = card.name || "Unknown";
  mmDetailsRarity.textContent = (card.rarity || "common").toUpperCase();
  mmDetailsChance.textContent = `${Number(card.pullChance ?? card.w ?? 0)}%`;
  mmDetailsMutation.textContent = mutationLabel(card);
  mmDetailsGps.textContent = `${fmt(Number(card.gps)||0)} / sec`;
}

function renderMmPickGrid(){
  if (!mmPickGrid) return;
  mmPickGrid.innerHTML = "";

  const q = String(mmSearchInput?.value || "").trim().toLowerCase();

  let pool = mutationMachineEligibleCards();

  if (q){
    pool = pool.filter(c=>{
      const name = String(c.name||"").toLowerCase();
      const rarity = String(c.rarity||"").toLowerCase();
      const muts = getMutationList(c).join(" ").toLowerCase();
      return (name.includes(q) || rarity.includes(q) || muts.includes(q));
    });
  }

  if (!pool.length){
    if (mmPickEmpty) mmPickEmpty.style.display = "";
    if (mmPicking) mmPicking.selectedCardId = null;
    if (mmSelectBtn) mmSelectBtn.disabled = true;
    setMmDetails(null);
    return;
  }
  if (mmPickEmpty) mmPickEmpty.style.display = "none";

  const selectedId = mmPicking?.selectedCardId || null;
  let selectedCardObj = null;

  pool.forEach(c=>{
    const item = document.createElement("div");
    item.className = "deckPickItem";
    item.dataset.id = c.id;

    applyMutationGlow(item, c);

    const img = document.createElement("img");
    img.src = c.img || "cards/card.png";
    img.onerror = ()=>{ img.src = "cards/card.png"; };
    startCardAnimation(img, c);

    const meta = document.createElement("div");
    meta.className = "deckPickMeta";

    const name = document.createElement("div");
    name.className = "deckPickName";
    name.textContent = c.name || "Unknown";

    const tag = document.createElement("div");
    tag.className = "deckPickTag";
    tag.textContent = (c.rarity || "common").toUpperCase();

    meta.appendChild(name);
    meta.appendChild(tag);

    item.appendChild(img);
    item.appendChild(meta);

    bindTooltip(item, ()=>c);

    if (selectedId && c.id === selectedId){
      item.classList.add("sel");
      selectedCardObj = c;
    }

    if (item) item.addEventListener("click", ()=>{
      mmPickGrid.querySelectorAll(".deckPickItem.sel").forEach(n=>n.classList.remove("sel"));
      item.classList.add("sel");
      if (mmPicking) mmPicking.selectedCardId = c.id;
      if (mmSelectBtn) mmSelectBtn.disabled = false;
      setMmDetails(c);
    });

    mmPickGrid.appendChild(item);
  });

  if (selectedCardObj){
    if (mmSelectBtn) mmSelectBtn.disabled = false;
    setMmDetails(selectedCardObj);
  }else{
    if (mmSelectBtn) mmSelectBtn.disabled = true;
    setMmDetails(null);
  }
}

/* ================= Trade Gifts (Notifications) ================= */
function tradeEligibleCards(){
  const usedInDeck = getUsedDeckCardIdSet ? getUsedDeckCardIdSet() : new Set();
  return (state.cardsOwned||[]).filter(c=>{
    if (!c || !c.id) return false;
    if (String(c.location||"inventory") !== "inventory") return false;
    if (usedInDeck && usedInDeck.has && usedInDeck.has(c.id)) return false;
    if (c.fav === true) return false;
    return true;
  });
}

function openTradeSelectModal(){
  if (!tradeSelectOverlay) return;
  tradePicking = { selectedCardId: null };
  tradeSelectOverlay.classList.add("show");
  tradeSelectOverlay.setAttribute("aria-hidden","false");
  renderTradePickGrid();
  setTradeDetails(null);
  if (tradeSelectBtn) tradeSelectBtn.disabled = true;
}
function closeTradeSelectModal(){
  if (!tradeSelectOverlay) return;
  tradeSelectOverlay.classList.remove("show");
  tradeSelectOverlay.setAttribute("aria-hidden","true");
  tradePicking = null;
  FrameAnimationManager.stopAll();
}

let __tradePollBusy = false;
let __tradeLastToastAt = 0;

async function pollTradeGifts(){
  if (__tradePollBusy) return;
  __tradePollBusy = true;
  try{
    const res = await fetch("api/trade_fetch.php", { method:"GET", credentials:"same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(()=>null);
    if (!data || data.ok !== true) return;

    const items = Array.isArray(data.messages) ? data.messages : [];
    if (!items.length) return;

    ensureNotifications();
    if (!Array.isArray(state.notifications.messages)) state.notifications.messages = [];

    let gotAny = false;

    for (const it of items){
      const from = String(it.from_username || "Someone");
      const card = (it.card && typeof it.card === "object") ? it.card : null;
      const created = Number(it.created_at_ms || Date.now());

      if (card && card.id){
        card.location = "inventory";
        if (card.fav === undefined) card.fav = false;

        if (!(state.cardsOwned||[]).some(c=>c && c.id === card.id)){
          state.cardsOwned = state.cardsOwned || [];
          state.cardsOwned.push(card);
          gotAny = true;
        }
      }

      const cardName = card?.name ? String(card.name) : "a card";
      state.notifications.messages.push({
        text: `${from} sent you ${cardName}.`,
        ts: created
      });

      const now = Date.now();
      if (now - __tradeLastToastAt > 900){
        giftToast(from, card);
        __tradeLastToastAt = now;
      }
    }

    if (gotAny){
      ensureDeckCardLocations();
      saveState();
      try{ syncUI(); }catch(_){}
      try{ renderNotifTab(); }catch(_){}
    }
  }catch(_){
  }finally{
    __tradePollBusy = false;
  }
}

function setTradeDetails(card){
  if (!tradeDetailsImg) return;
  if (!card){
    tradeDetailsImg.src = "cards/card.png";
    tradeDetailsName.textContent = "—";
    tradeDetailsRarity.textContent = "—";
    tradeDetailsChance.textContent = "—";
    tradeDetailsMutation.textContent = "—";
    tradeDetailsGps.textContent = "—";
    return;
  }
  tradeDetailsImg.src = card.img || "cards/card.png";
  tradeDetailsName.textContent = card.name || "Unknown";
  tradeDetailsRarity.textContent = (card.rarity || "common").toUpperCase();
  tradeDetailsChance.textContent = `${Number(card.pullChance ?? card.w ?? 0)}%`;
  tradeDetailsMutation.textContent = mutationLabel(card);
  tradeDetailsGps.textContent = `${fmt(Number(card.gps)||0)} / sec`;
}

function renderTradePickGrid(){
  if (!tradePickGrid) return;
  tradePickGrid.innerHTML = "";
  const pool = tradeEligibleCards();
  if (!pool.length){
    if (tradePickEmpty) tradePickEmpty.style.display = "";
    return;
  }
  if (tradePickEmpty) tradePickEmpty.style.display = "none";

  pool.forEach(c=>{
    const item = document.createElement("div");
    item.className = "deckPickItem";
    item.dataset.id = c.id;

    applyMutationGlow(item, c);

    const img = document.createElement("img");
    img.src = c.img || "cards/card.png";
    img.onerror = ()=>{ img.src = "cards/card.png"; };
    startCardAnimation(img, c);

    const meta = document.createElement("div");
    meta.className = "deckPickMeta";
    meta.innerHTML = `
      <div class="deckPickName">${escapeHtml(c.name||"Unknown")}</div>
      <div class="deckPickLine">
        <span class="pill">${escapeHtml(String((c.rarity||"common")).toUpperCase())}</span>
        <span class="muted">${escapeHtml(mutationLabel(c))}</span>
      </div>
      <div class="deckPickLine">
        <span class="muted">GPS</span>
        <b>${fmt(Number(c.gps)||0)}</b>
        <span class="muted" style="margin-left:auto;">${escapeHtml(String(c.location||"inventory"))}</span>
      </div>
    `;
    item.appendChild(img);
    item.appendChild(meta);

    if (item) item.addEventListener("click", ()=>{
      AudioSystem.play(AudioSystem.click);
      tradePicking.selectedCardId = c.id;
      tradePickGrid.querySelectorAll(".deckPickItem").forEach(x=>x.classList.toggle("isSelected", x.dataset.id === c.id));
      setTradeDetails(c);
      if (tradeSelectBtn) tradeSelectBtn.disabled = false;
    });

    tradePickGrid.appendChild(item);
  });
}

function removeCardEverywhere(cardId){
  if (!cardId) return;
  state.cardsOwned = (state.cardsOwned||[]).filter(c=>c && c.id !== cardId);
  try{
    if (state.decks){
      for (const dk of Object.keys(state.decks)){
        const arr = state.decks[dk];
        if (!Array.isArray(arr)) continue;
        for (let i=0;i<arr.length;i++) if (arr[i] === cardId) arr[i] = null;
      }
    }
  }catch(_){ }
  try{
    if (Array.isArray(state.cardsInDeck)) state.cardsInDeck = state.cardsInDeck.filter(id=>id !== cardId);
  }catch(_){ }
}

function renderTradePanel(){
  if (!notifContent) return;
  ensureNotifications();

  const h = document.createElement("h3");
  h.textContent = "Trade / Gift a Card";
  notifContent.appendChild(h);

  const note = document.createElement("div");
  note.className = "small muted";
  note.textContent = "Send a card as a gift. The card vanishes from your inventory immediately and is generated in the receiver’s Inventory > Cards.";
  notifContent.appendChild(note);

  const box = document.createElement("div");
  box.className = "tradeBox";

  const rowUser = document.createElement("div");
  rowUser.className = "tradeRow";
  rowUser.innerHTML = `
    <label class="tradeLabel">Receiver Username</label>
    <input class="tradeInput" id="tradeToInput" type="text" placeholder="Enter username..." maxlength="32" autocomplete="off">
  `;
  box.appendChild(rowUser);

  const rowCard = document.createElement("div");
  rowCard.className = "tradeRow";
  rowCard.innerHTML = `
    <label class="tradeLabel">Select a Card to Send</label>
    <button class="tradeCardSlot" id="tradeCardSlot" type="button">
      <span class="tradeCardSlotHint">Click to choose a card</span>
    </button>
  `;
  box.appendChild(rowCard);

  const selected = (state.cardsOwned||[]).find(c=>c && c.id === tradeSelectedCardId) || null;
  const slotBtn = rowCard.querySelector("#tradeCardSlot");
  if (slotBtn){
    slotBtn.dataset.sfx = "click";
    if (selected){
      slotBtn.classList.add("hasCard");
      slotBtn.innerHTML = `
        <img class="tradeCardThumb" src="${escapeAttr(selected.img||"cards/card.png")}" alt="Selected card">
        <div class="tradeCardInfo">
          <div class="tradeCardName">${escapeHtml(selected.name||"Unknown")}</div>
          <div class="tradeCardMeta">
            <span class="pill">${escapeHtml(String((selected.rarity||"common")).toUpperCase())}</span>
            <span class="muted">${escapeHtml(mutationLabel(selected))}</span>
            <span class="muted">•</span>
            <span class="muted">${fmt(Number(selected.gps)||0)} GPS</span>
          </div>
        </div>
        <span class="tradeChange">Change</span>
      `;
      applyMutationGlow(slotBtn, selected);
    }
    if (slotBtn) slotBtn.addEventListener("click", openTradeSelectModal);
  }

  const actions = document.createElement("div");
  actions.className = "tradeActions";
  actions.innerHTML = `<button class="btn btnPrimary" id="tradeSendBtn" type="button" disabled>Send Card</button>`;
  box.appendChild(actions);

  notifContent.appendChild(box);

  const toInput = box.querySelector("#tradeToInput");
  const sendBtn = box.querySelector("#tradeSendBtn");

  const syncDisabled = ()=>{
    const to = (toInput?.value||"").trim();
    const ok = to.length >= 3 && !!tradeSelectedCardId;
    if (sendBtn) sendBtn.disabled = !ok;
  };
  if (toInput) toInput.addEventListener("input", syncDisabled);
  syncDisabled();

  if (sendBtn){
    sendBtn.dataset.sfx = "click";
    if (sendBtn) sendBtn.addEventListener("click", async ()=>{
      const to = (toInput?.value||"").trim();
      if (!to){ toast("Missing receiver", "Please enter a username."); return; }
      if (!tradeSelectedCardId){ toast("No card selected", "Please select a card to send."); return; }

      const myUser = (window.__USER__ && window.__USER__.username) ? String(window.__USER__.username) : "";
      if (myUser && myUser.toLowerCase() === to.toLowerCase()){
        toast("Invalid receiver", "You can’t send a gift to yourself.");
        return;
      }

      sendBtn.disabled = true;
      try{
        await postJSON("api/trade_send.php", { to_username: to, card_id: tradeSelectedCardId });
        removeCardEverywhere(tradeSelectedCardId);
        tradeSelectedCardId = null;
        saveState();
        toast("Sent successfully", `Gift sent to ${to}.`);
        renderNotifTab();
      }catch(err){
        const msg = (err && err.message) ? err.message : "Failed to send gift.";
        toast("Trade failed", msg);
        syncDisabled();
      }
    });
  }

  const inbox = document.createElement("div");
  inbox.className = "tradeInbox";
  const msgs = Array.isArray(state.notifications.messages) ? state.notifications.messages : [];
  inbox.innerHTML = `
    <div class="tradeInboxHead">
      <b>Messages</b>
      <span class="muted small">${msgs.length ? "Latest gifts & notices" : "No messages yet"}</span>
    </div>
  `;
  if (msgs.length){
    const list = document.createElement("div");
    list.className = "tradeMsgList";
    msgs.slice().sort((a,b)=>Number(b.ts||0)-Number(a.ts||0)).slice(0,50).forEach(m=>{
      const item = document.createElement("div");
      item.className = "tradeMsg";
      const dt = new Date(Number(m.ts||Date.now()));
      item.innerHTML = `
        <div class="tradeMsgText">${escapeHtml(String(m.text||""))}</div>
        <div class="tradeMsgTime small muted">${dt.toLocaleString()}</div>
      `;
      list.appendChild(item);
    });
    inbox.appendChild(list);
  }
  notifContent.appendChild(inbox);
}

function openMmResultModal(card){
  if (!mmResultOverlay) return;
  ensureNotifications();
  const mm = state.notifications.mutationMachine;

  const target = card || getCardById(mm.cardId);
  const targetId = target?.id;
  if (!target){
    toast("Mutation Machine", "Card not found.");
    return;
  }

  mmResultName.textContent = target?.name || "Mutated Card";
  mmResultImg.src = target?.img || "cards/card.png";
  mmResultImg.onerror = ()=>{ mmResultImg.src = "cards/card.png"; };

  mmResultMeta.textContent = "Revealing...";

  const flip = document.getElementById("mmFlipCard");
  if (flip) flip.classList.remove("revealed");

  if (mmResultImgWrap){
    mmResultImgWrap.className = "luckyResultImgWrap";
  }

  if (mmResultImgWrap) bindTooltip(mmResultImgWrap, ()=> (targetId ? (getCardById(targetId) || target) : target));

  mmResultOverlay.classList.add("show");
  mmResultOverlay.setAttribute("aria-hidden","false");

  if (mm.status !== "done" || !mm.resultMutation){
    mmResultMeta.textContent = "Machine is not finished yet.";
    return;
  }

  if (mm.revealed){
    const muts = getMutationList(target).map(normMutKey);
    const mainMut = muts.length ? muts[0] : "normal";
    const pretty = (mainMut === "normal") ? "Normal (No Mutation)" : (mainMut[0].toUpperCase()+mainMut.slice(1));
    mmResultMeta.textContent = `Mutation: ${pretty}`;
    if (mmResultImgWrap) applyMutationGlow(mmResultImgWrap, target);
    if (flip) flip.classList.add("revealed");
    return;
  }

  const mkCaptured = mm.resultMutation;
  const REVEAL_DELAY_MS = 900;

  mmRevealPending = true;
  try{ if (mmResultOkBtn) mmResultOkBtn.disabled = true; }catch(_){}
  try{ if (closeMmResultBtn) closeMmResultBtn.disabled = true; }catch(_){}

  window.setTimeout(() => {
    try{ playCardOpeningSFX(); }catch(_){}

    if (flip) flip.classList.add("revealed");

    const mk = mkCaptured;
    const live = targetId ? getCardById(targetId) : null;
    const cardRef = live || target;

    clearAllMutations(cardRef);
    if (normMutKey(mk) !== "normal"){
      applyMutationToCard(cardRef, mk);
    }else{
      clearAllMutations(cardRef);
      recomputeCardStats(cardRef);
    }

    mm.revealed = true;

    saveState();
    syncUI();

    const muts = getMutationList(cardRef).map(normMutKey);
    const mainMut = muts.length ? muts[0] : "normal";
    const pretty = (mainMut === "normal") ? "Normal (No Mutation)" : (mainMut[0].toUpperCase()+mainMut.slice(1));
    mmResultMeta.textContent = `Mutation: ${pretty}`;

    if (mmResultImgWrap){
      mmResultImgWrap.className = "luckyResultImgWrap";
      applyMutationGlow(mmResultImgWrap, cardRef);
    }

    mmRevealPending = false;
    try{ if (mmResultOkBtn) mmResultOkBtn.disabled = false; }catch(_){}
    try{ if (closeMmResultBtn) closeMmResultBtn.disabled = false; }catch(_){}
  }, REVEAL_DELAY_MS);
}

function closeMmResultModal(){
  if (!mmResultOverlay) return;
  if (mmRevealPending) return;
  mmResultOverlay.classList.remove("show");
  mmResultOverlay.setAttribute("aria-hidden","true");
}

function canPayMutationCost(option){
  if (option === "gold"){
    return state.gold >= 5000000;
  }
  return true;
}

function sacrificeRarestCards(rarityKey, count, excludeId){
  const key = String(rarityKey||"").toLowerCase();
  const pool = (state.cardsOwned||[]).filter(c=>{
    if (!c || !c.id) return false;
    if (c.id === excludeId) return false;
    if (String(c.location||"inventory") !== "inventory") return false;
    if (c.fav === true) return false;
    return String(c.rarity||"").toLowerCase() === key;
  });
  pool.sort((a,b)=> (Number(b.gps)||0) - (Number(a.gps)||0));
  if (pool.length < count) return false;
  for (let i=0;i<count;i++){
    removeCardEverywhere(pool[i].id);
  }
  return true;
}

function startMutationMachine(option){
  ensureNotifications();
  const mm = state.notifications.mutationMachine;

  if (!mm.cardId){
    toast("Mutation Machine", "Select a card first.");
    return;
  }
  const card = getCardById(mm.cardId);
  if (!card){
    mm.cardId = null;
    mm.status = "idle";
    saveState();
    renderNotifTab();
    toast("Mutation Machine", "Selected card is missing.");
    return;
  }

  if (String(card.location||"inventory") !== "inventory"){
    toast("Mutation Machine", "That card is not in your inventory.");
    return;
  }
  if (card.fav === true){
    toast("Mutation Machine", "This card is locked (hearted). Unheart it to use the Mutation Machine.");
    return;
  }
  const muts = getMutationList(card);
  if (muts.length > 1){
    toast("Mutation Machine", "This card has stacked mutations and is not eligible.");
    return;
  }

  option = String(option || mm.speedOption || "wait");
  mm.speedOption = option;

  if (option === "gold"){
    if (state.gold < MUTATION_MACHINE_GOLD_SKIP_FULL){
      toast("Not enough gold", `You need ${fmt(MUTATION_MACHINE_GOLD_SKIP_FULL)} gold.`);
      return;
    }
    state.gold -= MUTATION_MACHINE_GOLD_SKIP_FULL;
  }else if (option === "legendary"){
    const ok = sacrificeRarestCards("legendary", 5, mm.cardId);
    if (!ok){
      toast("Sacrifice failed", "You need 5 Legendary cards in your inventory (not in decks).");
      return;
    }
  }else if (option === "cosmic"){
    const ok = sacrificeRarestCards("cosmic", 3, mm.cardId);
    if (!ok){
      toast("Sacrifice failed", "You need 3 Cosmic cards in your inventory (not in decks).");
      return;
    }
  }else if (option === "interstellar"){
    const ok = sacrificeRarestCards("interstellar", 1, mm.cardId);
    if (!ok){
      toast("Sacrifice failed", "You need 1 Interstellar card in your inventory (not in decks).");
      return;
    }
  }

  const now = Date.now();
  mm.startAt = now;
  mm.endAt = (option === "wait") ? (now + MUTATION_MACHINE_DURATION_MS) : now;
  mm.status = "running";
  mm.resultMutation = null;
  mm.revealed = false;
  mm.doneNotified = false;

  saveState();
  syncUI();

  try{ completeMutationMachineIfNeeded(); }catch(_){ }

  renderNotifTab();
}

function completeMutationMachineIfNeeded(){
  ensureNotifications();
  const mm = state.notifications.mutationMachine;
  if (mm.status !== "running") return;

  const now = Date.now();
  if (now < mm.endAt) return;

  const card = getCardById(mm.cardId);
  if (!card){
    mm.status = "idle";
    mm.cardId = null;
    mm.resultMutation = null;
    saveState();
    return;
  }

  if (!mm.resultMutation){
    const current = getMutationList(card);
    const currentKey = current.length ? current[0] : "Normal";
    const mk = rollMutationMachineKeyAvoid(currentKey);

    mm.resultMutation = mk;
    mm.revealed = false;
  }

  mm.status = "done";

  if (!mm.doneNotified){
    mm.doneNotified = true;
    toast("Mutation Machine", "Mutation is done!");
  }

  saveState();
  syncUI();
}

function resetMutationMachine(){
  ensureNotifications();
  const mm = state.notifications.mutationMachine;
  mm.cardId = null;
  mm.startAt = 0;
  mm.endAt = 0;
  mm.status = "idle";
  mm.speedOption = "wait";
  mm.resultMutation = null;
  mm.revealed = false;
  mm.doneNotified = false;
  saveState();
}

function renderMutationMachinePanel(){
  ensureNotifications();
  const mm = state.notifications.mutationMachine;
  __mmLastStatusForPanel = String(mm.status||"idle");
  preloadMmAssets();

  const h = document.createElement("h3");
  h.textContent = "Mutation Machine";
  notifContent.appendChild(h);

  const sub = document.createElement("div");
  sub.className = "small muted";
  sub.textContent = "Insert 1 card, then start the mutation process. Come back to open your result.";
  notifContent.appendChild(sub);

  const wrap = document.createElement("div");
  wrap.className = "mmMachine";

  const coreWrap = document.createElement("div");
  coreWrap.className = "mmCoreWrap";
  const coreImg = document.createElement("img");
  coreImg.id = "mmCoreImg";
  coreImg.className = "mmCoreImg";
  coreImg.alt = "Mutation Machine";
  coreImg.src = (mm.status === "done") ? MM_FINISH_IMG : (mm.status === "running" ? MM_RUN_FRAMES[0] : MM_IDLE_IMG);
  coreImg.dataset.src = coreImg.src;
  coreWrap.appendChild(coreImg);
  wrap.appendChild(coreWrap);

  const slotRow = document.createElement("div");
  slotRow.className = "mmSlotRow";

  const slot = document.createElement("div");
  slot.className = "mmSlot";
  slot.type = "button";

  const card = mm.cardId ? getCardById(mm.cardId) : null;
  slot.innerHTML = "";
  if (card){
    const img = document.createElement("img");
    img.className = "mmSlotImg";
    img.src = card.img || "cards/card.png";
    img.onerror = ()=>{ img.src = "cards/card.png"; };
    startCardAnimation(img, card);
    slot.appendChild(img);
    applyMutationGlow(slot, card);
    bindTooltip(slot, ()=>card);
  }else{
    const empty = document.createElement("div");
    empty.className = "mmSlotEmpty";
    empty.innerHTML = `<div class="plus">+</div><div><b>Insert Card</b><div class="small muted" style="margin-top:4px;">Tap to choose</div></div>`;
    slot.appendChild(empty);
  }

  if (slot) slot.addEventListener("click", ()=>{
    if (mm.status === "running") return;
    openMmSelectModal();
  });

  const meta = document.createElement("div");
  meta.className = "mmSlotMeta";

  const stats = document.createElement("div");
  stats.className = "mmStatGrid";

  const stat = (k,v)=>{
    const d = document.createElement("div");
    d.className = "mmStat";
    d.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
    return d;
  };

  stats.appendChild(stat("Selected", card ? (card.name||"Unknown") : "—"));
  stats.appendChild(stat("Rarity", card ? (String(card.rarity||"common").toUpperCase()) : "—"));
  stats.appendChild(stat("Current Mutation", card ? mutationLabel(card) : "—"));
  stats.appendChild(stat("Base Time", "25:00"));

  meta.appendChild(stats);

  slotRow.appendChild(slot);
  slotRow.appendChild(meta);
  wrap.appendChild(slotRow);

  const prog = document.createElement("div");
  prog.className = "mmProgress";

  const bar = document.createElement("div");
  bar.className = "mmProgressBar";
  const fill = document.createElement("div");
  fill.className = "mmProgressFill";
  fill.id = "mmProgFill";
  bar.appendChild(fill);
  prog.appendChild(bar);

  const txt = document.createElement("div");
  txt.className = "mmProgressText";

  const now = Date.now();
  let pct = 0;
  let left = MUTATION_MACHINE_DURATION_MS;
  if (mm.status === "running"){
    const total = Math.max(1, mm.endAt - mm.startAt);
    pct = clamp((now - mm.startAt) / total, 0, 1);
    left = Math.max(0, mm.endAt - now);
  }else if (mm.status === "done"){
    pct = 1;
    left = 0;
  }else{
    pct = 0;
    left = MUTATION_MACHINE_DURATION_MS;
  }

  fill.style.width = `${Math.round(pct*100)}%`;

  const leftTxt = document.createElement("div");
  leftTxt.id = "mmProgLeft";
  leftTxt.innerHTML = `<b>Status</b> <span class="muted">${mm.status.toUpperCase()}</span>`;
  const rightTxt = document.createElement("div");
  rightTxt.id = "mmProgRight";
  rightTxt.innerHTML = (mm.status === "running")
    ? `<b>Remaining</b> <span class="muted">${mmss(left)}</span>`
    : (mm.status === "done")
      ? `<b>Ready</b> <span class="muted">Open result</span>`
      : `<b>Duration</b> <span class="muted">25:00</span>`;

  txt.appendChild(leftTxt);
  txt.appendChild(rightTxt);

  prog.appendChild(txt);
  wrap.appendChild(prog);

  const controls = document.createElement("div");
  controls.className = "mmControls";

  const group = document.createElement("div");
  group.className = "mmRadioGroup";

  const options = [
    { v:"wait",        title:"Wait",        sub:"25 minutes (Free)" },
    { v:"gold",        title:"Gold",        sub:"Pay 1,000,000 gold (Instant)" },
    { v:"legendary",   title:"Legendary",   sub:"Sacrifice 5 rarest Legendary (Instant)" },
    { v:"cosmic",      title:"Cosmic",      sub:"Sacrifice 3 rarest Cosmic (Instant)" },
    { v:"interstellar",title:"Interstellar",sub:"Sacrifice 1 rarest Interstellar (Instant)" },
  ];

  const currentOpt = String(mm.speedOption || "wait");

  options.forEach((op, idx)=>{
    const label = document.createElement("label");
    label.className = "mmRadioOpt";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "mmSpeedOption";
    input.value = op.v;
    input.checked = (op.v === currentOpt);
    input.disabled = (mm.status !== "idle");
    if (input) input.addEventListener("change", ()=>{
      if (!input.checked) return;
      ensureNotifications();
      state.notifications.mutationMachine.speedOption = op.v;
      saveState();
    });

    const box = document.createElement("div");
    box.className = "mmRadioBox";
    box.innerHTML = `<div class="t">${op.title}</div><div class="s">${op.sub}</div>`;

    label.appendChild(input);
    label.appendChild(box);
    group.appendChild(label);
  });

  const btn = document.createElement("button");
  btn.className = "mmStartBtn";
  btn.type = "button";

  if (mm.status === "done"){
    btn.textContent = "Open Result";
    btn.disabled = !mm.cardId;
    if (btn) btn.addEventListener("click", ()=>{
      const c = mm.cardId ? getCardById(mm.cardId) : null;
      if (!c) return;
      openMmResultModal(c);
    });
  }else{
    btn.textContent = "Start";
    btn.disabled = (!mm.cardId || mm.status !== "idle");
    if (btn) btn.addEventListener("click", ()=>{
      const selected = (group.querySelector("input[type='radio']:checked")?.value) || (mm.speedOption||"wait");
      startMutationMachine(selected);
    });
  }

  controls.appendChild(group);
  controls.appendChild(btn);

  if (mm.status === "running"){
    const remMs = Math.max(0, (Number(mm.endAt)||0) - Date.now());
    const cost = calcMutationMachineSkipCost(remMs);
    const skipBtn = document.createElement("button");
    skipBtn.className = "mmStartBtn";
    skipBtn.type = "button";
    skipBtn.textContent = `⚡ Skip Now (${fmt(cost)} gold)`;
    skipBtn.disabled = (state.gold < cost);
    skipBtn.style.marginTop = "10px";
    if (skipBtn) skipBtn.addEventListener("click", ()=>{
      if (mm.status !== "running") return;
      const leftMs = Math.max(0, (Number(mm.endAt)||0) - Date.now());
      const price = calcMutationMachineSkipCost(leftMs);
      if (state.gold < price){
        toast("Not enough gold", `You need ${fmt(price)} gold.`);
        return;
      }
      const ok = confirm(`Skip the remaining time for ${fmt(price)} gold?`);
      if (!ok) return;
      state.gold -= price;
      mm.endAt = Date.now() - 1;
      saveState();
      completeMutationMachineIfNeeded();
      renderNotifTab();
      syncUI();
    });
    controls.appendChild(skipBtn);
  }

  wrap.appendChild(controls);

  const hint = document.createElement("div");
  hint.className = "small muted";
  hint.style.marginTop = "6px";
  hint.textContent = "Eligible cards: Unhearted (not locked), and either no mutation or exactly one mutation. The Mutation Machine replaces the card\'s current mutation with a new random one (no stacking). You can skip the remaining timer with Gold — price scales with time left.";
  wrap.appendChild(hint);

  notifContent.appendChild(wrap);
}

function tickMutationMachine(){
  completeMutationMachineIfNeeded();

  if (!(notifOverlay && notifOverlay.classList.contains("show") && notifActiveTab === "mutation")) return;

  ensureNotifications();
  const mm = state.notifications.mutationMachine;
  const now = Date.now();

  const curStatus = String(mm.status||"idle");
  if (__mmLastStatusForPanel !== null && __mmLastStatusForPanel !== curStatus){
    __mmLastStatusForPanel = curStatus;
    try{ renderNotifTab(); }catch(_){ }
    return;
  }
  __mmLastStatusForPanel = curStatus;

  const fill = document.getElementById("mmProgFill");
  const leftEl = document.getElementById("mmProgLeft");
  const rightEl = document.getElementById("mmProgRight");

  let pct = 0;
  let left = MUTATION_MACHINE_DURATION_MS;

  if (mm.status === "running"){
    const total = Math.max(1, (Number(mm.endAt)||0) - (Number(mm.startAt)||0));
    pct = clamp((now - (Number(mm.startAt)||0)) / total, 0, 1);
    left = Math.max(0, (Number(mm.endAt)||0) - now);
  }else if (mm.status === "done"){
    pct = 1;
    left = 0;
  }else{
    pct = 0;
    left = MUTATION_MACHINE_DURATION_MS;
  }

  if (fill) fill.style.width = `${Math.round(pct*100)}%`;
  if (leftEl) leftEl.innerHTML = `<b>Status</b> <span class="muted">${String(mm.status||"idle").toUpperCase()}</span>`;
  if (rightEl){
    rightEl.innerHTML = (mm.status === "running")
      ? `<b>Remaining</b> <span class="muted">${mmss(left)}</span>`
      : (mm.status === "done")
        ? `<b>Ready</b> <span class="muted">Open result</span>`
        : `<b>Duration</b> <span class="muted">25:00</span>`;
  }

  if (mm.status === "running"){
    startMmCoreAnimation();
  }else{
    stopMmCoreAnimation();
    setMmCoreImage(mm.status === "done" ? MM_FINISH_IMG : MM_IDLE_IMG);
  }
}

function rollMutationKey(){
  let r = Math.random();
  for (const m of MUTATIONS){
    const c = Number(m.chance)||0;
    if ((r -= c) <= 0) return m.k;
  }
  return "Normal";
}

function rollLuckyDrawReward(){
  let r = Math.random();
  const a = LUCKY_DRAW_POOL[0];
  const b = LUCKY_DRAW_POOL[1];
  const c = LUCKY_DRAW_POOL[2];
  if (r < a.chance) return a;
  r -= a.chance;
  if (r < b.chance) return b;
  return c;
}

function addLuckyDrawCard(def){
  const card = {
    id: uid(),
    name: def.name,
    img: def.img,
    rarity: def.rarity,
    pullChance: 0,
    baseGps: Number(def.gps)||0,
    mutations: [],
    location: "inventory",
    fav: false
  };
  const mk = rollMutationKey();
  if (normMutKey(mk) !== "normal"){
    applyMutationToCard(card, mk);
  }else{
    recomputeCardStats(card);
  }
  state.cardsOwned.push(card);
  saveState();
  syncUI();
  try{ renderCardsModal?.(); }catch(_){}
  return card;
}

function showLuckyDrawResult(card){
  if (!luckyResultOverlay) return;

  const resolveCardImg = (c) => {
    if (c && c.img && c.img !== "cards/card.png") return c.img;
    const nm = String(c?.name||"");
    if (!nm) return "cards/card.png";
    try{
      for (const rar of Object.keys(CARD_REWARDS||{})){
        const arr = CARD_REWARDS[rar] || [];
        const hit = arr.find(x => String(x.name) === nm);
        if (hit && hit.img) return hit.img;
      }
    }catch(_){}
    return "cards/card.png";
  };

  const imgSrc = resolveCardImg(card);

  if (luckyResultName) luckyResultName.textContent = card?.name || "Reward";

  const wrap = luckyResultOverlay.querySelector(".luckyResultImgWrap");
  if (wrap){
    wrap.innerHTML = `
      <div class="flipStage isCharging" id="luckyFlipStage" aria-label="Lucky draw reveal">
        <div class="flipCard" id="luckyFlipCard">
          <div class="flipInner">
            <div class="flipFace flipBack">
              <img alt="Card back" src="cards/card.png" />
            </div>
            <div class="flipFace flipFront">
              <img alt="Card" id="luckyFlipFrontImg" src="${imgSrc}" />
            </div>
          </div>
        </div>
        <div class="flipScanLine" aria-hidden="true"></div>
        <div class="flipGlow" aria-hidden="true"></div>
      </div>
    `;

    const stage = wrap.querySelector("#luckyFlipStage");
    const cardEl = wrap.querySelector("#luckyFlipCard");
    const frontImg = wrap.querySelector("#luckyFlipFrontImg");

    if (frontImg) frontImg.src = imgSrc;

    try{ applyMutationGlow(wrap, {...card, img: imgSrc}); }catch(_){}

    setTimeout(()=>{ stage && stage.classList.add("isReady"); }, 220);
    setTimeout(()=>{
      if (cardEl) cardEl.classList.add("isRevealed");
      if (stage) stage.classList.remove("isReady");
      if (luckyResultImg) luckyResultImg.src = imgSrc;
    }, 900);
    setTimeout(()=>{ stage && stage.classList.remove("isCharging"); }, 1150);
  }

  if (luckyResultImg) luckyResultImg.src = imgSrc;

  if (luckyResultMeta){
    luckyResultMeta.textContent =
      `Rarity: ${(card?.rarity||"").toUpperCase()} • Mutation: ${mutationLabel(card)} • ${Number(card?.gps)||0} GPS`;
  }

  openLuckyResultModal();
}

function doLuckyDraw(mode){
  ensureNotifications();
  if (mode === "ticket"){
    if ((state.notifications.tickets||0) < 1) return;
    state.notifications.tickets -= 1;
  }else{
    if (state.gold < LUCKY_DRAW_COST_GOLD){
      toast("Not enough gold", `Need ${fmt(LUCKY_DRAW_COST_GOLD)} gold to spin.`);
      return;
    }
    state.gold -= LUCKY_DRAW_COST_GOLD;
  }

  playCardOpeningSFX();

  const def = rollLuckyDrawReward();
  const card = addLuckyDrawCard(def);
  toast("Lucky Draw", `You got ${card.name}!`);
  updateNotificationsBadges();

  try{
    if (notifOverlay && notifOverlay.classList.contains("show") && notifActiveTab === "lucky"){
      renderNotifTab();
    }
  }catch(_){/* noop */}

  showLuckyDrawResult(card);
}

/* ================= Weather System ================= */
function getWeatherDef(key){
  const k = String(key||"normal").toLowerCase();
  return WEATHER_TABLE.find(w=>w.key===k) || WEATHER_TABLE[0];
}
function totalWeatherChance(){
  return WEATHER_TABLE.reduce((a,w)=>a + (Number(w.chance)||0), 0);
}
function rollWeatherKey(){
  const total = totalWeatherChance();
  const normal = getWeatherDef("normal");
  const remainder = Math.max(0, 100 - total);
  const rollMax = total + remainder;
  let r = Math.random() * rollMax;

  for (const w of WEATHER_TABLE){
    const c = Number(w.chance)||0;
    if ((r -= c) <= 0) return w.key;
  }
  return normal.key;
}
function formatCountdown(ms){
  const s = Math.max(0, Math.ceil(ms/1000));
  const mm = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  return `${mm}:${ss}`;
}
function setWeatherIconUI(key){
  if (!weatherIconBox || !weatherIcon) return;
  const def = getWeatherDef(key);

  weatherIcon.textContent = def.icon || "☀";

  for (const w of WEATHER_TABLE){ weatherIconBox.classList.remove(`weather-${w.key}`); }
  weatherIconBox.classList.add(`weather-${def.key}`);
}
function weatherRollChancesText(){
  try{
    const parts = WEATHER_TABLE.map(w=>{
      const c = Number(w.chance)||0;
      const pct = (Math.round(c*10)/10).toString().replace(/\.0$/, "");
      return `${w.name} ${pct}%`;
    });
    return parts.join(" • ");
  }catch(_){
    return "—";
  }
}

function updateWeatherTooltip(){
  if (!weatherTooltip) return;

  const w = state.weather || {};
  const active = !!w.active;
  const def = getWeatherDef(active ? w.currentKey : "normal");

  const countdown = active ? formatCountdown(w.endsAt - Date.now()) : formatCountdown(w.nextEventAt - Date.now());

  const pill = active ? `Weather ends in: ${countdown}` : `Next event in: ${countdown}`;

  let details = "";
  if (active && def.special){
    details = `
      <div class="wtLine"><b>Effect:</b> 10% chance per strike to mutate a random deck card</div>
      <div class="wtLine"><b>Mutation:</b> ${escapeHtml(def.mutation)} (×${def.mult})</div>
      <div class="wtLine"><b>Strikes:</b> ${Math.min(WEATHER_STRIKE_ATTEMPTS, (w.strikesDone||0))}/${WEATHER_STRIKE_ATTEMPTS}</div>
    `;
  }else{
    details = `<div class="wtLine">Normal weather. No strikes.</div>`;
  }

  weatherTooltip.innerHTML = `
    <div class="wtTitle">
      <b>${escapeHtml(def.name)}</b>
      <span class="wtPill">${escapeHtml(pill)}</span>
    </div>
    <div class="wtLine"><b>Roll chances:</b> ${escapeHtml(weatherRollChancesText())}</div>
    ${details}
  `;
  refreshWeatherTooltipPortalIfOpen();
}
function showWeatherTicker(text){
  if (!weatherTicker) return;
  weatherTicker.textContent = text;
  weatherTicker.style.display = "block";
  weatherTicker.classList.remove("pulseIn");
  void weatherTicker.offsetWidth;
  weatherTicker.classList.add("pulseIn");
  setTimeout(()=>{
    if (weatherTicker) weatherTicker.style.display = "none";
  }, 4200);
}

function showAdminTicker(text){
  if (!adminTicker) return;

  let msg = String(text||"").trim();
  msg = msg.replace(/^admin\s*:\s*/i, "").trim();

  const finalText = `Admin: "${msg}"`;

  adminTicker.textContent = finalText;
  adminTicker.style.display = "block";
  adminTicker.classList.add("show");
  adminTicker.classList.remove("pulseIn");
  void adminTicker.offsetWidth;
  adminTicker.classList.add("pulseIn");

  clearTimeout(showAdminTicker._t);
  showAdminTicker._t = setTimeout(()=>{
    if (!adminTicker) return;
    adminTicker.classList.remove("show");
    adminTicker.style.display = "none";
  }, 12000);
}

function ensureWxFlashEl(){
  let el = document.getElementById("wxFlash");
  if (el) return el;
  el = document.createElement("div");
  el.id = "wxFlash";
  el.setAttribute("aria-hidden","true");
  document.body.appendChild(el);
  return el;
}

function triggerWeatherStrikeFX(cardId, weatherKey){
  if (!cardId) return;
  const wk = String(weatherKey||"").toLowerCase();
  const cls = `wx-${wk}`;

  try{ AudioSystem.play(AudioSystem.strike); }catch(_){}

  try{
    const fx = ensureWxFlashEl();
    fx.classList.remove("on");
    void fx.offsetWidth;
    fx.classList.add("on");
    setTimeout(()=>fx.classList.remove("on"), 520);
  }catch(_){}

  const safeId = CSS.escape(String(cardId));
  const els = document.querySelectorAll(
    `.slot.assigned[data-card-id="${safeId}"], .cardThumb[data-card-id="${safeId}"]`
  );
  if (!els || !els.length) return;

  els.forEach(el=>{
    el.classList.remove("wxStrike","wx-spacestorm","wx-antigravity","wx-ascension","wx-multiverse");
    void el.offsetWidth;
    el.classList.add("wxStrike");
    if (wk && wk !== "normal") el.classList.add(cls);
  });

  setTimeout(()=>{
    els.forEach(el=> el.classList.remove("wxStrike", cls));
  }, 1100);
}

function applyMutationToCard(card, mutationKey){
  if (!card) return false;
  const muts = getMutationList(card);
  const nk = normMutKey(mutationKey);
  if (!nk || nk === "normal") return false;

  if (muts.map(normMutKey).includes(nk)){
    return false;
  }
  muts.push(titleMutKey(mutationKey));
  card.mutations = muts;
  recomputeCardStats(card);
  return true;
}

function pickRandomDeckCardId(){
  const progTier = getProgressionTier();
  const ids = [];

  const addFromDeck = (deckKey)=>{
    const deckArr = state.decks?.[deckKey] || [];
    for (let idx=0; idx<deckArr.length; idx++){
      const id = deckArr[idx];
      if (!id) continue;

      if (deckKey === "B" && progTier < 4) continue;

      const purchased = !!state.deckSlotPurchases?.[deckKey]?.[idx];
      if (!purchased) continue;

      ids.push(id);
    }
  };

  addFromDeck("A");
  addFromDeck("B");

  if (!ids.length) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

function weatherStrikeAttempt(){
  const w = state.weather;
  const def = getWeatherDef(w.currentKey);
  if (!def.special) return;

  if (Math.random() >= WEATHER_STRIKE_CHANCE) return;

  const id = pickRandomDeckCardId();
  if (!id) return;

  const card = getCardById(id);
  if (!card) return;

  const applied = applyMutationToCard(card, def.mutation);
  triggerWeatherStrikeFX(id, def.key);

  if (applied){
    toast(def.name, `${card.name} was struck! +${def.mutation} (×${def.mult})`);
    saveState();
    buildSlots();
    try{ renderCardsModal?.(); }catch(_){}
  }else{
    toast(def.name, `${card.name} resisted — already has ${def.mutation}.`);
  }
}

function startWeatherEvent(key){
  const now = Date.now();
  state.weather.active = true;
  state.weather.currentKey = key;
  state.weather.endsAt = now + WEATHER_EVENT_DURATION_MS;
  state.weather.strikesDone = 0;
  state.weather.nextStrikeAt = now;
  state.weather.nextAnnounceAt = 0;
  saveState();

  const def = getWeatherDef(key);
  if (def.special){
    toast("Weather Event Started", `${def.icon||"✨"} ${def.name} • strikes every 10s for 01:30`);
    showWeatherTicker(`${def.icon||"✨"} ${def.name} started!`);
  }

  setWeatherIconUI(key);
  updateWeatherUI(true);
}

function endWeatherEvent(){
  const now = Date.now();
  const endedKey = state.weather.currentKey;

  state.weather.active = false;
  state.weather.currentKey = "normal";
  state.weather.endsAt = 0;
  state.weather.nextStrikeAt = 0;
  state.weather.strikesDone = 0;

  state.weather.nextEventAt = now + WEATHER_EVENT_INTERVAL_MS;

  state.weather.nextPreviewKey = rollWeatherKey();
  state.weather.nextAnnounceAt = now + 60000;

  saveState();

  setWeatherIconUI("normal");
  updateWeatherUI(true);

  const def = getWeatherDef(endedKey);
  toast("Weather ended", def.special ? `${def.name} faded.` : "Back to Normal.");
}

function tickWeather(){
  if (!state.weather) ensureWeather();
  ensureNotifications();
  const w = state.weather;
  const now = Date.now();

  if (w.active){
    if (now >= w.endsAt){
      endWeatherEvent();
      return;
    }
    if (w.strikesDone < WEATHER_STRIKE_ATTEMPTS && now >= w.nextStrikeAt){
      w.nextStrikeAt += WEATHER_STRIKE_INTERVAL_MS;
      w.strikesDone += 1;
      weatherStrikeAttempt();
      saveState();
    }
    return;
  }

  if (now >= w.nextEventAt){
    const key = rollWeatherKey();
    const def = getWeatherDef(key);

    if (!def.special){
      w.currentKey = "normal";
      w.nextEventAt = now + WEATHER_EVENT_INTERVAL_MS;
      w.nextPreviewKey = null;
      w.nextAnnounceAt = 0;
      saveState();
      updateWeatherUI(true);
      return;
    }

    startWeatherEvent(key);
    return;
  }

  if (w.nextAnnounceAt && now >= w.nextAnnounceAt){
    const preview = getWeatherDef(w.nextPreviewKey || rollWeatherKey());
    const chance = Number(preview.chance)||0;
    showWeatherTicker(`Next weather: ${preview.name} • Chance: ${chance}%`);
    w.nextAnnounceAt = now + 60000;
    w.nextPreviewKey = preview.key;
    saveState();
  }
}

function updateWeatherUI(force){
  if (!weatherWrap || !weatherTimer || !weatherCountdownText) return;

  const w = state.weather || {};
  const now = Date.now();

  const active = !!w.active;
  const timerText = active ? formatCountdown(w.endsAt - now) : formatCountdown(w.nextEventAt - now);
  weatherTimer.textContent = timerText;

  if (active){
    weatherCountdownText.textContent = `Weather ends in: ${timerText}`;
    setWeatherIconUI(w.currentKey);
  }else{
    weatherCountdownText.textContent = `Next event in: ${timerText}`;
    setWeatherIconUI("normal");
  }

  updateWeatherTooltip();
}

/* ================= PET SHOP ================= */
let petTimerInterval = null;

function ensurePetRestock(){
  const now = Date.now();
  if(!Number.isFinite(state.petShopRestockAt) || state.petShopRestockAt <= now){
    state.petShopRestockAt = now + 5*60*1000;
    saveState(state);
  }
}

function updatePetsBadge(){
  const n = Array.isArray(state.petsOwned) ? state.petsOwned.length : 0;

  if (invPetsBadge){
    invPetsBadge.textContent = String(n);
    invPetsBadge.style.display = n > 0 ? "inline-flex" : "none";
  }
}

function openPetShop(){
  if(!petShopOverlay) return;
  petShopOverlay.classList.add("show");
  petShopOverlay.setAttribute("aria-hidden","false");
}

function closePetShop(){
  if(!petShopOverlay) return;
  petShopOverlay.classList.remove("show");
  petShopOverlay.setAttribute("aria-hidden","true");
}

function startPetTimer(){
  stopPetTimer();
  const tick = ()=>{
    ensurePetRestock();
    if(petRestockTimer){
      petRestockTimer.textContent = mmss(state.petShopRestockAt - Date.now());
    }
  };
  tick();
  petTimerInterval = setInterval(tick, 1000); // 🔥 reduced frequency from 250ms to 1s
}

function stopPetTimer(){
  if(petTimerInterval){
    clearInterval(petTimerInterval);
    petTimerInterval = null;
  }
}

function renderPetShop(){
  if(!petShopGrid) return;
  petShopGrid.innerHTML = "";
  PET_CATALOG.forEach(p=>{
    const card = document.createElement("div");
    card.className = "petCard";
    card.innerHTML = `
      <img src="${p.img}" alt="${p.name}" onerror="this.style.display='none'"/>
      <div class="petMeta">
        <b>${p.name}</b>
        <div class="small">A loyal companion.</div>
        <div class="petBuyRow">
          <div class="petPrice">${fmt(p.price)} gold</div>
          <button class="btn btnPrimary" type="button">Buy</button>
        </div>
      </div>
    `;
    const btn = card.querySelector("button");
    btn.disabled = state.gold < p.price;
    if (btn) btn.addEventListener("click", ()=>{
      const tier = getSummonerTier();
      const limit = petLimitForTier(tier);
      const ownedN = Array.isArray(state.petsOwned) ? state.petsOwned.length : 0;
      if (ownedN >= limit){
        toast("Pet limit reached", `Your current Summoner allows only ${limit} pets.`);
        return;
      }
      if(state.gold < p.price){
        toast("Not enough gold", "Earn more gold before buying this pet.");
        return;
      }
      state.gold -= p.price;
      state.petsOwned.push({ id:p.id, name:p.name, img:p.img, price:p.price, boughtAt: Date.now() });
      saveState(state);
      syncUI();
      updatePetsBadge();

      playPurchaseSFX();
      toast("Pet purchased!", `${p.name} added to your Pets.`);
      renderPetShop();
    });
    petShopGrid.appendChild(card);
  });
}

/* ================= PETS (Inventory Tab) ================= */
function renderPets(){
  if(!invPetsGrid || !invPetsEmpty) return;
  const pets = Array.isArray(state.petsOwned) ? state.petsOwned : [];
  invPetsGrid.innerHTML = "";
  if(pets.length === 0){
    invPetsEmpty.style.display = "block";
    return;
  }
  invPetsEmpty.style.display = "none";
  pets.forEach(p=>{
    const el = document.createElement("div");
    el.className = "ownedPet";
    el.innerHTML = `
      <img src="${p.img}" alt="${p.name}" onerror="this.style.display='none'"/>
      <div>
        <b>${p.name}</b>
        <div class="small">Owned</div>
      </div>
    `;
    invPetsGrid.appendChild(el);
  });
}

/* ================= SUMMONERS ================= */
let selectedSummonerId = "3dm4rk";

function openSummonersModal(){
  if(!summonersOverlay) return;
  selectedSummonerId = (state.summoners && typeof state.summoners.selectedId === "string") ? state.summoners.selectedId : "3dm4rk";
  renderSummonersList();
  renderSummonerDetails(selectedSummonerId);
  summonersOverlay.classList.add("show");
  summonersOverlay.setAttribute("aria-hidden","false");
}

function closeSummonersModal(){
  if(!summonersOverlay) return;
  summonersOverlay.classList.remove("show");
  summonersOverlay.setAttribute("aria-hidden","true");
}

function isSummonerOwned(id){
  return state.summoners && Array.isArray(state.summoners.owned) && state.summoners.owned.includes(id);
}

function getSummonerLevel(id){
  const lv = state.summoners && state.summoners.levels ? state.summoners.levels[id] : 1;
  return Number.isFinite(lv) ? Math.max(1, lv) : 1;
}

function summonerUpgradeCostForLevel(lv){
  if (lv === 1) return 15000;
  if (lv === 2) return 500000;
  if (lv === 3) return 1000000;
  if (lv === 4) return 5000000;
  if (lv === 5) return 15000000;
  if (lv === 6) return 25000000;
  return Infinity;
}

function renderSummonersList(){
  if(!summonersList) return;
  summonersList.innerHTML = "";

  const activeId = getActiveSummonerId();

  SUMMONER_CATALOG.forEach((s)=>{
    const owned = (state.summoners?.owned || []).includes(s.id) || !!s.free;
    const isActive = (s.id === activeId);

    const item = document.createElement("div");
    item.className = "summonerItem" + (isActive ? " active" : "");

    item.innerHTML = `
      <img src="${s.img}" alt="${s.name}" onerror="this.style.display='none'"/>
      <div>
        <b>${escapeHtml(s.name)}</b>
        <div class="small">${isActive ? "In Use" : (owned ? "Owned" : "Locked")}</div>
      </div>
    `;

    if (item) item.addEventListener("mouseenter", (e)=>{
      const tier = summonerTierOfId(s.id);
      const mult = towerMultiplierForTier(tier);
      const cap = towerCapForTier(tier);
      const petLimit = petLimitForTier(tier);
      const bonus15 = bonusGoldPer15sForTier(tier);

      const html = `
        <div class="ttName">${escapeHtml(s.name)}</div>
        <div class="ttRow"><span class="ttBadge">SUMMONER</span>${isActive ? `<span class="ttBadge">IN USE</span>` : ``}</div>
        <div class="ttRow" style="opacity:.82">${escapeHtml(s.desc || "")}</div>
        ${isActive ? `<div class="ttRow">Tier ${tier} • ${bonus15>0?`+${fmt(bonus15)}/15s`:"No bonus"} • Pets ${petLimit} • Tower ${mult.toFixed(1)}x (cap ${fmt(cap)})</div>` : ``}
      `;
      showTooltipHtml(html, e.clientX, e.clientY);
    });
    if (item) item.addEventListener("mousemove", (e)=>{
      showTooltipHtml(tooltipEl?.innerHTML || "", e.clientX, e.clientY);
    });
    if (item) item.addEventListener("mouseleave", hideCardTooltip);

    bindLongPressTooltip(item, ()=>{
      const tier = summonerTierOfId(s.id);
      const mult = towerMultiplierForTier(tier);
      const cap = towerCapForTier(tier);
      const petLimit = petLimitForTier(tier);
      const bonus15 = bonusGoldPer15sForTier(tier);
      return `
        <div class="ttName">${escapeHtml(s.name)}</div>
        <div class="ttRow"><span class="ttBadge">SUMMONER</span>${isActive ? `<span class="ttBadge">IN USE</span>` : ``}</div>
        <div class="ttRow" style="opacity:.82">${escapeHtml(s.desc || "")}</div>
        ${isActive ? `<div class="ttRow">Tier ${tier} • ${bonus15>0?`+${fmt(bonus15)}/15s`:"No bonus"} • Pets ${petLimit} • Tower ${mult.toFixed(1)}x (cap ${fmt(cap)})</div>` : ``}
      `;
    });

    if (item) item.addEventListener("click", ()=>{
      selectedSummonerId = s.id;
      renderSummonersList();
      renderSummonerDetails(s.id);

      if (!owned){
        toast("Locked", "You don't own this summoner yet.");
        return;
      }

      state.summoners.selectedId = s.id;
      if(!(state.summoners.owned||[]).includes(s.id)) state.summoners.owned.push(s.id);
      onActiveSummonerChanged();
    });

    summonersList.appendChild(item);
  });
}

function renderSummonerDetails(id){
  const mainId = getMainSummonerId();
  const lv = getSummonerLevel(mainId);
  const tier = getSummonerTier();

  const activeId = getActiveSummonerId();
  const s = getSummonerDef(activeId);

  const cost = summonerUpgradeCostForLevel(lv);
  const mult = towerMultiplierForTier(tier);
  const cap = towerCapForTier(tier);
  const petLimit = petLimitForTier(tier);
  const bonus15 = bonusGoldPer15sForTier(tier);

  if(selectedSummonerName) selectedSummonerName.textContent = s.name;
  if(summonerDetailName) summonerDetailName.textContent = s.name;
  if(summonerDetailLevel) summonerDetailLevel.textContent = `Lv. ${lv}`;

  if(summonerDetailText){
    const lines = [];
    lines.push(s.desc || "");
    lines.push(bonus15 > 0 ? `Bonus: +${fmt(bonus15)} gold every 15s.` : "No bonus gold.");
    if (activeId === "3dm4rk"){
      lines.push("Deck: Only Deck A (Slots 1–3). Other slots and Deck B are locked.");
    } else {
      lines.push(`Deck: Slots 1–3 unlocked. ${tier >= 2 ? "Slots 4–6 unlockable." : "Slots 4–6 locked."} ${tier >= 3 ? "Slots 7–9 unlockable." : "Slots 7–9 locked."} Deck B available (tier-based).`);
    }
    lines.push(`Pets allowed: ${petLimit}`);
    lines.push(`Tower: ${mult.toFixed(1)}x • Cap: ${fmt(cap)} gold`);
    summonerDetailText.textContent = lines.filter(Boolean).join(" ");
  }

  if(summonerBonusText){
    summonerBonusText.textContent = bonus15 <= 0 ? "None" : `+${fmt(bonus15)} / 15s`;
  }
  if(summonerUpgradeCost){
    summonerUpgradeCost.textContent = (cost === Infinity) ? "MAX" : fmt(cost);
  }

  if (summonerReqText){
    const r = getUpgradeRequirementsForLevel(lv);
    if (r.max){
      summonerReqText.textContent = "Max level reached.";
    } else {
      const dot = (ok)=> ok ? "rgba(90,255,170,.95)" : "rgba(255,110,110,.95)";
      summonerReqText.innerHTML = r.reqs.map(req=>`
        <div class="reqRow">
          <div class="reqLeft">
            <span class="reqDot" style="background:${dot(req.ok)}"></span>
            <div class="reqName">${escapeHtml(req.label)}</div>
          </div>
          <div class="reqMeta">${req.ok ? "OK" : "Missing"}</div>
        </div>
      `).join("") + `<div class="small muted" style="margin-top:10px">Upgrades switch you to: <b>${escapeHtml(getSummonerDef(getSummonerIdForTier(r.nextTier)).name)}</b> (Tier ${r.nextTier})</div>`;
    }
  }

  if(upgradeSummonerBtn){
    const chk = canUpgradeMainSummoner();
    if(cost === Infinity){
      upgradeSummonerBtn.disabled = true;
      upgradeSummonerBtn.textContent = "Max Level";
      upgradeSummonerBtn.title = "";
    } else if(chk.ok){
      upgradeSummonerBtn.disabled = false;
      upgradeSummonerBtn.textContent = `Upgrade (Tier ${lv}→${lv+1})`;
      upgradeSummonerBtn.title = "";
    } else {
      upgradeSummonerBtn.disabled = true;
      upgradeSummonerBtn.textContent = "Upgrade Locked";
      upgradeSummonerBtn.title = chk.reason || "Requirements not met.";
    }
  }
}

function upgradeSelectedSummoner(){
  const mainId = getMainSummonerId();
  const lv = getSummonerLevel(mainId);
  const cost = summonerUpgradeCostForLevel(lv);

  const chk = canUpgradeMainSummoner();
  if (!chk.ok){
    toast("Upgrade Locked", chk.reason || "Requirements not met.");
    renderSummonerDetails(mainId);
    return;
  }

  state.gold -= cost;
  playPurchaseSFX();
  state.summoners.levels[mainId] = lv + 1;

  const nextTier = lv + 1;
  const nextSummonerId = getSummonerIdForTier(nextTier);
  state.summoners.selectedId = nextSummonerId;

  if(!state.summoners.owned.includes(nextSummonerId)) state.summoners.owned.push(nextSummonerId);
  if(!state.summoners.levels[nextSummonerId]) state.summoners.levels[nextSummonerId] = 1;

  tickTowers();
  state.towers.lastTs = Date.now();

  saveState(state);
  syncUI();

  const nextSummoner = getSummonerDef(nextSummonerId);
  toast("Upgraded!", `Switched to ${nextSummoner.name} (Tier ${nextTier}).`);

  renderSummonersList();
  renderSummonerDetails(mainId);
}

/* ================= GOLD PLACEHOLDER (STATIC) ================= */
function tickTowers(){
  const now = Date.now();
  if (!state.towers) ensureTowers();
  const last = Number(state.towers.lastTs) || now;
  const dt = Math.max(0, (now - last) / 1000);

  const tier = getSummonerTier();
  const cap = towerCapForTier(tier);
  const mult = towerMultiplierForTier(tier);

  const storedNow = Number(state.towers.stored) || 0;
  if (storedNow >= cap){
    state.towers.stored = cap;
    state.towers.lastTs = now;
    return;
  }

  const rate = computeDeckGps() * mult;
  const next = storedNow + rate * dt;
  state.towers.stored = Math.min(cap, next);
  state.towers.lastTs = now;
}

function collectTowersGold(){
  tickTowers();
  const gain = Math.floor(state.towers.stored || 0);
  if (gain <= 0) return;

  playTowerGoldSFX();
  state.gold += gain;

  try{
    if (openGoldPanel){
      openGoldPanel.classList.add("collectFx");
      setTimeout(()=>openGoldPanel.classList.remove("collectFx"), 650);
    }
  }catch(_){ }
  showGoldPop(gain, openGoldPanel);
  toast("Tower", `Added ${fmt(gain)} gold`);

  try{
    ensureValentines();
    if (state.valentines?.daily?.progress){
      state.valentines.daily.progress.towerCollects = (Number(state.valentines.daily.progress.towerCollects)||0) + 1;
    }
  }catch(_){ }

  state.towers.stored = 0;
  state.towers.lastTs = Date.now();
  saveState();
  syncUI();
}

function tickSummonerBonus(){
  const tier = getSummonerTier();
  const now = Date.now();
  if (!state.summoners) return;

  let changed = false;

  const bonus15 = bonusGoldPer15sForTier(tier);
  if (!Number.isFinite(state.summoners.nextBonusAt)) state.summoners.nextBonusAt = now + 15000;

  if (bonus15 > 0 && now >= state.summoners.nextBonusAt){
    const missed = Math.min(10, Math.floor((now - state.summoners.nextBonusAt) / 15000) + 1);
    const gain = bonus15 * missed;

    state.gold += gain;
    state.summoners.nextBonusAt += missed * 15000;
    changed = true;

    playAbilityGoldSFX();

    showGoldPop(gain, openGoldPanel || null);
    toast("Summoner Bonus", `+${fmt(gain)} gold`);
  }

  if (tier >= 7){
    if (!Number.isFinite(state.summoners.nextZenoAt)) state.summoners.nextZenoAt = now + 60000;

    if (now >= state.summoners.nextZenoAt){
      const missed = Math.min(3, Math.floor((now - state.summoners.nextZenoAt) / 60000) + 1);
      state.summoners.nextZenoAt += missed * 60000;
      changed = true;

      if (Math.random() < 0.5){
        const gain = 1000000;
        state.gold += gain;
        changed = true;
        showGoldPop(gain, openGoldPanel || null);
        toast("Zeno Blessing", `+${fmt(gain)} gold`);
        playAbilityGoldSFX();
      }
    }
  }

  if (changed){
    saveState(state);
    syncUI();
  }
}

function initGoldPlaceholder(){
  if(!openGoldPanel) return;

  openGoldPanel.dataset.sfx = "tower";

  const act = ()=>{
    collectTowersGold();
  };

  if (openGoldPanel) openGoldPanel.addEventListener("click", act);
  if (openGoldPanel) openGoldPanel.addEventListener("keydown", (e)=>{
    if(e.key==="Enter" || e.key===" "){ e.preventDefault(); act(); }
  });
}

/* ================= Gallery (All Cards) ================= */
const GALLERY_RARITY_ORDER = ["common","rare","epic","mythical","legendary","cosmic","interstellar","dragon","valentines","cny","limited edition"];

let galleryActiveTab = "gallery";
let conversionIndex = null;
let conversionMap = new Map();
let conversionLoading = false;
let conversionLoadError = null;

function pesoFmt(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return "₱" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function convKey(rarity, name){
  return `${String(rarity||"").toLowerCase().trim()}::${String(name||"").toLowerCase().trim()}`;
}
async function fetchConversionIndex(){
  if (conversionIndex || conversionLoading) return;
  conversionLoading = true;
  conversionLoadError = null;
  try{
    const res = await fetch("checker.php?api=1", { cache: "no-store" });
    if (!res.ok) throw new Error(`checker.php api failed (${res.status})`);
    const data = await res.json();
    conversionIndex = data;
    conversionMap = new Map();
    (data.cards || []).forEach(it=>{
      conversionMap.set(convKey(it.rarity, it.name), Number(it.price));
    });
  }catch(err){
    conversionLoadError = err;
  }finally{
    conversionLoading = false;
    if (galleryOverlay?.classList?.contains("show") && galleryActiveTab === "conversion"){
      renderGallery(gallerySearch?.value || "");
    }
  }
}

function setGalleryTab(tab){
  galleryActiveTab = (tab === "conversion") ? "conversion" : "gallery";
  if (galleryTabs){
    galleryTabs.querySelectorAll(".galleryTab").forEach(btn=>{
      const on = btn.getAttribute("data-tab") === galleryActiveTab;
      btn.classList.toggle("isActive", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  if (galleryActiveTab === "conversion") fetchConversionIndex();
  renderGallery(gallerySearch?.value || "");
}

function buildGalleryList(){
  const list = [];
  for (const r of GALLERY_RARITY_ORDER){
    const pool = CARD_REWARDS[r] || [];
    for (const c of pool){
      const baseGps = CARD_GPS[c.name] ?? 0;
      list.push({
        name: c.name,
        img: c.img,
        rarity: r,
        baseGps: baseGps,
        mutations: [],
        gps: baseGps
      });
    }
  }

  try{
    const seen = new Set(list.map(x => `${String(x.rarity||"")}::${String(x.name||"")}`));
    if (Array.isArray(LUCKY_DRAW_POOL)){
      for (const c of LUCKY_DRAW_POOL){
        const rarity = String(c.rarity || "common").toLowerCase();
        const key = `${rarity}::${String(c.name||"")}`;
        if (seen.has(key)) continue;

        const baseGps = Number(c.gps) || (CARD_GPS[c.name] ?? 0);
        list.push({
          name: c.name,
          img: c.img,
          rarity: rarity,
          baseGps: baseGps,
          mutations: [],
          gps: baseGps
        });
        seen.add(key);
      }
    }

    const rIndex = new Map(GALLERY_RARITY_ORDER.map((r,i)=>[r,i]));
    list.sort((a,b)=>{
      const da = rIndex.get(a.rarity); const db = rIndex.get(b.rarity);
      return ((da??999)-(db??999)) || String(a.name||"").localeCompare(String(b.name||""));
    });
  }catch(_){ /* noop */ }

  return list;
}
const ALL_GALLERY_CARDS = buildGalleryList();

function openGallery(){
  if (!galleryOverlay) return;
  if (gallerySearch) gallerySearch.value = "";
  setGalleryTab("gallery");
  galleryOverlay.classList.add("show");
  galleryOverlay.setAttribute("aria-hidden","false");
  setTimeout(()=> gallerySearch?.focus?.(), 0);
}

function closeGallery(){
  if (!galleryOverlay) return;
  galleryOverlay.classList.remove("show");
  galleryOverlay.setAttribute("aria-hidden","true");
  if (typeof hideTooltip === 'function') hideTooltip();
  FrameAnimationManager.stopAll();
}

function renderGallery(q){
  if (!galleryGrid) return;

  const query = String(q || "").trim().toLowerCase();
  const filtered = !query
    ? ALL_GALLERY_CARDS
    : ALL_GALLERY_CARDS.filter(c => String(c.name||"").toLowerCase().includes(query));

  galleryGrid.innerHTML = "";

  for (const card of filtered){
    const tile = document.createElement("div");
    const rClass = String(card.rarity||"common").toLowerCase().trim().replace(/\s+/g,"-");
    tile.className = `gCard r-${rClass}`;
    const showValue = (galleryActiveTab === "conversion");
    let valueTag = "";
    if (showValue){
      if (!conversionIndex && conversionLoading) valueTag = `<div class="gValueTag isLoading">…</div>`;
      else if (conversionLoadError) valueTag = `<div class="gValueTag isError">—</div>`;
      else{
        const v = conversionMap.get(convKey(card.rarity, card.name));
        valueTag = (v === undefined) ? `<div class="gValueTag isError">—</div>` : `<div class="gValueTag">${pesoFmt(v)}</div>`;
      }
    }

    tile.innerHTML = `
      ${valueTag}
      <img src="${escapeHtml(card.img)}" alt="${escapeHtml(card.name)}" loading="lazy" decoding="async"
           onerror="this.style.display='none'"/>
    `;

    if (tile) tile.addEventListener("mouseenter", (e)=>{
      tooltipPinned = false;
      showCardTooltip(card, e.clientX, e.clientY);
    });
    if (tile) tile.addEventListener("mousemove", (e)=>{
      if (!tooltipPinned) positionTooltip(e.clientX, e.clientY);
    });
    if (tile) tile.addEventListener("mouseleave", ()=>{
      if (!tooltipPinned) hideTooltip();
    });

    bindLongPressTooltip(tile, ()=>formatCardDetails(card));

    galleryGrid.appendChild(tile);
  }

  if (galleryEmpty){
    galleryEmpty.style.display = (filtered.length === 0) ? "block" : "none";
  }
  if (galleryCount){
    galleryCount.textContent = `${filtered.length.toLocaleString("en-US")} cards`;
  }
}

/* ================= How to Play ================= */
const HOWTO_STEPS = [
  {
    key: "start",
    icon: "✨",
    title: "Start here",
    hint: "What you should do first",
    html: `
      <h4>Your goal</h4>
      <ul>
        <li>Buy packs in the <b>Main Shop</b>, open them in <b>Inventory</b>, and build strong decks.</li>
        <li>Your cards generate <b>Gold/sec</b> (GPS). More GPS = faster gold.</li>
        <li>Use gold to buy better packs, upgrade systems, and flex your best pulls.</li>
      </ul>
      <div class="howtoCallout">
        Tip: On desktop, hover cards to see details. On mobile, <b>long-press</b> the card to show the same info.
      </div>
    `
  },
  {
    key: "shop",
    icon: "🛒",
    title: "Main Shop",
    hint: "Buy card packs",
    html: `
      <h4>Buying packs</h4>
      <ul>
        <li>Click a moving card in the <b>Main Shop</b> to purchase a pack.</li>
        <li>Packs are stored in your <b>Inventory → Packs</b>.</li>
        <li>Better rarities are usually harder to pull, but give stronger base GPS.</li>
      </ul>
    `
  },
  {
    key: "inventory",
    icon: "🎒",
    title: "Inventory",
    hint: "Open packs & manage cards",
    html: `
      <h4>Opening packs</h4>
      <ul>
        <li>Open <b>Inventory</b> (top bar) → go to <b>Packs</b> → open your pack to get cards.</li>
        <li>Your owned cards appear under <b>Inventory → Cards</b>.</li>
      </ul>
      <div class="howtoCallout">
        Some cards can have a <b>mutation</b>. Mutations change your GPS via multipliers.
      </div>
    `
  },
  {
    key: "deck",
    icon: "🧩",
    title: "Decks",
    hint: "Equip cards to earn GPS",
    html: `
      <h4>Deck A & Deck B</h4>
      <ul>
        <li>Click a slot in <b>Deck A</b> or <b>Deck B</b> to place one of your cards.</li>
        <li>Equipped cards contribute to your total <b>Gold/sec</b>.</li>
        <li>You can re-pick cards anytime by clicking the slot again.</li>
      </ul>
    `
  },
  {
    key: "tower",
    icon: "🏰",
    title: "Tower",
    hint: "Collect stored gold",
    html: `
      <h4>Tower storage</h4>
      <ul>
        <li>The <b>Tower</b> stores gold for you over time.</li>
        <li>Click the Tower to collect the stored amount.</li>
        <li>The % on the Tower shows how full it is.</li>
      </ul>
    `
  },
  {
    key: "systems",
    icon: "⚡",
    title: "Events & Systems",
    hint: "Weather, Lucky Draw, Mutations",
    html: `
      <h4>Extra ways to progress</h4>
      <ul>
        <li><b>Weather</b>: special weather can strike cards with mutations (watch the timer chip).</li>
        <li><b>Notifications</b>: missions/rewards and special features live here.</li>
        <li><b>Mutation Machine</b>: insert an eligible card and roll a new random mutation (replacement only, no stacking).</li>
        <li><b>Lucky Draw</b>: spend tickets for a gacha-style reward.</li>
      </ul>
      <div class="howtoCallout">
        If you ever feel lost, open this guide anytime from <b>How to Play</b> on the top bar.
      </div>
    `
  }
];

let howtoStepIdx = 0;

function howtoMarkSeen(){
  try{ localStorage.setItem(HOWTO_LS_KEY, "1"); }catch(_){ }
}

function howtoIsSeen(){
  try{ return localStorage.getItem(HOWTO_LS_KEY) === "1"; }catch(_){ return false; }
}

function openHowToPlay(force=false){
  if (!howtoOverlay) return;
  if (!force && howtoIsSeen()) return;
  howtoOverlay.classList.add("show");
  howtoOverlay.setAttribute("aria-hidden","false");
  howtoStepIdx = Math.max(0, Math.min(howtoStepIdx, HOWTO_STEPS.length-1));
  renderHowToPlay();
}

function closeHowToPlay(){
  if (!howtoOverlay) return;
  howtoOverlay.classList.remove("show");
  howtoOverlay.setAttribute("aria-hidden","true");
  if (howtoDontShow && howtoDontShow.checked) howtoMarkSeen();
  FrameAnimationManager.stopAll();
}

function renderHowToPlay(){
  if (!howtoTabs || !howtoContent || !howtoStepTitle) return;

  howtoTabs.innerHTML = "";
  HOWTO_STEPS.forEach((s, i)=>{
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "howtoTab" + (i===howtoStepIdx ? " isActive" : "");
    btn.innerHTML = `
      <div class="howtoTabTop">
        <div class="howtoTabIcon" aria-hidden="true">${s.icon}</div>
        <div>
          <div class="howtoTabTitle">${escapeHtml(s.title)}</div>
          <div class="howtoTabHint">${escapeHtml(s.hint)}</div>
        </div>
      </div>
    `;
    if (btn) btn.addEventListener("click", ()=>{
      howtoStepIdx = i;
      renderHowToPlay();
    });
    howtoTabs.appendChild(btn);
  });

  if (howtoDots){
    howtoDots.innerHTML = "";
    for (let i=0;i<HOWTO_STEPS.length;i++){
      const d = document.createElement("div");
      d.className = "howtoDot" + (i===howtoStepIdx ? " on" : "");
      howtoDots.appendChild(d);
    }
  }

  const step = HOWTO_STEPS[howtoStepIdx];
  howtoStepTitle.textContent = `${howtoStepIdx+1}/${HOWTO_STEPS.length} • ${step.title}`;
  howtoContent.innerHTML = step.html;

  if (howtoBackBtn) howtoBackBtn.disabled = (howtoStepIdx === 0);
  if (howtoNextBtn){
    const isLast = (howtoStepIdx === HOWTO_STEPS.length-1);
    howtoNextBtn.textContent = isLast ? "Finish" : "Next";
  }
}

function maybeAutoShowHowToPlay(){
  if (!howtoOverlay) return;
  if (howtoIsSeen()) return;
  window.setTimeout(()=> openHowToPlay(true), 350);
}

/* ================= Events ================= */
if (openGalleryBtn) openGalleryBtn.addEventListener("click", openGallery);
if (closeGalleryBtn) closeGalleryBtn.addEventListener("click", closeGallery);
if (galleryOverlay) galleryOverlay.addEventListener("click", (e)=>{ if (e.target === galleryOverlay) closeGallery(); });
if (gallerySearch) gallerySearch.addEventListener("input", (e)=> renderGallery(e.target.value));
if (galleryTabs) galleryTabs.addEventListener("click", (e)=>{
  const btn = e.target.closest?.(".galleryTab");
  if (!btn) return;
  setGalleryTab(btn.getAttribute("data-tab"));
});

document.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && galleryOverlay && galleryOverlay.classList.contains("show")) closeGallery(); });

if (openInvBtn) openInvBtn.addEventListener("click", openInventory);
if (invOkBtn) invOkBtn.addEventListener("click", closeInventory);
if (closeInvBtn) closeInvBtn.addEventListener("click", closeInventory);
if (invOverlay) invOverlay.addEventListener("click", (e)=>{ if(e.target === invOverlay) closeInventory(); });

if (closeGiftSendBtn) closeGiftSendBtn.addEventListener("click", closeGiftSendModal);
if (giftSendOverlay) giftSendOverlay.addEventListener("click", (e)=>{ if(e.target === giftSendOverlay) closeGiftSendModal(); });
if (giftReceiverInput) giftReceiverInput.addEventListener("input", syncGiftSendDisabled);

if (giftSendBtn){
  giftSendBtn.dataset.sfx = "click";
  if (giftSendBtn) giftSendBtn.addEventListener("click", async ()=>{
    const to = (giftReceiverInput?.value||"").trim();
    if (!to){ toast("Missing receiver", "Please enter a username."); return; }
    if (!giftSelectedCardId){ toast("No card selected", "Please select a card to send."); return; }

    const myUser = (window.__USER__ && window.__USER__.username) ? String(window.__USER__.username) : "";
    if (myUser && myUser.toLowerCase() === to.toLowerCase()){
      toast("Invalid receiver", "You can’t send a gift to yourself.");
      return;
    }

    giftSendBtn.disabled = true;
    try{
      await postJSON("api/trade_send.php", { to_username: to, card_id: giftSelectedCardId });
      removeCardEverywhere(giftSelectedCardId);
      const sentId = giftSelectedCardId;
      giftSelectedCardId = null;
      saveState();
      closeGiftSendModal();
      toast("Sent successfully", `Gift sent to ${to}.`);
      try{ renderCardsModal(); }catch(_){}
      try{ buildSlots(); }catch(_){}
      try{ syncUI(); }catch(_){}
    }catch(err){
      const msg = (err && err.message) ? err.message : "Failed to send gift.";
      toast("Send failed", msg);
      syncGiftSendDisabled();
    }
  });
}

if (openHowToBtn) openHowToBtn.addEventListener("click", ()=> openHowToPlay(true));
if (closeHowToBtn) closeHowToBtn.addEventListener("click", closeHowToPlay);
if (howtoOverlay) howtoOverlay.addEventListener("click", (e)=>{ if (e.target === howtoOverlay) closeHowToPlay(); });
if (howtoBackBtn) howtoBackBtn.addEventListener("click", ()=>{ howtoStepIdx = Math.max(0, howtoStepIdx-1); renderHowToPlay(); });
if (howtoNextBtn) howtoNextBtn.addEventListener("click", ()=>{
  const last = (howtoStepIdx >= HOWTO_STEPS.length-1);
  if (last){
    if (howtoDontShow) howtoDontShow.checked = true;
    howtoMarkSeen();
    closeHowToPlay();
    return;
  }
  howtoStepIdx = Math.min(HOWTO_STEPS.length-1, howtoStepIdx+1);
  renderHowToPlay();
});

document.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && howtoOverlay && howtoOverlay.classList.contains("show")) closeHowToPlay(); });

if (invTabs){
  if (invTabs) invTabs.addEventListener("click", (e)=>{
    const btn = e.target.closest(".invTab");
    if (!btn) return;
    const tab = btn.getAttribute("data-tab");
    if (!tab) return;

    setInventoryTab(tab);

    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.invTab = tab;
    try{ saveState(state); }catch(_){ try{ saveState(); }catch(__){} }
  });
}

if (openCardsBtn){ openCardsBtn.addEventListener("click", openCards); }
if (cardsSearchInput){ cardsSearchInput.addEventListener("input", renderCardsModal); }
if (cardsOkBtn){ cardsOkBtn.addEventListener("click", closeCards); }

// Notifications

function getCurrentUsername(){
  const u = String(window.__USER__?.username || "").trim();
  if (u) return u;
  return String(state?.user || state?.name || "Player");
}

function countOwnedCards(){
  return Array.isArray(state.cardsOwned) ? state.cardsOwned.length : 0;
}

function uniqueOwnedCards(){
  const arr = Array.isArray(state.cardsOwned) ? state.cardsOwned : [];
  const map = new Map();
  for (const c of arr){
    const name = String(c?.name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!map.has(key)){
      map.set(key, { name, img: String(c?.img || "") });
    }
  }
  return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name));
}

function fillFlexSelect(selEl, slotIdx){
  if (!selEl) return;
  const cards = uniqueOwnedCards();
  const saved = state.profile?.featured?.[slotIdx] || "";
  const opts = ['<option value="">— Empty —</option>']
    .concat(cards.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`));
  selEl.innerHTML = opts.join("");
  selEl.value = saved || "";
}

function updateFlexThumb(slotIdx){
  const card = getFeaturedCard(slotIdx);

  const imgEl = [flexImg0, flexImg1, flexImg2][slotIdx];
  if (imgEl){
    imgEl.src = (card && card.img) ? card.img : "cards/card.png";
    imgEl.style.display = "";
  }

  const slotEl = document.querySelector(`.profileFlexSlot[data-slot="${slotIdx}"]`);
  if (!slotEl) return;

  slotEl.innerHTML = "";

  if (!card){
    slotEl.classList.remove("hasCard");
    slotEl.innerHTML = `<div class="userFlexEmpty">Empty</div><div class="flexSub">Tap to pick</div>`;
    return;
  }

  slotEl.classList.add("hasCard");

  const tile = document.createElement("div");
  tile.className = `userFlexCardTile r-${String(card.rarity||"").toLowerCase()}`;
  try{ applyMutationGlow(tile, card); }catch(_){}

  const img = document.createElement("img");
  img.className = "userFlexCardImg";
  img.loading = "lazy";
  img.decoding = "async";
  img.alt = card.name || "Card";
  img.src = card.img || card.image || "cards/card.png";
  img.onerror = ()=>{ img.src = "cards/card.png"; };
  startCardAnimation(img, card);
  tile.appendChild(img);

  const meta = document.createElement("div");
  meta.className = "userFlexCardMeta";
  const gps = computeCardGps(card);
  meta.innerHTML = `
    <div class="ufcmName">${escapeHtml(card.name || "Unknown")}</div>
    <div class="ufcmGps">${fmt(gps)} GPS</div>
  `;
  tile.appendChild(meta);

  try{ bindTooltip(tile, ()=>card); }catch(_){}
  tile.addEventListener("click", (e)=>{
    try{
      const r = tile.getBoundingClientRect();
      showTooltipHtml(formatCardDetails(card), r.left + r.width/2, r.top + 10);
      tooltipOwnerEl = tile;
      e.preventDefault();
      e.stopPropagation();
    }catch(_){}
  }, true);

  slotEl.appendChild(tile);

  const sub = document.createElement("div");
  sub.className = "flexSub";
  sub.textContent = "Tap to change";
  slotEl.appendChild(sub);
}

/* ================= Profile: Theme / Snapshot / Achievements ================= */

const PROFILE_THEMES = [
  { key:"cosmic",     name:"Cosmic",     emoji:"🌌", desc:"Default deep-space glow." },
  { key:"neon",       name:"Neon Pulse", emoji:"⚡", desc:"Electric highlights + crisp contrast." },
  { key:"royal",      name:"Royal Rift", emoji:"👑", desc:"Purple-gold prestige vibe." },
  { key:"abyss",      name:"Abyss",      emoji:"🌊", desc:"Deep dark ocean-space feel." },
  { key:"valentines", name:"Valentines", emoji:"💘", desc:"Sweet pink aura for the event season." }
];

let __appliedProfileTheme = null;
function getProfileThemeKey(){
  const t = String(state?.profile?.theme || "cosmic").toLowerCase();
  return PROFILE_THEMES.some(x=>x.key===t) ? t : "cosmic";
}
function applyProfileTheme(){
  const t = getProfileThemeKey();
  if (__appliedProfileTheme === t) return;
  try{ document.body.dataset.theme = t; }catch(_){}
  __appliedProfileTheme = t;
}

function renderProfileThemeSelector(){
  if (!profileThemeGridEl) return;
  const active = getProfileThemeKey();
  profileThemeGridEl.innerHTML = "";
  for (const th of PROFILE_THEMES){
    const b = document.createElement("button");
    b.type = "button";
    b.className = "profileThemeBtn" + (th.key === active ? " isActive" : "");
    b.innerHTML = `
      <div class="tTop">
        <div class="tName">${escapeHtml(th.emoji)} ${escapeHtml(th.name)}</div>
        <div class="tEmoji">${th.key === active ? "✔" : ""}</div>
      </div>
      <div class="tDesc">${escapeHtml(th.desc)}</div>
    `;
    if (b) b.addEventListener("click", ()=>{
      ensureProfile();
      state.profile.theme = th.key;
      saveState();
      applyProfileTheme();
      renderProfileThemeSelector();
      toast("Theme Applied", `${th.name} theme is now active.`);
    });
    profileThemeGridEl.appendChild(b);
  }
}

/* ===== Profile Cosmetics (Valentines: Rose Frame + Premium Title) ===== */

const PROFILE_COSMETICS = {
  frames: [
    { key:"default",   name:"Default Frame", emoji:"🟦", desc:"Standard profile frame.", requires:null },
    { key:"rose",      name:"Rose Frame",    emoji:"🌹", desc:"Permanent Valentines rose frame.", requires:"val_roseFrame" },
  ],
  titles: [
    { key:null,        name:"No Title",      emoji:"—",  desc:"Hide your title.", requires:null },
    { key:"fatebound", name:"Fatebound",     emoji:"💖", desc:"Premium Valentines title + prestige.", requires:"val_fateboundTitle" },
  ]
};

function ownedCosmeticFlag(flag){
  try{
    const c = state?.valentines?.cosmetics || {};
    if (flag === "val_roseFrame") return !!c.roseFrame;
    if (flag === "val_fateboundTitle") return !!c.fateboundTitle;
  }catch(_){}
  return false;
}

function isCosmeticOwned(item){
  if (!item.requires) return true;
  return ownedCosmeticFlag(item.requires);
}

function getEquippedFrameKey(){
  ensureProfile();
  const k = String(state.profile.cosmetics.frame || "default").toLowerCase();
  return PROFILE_COSMETICS.frames.some(x=>x.key===k) ? k : "default";
}

function getEquippedTitleKey(){
  ensureProfile();
  const t = state.profile.cosmetics.title;
  if (t === null || t === "null" || t === "") return null;
  const k = String(t).toLowerCase();
  return PROFILE_COSMETICS.titles.some(x=>x.key===k) ? k : null;
}

function forceHeaderProfileAvatar(){
  const AVATAR_SRC = "profile/profile.png";
  try{
    const headerImg = document.querySelector("#profileAvatarWrapHeader img");
    if (headerImg) headerImg.src = AVATAR_SRC;
  }catch(_){}
}

function forceProfileAvatar(){
  const AVATAR_SRC = "profile/profile.png";
  try{
    if (profileAvatarImg) profileAvatarImg.src = AVATAR_SRC;
    if (profileModalAvatarImg) profileModalAvatarImg.src = AVATAR_SRC;
  }catch(_){}
}

function ensureDefaultProfileAvatar(){
  const DEFAULT_AVATAR_SRC = "profile/profile.png";
  try{
    if (profileAvatarImg){
      const cur = (profileAvatarImg.getAttribute("src") || "").trim();
      if (!cur || cur === "cards/card.png" || cur === "cards/cards.png"){
        profileAvatarImg.src = DEFAULT_AVATAR_SRC;
      }
    }
    if (profileModalAvatarImg){
      const cur = (profileModalAvatarImg.getAttribute("src") || "").trim();
      if (!cur || cur === "cards/card.png" || cur === "cards/cards.png"){
        profileModalAvatarImg.src = DEFAULT_AVATAR_SRC;
      }
    }
  }catch(_){}
}

function setupProfileCosmeticButtons(){
  document.querySelectorAll(".profileCosmetics [data-frame]").forEach(btn=>{
    if (btn) btn.addEventListener("click", ()=>{
      const key = btn.getAttribute("data-frame");
      const owned = state?.profile?.cosmetics?.ownedFrames || ["default"];
      if (!owned.includes(key)) return;
      state.profile.cosmetics.frame = key;
      saveState();
      applyProfileCosmetics();
      refreshProfileCosmeticsUI();
    });
  });

  document.querySelectorAll(".profileCosmetics [data-title]").forEach(btn=>{
    if (btn) btn.addEventListener("click", ()=>{
      const key = btn.getAttribute("data-title");
      if (key === "none"){ state.profile.cosmetics.title = null; saveState(); applyProfileCosmetics(); refreshProfileCosmeticsUI(); return; }
      const owned = state?.profile?.cosmetics?.ownedTitles || [];
      if (!owned.includes(key)) return;
      state.profile.cosmetics.title = key;
      saveState();
      applyProfileCosmetics();
      refreshProfileCosmeticsUI();
    });
  });

  document.querySelectorAll(".profileCosmetics [data-aura]").forEach(btn=>{
    if (btn) btn.addEventListener("click", ()=>{
      const key = btn.getAttribute("data-aura");
      if (key === "none"){ state.profile.cosmetics.aura = "none"; saveState(); applyProfileCosmetics(); refreshProfileCosmeticsUI(); return; }
      const owned = state?.profile?.cosmetics?.ownedAuras || ["none"];
      if (!owned.includes(key)) return;
      state.profile.cosmetics.aura = key;
      saveState();
      applyProfileCosmetics();
      refreshProfileCosmeticsUI();
    });
  });
}

function refreshProfileCosmeticsUI(){
  const frameSel = state?.profile?.cosmetics?.frame || "default";
  const titleSel = state?.profile?.cosmetics?.title || "none";
  const auraSel  = state?.profile?.cosmetics?.aura  || "none";

  const ownedFrames = state?.profile?.cosmetics?.ownedFrames || ["default"];
  const ownedTitles = state?.profile?.cosmetics?.ownedTitles || [];
  const ownedAuras  = state?.profile?.cosmetics?.ownedAuras  || ["none"];

  document.querySelectorAll(".profileCosmetics [data-frame]").forEach(b=>{
    const k=b.getAttribute("data-frame");
    b.classList.toggle("isSel", k===frameSel);
    b.classList.toggle("locked", !ownedFrames.includes(k));
  });
  document.querySelectorAll(".profileCosmetics [data-title]").forEach(b=>{
    const k=b.getAttribute("data-title");
    const isNone = (k==="none");
    b.classList.toggle("isSel", (isNone ? (titleSel==="none") : (k===titleSel)));
    b.classList.toggle("locked", (!isNone && !ownedTitles.includes(k)));
  });
  document.querySelectorAll(".profileCosmetics [data-aura]").forEach(b=>{
    const k=b.getAttribute("data-aura");
    const isNone = (k==="none");
    b.classList.toggle("isSel", (isNone ? (auraSel==="none") : (k===auraSel)));
    b.classList.toggle("locked", (!isNone && !ownedAuras.includes(k)));
  });
}

function applyProfileCosmetics(){
  ensureDefaultProfileAvatar();

  const tKey = getEquippedTitleKey();
  if (profileEquippedTitleEl){
    if (tKey){
      profileEquippedTitleEl.textContent = "💖 Fatebound";
      profileEquippedTitleEl.classList.remove("hidden");
      profileEquippedTitleEl.dataset.kind = tKey;
    }else{
      profileEquippedTitleEl.textContent = "";
      profileEquippedTitleEl.classList.add("hidden");
      profileEquippedTitleEl.dataset.kind = "";
    }
  }

  const fKey = getEquippedFrameKey();
  const frameUrl = (fKey === "rose") ? "url('frame/valentines.png'), url('frames/valentines.png')" : "";

  const frameWrap = profileAvatarFrameWrapEl;
  if (frameWrap){
    frameWrap.classList.toggle("hasRoseFrame", fKey === "rose");
  }

  const targets = [profileAvatarWrapHeader, profileAvatarWrapModal].filter(Boolean);
  for (const el of targets){
    el.classList.toggle("hasFrame", fKey === "rose");
    if (fKey === "rose"){
      try{ el.style.setProperty("--avatarFrameUrl", frameUrl); }catch(_){}
    }else{
      try{ el.style.removeProperty("--avatarFrameUrl"); }catch(_){}
    }
  }
}

function renderProfileCosmetics(){
  if (!profileCosmeticsGridEl) return;
  ensureProfile();

  const curFrame = getEquippedFrameKey();
  const curTitle = getEquippedTitleKey();

  const mkItem = (type, item, isActive) => {
    const owned = isCosmeticOwned(item);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cosmeticBtn" + (isActive ? " isActive" : "") + (owned ? "" : " isLocked");
    b.innerHTML = `
      <div class="cTop">
        <div class="cName">${escapeHtml(item.emoji)} ${escapeHtml(item.name)}</div>
        <div class="cState">${owned ? (isActive ? "Equipped" : "Owned") : "Locked"}</div>
      </div>
      <div class="cDesc">${escapeHtml(item.desc)}</div>
    `;
    if (b) b.addEventListener("click", ()=>{
      if (!owned){
        toast("Locked", "You don't own this cosmetic yet.");
        return;
      }
      if (type === "frame"){
        state.profile.cosmetics.frame = item.key;
      }else{
        state.profile.cosmetics.title = item.key;
      }
      saveState();
      applyProfileCosmetics();
      renderProfileCosmetics();
      toast("Saved", "Profile cosmetic updated.");
    });
    return b;
  };

  profileCosmeticsGridEl.innerHTML = "";

  const frameHead = document.createElement("div");
  frameHead.className = "cosmeticGroupHead";
  frameHead.textContent = "Frames";
  profileCosmeticsGridEl.appendChild(frameHead);

  const frameGrid = document.createElement("div");
  frameGrid.className = "cosmeticGrid";
  for (const it of PROFILE_COSMETICS.frames){
    frameGrid.appendChild(mkItem("frame", it, it.key === curFrame));
  }
  profileCosmeticsGridEl.appendChild(frameGrid);

  const titleHead = document.createElement("div");
  titleHead.className = "cosmeticGroupHead";
  titleHead.textContent = "Titles";
  profileCosmeticsGridEl.appendChild(titleHead);

  const titleGrid = document.createElement("div");
  titleGrid.className = "cosmeticGrid";
  for (const it of PROFILE_COSMETICS.titles){
    const active = (it.key === curTitle) || (it.key === null && curTitle === null);
    titleGrid.appendChild(mkItem("title", it, active));
  }
  profileCosmeticsGridEl.appendChild(titleGrid);
}

const PROFILE_ACHIEVEMENTS = [
  { id:"cards_50",    icon:"🃏", name:"Collector I",   desc:"Own 50 total cards.",                 test:()=> countOwnedCards() >= 50 },
  { id:"cards_200",   icon:"📚", name:"Collector II",  desc:"Own 200 total cards.",                test:()=> countOwnedCards() >= 200 },
  { id:"rar_myth",    icon:"💜", name:"Mythic Touch",  desc:"Own at least 1 MYTHICAL card.",       test:()=> countOwnedByRarity("mythical") >= 1 },
  { id:"rar_inter",   icon:"🌀", name:"Star Traveler", desc:"Own at least 1 INTERSTELLAR card.",    test:()=> countOwnedByRarity("interstellar") >= 1 },
  { id:"rar_val",     icon:"💘", name:"Valentine",     desc:"Own at least 1 VALENTINES card.",     test:()=> countOwnedByRarity("valentines") >= 1 },
  { id:"rar_dragon",  icon:"🐉", name:"Dragonbound",   desc:"Own at least 1 DRAGON card.",         test:()=> countOwnedByRarity("dragon") >= 1 },
  { id:"tower_100k",  icon:"🏰", name:"Vault Keeper",  desc:"Have 100,000 gold stored in the Tower.", test:()=> (Number(state.towers?.stored)||0) >= 100000 }
];

function isAchievementUnlocked(id){
  return !!(state?.profile?.achievements && state.profile.achievements[id]);
}
function unlockAchievement(id){
  ensureProfile();
  if (!state.profile.achievements) state.profile.achievements = {};
  state.profile.achievements[id] = 1;
}
function checkAchievementUnlocks(){
  for (const a of PROFILE_ACHIEVEMENTS){
    if (isAchievementUnlocked(a.id)) continue;
    let ok = false;
    try{ ok = !!a.test(); }catch(_){ ok = false; }
    if (ok){
      unlockAchievement(a.id);
      saveState();
      toast("Achievement Unlocked!", `${a.icon} ${a.name}`);
    }
  }
}
function renderProfileBadges(){
  if (!profileBadgesGridEl) return;
  checkAchievementUnlocks();
  profileBadgesGridEl.innerHTML = "";
  for (const a of PROFILE_ACHIEVEMENTS){
    const unlocked = isAchievementUnlocked(a.id);
    const card = document.createElement("div");
    card.className = "profileBadge " + (unlocked ? "unlocked" : "locked");
    card.title = `${a.name} — ${a.desc}`;
    card.innerHTML = `
      <div class="bTop">
        <div class="bIcon" aria-hidden="true">${escapeHtml(a.icon)}</div>
        <div class="bName">${escapeHtml(a.name)}</div>
        <div class="bTag">${unlocked ? "UNLOCKED" : "LOCKED"}</div>
      </div>
      <div class="bDesc">${escapeHtml(a.desc)}</div>
    `;
    if (card) card.addEventListener("click", ()=>{
      toast(a.name, unlocked ? a.desc : ("Locked: " + a.desc));
    });
    profileBadgesGridEl.appendChild(card);
  }
}

function getTopOwnedRarity(){
  const cards = Array.isArray(state.cardsOwned) ? state.cardsOwned : [];
  if (!cards.length) return { rarity:"common", count:0 };
  let best = "common";
  let bestIdx = -1;
  for (const c of cards){
    const r = String(c?.rarity||"common").toLowerCase();
    const idx = rarityIndex(r);
    if (idx > bestIdx){
      bestIdx = idx;
      best = r;
    }
  }
  return { rarity: best, count: countOwnedByRarity(best) };
}

function updateProfileSnapshot(){
  try{
    if (profileCurGpsEl) profileCurGpsEl.textContent = fmt(Math.round(computeDeckGps()));
  }catch(_){}
  try{
    const tier = getSummonerTier();
    const mult = towerMultiplierForTier(tier);
    if (profileTowerMultEl) profileTowerMultEl.textContent = `${mult.toFixed(1)}x`;
  }catch(_){}
  try{
    const stored = Math.floor(Number(state.towers?.stored)||0);
    if (profileTowerStoredEl) profileTowerStoredEl.textContent = fmt(stored);
  }catch(_){}
  try{
    const top = getTopOwnedRarity();
    if (profileTopRarityEl) profileTopRarityEl.textContent = String(top.rarity||"common").toUpperCase();
    if (profileRarityCountEl) profileRarityCountEl.textContent = `${fmt(top.count)} cards`;
  }catch(_){}
}

function renderProfileModal(){
  const uname = getCurrentUsername();
  if (profileNameEl) profileNameEl.textContent = uname;
  if (profileUserNameEl) profileUserNameEl.textContent = uname;
  if (profileTotalCardsEl) profileTotalCardsEl.textContent = String(countOwnedCards());

  const avatarSrc = state?.profile?.avatar || "profile/profile.png";
  if (profileAvatarImg) profileAvatarImg.src = avatarSrc;
  if (profileModalAvatarImg) profileModalAvatarImg.src = avatarSrc;

  fillFlexSelect(flexSel0, 0);
  fillFlexSelect(flexSel1, 1);
  fillFlexSelect(flexSel2, 2);
  updateFlexThumb(0); updateFlexThumb(1); updateFlexThumb(2);

  applyProfileTheme();
  updateProfileSnapshot();
  renderProfileThemeSelector();
  renderProfileBadges();
  renderProfileCosmetics();
  applyProfileCosmetics();
}

function doLogout(){
  fetch("logout.php", { method:"POST", credentials:"same-origin" })
    .catch(()=>{})
    .finally(()=>{ window.location.href = "login.php"; });
}

function openProfile(){
  if (!profileOverlay) return;
  renderProfileModal();
  try{ updateFlexUI(); }catch(_){ }
  profileOverlay.classList.add("show");
  profileOverlay.setAttribute("aria-hidden","false");
}
function closeProfile(){
  if (!profileOverlay) return;
  try{ closeFlexPicker(); }catch(_){ }
  profileOverlay.classList.remove("show");
  profileOverlay.setAttribute("aria-hidden","true");
  FrameAnimationManager.stopAll();
}

function bindFlexSelect(selEl, slotIdx){
  if (!selEl) return;
  if (selEl) selEl.addEventListener("change", () => {
    ensureProfile();
    const v = String(selEl.value || "");
    state.profile.featured[slotIdx] = v ? v : null;
    saveState();
    updateFlexThumb(slotIdx);
  });
}

if (openProfileBtn){
  if (openProfileBtn) openProfileBtn.addEventListener("click", (e) => {
    try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
    openProfile();
  });
}
if (closeProfileBtn){
  if (closeProfileBtn) closeProfileBtn.addEventListener("click", (e)=>{ try{e.preventDefault();e.stopPropagation();}catch(_){} doLogout(); });
}
if (profileOkBtn){
  if (profileOkBtn) profileOkBtn.addEventListener("click", closeProfile);
}
if (profileOverlay){
  if (profileOverlay) profileOverlay.addEventListener("click", (e) => {
    if (e.target === profileOverlay) closeProfile();
  });
}
bindFlexSelect(flexSel0, 0);
bindFlexSelect(flexSel1, 1);
bindFlexSelect(flexSel2, 2);

if (profileOverlay){
  if (profileOverlay) profileOverlay.addEventListener("click", (e)=>{
    const slot = e.target && e.target.closest ? e.target.closest(".profileFlexSlot") : null;
    if (!slot) return;
    const idx = Number(slot.getAttribute("data-slot"));
    if (!Number.isFinite(idx)) return;
    if (e.target && (e.target.tagName==="SELECT" || e.target.closest("select"))) return;
    openFlexPicker(idx);
  });
}

if (openNotifBtn){
  if (openNotifBtn) openNotifBtn.addEventListener("click", openNotifications);
}
if (notifOkBtn){
  if (notifOkBtn) notifOkBtn.addEventListener("click", closeNotifications);
}
if (closeNotifBtn){
  if (closeNotifBtn) closeNotifBtn.addEventListener("click", closeNotifications);
}
if (notifOverlay){
  if (notifOverlay) notifOverlay.addEventListener("click", (e)=>{ if(e.target === notifOverlay) closeNotifications(); });
}

if (openLeaderboardBtn){
  if (openLeaderboardBtn) openLeaderboardBtn.addEventListener("click", openLeaderboards);
}
if (leaderboardOkBtn){
  if (leaderboardOkBtn) leaderboardOkBtn.addEventListener("click", closeLeaderboards);
}
if (closeLeaderboardBtn){
  if (closeLeaderboardBtn) closeLeaderboardBtn.addEventListener("click", closeLeaderboards);
}
if (leaderboardOverlay){
  if (leaderboardOverlay) leaderboardOverlay.addEventListener("click", (e)=>{ if(e.target === leaderboardOverlay) closeLeaderboards(); });
}

if (openValentinesBtn){
  if (openValentinesBtn) openValentinesBtn.addEventListener("click", openValentines);
}
if (closeValentinesBtn){
  if (closeValentinesBtn) closeValentinesBtn.addEventListener("click", closeValentines);
}
if (valentinesOverlay){
  if (valentinesOverlay) valentinesOverlay.addEventListener("click", (e)=>{ if (e.target === valentinesOverlay) closeValentines(); });
}

if (openValHelpBtn){
  if (openValHelpBtn) openValHelpBtn.addEventListener("click", openValHelp);
}
if (closeValHelpBtn){
  if (closeValHelpBtn) closeValHelpBtn.addEventListener("click", closeValHelp);
}
if (valHelpOkBtn){
  if (valHelpOkBtn) valHelpOkBtn.addEventListener("click", closeValHelp);
}
if (valentinesHelpOverlay){
  if (valentinesHelpOverlay) valentinesHelpOverlay.addEventListener("click", (e)=>{ if (e.target === valentinesHelpOverlay) closeValHelp(); });
}
if (valTabs){
  if (valTabs) valTabs.addEventListener("click", (e)=>{
    const b = e.target.closest(".valTab");
    if (!b) return;
    const t = b.getAttribute("data-tab");
    if (t) setValTab(t);
  });
}
document.addEventListener("keydown", (e)=>{
  if (e.key === "Escape" && valentinesOverlay && valentinesOverlay.classList.contains("show")) closeValentines();
});
document.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && leaderboardOverlay && leaderboardOverlay.classList.contains("show")) closeLeaderboards(); });

if (notifTabs){
  if (notifTabs) notifTabs.addEventListener("click", (e)=>{
    const btn = e.target.closest(".notifTab");
    if (!btn) return;
    const tab = btn.getAttribute("data-tab");
    if (!tab) return;
    setNotifTab(tab);
    renderNotifTab();
  });
}

if (luckyResultOkBtn) luckyResultOkBtn.addEventListener("click", closeLuckyResultModal);
if (closeLuckyResultBtn) closeLuckyResultBtn.addEventListener("click", closeLuckyResultModal);
if (luckyResultOverlay){
  if (luckyResultOverlay) luckyResultOverlay.addEventListener("click", (e)=>{ if(e.target === luckyResultOverlay) closeLuckyResultModal(); });
}

const sellAllCardsBtn = document.getElementById("sellAllCardsBtn");
if (sellAllCardsBtn){
  if (sellAllCardsBtn) sellAllCardsBtn.addEventListener("click", ()=>{
    ensureDeckCardLocations();

    const invCards = getInventoryCards();
    const sellable = invCards.filter(c => !c?.fav);
    if (!invCards.length){
      toast("No inventory cards", "You have no cards in inventory to sell.");
      return;
    }

    const ok = confirm(`Sell ALL unhearted inventory cards (${sellable.length})? Hearted cards will be kept. Deck cards will NOT be affected.`);
    if (!ok) return;

    let gained = 0;
    for (const c of sellable){
      gained += computeSellGold(c);
    }

    state.cardsOwned = (state.cardsOwned||[]).filter(c => {
      const loc = (c?.location||"inventory");
      if (loc !== "inventory") return true;
      return c?.fav === true;
    });

    state.gold = (Number(state.gold)||0) + gained;
    saveState();
    syncUI();
    renderCardsModal();
    buildSlots();
    updateTowersUI();
    toast("Sold!", `You gained ${fmt(gained)} gold.`);
  });
}

if (closeCardsBtn){ closeCardsBtn.addEventListener("click", closeCards); }
if (cardsOverlay){ cardsOverlay.addEventListener("click", (e)=>{ if(e.target === cardsOverlay) closeCards(); }); }

if (closeDeckBtn){
  if (closeDeckBtn) closeDeckBtn.addEventListener("click", closeDeckPicker);
}
if (deckOverlay){
  if (deckOverlay) deckOverlay.addEventListener("click", (e)=>{
    if (e.target === deckOverlay) closeDeckPicker();
  });
}

if (deckSearchInput){
  if (deckSearchInput) deckSearchInput.addEventListener("input", ()=>{
    try{ renderDeckPicker(); }catch(_){}
  });
  if (deckSearchInput) deckSearchInput.addEventListener("keydown", (e)=>{
    if (e.key === "Escape"){
      deckSearchInput.value = "";
      try{ renderDeckPicker(); }catch(_){}
      if (deckSearchDropdown){ deckSearchDropdown.style.display = "none"; deckSearchDropdown.innerHTML = ""; }
    }
  });
}
if (deckSearchClear){
  if (deckSearchClear) deckSearchClear.addEventListener("click", ()=>{
    if (deckSearchInput){
      deckSearchInput.value = "";
      deckSearchInput.focus();
    }
    try{ renderDeckPicker(); }catch(_){}
    if (deckSearchDropdown){ deckSearchDropdown.style.display = "none"; deckSearchDropdown.innerHTML = ""; }
  });
}

if (deckSelectBtn){
  if (deckSelectBtn) deckSelectBtn.addEventListener("click", ()=>{
    if (!deckPicking || !deckPicking.selectedCardId) return;
    ensureDecks();
    const curId = state.decks?.[deckPicking.deckKey]?.[deckPicking.idx] || null;
    const used = getUsedDeckCardIdSet(curId);
    if (used.has(deckPicking.selectedCardId)){
      toast("Card already in a deck", "That card is already placed in another deck slot.");
      return;
    }
    if (curId){
      state.decks[deckPicking.deckKey][deckPicking.idx] = null;
      moveCardToInventory(curId);
    }
    const chosen = getCardById(deckPicking.selectedCardId);
    if (chosen?.fav){
      toast("Protected", "Unheart (unfavorite) this card before putting it into a deck slot.");
      return;
    }

    if (!moveCardToDeck(deckPicking.selectedCardId, deckPicking.deckKey, deckPicking.idx)){
      toast("Missing card", "That card isn't available in your inventory (it might already be in a deck).");
      return;
    }
    state.decks[deckPicking.deckKey][deckPicking.idx] = deckPicking.selectedCardId;

    saveState();
    syncUI();
    closeDeckPicker();
    toast("Deck Updated", `Placed a card into Deck ${deckPicking.deckKey} Slot ${deckPicking.idx+1}`);
  });
}

if (closeMmSelectBtn) closeMmSelectBtn.addEventListener("click", closeMmSelectModal);
if (mmSelectOverlay) mmSelectOverlay.addEventListener("click", (e)=>{ if (e.target === mmSelectOverlay) closeMmSelectModal(); });
if (mmSearchInput) mmSearchInput.addEventListener("input", ()=>{ renderMmPickGrid(); });
if (mmSearchClear) mmSearchClear.addEventListener("click", ()=>{
  if (mmSearchInput) mmSearchInput.value = "";
  try{ mmSearchInput?.focus({preventScroll:true}); }catch(_){ }
  renderMmPickGrid();
});

if (mmSelectBtn){
  if (mmSelectBtn) mmSelectBtn.addEventListener("click", ()=>{
    if (!mmPicking || !mmPicking.selectedCardId) return;
    ensureNotifications();
    state.notifications.mutationMachine.cardId = mmPicking.selectedCardId;
    state.notifications.mutationMachine.status = "idle";
    state.notifications.mutationMachine.startAt = 0;
    state.notifications.mutationMachine.endAt = 0;
    state.notifications.mutationMachine.resultMutation = null;
    state.notifications.mutationMachine.doneNotified = false;
    saveState();
    closeMmSelectModal();
    if (notifOverlay && notifOverlay.classList.contains("show") && notifActiveTab === "mutation"){
      renderNotifTab();
    }
  });
}

if (closeTradeSelectBtn) closeTradeSelectBtn.addEventListener("click", closeTradeSelectModal);
if (tradeSelectOverlay) tradeSelectOverlay.addEventListener("click", (e)=>{ if (e.target === tradeSelectOverlay) closeTradeSelectModal(); });
if (tradeSelectBtn){
  if (tradeSelectBtn) tradeSelectBtn.addEventListener("click", ()=>{
    if (!tradePicking || !tradePicking.selectedCardId) return;
    tradeSelectedCardId = tradePicking.selectedCardId;
    closeTradeSelectModal();
    if (notifOverlay && notifOverlay.classList.contains("show") && notifActiveTab === "trade"){
      renderNotifTab();
    }
  });
}

if (closeMmResultBtn) closeMmResultBtn.addEventListener("click", closeMmResultModal);
if (mmResultOkBtn){
  if (mmResultOkBtn) mmResultOkBtn.addEventListener("click", ()=>{
    if (mmRevealPending) return;
    closeMmResultModal();
    try{
      const mm = state?.notifications?.mutationMachine;
      if (mm && mm.revealed) resetMutationMachine();
    }catch(_){ resetMutationMachine(); }
    if (notifOverlay && notifOverlay.classList.contains("show") && notifActiveTab === "mutation"){
      renderNotifTab();
    }
  });
}
if (mmResultOverlay) mmResultOverlay.addEventListener("click", (e)=>{ if (e.target === mmResultOverlay) closeMmResultModal(); });

if (rewardsOkBtn) rewardsOkBtn.addEventListener("click", closeRewards);
if (closeRewardsBtn) closeRewardsBtn.addEventListener("click", closeRewards);
if (rewardsOverlay) rewardsOverlay.addEventListener("click", (e)=>{ if(e.target === rewardsOverlay) closeRewards(); });

if(openPetShopBtn){
  if (openPetShopBtn) openPetShopBtn.addEventListener("click", openPetShop);
}
if(petShopOkBtn) petShopOkBtn.addEventListener("click", closePetShop);
if(closePetShopBtn) closePetShopBtn.addEventListener("click", closePetShop);
if(petShopOverlay) petShopOverlay.addEventListener("click", (e)=>{ if(e.target === petShopOverlay) closePetShop(); });

if(openSummoners){
  if (openSummoners) openSummoners.addEventListener("click", openSummonersModal);
  if (openSummoners) openSummoners.addEventListener("keydown", (e)=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); openSummonersModal(); }});
  bindSummonerTooltip(openSummoners);
}
if(upgradeSummonerBtn) upgradeSummonerBtn.addEventListener("click", upgradeSelectedSummoner);
if(summonersOkBtn) summonersOkBtn.addEventListener("click", closeSummonersModal);
if(closeSummonersBtn) closeSummonersBtn.addEventListener("click", closeSummonersModal);
if(summonersOverlay) summonersOverlay.addEventListener("click", (e)=>{ if(e.target === summonersOverlay) closeSummonersModal(); });

window.addEventListener("keydown", (e)=>{
  if(e.key !== "Escape") return;
  if (rewardsOverlay.classList.contains("show")) closeRewards();
  if (invOverlay.classList.contains("show")) closeInventory();
  if (cardsOverlay.classList.contains("show")) closeCards();
});

/* ================= Admin Poll (live admin-abuse commands) ================= */
let __adminPollTimer = null;
async function adminPollOnce(){
  try{
    const lastBid = Number(state.lastBroadcastId)||0;
    const res = await fetch(`api/admin_poll.php?last_broadcast_id=${encodeURIComponent(String(lastBid))}`, { method:'GET', headers:{'Accept':'application/json'} });
    if (!res.ok) return;
    const data = await res.json();

    if (data && data.ok && Array.isArray(data.broadcasts) && data.broadcasts.length){
      let maxId = Number(state.lastBroadcastId)||0;
      for (const b of data.broadcasts){
        const idNum = Number(b && b.id);
        if (Number.isFinite(idNum)) maxId = Math.max(maxId, idNum);
        const msg = String((b && (b.message ?? b.text)) || "").trim();
        if (msg) showAdminTicker(msg);
      }
      state.lastBroadcastId = maxId;
    }

    if (data && data.ok && data.globals && typeof data.globals === 'object'){
      let lockVal = data.globals.shop_lock;

      if (lockVal && typeof lockVal === "object"){
        lockVal = lockVal.rarity ?? lockVal.lock ?? lockVal.value ?? null;
      }

      const nextLock = (lockVal === null || lockVal === undefined || String(lockVal).trim()==="") ? null : String(lockVal).toLowerCase().trim();
      const prevLock = (state.adminShopLock === null || state.adminShopLock === undefined || String(state.adminShopLock).trim()==="") ? null : String(state.adminShopLock).toLowerCase().trim();

      if (nextLock !== prevLock){
        state.adminShopLock = nextLock;
        try{ buildMarquee(); }catch(_){ }
        try{ syncUI(); }catch(_){ }
        if (nextLock){
          try{ toast("Shop Locked", `Always showing: ${nextLock.toUpperCase()}`); }catch(_){ }
        }else{
          try{ toast("Shop Normal", "Shop lock cleared."); }catch(_){ }
        }
      }
    }

    if (!data || !data.ok || !Array.isArray(data.commands) || data.commands.length===0){
      saveState();
      syncUI();
      return;
    }

    for (const cmd of data.commands){
      if (!cmd || typeof cmd.type !== 'string') continue;
      const t = cmd.type;
      const p = (cmd.payload && typeof cmd.payload === 'object') ? cmd.payload : {};

      if (t === 'grant_gold'){
        const amt = Number(p.amount)||0;
        if (amt) state.gold = Math.max(0, (Number(state.gold)||0) + amt);
      }else if (t === 'set_gold'){
        const amt = Number(p.amount)||0;
        state.gold = Math.max(0, amt);
      }else if (t === 'grant_diamond'){
        const amt = Number(p.amount)||0;
        if (amt) state.diamond = Math.max(0, (Number(state.diamond)||0) + amt);
      }else if (t === 'set_diamond'){
        const amt = Number(p.amount)||0;
        state.diamond = Math.max(0, amt);
      }else if (t === 'add_packs'){
        const rk = String(p.rarity||'common').toLowerCase();
        const amt = Math.max(0, Number(p.amount)||0);
        state.invCounts[rk] = (Number(state.invCounts[rk])||0) + amt;
      }else if (t === 'set_packs'){
        const rk = String(p.rarity||'common').toLowerCase();
        const amt = Math.max(0, Number(p.amount)||0);
        state.invCounts[rk] = amt;
      }else if (t === 'add_card'){
        const card = (p.card && typeof p.card === 'object') ? { ...p.card } : null;
        if (card){
          if (!card.id) card.id = uid();
          if (!card.location) card.location = 'inventory';
          if (typeof card.fav !== 'boolean') card.fav = false;
          if (!Array.isArray(state.cardsOwned)) state.cardsOwned = [];
          recomputeCardStats(card);
          state.cardsOwned.push(card);
        }
      }else if (t === 'force_weather'){
        ensureWeather();
        const key = String(p.key||'normal').toLowerCase();
        const dur = Math.max(0, Number(p.duration_ms)||90000);
        const now = Date.now();
        state.weather.active = key !== 'normal';
        state.weather.currentKey = key;
        state.weather.endsAt = state.weather.active ? (now + dur) : 0;
        state.weather.strikesDone = 0;
        state.weather.nextStrikeAt = now;
        state.weather.nextAnnounceAt = 0;
        state.weather.nextEventAt = now + WEATHER_EVENT_INTERVAL_MS;
        state.weather.nextPreviewKey = null;
        updateWeatherUI();
      }else if (t === 'reroll_shop'){
        try{ buildMarquee(); }catch(_){ }
      }else if (t === 'admin_message'){
        const msg = String(p.text||'');
        if (msg) showAdminTicker(msg);
      }
    }

    saveState();
    syncUI();
  }catch(_){ }
}
function startAdminPoll(){
  if (__adminPollTimer) return;
  adminPollOnce();
  __adminPollTimer = setInterval(adminPollOnce, 5000);
}

/* ================= Boot ================= */

function ensureComingSoonDom(){
  let ov = document.getElementById("comingSoonOverlay");
  if (ov) return ov;

  ov = document.createElement("div");
  ov.id = "comingSoonOverlay";
  ov.className = "modalOverlay";
  ov.setAttribute("aria-hidden", "true");
  ov.innerHTML = `
    <div class="modal comingSoonModal" role="dialog" aria-modal="true" aria-labelledby="comingSoonTitle">
      <div class="modalHead">
        <b id="comingSoonTitle">Coming Soon</b>
        <button class="closeBtn" id="comingSoonCloseBtn" type="button">Close</button>
      </div>
      <div class="modalBody">
        <div class="comingSoonBody">
          <div class="comingSoonIcon">✨</div>
          <div class="comingSoonText">Comming soon</div>
          <div class="small muted">This feature isn’t available yet.</div>
        </div>
      </div>
      <div class="modalFoot">
        <button class="btn btnPrimary" id="comingSoonOkBtn" type="button">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(ov);

  const close = ()=>{
    ov.setAttribute("aria-hidden","true");
    ov.classList.remove("show");
  };

  ov.addEventListener("click", (e)=>{
    if (e.target === ov) close();
  });
  ov.querySelector("#comingSoonCloseBtn")?.addEventListener("click", close);
  ov.querySelector("#comingSoonOkBtn")?.addEventListener("click", close);

  return ov;
}

function showComingSoon(){
  const ov = ensureComingSoonDom();
  ov.setAttribute("aria-hidden","false");
  ov.classList.add("show");
}

function ensureGoldShopDom(){
  let ov = document.getElementById("goldShopOverlay");
  if (ov) return ov;

  ov = document.createElement("div");
  ov.id = "goldShopOverlay";
  ov.className = "modalOverlay";
  ov.setAttribute("aria-hidden", "true");
  ov.innerHTML = `
    <div class="modal goldShopModal" role="dialog" aria-modal="true" aria-labelledby="goldShopTitle">
      <div class="modalHead">
        <div class="goldShopHeadLeft">
          <b id="goldShopTitle">Shop Gold</b>
          <div class="small muted">Pick a pack and your payment mode.</div>
        </div>
        <button class="closeBtn" id="goldShopCloseBtn" type="button">Close</button>
      </div>

      <div class="modalBody">
        <div class="goldShopSection">
          <div class="sectionTitle">Gold Packs</div>
          <div class="goldPackGrid" id="goldPackGrid"></div>
        </div>

        <div class="goldShopSection">
          <div class="sectionTitle">Mode of Payment</div>
          <div class="payModeRow" id="payModeRow">
            <button class="payModeBtn" data-mode="gcash" type="button">
              <span class="payModeIcon">📱</span>
              <span class="payModeLabel">GCash</span>
            </button>
            <button class="payModeBtn" data-mode="card" type="button">
              <span class="payModeIcon">💳</span>
              <span class="payModeLabel">Credit Card</span>
            </button>
          </div>
          <div class="small muted" id="goldShopHint">Select a pack first.</div>
        </div>
      </div>

      <div class="modalFoot goldShopFoot">
        <div class="goldShopSummary" id="goldShopSummary">
          <div class="small muted">No selection yet.</div>
        </div>
        <button class="btn btnPrimary goldShopBuyBtn" id="goldShopBuyBtn" type="button" disabled>Purchase</button>
      </div>
    </div>
  `;

  document.body.appendChild(ov);

  const close = ()=>{
    ov.setAttribute("aria-hidden","true");
    ov.classList.remove("show");
  };

  ov.addEventListener("click", (e)=>{
    if (e.target === ov) close();
  });
  ov.querySelector("#goldShopCloseBtn")?.addEventListener("click", close);

  ov.__close = close;

  return ov;
}

const GOLD_SHOP_PACKS = [
  { id:"500m", gold: 500_000_000, label:"500M Gold", price:5 },
  { id:"1b",   gold: 1_000_000_000, label:"1B Gold",   price:25 },
  { id:"50b",  gold: 50_000_000_000, label:"50B Gold", price:60 },
  { id:"1t",   gold: 1_000_000_000_000, label:"1T Gold", price:200 },
];

function openGoldShop(){
  const ov = ensureGoldShopDom();
  const grid = ov.querySelector("#goldPackGrid");
  const payRow = ov.querySelector("#payModeRow");
  const hint = ov.querySelector("#goldShopHint");
  const summary = ov.querySelector("#goldShopSummary");
  const buyBtn = ov.querySelector("#goldShopBuyBtn");

  let selectedPack = null;
  let selectedMode = null;

  const refresh = ()=>{
    grid?.querySelectorAll(".goldPackCard").forEach(el=>{
      const on = selectedPack && el.dataset.packId === selectedPack.id;
      el.classList.toggle("selected", !!on);
    });

    payRow?.querySelectorAll(".payModeBtn").forEach(btn=>{
      const on = selectedMode && btn.dataset.mode === selectedMode;
      btn.classList.toggle("selected", !!on);
      btn.disabled = !selectedPack;
    });

    if (!selectedPack){
      hint.textContent = "Select a pack first.";
      summary.innerHTML = `<div class="small muted">No selection yet.</div>`;
      buyBtn.disabled = true;
      return;
    }

    const packLine = `${selectedPack.label} • ₱${selectedPack.price}`;
    if (!selectedMode){
      hint.textContent = "Now choose your payment mode.";
      summary.innerHTML = `
        <div class="goldShopSummaryTop">
          <div class="goldShopSummaryPack">${escapeHtml(packLine)}</div>
          <div class="small muted">Select a payment mode to continue.</div>
        </div>
      `;
      buyBtn.disabled = true;
      return;
    }

    hint.textContent = "Ready to purchase.";
    summary.innerHTML = `
      <div class="goldShopSummaryTop">
        <div class="goldShopSummaryPack">${escapeHtml(packLine)}</div>
        <div class="goldShopSummaryMode">Payment: <b>${selectedMode==="gcash"?"GCash":"Credit Card"}</b></div>
      </div>
    `;
    buyBtn.disabled = false;
  };

  grid.innerHTML = "";
  GOLD_SHOP_PACKS.forEach(p=>{
    const card = document.createElement("button");
    card.type = "button";
    card.className = "goldPackCard";
    card.dataset.packId = p.id;
    card.innerHTML = `
      <div class="goldPackTop">
        <div class="goldPackTitle">${escapeHtml(p.label)}</div>
        <div class="goldPackPrice">₱${p.price}</div>
      </div>
      <div class="goldPackSub small muted">Instant top-up (soon)</div>
      <div class="goldPackBar"></div>
    `;
    card.addEventListener("click", ()=>{
      selectedPack = p;
      selectedMode = null;
      refresh();
    });
    grid.appendChild(card);
  });

  payRow?.querySelectorAll(".payModeBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if (!selectedPack) return;
      selectedMode = btn.dataset.mode || null;
      refresh();
    });
  });

  buyBtn.onclick = ()=>{
    if (!selectedPack || !selectedMode) return;
    showComingSoon();
  };

  refresh();
  ov.setAttribute("aria-hidden","false");
  ov.classList.add("show");
}

function initGoldShopButton(){
  if (!goldPlusBtn) return;

  goldPlusBtn.dataset.sfx = "tower";

  const act = ()=>{
    openGoldShop();
  };

  goldPlusBtn.addEventListener("click", act);
  goldPlusBtn.addEventListener("keydown", (e)=>{
    if(e.key==="Enter" || e.key===" "){ e.preventDefault(); act(); }
  });
}

function boot(){
  buildMarquee();
  startAdminPoll();
  buildSlots();
  updateTowersUI();
  syncUI();
  maybeAutoShowHowToPlay();
  updatePetsBadge();
  initGoldPlaceholder();
  initGoldShopButton();
  let _towersSaveCtr = 0;
  let __uiTickCtr = 0;
  let __tradePollCtr = 0;
  setInterval(()=>{
    tickTowers();
    tickSummonerBonus();
    tickWeather();
    tickMutationMachine();

    if ((++__tradePollCtr % 24) === 0) pollTradeGifts();

    if ((++__uiTickCtr % 2) === 0){
      updateTowersUI();
      updateWeatherUI();
      syncUI();
    }

    if ((++_towersSaveCtr % 40) === 0) saveState();
  }, 250);

  const cardW = 210, gap = 22;
  x = -Math.random() * (22 * (cardW + gap));
  if (track) track.style.transform = `translate3d(${x}px,-50%,0)`;
  requestAnimationFrame(loop);
}
boot();

(function(){
  const POLL_MS = 1500;
  let lastSelfUser = "";
  let lastSearchUser = "";
  let timer = null;

  const selfDotHeader = document.getElementById("profileStatusDot");
  const selfDotModal  = document.getElementById("profileModalStatusDot");

  function setDot(dotEl, isOnline, lastSeenSeconds){
    if (!dotEl) return;
    dotEl.classList.toggle("online", !!isOnline);
    dotEl.classList.toggle("offline", !isOnline);
    const label = isOnline ? "Online" : "Offline";
    let title = label;
    if (!isOnline && typeof lastSeenSeconds === "number"){
      if (lastSeenSeconds < 60) title = `Offline • last seen ${lastSeenSeconds}s ago`;
      else if (lastSeenSeconds < 3600) title = `Offline • last seen ${Math.floor(lastSeenSeconds/60)}m ago`;
      else title = `Offline • last seen ${Math.floor(lastSeenSeconds/3600)}h ago`;
    }
    dotEl.setAttribute("aria-label", label);
    dotEl.title = title;
  }

  async function fetchStatus(username){
    const u = String(username||"").trim();
    if (!u) return null;
    try{
      const res = await fetch(`api/online_status.php?username=${encodeURIComponent(u)}&_=${Date.now()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Accept":"application/json" }
      });
      const data = await res.json().catch(()=>null);
      if (!data || !data.ok) return null;
      return data;
    }catch(_){
      return null;
    }
  }

  async function tick(){
    const selfUser = (typeof getCurrentUsername === "function") ? String(getCurrentUsername()||"") : "";
    if (selfUser && selfUser !== lastSelfUser) lastSelfUser = selfUser;

    try{
      lastSearchUser = String(window.__cc_search_user||"").trim();
    }catch(_){ lastSearchUser = ""; }

    if (lastSelfUser){
      const st = await fetchStatus(lastSelfUser);
      if (st){
        setDot(selfDotHeader, !!st.isOnline, st.lastSeenSecondsAgo);
        setDot(selfDotModal,  !!st.isOnline, st.lastSeenSecondsAgo);
      }
    }

    const searchDot = document.getElementById("searchUserStatusDot");
    if (searchDot && lastSearchUser){
      const st2 = await fetchStatus(lastSearchUser);
      if (st2){
        setDot(searchDot, !!st2.isOnline, st2.lastSeenSecondsAgo);
      }
    }
  }

  function start(){
    if (timer) return;
    tick();
    timer = setInterval(tick, POLL_MS);
  }

  setTimeout(start, 1200);
})();

(function(){
  try {
    var modalShown = false;

    function genToken(){
      return (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 48);
    }

    var tabToken = sessionStorage.getItem('cc_tab_token');
    if (!tabToken) {
      tabToken = genToken();
      sessionStorage.setItem('cc_tab_token', tabToken);
    }

    function showKickModal(message){
      if (modalShown) return;
      modalShown = true;

      var modal = document.createElement('div');
      modal.id = 'forceLogoutModal';
      modal.innerHTML =
        '<div class="force-box">' +
          '<h2>⚠ Account in use</h2>' +
          '<p>' + message + '</p>' +
          '<p>This tab will log out to prevent dual farming.</p>' +
        '</div>';
      document.body.appendChild(modal);

      setTimeout(function(){
        window.location.href = 'logout.php';
      }, 1500);
    }

    async function heartbeat(){
      try {
        var body = new URLSearchParams();
        body.set('tab_token', tabToken);
        body.set('action', 'heartbeat');

        var res = await fetch('api/session_check.php', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        });

        var data = null;
        try { data = await res.json(); } catch(e){ return; }

        if (!data || !data.status) return;

        if (data.status === 'TAB_TAKEN') {
          showKickModal('Another tab is already using this account.');
          return;
        }
        if (data.status === 'SESSION_TAKEN') {
          showKickModal('Someone else logged into your account from another device.');
          return;
        }
      } catch (e) {
      }
    }

    function release(){
      try {
        var body = new URLSearchParams();
        body.set('tab_token', tabToken);
        body.set('action', 'release');

        if (navigator.sendBeacon) {
          navigator.sendBeacon('api/session_check.php', body.toString());
        } else {
          fetch('api/session_check.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            keepalive: true
          }).catch(function(){});
        }
      } catch(e){}
    }

    setTimeout(function(){
      heartbeat();
      setInterval(heartbeat, 4000);
    }, 800);

    window.addEventListener('beforeunload', release);
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'hidden') release();
    });
  } catch (e) {}
})();

// ============================================================
// GLOBAL CHAT – PERSISTENT HISTORY (with cache)
// ============================================================

(function() {
  'use strict';

  // --- DOM elements ---
  let chatToggle = null;
  let chatPanel = null;
  let chatMessages = null;
  let chatInput = null;
  let chatSendBtn = null;
  let unreadDot = null;

  let isOpen = false;
  let lastMessageId = 0;
  let chatPollTimer = null;
  let isInitialized = false;

  // Full message history (kept in memory + cache)
  let fullMessages = [];

  // Cache key
  const CACHE_KEY = 'global_chat_cache';
  const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

  // --- Cache helpers ---
  function getCachedMessages() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.timestamp > CACHE_EXPIRY) return null;
      return data.messages || [];
    } catch (_) { return null; }
  }

  function updateCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        messages: fullMessages
      }));
    } catch (_) {}
  }

  // --- Helpers ---
  function getUsername() {
    try {
      const u = window.__USER__ || {};
      return String(u.username || '').trim() || 'Guest';
    } catch (_) { return 'Guest'; }
  }

  function isLoggedIn() {
    const u = window.__USER__ || {};
    return !!(u.username && u.id);
  }

  function fmtTime(ms) {
    try {
      return new Date(Number(ms)).toLocaleString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (_) { return ''; }
  }

  // --- Build UI (runs once) ---
  function buildChatUI() {
    if (document.getElementById('globalChatToggle')) return;

    chatToggle = document.createElement('button');
    chatToggle.id = 'globalChatToggle';
    chatToggle.setAttribute('aria-label', 'Global Chat');
    chatToggle.type = 'button';
    chatToggle.innerHTML = '💬<span class="unreadDot" id="chatUnreadDot"></span>';
    document.body.appendChild(chatToggle);

    chatPanel = document.createElement('div');
    chatPanel.id = 'globalChatPanel';
    chatPanel.innerHTML = `
      <div id="chatHeader">
        <span class="chatTitle">💬 Global Chat</span>
        <button class="chatClose" id="chatCloseBtn" type="button">✕</button>
      </div>
      <div id="chatMessages"></div>
      <div id="chatInputRow">
        <input id="chatInput" type="text" placeholder="Type a message..." maxlength="500" autocomplete="off" />
        <button id="chatSendBtn" type="button">Send</button>
      </div>
    `;
    document.body.appendChild(chatPanel);

    chatMessages = document.getElementById('chatMessages');
    chatInput = document.getElementById('chatInput');
    chatSendBtn = document.getElementById('chatSendBtn');
    unreadDot = document.getElementById('chatUnreadDot');

    chatToggle.addEventListener('click', toggleChat);
    document.getElementById('chatCloseBtn').addEventListener('click', closeChat);
    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });

    chatPanel.style.display = 'none';
    chatPanel.classList.remove('open');
    isOpen = false;

    updateLoginState();
    isInitialized = true;
  }

  function updateLoginState() {
    if (!chatInput || !chatSendBtn) return;
    const loggedIn = isLoggedIn();
    chatInput.disabled = !loggedIn;
    chatSendBtn.disabled = !loggedIn;
    chatInput.placeholder = loggedIn ? 'Type a message...' : 'Log in to chat';
  }

  // --- Toggle ---
  function toggleChat() {
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  function openChat() {
    if (!chatPanel) buildChatUI();
    if (isOpen) return;

    isOpen = true;
    chatPanel.style.display = 'flex';
    requestAnimationFrame(() => {
      chatPanel.classList.add('open');
    });
    if (unreadDot) unreadDot.classList.remove('show');

    // 1. Load from cache into fullMessages
    const cached = getCachedMessages();
    if (cached && cached.length) {
      fullMessages = cached.slice(); // copy
      renderMessages(fullMessages, false);
      // Set lastMessageId to the highest id in cache
      const maxId = fullMessages.reduce((max, m) => Math.max(max, Number(m.id) || 0), 0);
      if (maxId) lastMessageId = maxId;
    } else {
      fullMessages = [];
      renderMessages([], false);
      lastMessageId = 0;
    }

    // 2. Fetch fresh messages (will append new ones)
    fetchMessages(true);

    // 3. Start polling
    if (!chatPollTimer) {
      chatPollTimer = setInterval(() => fetchMessages(false), 3000);
    }

    setTimeout(() => { if (chatInput) chatInput.focus(); }, 100);
  }

  function closeChat() {
    if (!chatPanel) return;
    isOpen = false;
    chatPanel.classList.remove('open');
    setTimeout(() => {
      if (!isOpen) {
        chatPanel.style.display = 'none';
      }
    }, 200);
    if (chatPollTimer) {
      clearInterval(chatPollTimer);
      chatPollTimer = null;
    }
  }

  // --- Render messages (full list) ---
  function renderMessages(messages, forceScroll) {
    if (!chatMessages) return;
    const emptyEl = chatMessages.querySelector('.chatEmpty');
    if (emptyEl) emptyEl.remove();

    if (!messages || messages.length === 0) {
      chatMessages.innerHTML = '<div class="chatEmpty">No messages yet. Be the first!</div>';
      return;
    }

    const self = getUsername();
    chatMessages.innerHTML = '';
    messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'chatMsg';
      const isSelf = String(msg.username || '').toLowerCase() === self.toLowerCase();
      if (isSelf) div.classList.add('self');

      const time = fmtTime(msg.created_at_ms);
      const user = escapeHtml(String(msg.username || 'Unknown'));
      const body = escapeHtml(String(msg.message || ''));

      div.innerHTML = `
        <div class="msgMeta">
          <span class="msgUser">${user}</span>
          <span class="msgTime">${time}</span>
        </div>
        <div class="msgBody">${body}</div>
      `;
      chatMessages.appendChild(div);
    });

    if (forceScroll) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
      const nearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 60;
      if (nearBottom) chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  // --- Fetch new messages (append to fullMessages) ---
  async function fetchMessages(forceScroll = false) {
    if (!chatMessages) return;
    try {
      const url = `api/chat_fetch.php?since=${encodeURIComponent(String(lastMessageId))}`;
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || data.ok !== true) throw new Error(data?.error || 'Unknown error');

      const newMessages = data.messages || [];
      if (!newMessages.length) {
        // If we have no messages at all (first load), show empty state
        if (lastMessageId === 0) {
          renderMessages([], false);
        }
        return;
      }

      // Append new messages to fullMessages (avoid duplicates)
      const existingIds = new Set(fullMessages.map(m => m.id));
      for (const msg of newMessages) {
        if (!existingIds.has(msg.id)) {
          fullMessages.push(msg);
          existingIds.add(msg.id);
        }
      }

      // Sort by id (oldest first)
      fullMessages.sort((a, b) => Number(a.id) - Number(b.id));

      // Update lastMessageId to the highest id
      const maxId = fullMessages.reduce((max, m) => Math.max(max, Number(m.id) || 0), 0);
      if (maxId) lastMessageId = maxId;

      // Update cache
      updateCache();

      // Render full list
      renderMessages(fullMessages, forceScroll);

      // If chat is closed, show unread dot
      if (!isOpen && unreadDot) {
        unreadDot.classList.add('show');
      }

    } catch (err) {
      // Silently fail
    }
  }

  // --- Send message ---
  async function sendMessage() {
    if (!chatInput || !chatSendBtn) return;
    const msg = chatInput.value.trim();
    if (!msg) return;

    if (!isLoggedIn()) {
      toast('Not logged in', 'You need to be logged in to chat.');
      return;
    }

    chatSendBtn.disabled = true;
    chatInput.disabled = true;
    try {
      const payload = { message: msg };
      const res = await fetch('api/chat_send.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || data.ok !== true) throw new Error(data?.error || 'Send failed');

      chatInput.value = '';
      // Fetch new messages (will include the one we just sent)
      await fetchMessages(true);
    } catch (err) {
      toast('Send error', err.message || 'Failed to send message.');
    } finally {
      chatSendBtn.disabled = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  }

  // --- Initialisation ---
  function initGlobalChat() {
    if (isInitialized) return;
    buildChatUI();
    // Do NOT open automatically.
    console.log('Global Chat ready – click 💬 to open.');
  }

  // Expose for debugging
  window.__chat = { toggle: toggleChat, open: openChat, close: closeChat, refresh: fetchMessages };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalChat);
  } else {
    initGlobalChat();
  }

})();