/* Premium Gacha — split files + LocalStorage
   - Shop sells packs (rarity-based)
   - Inventory stores packs (counts)
   - Opening packs gives CARDS ONLY (NO GOLD)
   - Cards modal shows your owned cards
*/

const LS_KEY = "gotcha_state_v1";
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

    // If user holds ~420ms, treat as long-press and suppress browser callout.
    lpTimer = setTimeout(() => {
      if (!active) return;
      // Prevent iOS/Android context menu / callout
      try { e.preventDefault(); } catch(_){}
      // Also stop propagation so no weird "ghost clicks"
      try { e.stopPropagation(); } catch(_){}
    }, 420);
  }, { passive:false, capture:true });

  document.addEventListener("pointermove", (e) => {
    if (!active) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    // If finger moves, user is likely scrolling—don't block.
    if (dx > 10 || dy > 10) cancel();
  }, { passive:true, capture:true });

  document.addEventListener("pointerup", cancel, { passive:true, capture:true });
  document.addEventListener("pointercancel", cancel, { passive:true, capture:true });

  // Bonus: keep double-tap from zooming on some browsers while still allowing pinch-zoom on page
  // (handled primarily by CSS touch-action + tap highlight removal)
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
    };
    const hide = () => {
      wChip.classList.remove("lpShow");
      wTip.setAttribute("aria-hidden","true");
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

const RARITIES = [
  {k:"common",      w:60,  price:2000},
  {k:"rare",        w:40,  price:3500},
  {k:"epic",        w:15,  price:5000},
  {k:"mythical",    w:10,  price:7500},
  {k:"legendary",   w:3,   price:10000},
  {k:"cosmic",      w:1,   price:25000},
  {k:"interstellar",w:0.5, price:1000000}
];
const totalW = RARITIES.reduce((a,r)=>a+r.w,0);

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
    { name:"3dm4rk", img:"cards/3dm4rk.png", w:5 },
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
    { name:"Space Duelist", img:"cards/space-duelist.png", w:5 },
    { name:"Void Chronomancer", img:"cards/void-chronomancer.png", w:40 },
    { name:"Starbreaker Null King", img:"cards/start-breaker-null-king.png", w:5 },
    { name:"Astro Witch", img:"cards/astro-witch.png", w:60 }
  ],
  legendary: [
    { name:"Yrol", img:"cards/yrol.png", w:5 },
    { name:"Zukinimato", img:"cards/zukinimato1.png", w:60 },
    { name:"Abarskie", img:"cards/abarskie.png", w:5 },
    { name:"LeiRality", img:"cards/LeiRality.png", w:1 },
    { name:"621", img:"cards/621.png", w:40 },
    { name:"Alric", img:"cards/alric.png", w:8 }
  ],
  cosmic: [
    { name:"Omni", img:"cards/omni.png", w:0.7 },
    { name:"Entity", img:"cards/entity.png", w:10 },
    { name:"Awakened Monster", img:"cards/am.png", w:2 },
    { name:"Anti Matter", img:"cards/anti-matter.png", w:5 },
    { name:"Rah Bill", img:"cards/rah-bill.png", w:60 },
    { name:"Cosmo Revelation", img:"cards/cm.png", w:1 },
    { name:"Cosmic God", img:"cards/cosmic-god.png", w:30 }
  ],
  interstellar: [
    { name:"Joe", img:"cards/joe.png", w:60 },
    { name:"Meowl", img:"cards/meowl.png", w:0.2 },
    { name:"Emerald Emperor", img:"cards/ee.png", w:0.1 },
    { name:"Skwikik", img:"cards/skwikik.png", w:40 },
    { name:"Space Hen", img:"cards/spacehen.png", w:50 }
  ]
};

// === FIXED Gold per Second per Card (balanced + predictable) ===
// === FIXED Gold per Second per Card (balanced + predictable) ===
const CARD_GPS = {
  // 🟤 COMMON
  "Daysi": 11,
  "Patrick the Destroyer": 90,
  "Angelo": 12,
  "Lucky Cat": 12,
  "Space Patrol": 8,

  // 🔵 RARE
  "Baltrio": 15,
  "Nebula Gunslinger": 100,
  "Nova Empress": 17,
  "Celestial Priestess": 16,
  "Dr. Nemesis": 1000,
  "Otehnsahorse": 12,
  "Phantom Thief": 30,

  // 🟣 EPIC
  "3dm4rk": 120,
  "Tremo": 25,
  "Holly Child": 25,
  "Ey-Ji-Es": 27,
  "Stakes Staker": 30,
  "Diablo": 24,
  "Spidigong": 500,
  "Slime King": 120,

  // 🔴 MYTHICAL
  "Halaka": 30,
  "Void Samurai": 110,
  "Space Duelist": 400,
  "Void Chronomancer": 60,
  "Starbreaker Null King": 400,
  "Astro Witch": 35,

  // 🟡 LEGENDARY
  "Yrol": 400,
  "Zukinimato": 45,
  "Abarskie": 400,
  "LeiRality": 1500,

  // ✅ NEW LEGENDARY
  "621": 60,
  "Alric": 250,

  // 🌌 COSMIC
  "Omni": 5000,
  "Entity": 800,
  "Awakened Monster": 2500,
  "Anti Matter": 3500,
  "Rah Bill": 500,
  "Cosmo Revelation": 4500,
  "Cosmic God": 550,
  "The World": 1500,

  // 🌠 INTERSTELLAR
  "Joe": 200,
  "Meowl": 100000,
  "Emerald Emperor": 200000,
  "Skwikik": 250,
  "Space Hen": 150

};


// Gold-per-second multipliers by rarity (higher rarity = better gold/sec)
const RARITY_GPS_MULT = {
  common: 1,
  rare: 2,
  epic: 3,
  mythical: 4,
  legendary: 6,
  cosmic: 10,
  interstellar: 15
};

// Mutation roll table (applies to ALL opened cards, any rarity)
const MUTATIONS = [
  { k: "Normal",   chance: 0.695, mult: 1.0 },
  { k: "Silver",   chance: 0.10,  mult: 1.3 },
  { k: "Gold",     chance: 0.05,  mult: 2.0 },
  { k: "Diamond",  chance: 0.03,  mult: 3.0 },
  { k: "Rainbow",  chance: 0.01,  mult: 5.0 },
  // ✅ NEW
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
  { key:"multiverse",  name:"Multiverse",     icon:"🌌", chance:5,  special:true, mutation:"Heavenly", mult:5 },
];

const MUTATION_MULTS = {
  normal: 1.0,
  silver: 1.3,
  gold: 2.0,
  diamond: 3.0,
  rainbow: 5.0,
  neon: 8.0,
  galactic: 10.0,

  // Weather mutations
  thunder: 2.0,
  blackhole: 3.0,
  godly: 4.0,
  heavenly: 5.0,
};

const auraVarByRarity = {
  common:   "var(--common)",
  rare:     "var(--rare)",
  epic:     "var(--epic)",
  mythical: "var(--mythical)",
  legendary:"var(--legendary)",
  cosmic:   "var(--cosmic)",
  interstellar: "var(--interstellar)"
};

const invOrder = ["interstellar","cosmic","legendary","mythical","epic","rare","common"];

/* ================= STATE (persisted) ================= */
let state = loadState();
ensureDecks();
ensureTowers();
ensureWeather();
ensureNotifications();
migrateCards();
ensureDeckSlotPurchases();
ensureDeckCardLocations();
ensureDeckCardLocations();
if (!state.summoners || typeof state.summoners !== 'object') state.summoners = {selectedId:'3dm4rk', owned:['3dm4rk'], levels:{'3dm4rk':1}, nextBonusAt: Date.now()+15000, nextZenoAt: Date.now()+60000};
if (!Number.isFinite(state.summoners.nextBonusAt)) state.summoners.nextBonusAt = Date.now()+15000;

if (!Number.isFinite(state.summoners.nextZenoAt)) state.summoners.nextZenoAt = Date.now()+60000;


/* ================= DOM ================= */
const track = document.getElementById("track");
const goldEl = document.getElementById("gold");


const openGalleryBtn = document.getElementById("openGalleryBtn");
const galleryOverlay = document.getElementById("galleryOverlay");
const galleryGrid = document.getElementById("galleryGrid");
const gallerySearch = document.getElementById("gallerySearch");
const galleryEmpty = document.getElementById("galleryEmpty");
const galleryCount = document.getElementById("galleryCount");
const closeGalleryBtn = document.getElementById("closeGalleryBtn");


const heroImg = document.querySelector(".heroImg");

const openInvBtn = document.getElementById("openInvBtn");
const invBadge = document.getElementById("invBadge");
const invOverlay = document.getElementById("invOverlay");
const invModalGrid = document.getElementById("invModalGrid");
const invModalEmpty = document.getElementById("invModalEmpty");
const invTotalEl = document.getElementById("invTotal");
const invOkBtn = document.getElementById("invOkBtn");
const closeInvBtn = document.getElementById("closeInvBtn");

// How to Play (Beginner Guide)
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

// Weather System UI
const weatherWrap = document.getElementById("weatherWrap");
const weatherChip = document.getElementById("weatherChip");
const weatherIconBox = document.getElementById("weatherIconBox");
const weatherIcon = document.getElementById("weatherIcon");
const weatherTimer = document.getElementById("weatherTimer");
const weatherCountdownText = document.getElementById("weatherCountdownText");
const weatherTooltip = document.getElementById("weatherTooltip");
const weatherTicker = document.getElementById("weatherTicker");


// Notifications System UI
const openNotifBtn = document.getElementById("openNotifBtn");
const notifBadge = document.getElementById("notifBadge");
const notifOverlay = document.getElementById("notifOverlay");
const notifTabs = document.getElementById("notifTabs");
const notifContent = document.getElementById("notifContent");
const notifOkBtn = document.getElementById("notifOkBtn");
const closeNotifBtn = document.getElementById("closeNotifBtn");
const notifRewardsBadge = document.getElementById("notifRewardsBadge");

// Lucky draw result modal
const luckyResultOverlay = document.getElementById("luckyResultOverlay");
const luckyResultName = document.getElementById("luckyResultName");
const luckyResultImg = document.getElementById("luckyResultImg");
const luckyResultMeta = document.getElementById("luckyResultMeta");
const luckyResultOkBtn = document.getElementById("luckyResultOkBtn");
const closeLuckyResultBtn = document.getElementById("closeLuckyResultBtn");

// Deck picker modal
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

let deckPicking = null; // { deckKey, idx, selectedCardId }

// Mutation Machine modals
const mmSelectOverlay = document.getElementById("mmSelectOverlay");
const closeMmSelectBtn = document.getElementById("closeMmSelectBtn");
const mmPickGrid = document.getElementById("mmPickGrid");
const mmPickEmpty = document.getElementById("mmPickEmpty");
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

let mmPicking = null; // { selectedCardId }

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

// Inventory tabs (Packs / Pets)
const invTabs = document.getElementById("invTabs");
const invPanelPacks = document.getElementById("invPanelPacks");
const invPanelPets = document.getElementById("invPanelPets");
const invPacksBadge = document.getElementById("invPacksBadge");
const invPetsBadge = document.getElementById("invPetsBadge");

const invPanelCards = document.getElementById("invPanelCards");
const invCardsBadge = document.getElementById("invCardsBadge");
// Pets live inside Inventory now
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
;

const rewardsOverlay = document.getElementById("rewardsOverlay");
const rewardGrid = document.getElementById("rewardGrid");
const rewardsOkBtn = document.getElementById("rewardsOkBtn");
const closeRewardsBtn = document.getElementById("closeRewardsBtn");

const toasts = document.getElementById("toasts");


/* ===============================
   MOBILE ROTATE OVERLAY
   - Shows a full-screen message when on a mobile device in portrait orientation
   =============================== */
const rotateOverlay = document.getElementById("rotateOverlay");

function isMobileLike(){
  // Prefer capability detection over UA sniffing
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) <= 820;
  return coarse && smallScreen;
}

function isPortrait(){
  // Works even when screen.orientation isn't available
  return window.innerHeight > window.innerWidth;
}

function updateRotateOverlay(){
  if (!rotateOverlay) return;
  const shouldShow = isMobileLike() && isPortrait();
  rotateOverlay.classList.toggle("show", shouldShow);
  rotateOverlay.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  document.body.classList.toggle("rotateLock", shouldShow);
}

function setupRotateOverlay(){
  updateRotateOverlay();
  window.addEventListener("resize", updateRotateOverlay, { passive:true });
  window.addEventListener("orientationchange", updateRotateOverlay, { passive:true });
  document.addEventListener("visibilitychange", updateRotateOverlay, { passive:true });

  // Some browsers expose screen.orientation change events
  try{
    if (screen.orientation && typeof screen.orientation.addEventListener === "function"){
      screen.orientation.addEventListener("change", updateRotateOverlay);
    }
  }catch(_){}
}
setupRotateOverlay();

/* ================= SHOP SCROLLER ================= */
let stock = [];
let x = 0;
const speed = 120;
let lastTime = performance.now();

function fmt(n){ return n.toLocaleString("en-US"); }


function titleCase(str){
  str = String(str||"");
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}



function updateGoldUI(){
  if (!goldEl) return;
  goldEl.textContent = fmt(state.gold);

  // Premium "pop" when gold changes (subtle, not annoying)
  goldEl.classList.remove("goldPulse");
  // Restart CSS animation reliably
  void goldEl.offsetWidth;
  goldEl.classList.add("goldPulse");
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
/*
  IMPORTANT DESIGN (progression + active effects)
  - Progression (permanent): owning summoners unlocks *permission* to buy more deck slots.
    Purchased slots stay unlocked forever, even if you switch summoners.
  - Active effects (temporary): ONLY the currently selected summoner provides bonus gold / tower cap / pets limit.
*/

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
  // fallback to first owned or main
  return owned[0] || "3dm4rk";
}

function getSummonerTier(){
  // Tier for ACTIVE effects
  return summonerTierOfId(getActiveSummonerId());
}

function getProgressionTier(){
  // Highest owned tier (progression gate)
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
  // Active effects by tier (SPEC)
  // 1: 3dm4rk -> 1 pet
  // 2: Nova   -> 2 pets
  // 3: Ember  -> 3 pets
  // 4: Aegis  -> 4 pets
  // 5: Void   -> 5 pets
  // 6: Zioti  -> 6 pets
  if (tier >= 6) return 6;
  if (tier >= 5) return 5;
  if (tier >= 4) return 4;
  if (tier >= 3) return 3;
  if (tier >= 2) return 2;
  return 1;
}
function towerMultiplierForTier(tier){
  if (tier >= 5) return 2.5;   // Void (optional spice)
  if (tier >= 3) return 2.0;   // Ember/Aegis
  if (tier >= 2) return 1.5;   // Nova
  return 1.0;
}
function towerCapForTier(tier){
  // Tower storage cap by tier (IMPORTANT: this should NOT cap the player's main gold)
  // Zeno: tower cap 1,000,000
  if (tier >= 7) return 1000000; // Zeno (SPEC)
  // Zioti SPEC: 200,000 cap
  if (tier >= 6) return 200000; // Zioti (SPEC)
  // Existing progression caps
  if (tier >= 5) return 200000; // Void
  if (tier >= 4) return 150000; // Aegis
  if (tier >= 3) return 100000; // Ember
  if (tier >= 2) return 50000;  // Nova
  return 20000;                 // 3dm4rk
}
function bonusGoldPer15sForTier(tier){
  // Active bonus by tier
  // Zeno SPEC: uses a separate 1-minute RNG bonus (no fixed 15s bonus)
  if (tier >= 7) return 0;
  // Zioti SPEC: +1,500 gold every 15 seconds
  if (tier >= 6) return 1500; // Zioti (SPEC)
  // Keep existing balance for earlier summoners
  if (tier >= 5) return 2000; // Void
  if (tier >= 4) return 1000; // Aegis
  if (tier >= 3) return 1000; // Ember
  if (tier >= 2) return 500;  // Nova
  return 0;
}

function onActiveSummonerChanged(){
  // Reset bonus timers so previous summoner effects don't linger
  if (state?.summoners){
    state.summoners.nextBonusAt = Date.now() + 15000;
    state.summoners.nextZenoAt = Date.now() + 60000;
  }

  // Enforce tower cap immediately (do NOT cap main gold)
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
    // UPDATED: Ember -> Aegis now requires EPIC (not Mythical)
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
  // rarest = smallest pull weight/chance (w)
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

  // Card requirements
  if (lv === 1){
    if (!ownsRarestCardOfRarity("common")) return { ok:false, reason:"Need the rarest Common card." };
  } else if (lv === 2){
    if (!ownsRarestCardOfRarity("rare")) return { ok:false, reason:"Need the rarest Rare card." };
  } else if (lv === 3){
    // UPDATED: Ember -> Aegis uses Epic
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


// === Deck B slot costs (edit anytime) ===
// SPEC: Deck B slots are NEVER free. Unlocking a summoner only grants permission to BUY these slots.
// Index 0 = Slot 1, ... Index 8 = Slot 9
const DECK_B_SLOT_COSTS = [
  5000, 5000, 5000, // B1–3 (Aegis permission)
  5000, 5000, 5000, // B4–6 (Void permission)
  15000,15000,15000 // B7–9 (Zioti permission)
];

function ensureDeckSlotPurchases(){
  if (!state.deckSlotPurchases || typeof state.deckSlotPurchases !== "object"){
    state.deckSlotPurchases = { A: Array(9).fill(false), B: Array(9).fill(false) };
  }
  if (!Array.isArray(state.deckSlotPurchases.A)) state.deckSlotPurchases.A = Array(9).fill(false);
  if (!Array.isArray(state.deckSlotPurchases.B)) state.deckSlotPurchases.B = Array(9).fill(false);
  if (state.deckSlotPurchases.A.length !== 9) state.deckSlotPurchases.A = Array(9).fill(false).map((_,i)=>!!state.deckSlotPurchases.A[i]);
  if (state.deckSlotPurchases.B.length !== 9) state.deckSlotPurchases.B = Array(9).fill(false).map((_,i)=>!!state.deckSlotPurchases.B[i]);

  // Deck A slots 1–3 are always free/unlocked
  for (let i=0;i<3;i++){
    state.deckSlotPurchases.A[i] = true;
  }

  // Deck B slots are NEVER free in this ruleset.
  // Owning Aegis/Void/Zioti only makes certain Deck B slots *purchasable* (handled in getDeckSlotStatus).
}


function getDeckSlotStatus(deckKey, idx){
  ensureDeckSlotPurchases();
  ensureDeckCardLocations();

  const purchased = !!state.deckSlotPurchases?.[deckKey]?.[idx];
  const progTier = getProgressionTier();

  // Deck A: Slots 1–3 always free
  if (deckKey === "A"){
    if (idx <= 2) return { status:"unlocked", purchased:true, price:0 };

    // Slots 4–6: unlockable once NOVA is owned; 5,000g each
    if (idx >= 3 && idx <= 5){
      if (progTier < 2) return { status:"locked", purchased:false, price:5000, reason:"Requires Nova" };
      if (purchased) return { status:"unlocked", purchased:true, price:0 };
      return { status:"purchasable", purchased:false, price:5000 };
    }

    // Slots 7–9: unlockable once EMBER is owned; 15,000g each
    if (idx >= 6 && idx <= 8){
      if (progTier < 3) return { status:"locked", purchased:false, price:15000, reason:"Requires Ember" };
      if (purchased) return { status:"unlocked", purchased:true, price:0 };
      return { status:"purchasable", purchased:false, price:15000 };
    }
  }

  // Deck B: gated by summoners, PURCHASE-ONLY (SPEC)
  if (deckKey === "B"){
    // Entire Deck B is unavailable until Aegis is owned
    if (progTier < 4){
      return { status:"locked", purchased:false, price:0, reason:"Requires Aegis" };
    }

    // Slots 1–3: purchasable once Aegis is owned
    if (idx >= 0 && idx <= 2){
      const price = DECK_B_SLOT_COSTS[idx] || 0;
      if (purchased) return { status:"unlocked", purchased:true, price:0 };
      return { status:"purchasable", purchased:false, price };
    }

    // Slots 4–6: purchasable once Void is owned
    if (idx >= 3 && idx <= 5){
      const price = DECK_B_SLOT_COSTS[idx] || 0;
      if (progTier < 5) return { status:"locked", purchased:false, price, reason:"Requires Void" };
      if (purchased) return { status:"unlocked", purchased:true, price:0 };
      return { status:"purchasable", purchased:false, price };
    }

    // Slots 7–9: purchasable once Zioti is owned
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

  // Purchase SFX (dedicated)
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
function toast(title, msg){
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<b>${title}</b><div class="tSmall">${msg}</div>`;
  toasts.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(6px)"; }, 2600);
  setTimeout(()=>{ el.remove(); }, 3100);
}

function showGoldPop(amount, anchorEl){
  // amount: number, will show +X gold popup
  try{
    const pop = document.createElement("div");
    pop.className = "goldPop";
    pop.textContent = `+${fmt(Math.floor(amount))} gold`;

    // Default anchor near Towers; fallback top-center
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

    // trigger animation
    requestAnimationFrame(()=> pop.classList.add("show"));
    setTimeout(()=>{ pop.classList.remove("show"); pop.classList.add("hide"); }, 700);
    setTimeout(()=>{ pop.remove(); }, 1200);
  }catch(_){}
}


/* ================= LocalStorage ================= */
function defaultState(){
  return {
    gold: 20000,
    invCounts: { common:0, rare:0, epic:0, mythical:0, legendary:0, cosmic:0, interstellar:0 },
    cardsOwned: [], // [{name,img}]
  cardsInDeck: [], // cards currently placed in decks (not shown in inventory)
    petsOwned: [], // [{id,name,img,price,boughtAt}]
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
    }
    ,
    weather: {
      currentKey: "normal",
      active: false,
      endsAt: 0,
      nextEventAt: Date.now() + WEATHER_EVENT_INTERVAL_MS,
      nextStrikeAt: 0,
      strikesDone: 0,
      // After a special weather ends, show a "Next weather" hint every 1 minute
      nextAnnounceAt: 0,
      nextPreviewKey: null
    },

    // Notifications (missions + lucky draw tickets)
    // IMPORTANT: claimed missions must persist across refreshes
    notifications: {
      tickets: 0,
      claimed: {}
    }

  };
}
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const s = defaultState();
    // merge
    s.gold = Number.isFinite(parsed.gold) ? parsed.gold : s.gold;
    s.invCounts = {...s.invCounts, ...(parsed.invCounts||{})};
    s.cardsOwned = Array.isArray(parsed.cardsOwned) ? parsed.cardsOwned : [];
  s.cardsInDeck = Array.isArray(parsed.cardsInDeck) ? parsed.cardsInDeck : [];

    // Notifications (missions claimed + lucky draw tickets) must persist across refreshes
    if (parsed.notifications && typeof parsed.notifications === "object"){
      const pn = parsed.notifications;
      const pt = Number(pn.tickets);
      const pc = (pn.claimed && typeof pn.claimed === "object") ? pn.claimed : {};
      s.notifications = {
        tickets: Number.isFinite(pt) ? pt : (s.notifications?.tickets||0),
        claimed: pc
      };
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
    

// decks
if (parsed.decks && typeof parsed.decks === "object"){
  if (Array.isArray(parsed.decks.A)) s.decks.A = parsed.decks.A;
  if (Array.isArray(parsed.decks.B)) s.decks.B = parsed.decks.B;
}

// deck slot purchases (persist unlocks so you only pay once)
if (parsed.deckSlotPurchases && typeof parsed.deckSlotPurchases === "object"){
  const a = Array.isArray(parsed.deckSlotPurchases.A) ? parsed.deckSlotPurchases.A : [];
  const b = Array.isArray(parsed.deckSlotPurchases.B) ? parsed.deckSlotPurchases.B : [];
  s.deckSlotPurchases = {
    A: Array(9).fill(false).map((_,i)=> !!a[i]),
    B: Array(9).fill(false).map((_,i)=> !!b[i])
  };
}

// Normalize purchases for safety (keeps slot unlocks permanent)
try{
  if (!s.deckSlotPurchases || typeof s.deckSlotPurchases !== "object"){
    s.deckSlotPurchases = { A: Array(9).fill(false), B: Array(9).fill(false) };
  }
  if (!Array.isArray(s.deckSlotPurchases.A)) s.deckSlotPurchases.A = Array(9).fill(false);
  if (!Array.isArray(s.deckSlotPurchases.B)) s.deckSlotPurchases.B = Array(9).fill(false);
  if (s.deckSlotPurchases.A.length !== 9) s.deckSlotPurchases.A = Array(9).fill(false).map((_,i)=>!!s.deckSlotPurchases.A[i]);
  if (s.deckSlotPurchases.B.length !== 9) s.deckSlotPurchases.B = Array(9).fill(false).map((_,i)=>!!s.deckSlotPurchases.B[i]);
  // Deck A slots 1-3 are always free/unlocked
  for (let i=0;i<3;i++) s.deckSlotPurchases.A[i] = true;
    // Deck B slots are NEVER free in this ruleset. No auto-unlock here.

}catch(_){}

	// notifications (persist mission claims + lucky draw tickets)
	try{
	  const pn = parsed.notifications || {};
	  const claimed = (pn.claimed && typeof pn.claimed === "object") ? pn.claimed : {};
	  s.notifications = {
	    tickets: Number(pn.tickets)||0,
	    claimed: { ...claimed }
	  };
	}catch(_){
	  // fall back to defaults
	  s.notifications = s.notifications || { tickets: 0, claimed: {} };
	}

return s;
  }catch{
    return defaultState();
  }
}
function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
window.resetGotcha = function(){
  localStorage.removeItem(LS_KEY);
  state = defaultState();
  syncUI();
  toast("Reset", "LocalStorage cleared.");
};

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
  // Base: pull chance itself
  let base = pc;

  // x100 only for 1%–10% pull chance
  if (pc >= 1 && pc <= 10) base *= 100;

  return base;
}


function normMutKey(k){
  return String(k||"").trim().toLowerCase();
}
function titleMutKey(k){
  const s = String(k||"").trim();
  if (!s) return "Normal";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function getMutationList(card){
  if (!card || typeof card !== "object") return [];
  let list = Array.isArray(card.mutations) ? card.mutations.slice() : [];

  // Back-compat: older saves used card.mutation = {k,mult}
  const legacy = card?.mutation?.k;
  if (legacy && normMutKey(legacy) !== "normal"){
    list.push(titleMutKey(legacy));
  }

  // Normalize + de-dupe
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
  // Clear both the modern stacked list and legacy single-mutation field
  card.mutations = [];
  if (card.mutation && typeof card.mutation === "object") delete card.mutation;
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
  // Pick ONE mutation for the premium edge glow (strongest first)
  const muts = getMutationList(card).map(normMutKey);
  const priority = ["heavenly","godly","blackhole","thunder","galactic","neon","rainbow","diamond","gold","silver"];
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

  // Keep legacy field in sync so older UI code stays safe
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
  if (!el || !card) return;

  const mk = primaryGlowKey(card);
  if (mk === "normal") return;

  el.classList.add("mutGlow", `mut-${mk}`);

  // Intensity differences by mutation (strong but not annoying)
  if (mk === "silver") el.style.setProperty("--mut-glow", "0.55");
  else if (mk === "gold") el.style.setProperty("--mut-glow", "0.70");
  else if (mk === "diamond") el.style.setProperty("--mut-glow", "0.78");
  else if (mk === "rainbow") el.style.setProperty("--mut-glow", "0.90");
  else if (mk === "neon") el.style.setProperty("--mut-glow", "0.98");
  else if (mk === "galactic") el.style.setProperty("--mut-glow", "1.10");
  else if (mk === "thunder") el.style.setProperty("--mut-glow", "0.98");
  else if (mk === "blackhole") el.style.setProperty("--mut-glow", "1.05");
  else if (mk === "godly") el.style.setProperty("--mut-glow", "1.10");
  else el.style.setProperty("--mut-glow", "1.18"); // heavenly
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
  // Ensure every card has: id, rarity, pullChance, mutations[], baseGps, gps, location, fav
  if (!Array.isArray(state.cardsOwned)) state.cardsOwned = [];
  state.cardsOwned = state.cardsOwned.map(c=>{
    const cc = (c && typeof c === "object") ? {...c} : { name:"Unknown", img:"card.png", w:1 };

    if (!cc.id) cc.id = uid();
    if (!cc.rarity) cc.rarity = findRarityByName(cc.name);

    // Standardize pullChance field (use w if missing)
    if (!Number.isFinite(cc.pullChance)) cc.pullChance = Number(cc.w) || 0;

    // Normalize + migrate mutations (stackable)
    const muts = getMutationList(cc); // handles legacy cc.mutation too
    cc.mutations = muts;

    // Base gps is stable per card name (from your fixed table)
    cc.baseGps = Number(CARD_GPS[cc.name]) || Number(cc.baseGps) || 0;

    if (!cc.location) cc.location = "inventory";
    if (typeof cc.fav !== "boolean") cc.fav = false;

    recomputeCardStats(cc);
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
  // Ensure correct length
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

  // Sanitize types
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

  // Mutation Machine (persisted)
  if (!state.notifications.mutationMachine || typeof state.notifications.mutationMachine !== "object"){
    state.notifications.mutationMachine = {
      cardId: null,
      startAt: 0,
      endAt: 0,
      status: "idle",     // idle | running | done
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
  // default everything to inventory unless explicitly in a deck slot
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
    const parts = c.location.split(":"); // deck:A:0
    if (parts.length !== 3){ c.location = "inventory"; return; }
    const dk = parts[1];
    const i = Number(parts[2]);
    if (!state.decks?.[dk] || state.decks[dk][i] !== c.id) c.location = "inventory";
  });
}


function removeCardEverywhere(cardId){
  if (!cardId) return false;

  // Remove from any deck slot references (safety)
  ensureDecks();
  state.decks.A = (state.decks.A||[]).map(id => id === cardId ? null : id);
  state.decks.B = (state.decks.B||[]).map(id => id === cardId ? null : id);

  // Remove from collection (location system keeps deck cards inside cardsOwned)
  state.cardsOwned = (state.cardsOwned||[]).filter(c => c && c.id !== cardId);

  // Legacy container safety (if present in old saves)
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

      // Deck B hard-locked until Aegis is owned
      if (deckKey === "B" && progTier < 4) continue;

      // Slot must be purchased/unlocked to count
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

let dcaCtx = null; // {deckKey, idx, cardId}

function closeDeckCardActions(){
  if (!dca) return;
  dca.classList.add("hidden");
  dca.setAttribute("aria-hidden","true");
  dcaCtx = null;
}

function computeSellGold(card){
  // Sell gold = base value * total multiplier
  const gps = Number(card?.gps) || 0;
  const mult = Number(getTotalMutationMult(card)) || 1;
  const base = Math.max(1, Math.round(gps / mult));
  return Math.max(1, Math.round(base * mult));
}
/* ================= Deck Card Inline Overlay (on-card details + actions) ================= */
// Replaces the old right-side actions panel UX: clicking a deck card toggles an on-card overlay.
let deckInlineCtx = null; // { deckKey, idx }

function isDeckInlineSelected(deckKey, idx){
  return !!deckInlineCtx && deckInlineCtx.deckKey === deckKey && deckInlineCtx.idx === idx;
}
function setDeckInlineSelected(deckKey, idx){
  deckInlineCtx = { deckKey, idx };
  // Keep legacy panel closed (if still present in DOM)
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
      <div><b>Gold/sec:</b> ${gps}</div>
      <div style="opacity:.85;margin-top:8px"><b>Sell value:</b> ${sellGold} gold</div>
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

  const sellGold = computeSellGold(card);
  state.gold += sellGold;

  // Remove from decks (both)
  state.decks.A = state.decks.A.map(id => id === card.id ? null : id);
  state.decks.B = state.decks.B.map(id => id === card.id ? null : id);

  // Remove from collection
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
  if (rateEl) rateEl.textContent = String(rate);

  const stored = Math.floor(state.towers?.stored || 0);
  const storedEl = document.getElementById("towersStored");
  if (storedEl) storedEl.textContent = String(stored);

  const capEl = document.getElementById("towersCap");
  if (capEl) capEl.textContent = String(cap);

  // Tower percent (1–100%)
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

// Touch devices don't have hover. We'll use a fast long-press (hold) to reveal hover info on mobile only.

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
  hideCardTooltip();
}

// Bind a mobile-only long-press gesture to show the same info that appears on hover.
// - Responsive: triggers around ~280ms
// - Intuitive: shows while holding; disappears on release/cancel
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

  el.addEventListener("pointerdown", (e)=>{
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

  el.addEventListener("pointermove", (e)=>{
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
  el.addEventListener("pointerup", end, { passive:true });
  el.addEventListener("pointercancel", end, { passive:true });
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

  el.addEventListener("pointerdown", (e)=>{
    if (e.pointerType !== "touch") return;
    clear();
    active = true;
    triggered = false;
    startX = e.clientX; startY = e.clientY;

    // Fast long-press (feels snappy, avoids accidental triggers while scrolling)
    lpTimer = setTimeout(()=>{
      if (!active) return;
      triggered = true;
      tooltipPinned = true;

      const html = (typeof getHtml === "function") ? getHtml() : "";
      showTooltipHtml(html, e.clientX, e.clientY);

      // Prevent browser callout/context menu and avoid "ghost click"
      try { e.preventDefault(); } catch(_){}
      try { e.stopPropagation(); } catch(_){}
    }, 280);
  }, { passive:false });

  el.addEventListener("pointermove", (e)=>{
    if (!active) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    // If user is scrolling, cancel the long-press.
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
  el.addEventListener("pointerup", end, { passive:true });
  el.addEventListener("pointercancel", end, { passive:true });
}

function formatCardDetails(card){
  if (!card) return "";
  const name = escapeHtml(card.name || "Unknown");
  const rarity = escapeHtml((card.rarity || "common").toUpperCase());
  const mutation = escapeHtml(mutationLabel(card));
  const gps = Number(card.gps) || 0;
  return `
    <div class="ttName">${name}</div>
    <div class="ttRow"><span class="ttBadge">${rarity}</span><span class="ttBadge">${mutation}</span></div>
    <div class="ttRow">Gold/sec: <b>${gps}</b></div>
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
  el.addEventListener("mouseenter", (e)=> showTooltipHtml(formatSummonerTooltip(), e.clientX, e.clientY));
  el.addEventListener("mousemove", (e)=> showTooltipHtml(formatSummonerTooltip(), e.clientX, e.clientY));
  el.addEventListener("mouseleave", hideCardTooltip);
  bindLongPressTooltip(el, ()=>formatSummonerTooltip());
}

function hideCardTooltip(){
  if (!tooltipEl) return;
  tooltipEl.classList.remove("show");
  tooltipEl.setAttribute("aria-hidden","true");
}

function bindTooltip(el, getCard){
  if (!el) return;
  el.addEventListener("mouseenter", (e)=>{
    const c = getCard();
    if (!c) return;
    showCardTooltip(c, e.clientX, e.clientY);
  });
  el.addEventListener("mousemove", (e)=>{
    const c = getCard();
    if (!c) return;
    showCardTooltip(c, e.clientX, e.clientY);
  });
  el.addEventListener("mouseleave", ()=>{
    hideCardTooltip();
  });

  bindLongPressTooltip(el, ()=>{
    const c = getCard();
    return c ? formatCardDetails(c) : "";
  });
}


function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

/* ================= RNG helpers ================= */
function pickRarity(){
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
  const pool = CARD_REWARDS[rarity] || [];
  const mut = rollMutation();

  const mk = normMutKey(mut.k);
  const muts = (mk && mk !== "normal") ? [titleMutKey(mut.k)] : [];

  if (!pool.length){
    const fallback = {
      id: uid(),
      rarity,
      name:"Unknown",
      img:"card.png",
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
    img: base.img || "card.png",
    // "w" is treated as pull chance percentage (matches your earlier balance logic)
    pullChance: Number(base.w) || 0,
    w: Number(base.w) || 0,
    baseGps: Number(CARD_GPS[base.name]) || 0,
    mutations: muts,
    location: "inventory",
    fav: false
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

  el.addEventListener("click", ()=>{
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

    

    // Purchase SFX (dedicated)
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

    // Animated mutation glow (Silver → Rainbow only)
    applyMutationGlow(tile, c);

    const img = document.createElement("img");
    img.loading = "eager";
    img.decoding = "async";
    img.alt = c?.name || "Card";
    img.src = c?.img || "card.png";
    img.onerror = ()=>{ img.src = "card.png"; };

    tile.appendChild(img);

    // Hover: show card details (name, rarity, mutation, gold/sec)
    bindTooltip(tile, ()=>c);

    rewardGrid.appendChild(tile);
  });
}

function openPacks(rarity, count){
  const have = state.invCounts[rarity] || 0;
  if (have <= 0) return;

  // Card opening SFX (dedicated)
  playCardOpeningSFX();

  // Close inventory so rewards is always on top (no "hidden behind" bug)
  closeInventory();

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

  // Remove packs only (NO GOLD REWARD)
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

  // Old header badge (may not exist anymore)
  if (cardsBadge){
    cardsBadge.textContent = String(n);
    cardsBadge.style.display = n > 0 ? "inline-flex" : "none";
  }

  // New Inventory → Cards tab badge
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

function renderCardsModal(){
  ensureDeckCardLocations();

  const q = (cardsSearchInput?.value || "").trim().toLowerCase();

  // Inventory view: show ONLY cards currently in inventory (cardsOwned)
  let available = getInventoryCards();
  if (q){
    available = available.filter(c => String(c?.name||"").toLowerCase().includes(q));
  }

  cardsGrid.innerHTML = "";
  updateCardsModalCounts();

  if (!available.length){
    cardsEmpty.style.display = "block";
    return;
  }
  cardsEmpty.style.display = "none";

  // One-time delegated handler (prevents "sometimes doesn't work" issues when the grid re-renders)
  if (!cardsGrid._delegatedCardsModal){
    cardsGrid._delegatedCardsModal = true;

    const onActivate = (evt)=>{
      // Heart toggle
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

      // Sell card (click tile)
      const tile = evt.target?.closest?.(".cardThumb");
      if (!tile || !cardsGrid.contains(tile)) return;

      const id = tile.getAttribute("data-card-id");
      const card = getCardById(id);
      if (!card) return;

      const sellGold = computeSellGold(card);
      const warn = card.fav ? "\n\nThis card is favorited (hearted). Selling it will remove it anyway." : "";
      const ok = confirm(`Sell ${card?.name||"this card"} for ${sellGold} gold?${warn}`);
      if (!ok) return;

      removeCardEverywhere(card.id);
      state.gold = (Number(state.gold)||0) + sellGold;
      saveState();
      syncUI();
      renderCardsModal();
      buildSlots();
      updateTowersUI();
    };

    cardsGrid.addEventListener("click", onActivate);

    // Keyboard support: Enter/Space triggers click for accessibility
    cardsGrid.addEventListener("keydown", (evt)=>{
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
    img.src = c?.img || "card.png";
    img.onerror = ()=>{ img.src = "card.png"; };
    d.appendChild(img);

    // Favorite (heart) — top right
    const fav = document.createElement("div");
    fav.className = "cardFavBtn" + (c.fav ? " isOn" : "");
    fav.setAttribute("role","button");
    fav.setAttribute("tabindex","0");
    fav.setAttribute("data-action","fav");
    fav.setAttribute("data-card-id", c.id);
    fav.setAttribute("aria-label", c.fav ? "Unfavorite" : "Favorite");
    fav.textContent = c.fav ? "❤" : "♡";
    d.appendChild(fav);

    bindTooltip(d, ()=>getCardById(c.id) || c);

    cardsGrid.appendChild(d);
  });
}



function openDeckPicker(deckKey, idx){
  ensureDecks();
  migrateCards();

  deckPicking = { deckKey, idx, selectedCardId: null };

  if (deckHint){
    deckHint.textContent = `Choose a card for Deck ${deckKey} • Slot ${idx+1}`;
  }

  renderDeckPicker();
  deckOverlay.classList.add("show");
  deckOverlay.setAttribute("aria-hidden","false");
}

function closeDeckPicker(){
  deckOverlay.classList.remove("show");
  deckOverlay.setAttribute("aria-hidden","true");
  deckPicking = null;
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
  const pool = getInventoryCards().filter(c=>c && !used.has(c.id));

  pool.forEach(c=>{
    const item = document.createElement("div");
    item.className = "deckPickItem";
    item.dataset.id = c.id;

    applyMutationGlow(item, c);

    const img = document.createElement("img");
    img.src = c.img || "card.png";
    img.onerror = ()=>{ img.src = "card.png"; };

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

    item.addEventListener("click", ()=>{
      document.querySelectorAll(".deckPickItem.sel").forEach(n=>n.classList.remove("sel"));
      item.classList.add("sel");
      deckPicking.selectedCardId = c.id;
      deckSelectBtn.disabled = false;
      setDeckDetails(c);
    });

    deckPickGrid.appendChild(item);
  });

  // Preselect currently assigned card if any
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
  if (!card){
    deckDetailsImg.src = "card.png";
    deckDetailsName.textContent = "—";
    deckDetailsRarity.textContent = "—";
    deckDetailsChance.textContent = "—";
    deckDetailsMutation.textContent = "—";
    deckDetailsGps.textContent = "—";
    return;
  }
  deckDetailsImg.src = card.img || "card.png";
  deckDetailsName.textContent = card.name || "Unknown";
  deckDetailsRarity.textContent = (card.rarity || "common").toUpperCase();
  deckDetailsChance.textContent = `${Number(card.pullChance ?? card.w ?? 0)}%`;
  deckDetailsMutation.textContent = mutationLabel(card);
  deckDetailsGps.textContent = `${Number(card.gps)||0} / sec`;
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

  // Render content for the active panel
  if (t === "packs") renderInventory();
  else if (t === "pets") renderPets();
  else renderCardsModal();

  // keep badges up to date
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
  // Default tab
  setInventoryTab(state.ui?.invTab || "packs");
  invOverlay.classList.add("show");
  invOverlay.setAttribute("aria-hidden","false");
  setTimeout(()=> invTabs?.querySelector?.(".invTab.isActive")?.focus?.(), 0);
}
function closeInventory(){
  if (!invOverlay) return;
  // remember tab
  const active = invTabs?.querySelector?.(".invTab.isActive");
  const tab = active?.dataset?.tab;
  if (tab){
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.invTab = tab;
    saveState(state);
  }

  invOverlay.classList.remove("show");
  invOverlay.setAttribute("aria-hidden","true");
}
function openRewards(){
  rewardsOverlay.classList.add("show");
  rewardsOverlay.setAttribute("aria-hidden","false");
}
function closeRewards(){
  rewardsOverlay.classList.remove("show");
  rewardsOverlay.setAttribute("aria-hidden","true");
  opening = null;
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
}

function openLuckyResultModal(){
  luckyResultOverlay.classList.add("show");
  luckyResultOverlay.setAttribute("aria-hidden","false");
}
function closeLuckyResultModal(){
  luckyResultOverlay.classList.remove("show");
  luckyResultOverlay.setAttribute("aria-hidden","true");
}

function openCards(){
  // Cards are now inside the Inventory modal (tab: Cards)
  if (invOverlay){
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.invTab = "cards";
    saveState(state);
    openInventory();
    return;
  }

  // Fallback (if Inventory modal isn't present)
  renderCardsModal();
  if (cardsOverlay){
    cardsOverlay.classList.add("show");
    cardsOverlay.setAttribute("aria-hidden","false");
  }
}
function closeCards(){
  // Close Inventory if it's open
  if (invOverlay && invOverlay.classList.contains("show")){
    closeInventory();
    return;
  }
  // Fallback to old overlay if it exists
  if (cardsOverlay){
    cardsOverlay.classList.remove("show");
    cardsOverlay.setAttribute("aria-hidden","true");
  }
}
/* ================= Animation loop ================= */
function loop(now){
  const dt = Math.min(0.05, (now - lastTime)/1000);
  lastTime = now;

  x -= speed * dt;

  const cardW = 210;
  const gap = 22;
  const step = cardW + gap;
  const w = stock.length * step;

  if (x <= -w) x += w;
  track.style.transform = `translate3d(${x}px,-50%,0)`;

  requestAnimationFrame(loop);
}

/* ================= Deck slots ================= */
function buildSlots(){
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
        img.src = c.img || "card.png";
        img.onerror = ()=>{ img.src = "card.png"; };
        const badge = document.createElement("div");
        badge.className = "slotBadge";
        badge.textContent = `${c.gps}/s`;
        s.appendChild(img);
        s.appendChild(badge);

// Inline overlay (click-to-toggle) for details + actions
if (isDeckInlineSelected(deckKey, idx)){
  s.classList.add("selected");
  const ov = document.createElement("div");
  ov.className = "slotOverlay";
  const rarity = (c.rarity || "common").toUpperCase();
  const mut = mutationLabel(c);
  const gps = Number(c.gps)||0;
  const sellGold = computeSellGold(c);

  ov.innerHTML = `
    <div class="slotOverlayTop">
      <div class="slotOverlayName">${escapeHtml(c.name || "Card")}</div>
      <div class="slotOverlayBadges">
        <span class="pillMini">${escapeHtml(rarity)}</span>
        <span class="pillMini">${escapeHtml(mut)}</span>
      </div>
    </div>
    <div class="slotOverlayLine">Gold/sec: <b>${gps}</b></div>
    <div class="slotOverlayBtns">
      <button class="slotBtn" type="button" data-act="keep">Keep</button>
      <button class="slotBtn danger" type="button" data-act="sell">Sell • ${sellGold}g</button>
    </div>
  `;

  // Prevent slot click toggle when clicking inside overlay
  ov.addEventListener("click", (e)=> e.stopPropagation());

  // Button actions
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

    // Remove from decks (both)
    state.decks.A = state.decks.A.map(x => x === cardNow.id ? null : x);
    state.decks.B = state.decks.B.map(x => x === cardNow.id ? null : x);

    // Remove from collection
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

    // Hover details for assigned card
    if (assignedId){
      const cardForTip = getCardById(assignedId);
      if (cardForTip) bindTooltip(s, ()=>cardForTip);
    }
    // Slot locking / purchasing based on Summoner tier
    if (!assignedId){
      if (slotInfo.status === "locked"){
        s.classList.add("locked");
        s.innerHTML = `<div class="slotLock">LOCKED</div>`;
      } else if (slotInfo.status === "purchasable"){
        s.classList.add("purchasable");
        s.innerHTML = `<div class="slotUnlock">UNLOCK<br><span>${fmt(slotInfo.price)}g</span></div>`;
      }
    }

    s.addEventListener("click", ()=>{
      if (s.classList.contains("locked")) return;
      if (s.classList.contains("purchasable")){ clearDeckInlineSelected(); purchaseDeckSlot(deckKey, idx); return; }

const currentId = state.decks?.[deckKey]?.[idx] || null;
if (currentId){
  // Toggle on-card overlay instead of opening a modal/panel
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
    const src = s.heroImg || s.img || "card.png";
    heroImg.src = src;
    heroImg.alt = s.name || "Summoner";
    heroImg.style.display = "";
  }
}

function syncUI(){
  updateGoldUI();
  renderInventory();
  updateCardsBadge();  updatePetsBadge();
  updateTowersUI();
  buildSlots();
  syncSummonerHeroUI();
  updateWeatherUI();
  updateNotificationsBadges();
}


/* ================= Notifications System ================= */

// ---- Mission helper utils (for new beginner/mid/hardcore missions) ----
const RARITY_ORDER = ["common","rare","epic","mythical","legendary","cosmic","interstellar"];
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
      // ignore legacy/normal-only
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

  // Tickets
  if (typeof reward === "number"){
    const add = Number(reward)||0;
    state.notifications.tickets = Number(state.notifications.tickets)||0;
    state.notifications.tickets += add;
    return `+${add} Lucky Draw ticket${add===1?"":"s"}.`;
  }

  // Structured rewards
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
      if (!state.invCounts || typeof state.invCounts !== "object") state.invCounts = { common:0, rare:0, epic:0, mythical:0, legendary:0, cosmic:0, interstellar:0 };
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
  // ===================== BEGINNER =====================
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

  // ===================== MID =====================
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

  // ===================== HARDCORE =====================
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
  // Count claimable missions only. Must be side-effect free (no DOM access).
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
  const n = unclaimedRewardsCount();
  if (n > 0){
    notifBadge.style.display = "";
    notifBadge.textContent = String(n);
    notifRewardsBadge.style.display = "";
    notifRewardsBadge.textContent = String(n);
  }else{
    notifBadge.style.display = "none";
    notifRewardsBadge.style.display = "none";
  }
}

let notifActiveTab = "rewards";
function setNotifTab(tab){
  notifActiveTab = tab;
  if (notifTabs){
    const btns = notifTabs.querySelectorAll(".notifTab");
    btns.forEach(b=>{
      const t = b.getAttribute("data-tab");
      if (!t) return;
      b.classList.toggle("isActive", t === tab);
    });
  }
}

function renderNotifTab(){
  if (!notifContent) return;
  updateNotificationsBadges();

  // Always reset the right-side panel so tabs never stack/overlap content
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
        btn.addEventListener("click", ()=>{
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
    btnTicket.addEventListener("click", ()=>doLuckyDraw("ticket"));
    actions.appendChild(btnTicket);

    const btnGold = document.createElement("button");
    btnGold.className = "btn btnGhost";
    btnGold.type = "button";
    btnGold.textContent = `Spin (${fmt(LUCKY_DRAW_COST_GOLD)} Gold)`;
    btnGold.dataset.sfx = "open-card";
    btnGold.disabled = state.gold < LUCKY_DRAW_COST_GOLD;
    btnGold.addEventListener("click", ()=>doLuckyDraw("gold"));
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

  // Coming soon tabs
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
  // Eligible rules (Mutation Machine):
  // - Only cards in inventory (avoid deck disruption)
  // - Only UNHEARTED cards (not locked/favorited)
  // - Only cards with NO mutation OR EXACTLY ONE mutation
  //   (stacked/multiple mutations are not allowed for this process)
  const usedInDeck = getUsedDeckCardIdSet(); // deck cards are still in cardsOwned, so filter by location
  const list = (state.cardsOwned||[]).filter(c=>{
    if (!c || !c.id) return false;
    if (String(c.location||"inventory") !== "inventory") return false;
    if (usedInDeck.has(c.id)) return false;

    // "hearted" == locked/favorited in this codebase (fav = true)
    if (c.fav === true) return false;

    const muts = getMutationList(c);
    return (muts.length === 0 || muts.length === 1);
  });

  // Sort by rarity desc then gps desc for better UX
  const rRank = (rk)=> invOrder.indexOf(String(rk||"common").toLowerCase());
  list.sort((a,b)=>{
    const ra = rRank(a.rarity), rb = rRank(b.rarity);
    if (ra !== rb) return ra - rb; // invOrder is rare->common
    return (Number(b.gps)||0) - (Number(a.gps)||0);
  });
  return list;
}

function rollMutationMachineKeyAvoid(excludeKey){
  // Avoid rolling the same mutation as the existing one when replacing
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
}

function setMmDetails(card){
  if (!mmDetailsImg) return;
  if (!card){
    mmDetailsImg.src = "card.png";
    mmDetailsName.textContent = "—";
    mmDetailsRarity.textContent = "—";
    mmDetailsChance.textContent = "—";
    mmDetailsMutation.textContent = "—";
    mmDetailsGps.textContent = "—";
    return;
  }
  mmDetailsImg.src = card.img || "card.png";
  mmDetailsName.textContent = card.name || "Unknown";
  mmDetailsRarity.textContent = (card.rarity || "common").toUpperCase();
  mmDetailsChance.textContent = `${Number(card.pullChance ?? card.w ?? 0)}%`;
  mmDetailsMutation.textContent = mutationLabel(card);
  mmDetailsGps.textContent = `${Number(card.gps)||0} / sec`;
}

function renderMmPickGrid(){
  if (!mmPickGrid) return;
  mmPickGrid.innerHTML = "";
  const pool = mutationMachineEligibleCards();
  if (!pool.length){
    if (mmPickEmpty) mmPickEmpty.style.display = "";
    return;
  }
  if (mmPickEmpty) mmPickEmpty.style.display = "none";

  pool.forEach(c=>{
    const item = document.createElement("div");
    item.className = "deckPickItem";
    item.dataset.id = c.id;

    applyMutationGlow(item, c);

    const img = document.createElement("img");
    img.src = c.img || "card.png";
    img.onerror = ()=>{ img.src = "card.png"; };

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

    item.addEventListener("click", ()=>{
      mmPickGrid.querySelectorAll(".deckPickItem.sel").forEach(n=>n.classList.remove("sel"));
      item.classList.add("sel");
      if (mmPicking) mmPicking.selectedCardId = c.id;
      if (mmSelectBtn) mmSelectBtn.disabled = false;
      setMmDetails(c);
    });

    mmPickGrid.appendChild(item);
  });

  setMmDetails(null);
}

function openMmResultModal(card){
  if (!mmResultOverlay) return;
  ensureNotifications();
  const mm = state.notifications.mutationMachine;

  // Always show the card name/art (front image will be revealed on flip)
  const target = card || getCardById(mm.cardId);
  if (!target){
    toast("Mutation Machine", "Card not found.");
    return;
  }

  mmResultName.textContent = target?.name || "Mutated Card";
  mmResultImg.src = target?.img || "card.png";
  mmResultImg.onerror = ()=>{ mmResultImg.src = "card.png"; };

  // Hide the result text until reveal
  mmResultMeta.textContent = "Revealing...";

  // Reset flip state (back face shows card.png via HTML)
  const flip = document.getElementById("mmFlipCard");
  if (flip) flip.classList.remove("revealed");

  // Ensure glow is cleared until reveal
  if (mmResultImgWrap){
    mmResultImgWrap.className = "luckyResultImgWrap";
  }

  // Hover for full details (shows CURRENT details; mutation will update after reveal)
  if (mmResultImgWrap) bindTooltip(mmResultImgWrap, ()=>target);

  mmResultOverlay.classList.add("show");
  mmResultOverlay.setAttribute("aria-hidden","false");

  // If the machine isn't done, don't reveal yet
  if (mm.status !== "done" || !mm.resultMutation){
    mmResultMeta.textContent = "Machine is not finished yet.";
    return;
  }

  // If already revealed before, just show final state (no re-flip)
  if (mm.revealed){
    const muts = getMutationList(target).map(normMutKey);
    const mainMut = muts.length ? muts[0] : "normal";
    const pretty = (mainMut === "normal") ? "Normal (No Mutation)" : (mainMut[0].toUpperCase()+mainMut.slice(1));
    mmResultMeta.textContent = `Mutation: ${pretty}`;
    if (mmResultImgWrap) applyMutationGlow(mmResultImgWrap, target);
    if (flip) flip.classList.add("revealed");
    return;
  }

  // Reveal moment: play sound + flip, then APPLY mutation to the card
  const REVEAL_DELAY_MS = 900; // charge-up timing
  window.setTimeout(() => {
    // 🔊 reveal SFX
    try{ playCardOpeningSFX(); }catch(_){}

    // Flip animation start
    if (flip) flip.classList.add("revealed");

    // Apply mutation now (replace only — no stacking)
    const mk = mm.resultMutation;
    clearAllMutations(target);
    if (normMutKey(mk) !== "normal"){
      applyMutationToCard(target, mk);
    }else{
      clearAllMutations(target);
      recomputeCardStats(target);
    }

    mm.revealed = true;
    saveState();
    syncUI();

    // Update modal meta + glow after apply
    const muts = getMutationList(target).map(normMutKey);
    const mainMut = muts.length ? muts[0] : "normal";
    const pretty = (mainMut === "normal") ? "Normal (No Mutation)" : (mainMut[0].toUpperCase()+mainMut.slice(1));
    mmResultMeta.textContent = `Mutation: ${pretty}`;

    if (mmResultImgWrap){
      mmResultImgWrap.className = "luckyResultImgWrap";
      applyMutationGlow(mmResultImgWrap, target);
    }
  }, REVEAL_DELAY_MS);
}

function closeMmResultModal(){
  if (!mmResultOverlay) return;
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
  // "Rarest" interpreted as highest GPS within that rarity
  const key = String(rarityKey||"").toLowerCase();
  const pool = (state.cardsOwned||[]).filter(c=>{
    if (!c || !c.id) return false;
    if (c.id === excludeId) return false;
    if (String(c.location||"inventory") !== "inventory") return false;
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

  // Card eligibility rules
  // - must be in inventory (extra safety)
  if (String(card.location||"inventory") !== "inventory"){
    toast("Mutation Machine", "That card is not in your inventory.");
    return;
  }
  // - must be unhearted / not favorited
  if (card.fav === true){
    toast("Mutation Machine", "This card is locked (hearted). Unheart it to use the Mutation Machine.");
    return;
  }
  // - must have 0 or 1 mutation (no stacked mutations allowed)
  const muts = getMutationList(card);
  if (muts.length > 1){
    toast("Mutation Machine", "This card has stacked mutations and is not eligible.");
    return;
  }

  option = String(option || mm.speedOption || "wait");
  mm.speedOption = option;

  // Pay / sacrifice
  if (option === "gold"){
    if (state.gold < 5000000){
      toast("Not enough gold", `You need ${fmt(5000000)} gold.`);
      return;
    }
    state.gold -= 5000000;
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
  mm.endAt = (option === "wait") ? (now + MUTATION_MACHINE_DURATION_MS) : now; // speed-up finishes immediately
  mm.status = "running";
  mm.resultMutation = null;
  mm.revealed = false; // reveal happens only when opening result
  mm.doneNotified = false;

  saveState();
  syncUI();
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

  // Decide mutation once, at completion (STORE ONLY — do not apply yet)
  if (!mm.resultMutation){
    const current = getMutationList(card);
    const currentKey = current.length ? current[0] : "Normal";
    const mk = rollMutationMachineKeyAvoid(currentKey);

    mm.resultMutation = mk;
    mm.revealed = false;
  }

  // Mark as done; mutation will be revealed/applied when player opens the machine
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
  mm.revealed = false; // reveal happens only when opening result
  mm.doneNotified = false;
  saveState();
}

function renderMutationMachinePanel(){
  ensureNotifications();
  const mm = state.notifications.mutationMachine;

  const h = document.createElement("h3");
  h.textContent = "Mutation Machine";
  notifContent.appendChild(h);

  const sub = document.createElement("div");
  sub.className = "small muted";
  sub.textContent = "Insert 1 card, then start the mutation process. Come back to open your result.";
  notifContent.appendChild(sub);

  const wrap = document.createElement("div");
  wrap.className = "mmMachine";

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
    img.src = card.img || "card.png";
    img.onerror = ()=>{ img.src = "card.png"; };
    slot.appendChild(img);
    applyMutationGlow(slot, card);
    bindTooltip(slot, ()=>card);
  }else{
    const empty = document.createElement("div");
    empty.className = "mmSlotEmpty";
    empty.innerHTML = `<div class="plus">+</div><div><b>Insert Card</b><div class="small muted" style="margin-top:4px;">Tap to choose</div></div>`;
    slot.appendChild(empty);
  }

  slot.addEventListener("click", ()=>{
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

  // Progress
  const prog = document.createElement("div");
  prog.className = "mmProgress";

  const bar = document.createElement("div");
  bar.className = "mmProgressBar";
  const fill = document.createElement("div");
  fill.className = "mmProgressFill";
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
  leftTxt.innerHTML = `<b>Status</b> <span class="muted">${mm.status.toUpperCase()}</span>`;
  const rightTxt = document.createElement("div");
  rightTxt.innerHTML = (mm.status === "running")
    ? `<b>Remaining</b> <span class="muted">${mmss(left)}</span>`
    : (mm.status === "done")
      ? `<b>Ready</b> <span class="muted">Open result</span>`
      : `<b>Duration</b> <span class="muted">25:00</span>`;

  txt.appendChild(leftTxt);
  txt.appendChild(rightTxt);

  prog.appendChild(txt);
  wrap.appendChild(prog);

  // Controls
  const controls = document.createElement("div");
  controls.className = "mmControls";

  const group = document.createElement("div");
  group.className = "mmRadioGroup";

  const options = [
    { v:"wait",        title:"Wait",        sub:"25 minutes (Free)" },
    { v:"gold",        title:"Gold",        sub:"Pay 5,000,000 gold (Instant)" },
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
    input.addEventListener("change", ()=>{
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
    btn.addEventListener("click", ()=>{
      const c = mm.cardId ? getCardById(mm.cardId) : null;
      if (!c) return;
      openMmResultModal(c);
    });
  }else{
    btn.textContent = "Start";
    btn.disabled = (!mm.cardId || mm.status !== "idle");
    btn.addEventListener("click", ()=>{
      const selected = (group.querySelector("input[type='radio']:checked")?.value) || (mm.speedOption||"wait");
      startMutationMachine(selected);
    });
  }

  controls.appendChild(group);
  controls.appendChild(btn);


  wrap.appendChild(controls);

  // Hint text
  const hint = document.createElement("div");
  hint.className = "small muted";
  hint.style.marginTop = "6px";
  hint.textContent = "Eligible cards: Unhearted (not locked), and either no mutation or exactly one mutation. The Mutation Machine replaces the card\'s current mutation with a new random one (no stacking).";
  wrap.appendChild(hint);

  notifContent.appendChild(wrap);
}

function tickMutationMachine(){
  completeMutationMachineIfNeeded();

  // Live progress updates when Notifications > Mutation Machine is open
  if (notifOverlay && notifOverlay.classList.contains("show") && notifActiveTab === "mutation"){
    // re-render occasionally for accurate progress bar
    if (!tickMutationMachine._lastRender) tickMutationMachine._lastRender = 0;
    const now = Date.now();
    if (now - tickMutationMachine._lastRender > 750){
      tickMutationMachine._lastRender = now;
      renderNotifTab();
    }
  }
}

function rollMutationKey(){
  // Uses MUTATIONS table
  let r = Math.random();
  for (const m of MUTATIONS){
    const c = Number(m.chance)||0;
    if ((r -= c) <= 0) return m.k;
  }
  return "Normal";
}

function rollLuckyDrawReward(){
  // If totals don't hit 1, remaining becomes Phantom Thief to keep it fair.
  let r = Math.random();
  const a = LUCKY_DRAW_POOL[0];
  const b = LUCKY_DRAW_POOL[1];
  const c = LUCKY_DRAW_POOL[2];
  if (r < a.chance) return a;
  r -= a.chance;
  if (r < b.chance) return b;
  // Remaining chunk
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

  // Ensure we have an image even if some callers pass only a name
  const resolveCardImg = (c) => {
    if (c && c.img && c.img !== "card.png") return c.img;
    const nm = String(c?.name||"");
    if (!nm) return "card.png";
    // Try to find image by name in CARD_REWARDS table
    try{
      for (const rar of Object.keys(CARD_REWARDS||{})){
        const arr = CARD_REWARDS[rar] || [];
        const hit = arr.find(x => String(x.name) === nm);
        if (hit && hit.img) return hit.img;
      }
    }catch(_){}
    return "card.png";
  };

  const imgSrc = resolveCardImg(card);

  if (luckyResultName) luckyResultName.textContent = card?.name || "Reward";

  // Preferred: premium flip stage (back -> reveal)
  const wrap = luckyResultOverlay.querySelector(".luckyResultImgWrap");
  if (wrap){
    wrap.innerHTML = `
      <div class="flipStage isCharging" id="luckyFlipStage" aria-label="Lucky draw reveal">
        <div class="flipCard" id="luckyFlipCard">
          <div class="flipInner">
            <div class="flipFace flipBack">
              <img alt="Card back" src="card.png" />
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

    // Force correct reward image (prevents "stuck on back card.png")
    if (frontImg) frontImg.src = imgSrc;

    // Apply mutation glow to the OUTER wrapper so it matches every other mutated card.
    // (The flip stage itself has no border-radius, so glowing it can look "weird" / boxy.)
    try{ applyMutationGlow(wrap, {...card, img: imgSrc}); }catch(_){}

    // Animate: charge -> flip
    setTimeout(()=>{ stage && stage.classList.add("isReady"); }, 220);
    setTimeout(()=>{
      if (cardEl) cardEl.classList.add("isRevealed");
      // Stop the scanline once revealed (prevents occasional “glitch line” artifacts)
      if (stage) stage.classList.remove("isReady");
      // Failsafe: also set the legacy img element in case CSS/DOM differs
      if (luckyResultImg) luckyResultImg.src = imgSrc;
    }, 900);
    setTimeout(()=>{ stage && stage.classList.remove("isCharging"); }, 1150);
  }

  // Fallback: if modal doesn't have the flip wrapper, use the existing image element.
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


  // Card opening SFX (Lucky Draw)
  playCardOpeningSFX();

  const def = rollLuckyDrawReward();
  const card = addLuckyDrawCard(def);
  toast("Lucky Draw", `You got ${card.name}!`);
  updateNotificationsBadges();

  // Keep Lucky Draw UI in sync (tickets count + button enable/disable)
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
  // If totals don't add to 100, treat the remainder as extra "Normal" chance.
  const total = totalWeatherChance();
  const normal = getWeatherDef("normal");
  const remainder = Math.max(0, 100 - total);
  const rollMax = total + remainder;
  let r = Math.random() * rollMax;

  // First: explicit table
  for (const w of WEATHER_TABLE){
    const c = Number(w.chance)||0;
    if ((r -= c) <= 0) return w.key;
  }
  // Remainder => normal
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

  weatherIconBox.classList.remove("weather-normal","weather-spacestorm","weather-antigravity","weather-ascension","weather-multiverse");
  weatherIconBox.classList.add(`weather-${def.key}`);
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
    <div class="wtLine"><b>Roll chances:</b> Normal 60% • Space Storm 40% • Anti-Gravity 25% • Ascension 15% • Multiverse 5%</div>
    ${details}
  `;
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


function triggerWeatherStrikeFX(cardId, weatherKey){
  if (!cardId) return;
  const wk = String(weatherKey||"").toLowerCase();
  const cls = `wx-${wk}`;

  const els = document.querySelectorAll(`.slot.assigned[data-card-id="${CSS.escape(String(cardId))}"]`);
  if (!els || !els.length) return;

  els.forEach(el=>{
    el.classList.remove("wxStrike","wx-spacestorm","wx-antigravity","wx-ascension","wx-multiverse");
    // Restart animation reliably
    void el.offsetWidth;
    el.classList.add("wxStrike");
    if (wk && wk !== "normal") el.classList.add(cls);
  });

  // Auto-clean
  setTimeout(()=>{
    els.forEach(el=> el.classList.remove("wxStrike", cls));
  }, 980);
}


function applyMutationToCard(card, mutationKey){
  if (!card) return false;
  const muts = getMutationList(card);
  const nk = normMutKey(mutationKey);
  if (!nk || nk === "normal") return false;

  if (muts.map(normMutKey).includes(nk)){
    // same mutation cannot stack
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

  // 10% strike chance (per attempt)
  if (Math.random() >= WEATHER_STRIKE_CHANCE) return;

  const id = pickRandomDeckCardId();
  if (!id) return;

  const card = getCardById(id);
  if (!card) return;

  const applied = applyMutationToCard(card, def.mutation);
  // Visible premium strike FX on the affected card(s)
  triggerWeatherStrikeFX(id, def.key);

  if (applied){
    toast(def.name, `${card.name} was struck! +${def.mutation} (×${def.mult})`);
    saveState();
    buildSlots();
    // Keep cards modal fresh if open
    try{ renderCardsModal?.(); }catch(_){}
  }else{
    // Already had the mutation (no stacking)
    toast(def.name, `${card.name} resisted — already has ${def.mutation}.`);
  }
}

function startWeatherEvent(key){
  const now = Date.now();
  state.weather.active = true;
  state.weather.currentKey = key;
  state.weather.endsAt = now + WEATHER_EVENT_DURATION_MS;
  state.weather.strikesDone = 0;
  state.weather.nextStrikeAt = now; // immediate first attempt
  state.weather.nextAnnounceAt = 0;
  saveState();

  const def = getWeatherDef(key);
  if (def.special){
    // Notification when a special event starts
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

  // No extra cooldown: next roll starts immediately counting to +5m
  state.weather.nextEventAt = now + WEATHER_EVENT_INTERVAL_MS;

  // Pick a preview (used by the 1-minute ticker)
  state.weather.nextPreviewKey = rollWeatherKey();
  state.weather.nextAnnounceAt = now + 60000;

  saveState();

  setWeatherIconUI("normal");
  updateWeatherUI(true);

  // Quick toast summary
  const def = getWeatherDef(endedKey);
  toast("Weather ended", def.special ? `${def.name} faded.` : "Back to Normal.");
}

function tickWeather(){
  if (!state.weather) ensureWeather();
ensureNotifications();
  const w = state.weather;
  const now = Date.now();

  // Active event lifecycle
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

  // Roll (every 5 minutes)
  if (now >= w.nextEventAt){
    const key = rollWeatherKey();
    const def = getWeatherDef(key);

    // Normal just advances the schedule
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

  // After a special event ends: show "Next weather" hint every minute
  if (w.nextAnnounceAt && now >= w.nextAnnounceAt){
    const preview = getWeatherDef(w.nextPreviewKey || rollWeatherKey());
    const chance = Number(preview.chance)||0;
    showWeatherTicker(`Next weather: ${preview.name} • Chance: ${chance}%`);
    w.nextAnnounceAt = now + 60000;
    // Keep the preview stable-ish
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

  // Inventory tab badge
  if (invPetsBadge){
    invPetsBadge.textContent = String(n);
    invPetsBadge.style.display = n > 0 ? "inline-flex" : "none";
  }
}

function openPetShop(){
  if(!petShopOverlay) return;
  // Pet Shop is currently a placeholder UI (Coming Soon)
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
  petTimerInterval = setInterval(tick, 250);
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
    btn.addEventListener("click", ()=>{
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

      // Purchase SFX (dedicated)
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
  // default selection
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
  // Cost to upgrade from current level -> next
  // Tier 1->2: 15,000
  // Tier 2->3: 500,000
  // Tier 3->4: 1,000,000
  // Tier 4->5: 5,000,000
  // Tier 5->6: 15,000,000
  // Tier 6->7: 25,000,000
  if (lv === 1) return 15000;
  if (lv === 2) return 500000;
  if (lv === 3) return 1000000;
  if (lv === 4) return 5000000;
  if (lv === 5) return 15000000;
  if (lv === 6) return 25000000;
  return Infinity; // maxed / unavailable
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

    // Tooltip (shows current effects if this is the active one)
    item.addEventListener("mouseenter", (e)=>{
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
    item.addEventListener("mousemove", (e)=>{
      // keep same tooltip but follow cursor
      showTooltipHtml(tooltipEl?.innerHTML || "", e.clientX, e.clientY);
    });
    item.addEventListener("mouseleave", hideCardTooltip);

    // Mobile: long-press to show the same hover tooltip
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

    item.addEventListener("click", ()=>{
      selectedSummonerId = s.id;
      renderSummonersList();
      renderSummonerDetails(s.id);

      if (!owned){
        toast("Locked", "You don't own this summoner yet.");
        return;
      }

      // Switch active summoner (effects change immediately)
      state.summoners.selectedId = s.id;
      if(!(state.summoners.owned||[]).includes(s.id)) state.summoners.owned.push(s.id);
      onActiveSummonerChanged();
    });

    summonersList.appendChild(item);
  });
}

function renderSummonerDetails(id){
  // Details panel always reflects the CURRENTLY USED summoner (tier-based),
  // not just whatever you clicked in the list.
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

  // Requirements UI
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

  // Upgrade button state
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

  // Pay + progress tier
  state.gold -= cost;
  playPurchaseSFX();
  state.summoners.levels[mainId] = lv + 1;

  // Switch to the NEXT summoner (tier-based)
  const nextTier = lv + 1;
  const nextSummonerId = getSummonerIdForTier(nextTier);
  state.summoners.selectedId = nextSummonerId;

  if(!state.summoners.owned.includes(nextSummonerId)) state.summoners.owned.push(nextSummonerId);
  if(!state.summoners.levels[nextSummonerId]) state.summoners.levels[nextSummonerId] = 1;

  // When upgrading, reset tower timer cleanly and allow new cap/mult
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

  // If already at cap, stop generating until collected
  const storedNow = Number(state.towers.stored) || 0;
  if (storedNow >= cap){
    state.towers.stored = cap;
    state.towers.lastTs = now;
    return;
  }

  const rate = computeDeckGps() * mult; // gold per second
  const next = storedNow + rate * dt;
  state.towers.stored = Math.min(cap, next);
  state.towers.lastTs = now;
}

function collectTowersGold(){
  tickTowers();
  const gain = Math.floor(state.towers.stored || 0);
  if (gain <= 0) return;

  // Tower collect SFX (dedicated)
  playTowerGoldSFX();
  state.gold += gain;

  // Visual collect FX + notification
  try{
    if (openGoldPanel){
      openGoldPanel.classList.add("collectFx");
      setTimeout(()=>openGoldPanel.classList.remove("collectFx"), 650);
    }
  }catch(_){ }
  showGoldPop(gain, openGoldPanel);
  toast("Tower", `Added ${fmt(gain)} gold`);
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

  // --- Fixed 15s bonus (normal summoners) ---
  const bonus15 = bonusGoldPer15sForTier(tier);
  if (!Number.isFinite(state.summoners.nextBonusAt)) state.summoners.nextBonusAt = now + 15000;

  if (bonus15 > 0 && now >= state.summoners.nextBonusAt){
    // catch up (avoid huge loops)
    const missed = Math.min(10, Math.floor((now - state.summoners.nextBonusAt) / 15000) + 1);
    const gain = bonus15 * missed;

    state.gold += gain;
    state.summoners.nextBonusAt += missed * 15000;
    changed = true;


    // Passive ability gold SFX (dedicated)
    playAbilityGoldSFX();

    showGoldPop(gain, openGoldPanel || null);
    toast("Summoner Bonus", `+${fmt(gain)} gold`);
  }

  // --- Zeno special: 50% chance +1,000,000 gold every 1 minute ---
  if (tier >= 7){
    if (!Number.isFinite(state.summoners.nextZenoAt)) state.summoners.nextZenoAt = now + 60000;

    if (now >= state.summoners.nextZenoAt){
      // advance timer (catch up but don't spam RNG)
      const missed = Math.min(3, Math.floor((now - state.summoners.nextZenoAt) / 60000) + 1);
      state.summoners.nextZenoAt += missed * 60000;
      changed = true;

      // one RNG roll per trigger (even if missed > 1)
      if (Math.random() < 0.5){
        const gain = 1000000;
        state.gold += gain;
        changed = true;
        showGoldPop(gain, openGoldPanel || null);
        toast("Zeno Blessing", `+${fmt(gain)} gold`);

        // Passive ability gold SFX (dedicated)
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

  openGoldPanel.addEventListener("click", act);
  openGoldPanel.addEventListener("keydown", (e)=>{
    if(e.key==="Enter" || e.key===" "){ e.preventDefault(); act(); }
  });
}


/* ================= Gallery (All Cards) ================= */
const GALLERY_RARITY_ORDER = ["common","rare","epic","mythical","legendary","cosmic","interstellar"];

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

// Include Lucky Draw pool cards in gallery (so Lucky Draw rewards also appear here)
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

  // Keep ordering consistent (rarity order, then name)
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
  renderGallery("");
  galleryOverlay.classList.add("show");
  galleryOverlay.setAttribute("aria-hidden","false");
  setTimeout(()=> gallerySearch?.focus?.(), 0);
}

function closeGallery(){
  if (!galleryOverlay) return;
  galleryOverlay.classList.remove("show");
  galleryOverlay.setAttribute("aria-hidden","true");
  if (typeof hideTooltip === 'function') hideTooltip();
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
    tile.className = `gCard r-${card.rarity}`;
    tile.innerHTML = `
      <img src="${escapeHtml(card.img)}" alt="${escapeHtml(card.name)}" loading="lazy" decoding="async"
           onerror="this.style.display='none'"/>
    `;

    // Hover tooltip: name / rarity / GPS
    tile.addEventListener("mouseenter", (e)=>{
      tooltipPinned = false;
      showCardTooltip(card, e.clientX, e.clientY);
    });
    tile.addEventListener("mousemove", (e)=>{
      if (!tooltipPinned) positionTooltip(e.clientX, e.clientY);
    });
    tile.addEventListener("mouseleave", ()=>{
      if (!tooltipPinned) hideTooltip();
    });

    // Mobile: long-press to show the same hover tooltip
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
}

function renderHowToPlay(){
  if (!howtoTabs || !howtoContent || !howtoStepTitle) return;

  // Tabs
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
    btn.addEventListener("click", ()=>{
      howtoStepIdx = i;
      renderHowToPlay();
    });
    howtoTabs.appendChild(btn);
  });

  // Dots
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
  // Show once after initial UI is mounted to avoid layout jank.
  window.setTimeout(()=> openHowToPlay(true), 350);
}


/* ================= Events ================= */
if (openGalleryBtn) openGalleryBtn.addEventListener("click", openGallery);
if (closeGalleryBtn) closeGalleryBtn.addEventListener("click", closeGallery);
if (galleryOverlay) galleryOverlay.addEventListener("click", (e)=>{ if (e.target === galleryOverlay) closeGallery(); });
if (gallerySearch) gallerySearch.addEventListener("input", (e)=> renderGallery(e.target.value));

document.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && galleryOverlay && galleryOverlay.classList.contains("show")) closeGallery(); });

openInvBtn.addEventListener("click", openInventory);
invOkBtn.addEventListener("click", closeInventory);
closeInvBtn.addEventListener("click", closeInventory);
invOverlay.addEventListener("click", (e)=>{ if(e.target === invOverlay) closeInventory(); });

// How to Play
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

// Inventory tab switching (Packs / Cards / Pets)
// Fix: previously there was no click handler on #invTabs, so pressing the Cards tab
// would not render anything on the right panel.
if (invTabs){
  invTabs.addEventListener("click", (e)=>{
    const btn = e.target.closest(".invTab");
    if (!btn) return;
    const tab = btn.getAttribute("data-tab");
    if (!tab) return;

    setInventoryTab(tab);

    // Persist chosen tab immediately so reopening Inventory keeps the same tab
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.invTab = tab;
    try{ saveState(state); }catch(_){ try{ saveState(); }catch(__){} }
  });
}

if (openCardsBtn){ openCardsBtn.addEventListener("click", openCards); }
if (cardsSearchInput){ cardsSearchInput.addEventListener("input", renderCardsModal); }
if (cardsOkBtn){ cardsOkBtn.addEventListener("click", closeCards); }


// Notifications
if (openNotifBtn){
  openNotifBtn.addEventListener("click", openNotifications);
}
if (notifOkBtn){
  notifOkBtn.addEventListener("click", closeNotifications);
}
if (closeNotifBtn){
  closeNotifBtn.addEventListener("click", closeNotifications);
}
if (notifOverlay){
  notifOverlay.addEventListener("click", (e)=>{ if(e.target === notifOverlay) closeNotifications(); });
}
if (notifTabs){
  notifTabs.addEventListener("click", (e)=>{
    const btn = e.target.closest(".notifTab");
    if (!btn) return;
    const tab = btn.getAttribute("data-tab");
    if (!tab) return;
    setNotifTab(tab);
    renderNotifTab();
  });
}

// Lucky result modal
if (luckyResultOkBtn) luckyResultOkBtn.addEventListener("click", closeLuckyResultModal);
if (closeLuckyResultBtn) closeLuckyResultBtn.addEventListener("click", closeLuckyResultModal);
if (luckyResultOverlay){
  luckyResultOverlay.addEventListener("click", (e)=>{ if(e.target === luckyResultOverlay) closeLuckyResultModal(); });
}



const sellAllCardsBtn = document.getElementById("sellAllCardsBtn");
if (sellAllCardsBtn){
  sellAllCardsBtn.addEventListener("click", ()=>{
    ensureDeckCardLocations();

    // IMPORTANT: Selling from Cards modal only sells INVENTORY cards (not decked cards).
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

    // Remove only inventory cards (keep deck cards in collection)
    state.cardsOwned = (state.cardsOwned||[]).filter(c => {
      const loc = (c?.location||"inventory");
      if (loc !== "inventory") return true;
      return c?.fav === true; // keep hearted inventory cards
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
  closeDeckBtn.addEventListener("click", closeDeckPicker);
}
if (deckOverlay){
  deckOverlay.addEventListener("click", (e)=>{
    if (e.target === deckOverlay) closeDeckPicker();
  });
}
if (deckSelectBtn){
  deckSelectBtn.addEventListener("click", ()=>{
    if (!deckPicking || !deckPicking.selectedCardId) return;
    ensureDecks();
    // Safety: prevent the same exact card instance from being used in multiple slots/decks
    const curId = state.decks?.[deckPicking.deckKey]?.[deckPicking.idx] || null;
    const used = getUsedDeckCardIdSet(curId);
    if (used.has(deckPicking.selectedCardId)){
      toast("Card already in a deck", "That card is already placed in another deck slot.");
      return;
    }
    // If replacing, return old card back to inventory
    if (curId){
      state.decks[deckPicking.deckKey][deckPicking.idx] = null;
      moveCardToInventory(curId);
    }
    // Consume chosen card from inventory into deck storage
    if (!moveCardToDeck(deckPicking.selectedCardId, deckPicking.deckKey, deckPicking.idx)){
      toast("Missing card", "That card isn't available in your inventory (it might already be in a deck).");
      return;
    }
    state.decks[deckPicking.deckKey][deckPicking.idx] = deckPicking.selectedCardId;

    saveState();
    syncUI(); // updates badges (Cards), slots, towers, etc.
    closeDeckPicker();
    toast("Deck Updated", `Placed a card into Deck ${deckPicking.deckKey} Slot ${deckPicking.idx+1}`);
  });
}


/* Mutation Machine modals */
if (closeMmSelectBtn) closeMmSelectBtn.addEventListener("click", closeMmSelectModal);
if (mmSelectOverlay) mmSelectOverlay.addEventListener("click", (e)=>{ if (e.target === mmSelectOverlay) closeMmSelectModal(); });
if (mmSelectBtn){
  mmSelectBtn.addEventListener("click", ()=>{
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

if (closeMmResultBtn) closeMmResultBtn.addEventListener("click", closeMmResultModal);
if (mmResultOkBtn){
  mmResultOkBtn.addEventListener("click", ()=>{
    closeMmResultModal();
    // After viewing result, return to Mutation Machine UI and reset machine state
    resetMutationMachine();
    if (notifOverlay && notifOverlay.classList.contains("show") && notifActiveTab === "mutation"){
      renderNotifTab();
    }
  });
}
if (mmResultOverlay) mmResultOverlay.addEventListener("click", (e)=>{ if (e.target === mmResultOverlay) closeMmResultModal(); });

rewardsOkBtn.addEventListener("click", closeRewards);
closeRewardsBtn.addEventListener("click", closeRewards);
rewardsOverlay.addEventListener("click", (e)=>{ if(e.target === rewardsOverlay) closeRewards(); });

/* Pets + Pet Shop */
if(openPetShopBtn){
  openPetShopBtn.addEventListener("click", openPetShop);
}
if(petShopOkBtn) petShopOkBtn.addEventListener("click", closePetShop);
if(closePetShopBtn) closePetShopBtn.addEventListener("click", closePetShop);
if(petShopOverlay) petShopOverlay.addEventListener("click", (e)=>{ if(e.target === petShopOverlay) closePetShop(); });


/* Summoners */
if(openSummoners){
  openSummoners.addEventListener("click", openSummonersModal);
  openSummoners.addEventListener("keydown", (e)=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); openSummonersModal(); }});
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

/* ================= Boot ================= */
function boot(){
  buildMarquee();
  buildSlots();
  updateTowersUI();
  syncUI();
  maybeAutoShowHowToPlay();
  updatePetsBadge();
  initGoldPlaceholder();
  let _towersSaveCtr = 0;
  setInterval(()=>{ tickTowers(); tickSummonerBonus(); tickWeather(); tickMutationMachine(); updateTowersUI(); updateWeatherUI(); if((++_towersSaveCtr % 40)===0) saveState(); }, 250);


  const cardW = 210, gap = 22;
  x = -Math.random() * (22 * (cardW + gap));
  track.style.transform = `translate3d(${x}px,-50%,0)`;
  requestAnimationFrame(loop);
}
boot();
