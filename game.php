<?php
require_once __DIR__ . '/config.php';
require_login();

$u = current_user();
$pdo = db();
$state = null;

$stmt = $pdo->prepare('SELECT state_json, updated_at FROM game_states WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1');
$stmt->execute([$u['id']]);
$row = $stmt->fetch();
if ($row && !empty($row['state_json'])) {
  $decoded = json_decode($row['state_json'], true);
  if (is_array($decoded)) $state = $decoded;
}

$state_updated_at_ms = 0;
if ($row && !empty($row['updated_at'])) {
  $ts = strtotime($row['updated_at']);
  if ($ts !== false) $state_updated_at_ms = $ts * 1000;
}

// We'll inject state + user into JS globals so app.js can load synchronously.
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"/>
  <title>Cosmic Cards</title>
  <meta name="theme-color" content="#050712"/>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
<header>
  <div class="wrap">
    

    <div class="headerActions">
      <div class="wallet goldWallet">
        <img src="currencyimg/gold.png" class="currencyIcon goldCurrencyIcon" alt="Gold">
        <span class="goldValue" id="gold">0</span>
        <button class="walletPlus" id="goldPlusBtn" type="button" aria-label="Gold options" title="Gold options">+</button>
      </div>

      <div class="wallet diamondWallet">
        <img src="currencyimg/diamond.png" class="currencyIcon diamondCurrencyIcon" alt="Diamond">
        <span class="diamondValue" id="diamond">0</span>
        <button class="walletPlus" id="diamondPlusBtn" type="button" aria-label="Diamond options" title="Diamond options">+</button>
      </div>

      

      
      <button class="invBtn" id="openGalleryBtn" type="button" aria-haspopup="dialog" aria-controls="galleryOverlay">
        <span class="invIcon" aria-hidden="true"></span>
        <span>Gallery</span>
      </button>

<button class="invBtn" id="openInvBtn" type="button" aria-haspopup="dialog" aria-controls="invOverlay">
        <span class="invIcon" aria-hidden="true"></span>
        <span>Inventory</span>
        <span class="invBadge" id="invBadge">0</span>
      </button>
      

      <!-- Weather (header): ICON ONLY. Details shown via hover/click tooltip. -->
      <div class="weatherWrap" id="weatherWrap" aria-label="Weather System">
        <div class="weatherChip" id="weatherChip" tabindex="0" role="button" aria-haspopup="true" aria-label="Weather status">
          <div class="weatherIconBox weather-normal" id="weatherIconBox">
            <span class="weatherIcon" id="weatherIcon" aria-hidden="true">☀</span>
          </div>

          <!-- Kept for JS state sync, but hidden in CSS (no header text) -->
          <span class="weatherTimer" id="weatherTimer">05:00</span>
          <span class="weatherMiniCountdown" id="weatherCountdownText">05:00</span>

          <div class="weatherTooltip" id="weatherTooltip" role="tooltip"></div>
        </div>
        <div class="weatherTicker" id="weatherTicker" aria-live="polite" style="display:none;"></div>
      </div>

      <button class="invBtn notifBtn" id="openNotifBtn" type="button" aria-haspopup="dialog" aria-controls="notifOverlay" aria-label="Open Notifications" title="Notifications">
        <span class="notifBell" aria-hidden="true">🔔</span>
        <span class="btnLabel">Notifications</span>
        <span class="invBadge notifBadge" id="notifBadge" style="display:none;">0</span>
      </button>

    
      <button class="invBtn" id="openLeaderboardBtn" type="button" aria-haspopup="dialog" aria-controls="leaderboardOverlay" aria-label="Open Leaderboards" title="Leaderboards">
        <span class="notifBell" aria-hidden="true">🏆</span>
        <span class="btnLabel">Leaderboards</span>
      </button>

      <!-- Profile -->
      <button class="profileBtn" id="openProfileBtn" type="button" aria-haspopup="dialog" aria-controls="profileOverlay" aria-label="Open Profile" title="Profile">
        <span class="profileAvatar" aria-hidden="true">
          <div class="profileAvatarWrap" id="profileAvatarWrapHeader"><img id="profileAvatarImg" src="profile/profile.png" alt="" onerror="this.style.display='none'"></div>
        </span>
        <span class="profileName" id="profileName">Player</span><span class="statusDot offline" id="profileStatusDot" aria-label="Offline" title="Offline"></span>
      </button>

</div>
  </div>
</header>
  <div id="adminTicker" class="adminTicker" aria-live="polite" style="display:none;"></div>


<section class="heroCard" aria-label="Featured Card">
  <div class="heroInner" id="openSummoners" role="button" tabindex="0" aria-haspopup="dialog" aria-controls="summonersOverlay">
    <div class="heroImgWrap">
      <img class="heroImg" src="summoners/roylier.png" alt="Card artwork" loading="eager" decoding="async"
           onerror="this.style.display='none'"/>
    </div>
  </div>
</section>

<section class="shop">
  <div class="shop-label">MAIN SHOP</div>

  <div class="viewport">
    <div class="track" id="track"></div>
  </div>
</section>

<div class="shopEventRow" aria-label="Shop hint and Valentines event">
<!-- Gallery Modal   <span class="shopHintText">Click a moving card to buy a pack. Packs go to Inventory.

<!--
  Valentines Event (February 2026)

  <button class="invBtn valBtn" id="openValentinesBtn" type="button" aria-haspopup="dialog" aria-controls="valentinesOverlay" aria-label="Open Valentines Event" title="Valentines Event">
    <span class="valIcon" aria-hidden="true">💘</span>
    <span class="btnLabel">Valentines Event</span>
  </button>
</div>
-->

<section class="slotPanels">
  <div class="slotPanel">
    <b>Deck A</b>
    <div class="slotGrid" id="deckA"></div>
  </div>
  <div class="slotPanel">
    <b>Deck B</b>
    <div class="slotGrid" id="deckB"></div>
  </div>
</section>


<section class="goldPlaceholder">
  <div class="goldPlaceholderInner" id="openGoldPanel" role="button" tabindex="0" aria-label="Tower (click to collect stored gold)">
    <img src="tower/t1.png" alt="Tower" class="goldPlaceholderCard" loading="lazy" decoding="async"
         onerror="this.style.display='none'"/>
    <div class="towerPercent" id="towerPercent">1%</div>
    <div class="goldPlaceholderText">Tower</div>

    <!-- Details shown on hover only -->
    <div class="towerTooltip" id="towerTooltip" role="tooltip" aria-hidden="true">
      <div class="ttTitle"><b>Tower</b><span class="ttPill">Click to collect</span></div>
      <div class="ttLine">Gold/sec: <b><span id="towersRate">0</span></b></div>
      <div class="ttLine">Stored: <b><span id="towersStored">0</span></b></div>
      <div class="ttLine" id="towersCapLine">Cap: <b><span id="towersCap">0</span></b></div>
    </div>
  </div>
</section>



<!-- Gallery Modal -->
<div class="modalOverlay" id="galleryOverlay" aria-hidden="true">
  <div class="modal galleryModal" id="galleryModal" role="dialog" aria-modal="true" aria-labelledby="galleryTitle">
    <div class="modalHead">
      <b id="galleryTitle">Card Gallery</b>
      <button class="closeBtn" id="closeGalleryBtn" type="button" aria-label="Close">✕</button>
    </div>

    <div class="galleryTabs" id="galleryTabs" role="tablist" aria-label="Gallery tabs">
      <button class="galleryTab isActive" type="button" data-tab="gallery" role="tab" aria-selected="true">Gallery</button>
      <button class="galleryTab" type="button" data-tab="conversion" role="tab" aria-selected="false">Conversion</button>
    </div>

    <div class="modalBody galleryBody">
      <div class="galleryTop">
        <input id="gallerySearch" class="gallerySearch" type="search" placeholder="Search cards..." autocomplete="off" />
        <div class="small muted" id="galleryCount">0 cards</div>
      </div>

      <div class="galleryGridWrap">
        <div class="galleryGrid" id="galleryGrid"></div>
        <p class="small" id="galleryEmpty" style="display:none;margin-top:12px;">No matching cards.</p>
      </div>
    </div>
  </div>
</div>

<!-- Deck Picker Modal -->
<div class="modalOverlay" id="deckOverlay" aria-hidden="true">
  <div class="modal deckModal" id="deckModal" role="dialog" aria-modal="true" aria-labelledby="deckTitle">
    <div class="modalHead">
      <b id="deckTitle">Select a Card</b>
      <button class="closeBtn" id="closeDeckBtn" type="button">Close</button>
    </div>

    <div class="modalBody deckBody">
      <div class="deckPickLeft">
        
        <div class="deckSearchWrap">
          <div class="deckSearchBox">
            <span class="deckSearchIcon" aria-hidden="true">🔎</span>
            <input id="deckSearchInput" type="text" placeholder="Search cards… (name / rarity)" autocomplete="off" />
            <button class="deckSearchClear" id="deckSearchClear" type="button" title="Clear" aria-label="Clear search">×</button>
          </div>
          <div class="deckSearchDropdown" id="deckSearchDropdown" style="display:none;"></div>
          <div class="deckSearchMeta" id="deckSearchMeta" style="display:none;"></div>
        </div>
    
        <div class="deckHint" id="deckHint">Choose a card to place into the slot.</div>
        <div class="deckPickGrid" id="deckPickGrid"></div>
        <div class="deckEmpty" id="deckEmpty" style="display:none;">You don’t own any cards yet.</div>
      </div>

      <div class="deckPickRight">
        <div class="deckDetailsTitle">Card Details</div>
        <div class="deckDetailsCard">
          <img id="deckDetailsImg" src="cards/card.png" alt="Card preview" />
          <div class="deckDetailsInfo">
            <div class="deckDetailsName" id="deckDetailsName">—</div>
            <div class="deckDetailsLine">Rarity: <span id="deckDetailsRarity">—</span></div>
            <div class="deckDetailsLine">Pull chance: <span id="deckDetailsChance">—</span></div>
            <div class="deckDetailsLine">Mutation: <span id="deckDetailsMutation">—</span></div>
            <div class="deckDetailsLine">Gold/sec: <span id="deckDetailsGps">—</span></div>
          </div>
        </div>

        <button class="primaryBtn" id="deckSelectBtn" type="button" disabled>Select for Slot</button>
      </div>
    </div>
  </div>
</div>

<!-- Inventory Modal -->
<div class="modalOverlay" id="invOverlay" aria-hidden="true">
  <div class="modal invModal" id="invModal" role="dialog" aria-modal="true" aria-labelledby="invTitle">
    <div class="modalHead">
      <b id="invTitle">Inventory</b>
      <button class="closeBtn" id="closeInvBtn" type="button">Close</button>
    </div>

    <div class="modalBody invBody">
      <div class="invLayout">
        <div class="invTabs" id="invTabs">
          <button class="invTab isActive" data-tab="packs" type="button">
            <span>Packs</span>
            <span class="pill invTabBadge" id="invPacksBadge" style="display:none;">0</span>
          </button>
          <button class="invTab" data-tab="cards" type="button">
            <span>Cards</span>
            <span class="pill invTabBadge" id="invCardsBadge" style="display:none;">0</span>
          </button>
          <button class="invTab" data-tab="pets" type="button">
            <span>Pets</span>
            <span class="pill invTabBadge" id="invPetsBadge" style="display:none;">0</span>
          </button>
        </div>

        <div class="invPanel">
          <!-- Packs -->
          <div class="invPanelSection" id="invPanelPacks">
            <div class="invModalTop">
              <p class="small">Total packs: <b id="invTotal">0</b></p>
              <span class="small muted">Open packs to get cards.</span>
            </div>

            <div class="invModalGrid" id="invModalGrid"></div>
            <p class="small" id="invModalEmpty" style="margin:10px 0 0; display:none;">No packs yet.</p>
          </div>

          <!-- Pets -->
          <div class="invPanelSection" id="invPanelPets" style="display:none;">
            <div class="petsGrid" id="invPetsGrid"></div>
            <p class="small" id="invPetsEmpty" style="display:none;margin-top:12px;">You don’t own any pets yet.</p>
          </div>

          <!-- Cards -->
          <div class="invPanelSection" id="invPanelCards" style="display:none;">
            <div class="cardsHeaderRow">
              <div>
                <b class="cardsTitle">Your Cards</b>
                <div class="small muted">Manage your collection, search, and protect favorites.</div>
              </div>
              <button class="btn btnGhost" id="sellAllCardsBtn" type="button" title="Sell all cards in your collection">Sell All</button>
            </div>

            <div class="cardsTools">
              <input id="cardsSearchInput" class="cardsSearch" type="text" placeholder="Search cards..." />
              <div class="cardsCounts">
                <span class="small">Total: <b id="cardsTotalCount">0</b></span>
                <span class="small">Hearted Cards: <b id="cardsHeartedCount">0</b></span>
              </div>
            </div>

            <div class="cardsGrid" id="cardsGrid"></div>
            <p class="small" id="cardsEmpty" style="display:none;margin-top:12px;">You don’t own any cards yet.</p>
          </div>

          </div>
        </div>
      </div>

      <div class="okRow">
        <button class="btn btnPrimary" id="invOkBtn" type="button">OK</button>
      </div>
    </div>
  </div>
</div>


<!-- Send Gift Modal (Inventory > Cards) -->
<div class="modalOverlay" id="giftSendOverlay">
  <div class="modal modalWide">
    <div class="modalHeader">
      <h2>Send Gift</h2>
      <button class="closeBtn" id="closeGiftSendBtn" type="button">Close</button>
    </div>

    <div class="modalBody giftSendBody">
      <div class="giftReceiverRow">
        <div class="giftLabelRow">
          <div class="giftLabel">Receiver name</div>
          <div class="giftSub muted small">Choose a receiver and send the selected card as a gift.</div>
        </div>
        <input id="giftReceiverInput" class="giftReceiverInput" type="text" placeholder="Enter username..." autocomplete="off" />
      </div>

      <div class="giftPreviewWrap">
        <div id="giftPreviewCard" class="giftPreviewCard" role="button" tabindex="0" aria-label="Selected card preview"></div>
        <div class="giftPreviewNote muted small">Hover / long-press the card to view full details.</div>
      </div>
    </div>

    <div class="okRow giftSendActions">
      <button class="btn btnPrimary" id="giftSendBtn" type="button" disabled>Send</button>
    </div>
  </div>
</div>


<!-- Rewards Modal -->
<div class="modalOverlay" id="rewardsOverlay" aria-hidden="true">
  <div class="modal rewardsModal" id="rewardsModal" role="dialog" aria-modal="true" aria-labelledby="rewardsTitle">
    <div class="modalHead">
      <b id="rewardsTitle">Rewards</b>
      <button class="closeBtn" id="closeRewardsBtn" type="button">Close</button>
    </div>

    <div class="modalBody rewardsBody">
      <div class="rewardGridWrap">
        <div class="rewardGrid" id="rewardGrid"></div>
      </div>

      <div class="okRow">
        <button class="btn btnPrimary okBtn" id="rewardsOkBtn" type="button" disabled>OK</button>
      </div>
    </div>
  </div>
</div>



<!-- Notifications Modal -->
<div class="modalOverlay" id="notifOverlay" aria-hidden="true">
  <div class="modal notifModal" id="notifModal" role="dialog" aria-modal="true" aria-labelledby="notifTitle">
    <div class="modalHead">
      <b id="notifTitle">Notifications</b>
      <button class="closeBtn" id="closeNotifBtn" type="button">Close</button>
    </div>

    <div class="modalBody notifBody">
      <div class="notifLayout">
        <div class="notifTabs" id="notifTabs">
          <button class="notifTab isActive" data-tab="rewards" type="button">
            <span>Rewards</span>
            <span class="pill notifTabBadge" id="notifRewardsBadge" style="display:none;">0</span>
          </button>
          <button class="notifTab" data-tab="howto" type="button">How to Play</button>
          <button class="notifTab" data-tab="lucky" type="button">Lucky Draw Gacha</button>
          <button class="notifTab" data-tab="mutation" type="button">Mutation Machine</button>
<button class="notifTab" data-tab="usersearch" type="button">Search User</button>
          <button class="notifTab" data-tab="messages" type="button">
            <span>Messages</span>
            <span class="pill notifTabBadge" id="notifMessagesBadge" style="display:none;">0</span>
          </button>
          <button class="notifTab" data-tab="settings" type="button">Settings <span class="muted">(Coming Soon)</span></button>        </div>

        <div class="notifPanel">
          <div id="notifContent"></div>
        </div>
      </div>

      <div class="okRow">
        <button class="btn btnPrimary" id="notifOkBtn" type="button">OK</button>
      </div>
    </div>
  </div>
</div>


<!-- Mutation Machine: Card Select Modal -->
<div class="modalOverlay" id="mmSelectOverlay" aria-hidden="true">
  <div class="modal deckModal mmSelectModal" id="mmSelectModal" role="dialog" aria-modal="true" aria-labelledby="mmSelectTitle">
    <div class="modalHead">
      <b id="mmSelectTitle">Select a Card</b>
      <button class="closeBtn" id="closeMmSelectBtn" type="button">Close</button>
    </div>

    <div class="modalBody deckBody">
      <div class="deckPickLeft">
        <div class="deckHint" id="mmSelectHint">Choose 1 card to insert into the Mutation Machine.</div>
        <div class="deckSearchWrap">
          <div class="deckSearchBox">
            <span class="deckSearchIcon" aria-hidden="true">🔎</span>
            <input id="mmSearchInput" type="text" placeholder="Search cards… (name / rarity)" autocomplete="off" />
            <button class="deckSearchClear" id="mmSearchClear" type="button" title="Clear" aria-label="Clear search">×</button>
          </div>
        </div>
        <div class="deckPickGrid" id="mmPickGrid"></div>
        <p class="small" id="mmPickEmpty" style="display:none;margin-top:10px;">No eligible cards found.</p>
      </div>

      <div class="deckPickRight">
        <div class="deckDetailsTitle">Card Details</div>
        <div class="deckDetailsCard">
          <img id="mmDetailsImg" src="cards/card.png" alt="Card preview" />
          <div class="deckDetailsInfo">
            <div class="deckDetailsName" id="mmDetailsName">—</div>
            <div class="deckDetailsLine">Rarity: <span id="mmDetailsRarity">—</span></div>
            <div class="deckDetailsLine">Pull chance: <span id="mmDetailsChance">—</span></div>
            <div class="deckDetailsLine">Mutation: <span id="mmDetailsMutation">—</span></div>
            <div class="deckDetailsLine">Gold/sec: <span id="mmDetailsGps">—</span></div>
          </div>
        </div>

        <button class="primaryBtn" id="mmSelectBtn" type="button" disabled>Select</button>
      </div>
    </div>
  </div>
</div>



<!-- Trade Gifts: Card Select Modal -->
<div class="modalOverlay" id="tradeSelectOverlay" aria-hidden="true">
  <div class="modal deckModal mmSelectModal tradeSelectModal" id="tradeSelectModal" role="dialog" aria-modal="true" aria-labelledby="tradeSelectTitle">
    <div class="modalHead">
      <b id="tradeSelectTitle">Select a Card to Send</b>
      <button class="closeBtn" id="closeTradeSelectBtn" type="button">Close</button>
    </div>

    <div class="modalBody deckBody">
      <div class="deckPickLeft">
        <div class="deckHint" id="tradeSelectHint">Choose 1 card to gift. Any mutation / any stacked mutations are allowed.</div>
        <div class="deckPickGrid" id="tradePickGrid"></div>
        <p class="small" id="tradePickEmpty" style="display:none;margin-top:10px;">No cards found.</p>
      </div>

      <div class="deckPickRight">
        <div class="deckDetailsTitle">Card Details</div>
        <div class="deckDetailsCard">
          <img id="tradeDetailsImg" src="cards/card.png" alt="Card preview" />
          <div class="deckDetailsInfo">
            <div class="deckDetailsName" id="tradeDetailsName">—</div>
            <div class="deckDetailsLine">Rarity: <span id="tradeDetailsRarity">—</span></div>
            <div class="deckDetailsLine">Pull chance: <span id="tradeDetailsChance">—</span></div>
            <div class="deckDetailsLine">Mutation: <span id="tradeDetailsMutation">—</span></div>
            <div class="deckDetailsLine">Gold/sec: <span id="tradeDetailsGps">—</span></div>
          </div>
        </div>

        <button class="primaryBtn" id="tradeSelectBtn" type="button" disabled>Select</button>
      </div>
    </div>
  </div>
</div>
<!-- Mutation Machine: Result Modal -->
<div class="modalOverlay" id="mmResultOverlay" aria-hidden="true">
  <div class="modal luckyResultModal mmResultModal" id="mmResultModal" role="dialog" aria-modal="true" aria-labelledby="mmResultTitle">
    <div class="modalHead">
      <b id="mmResultTitle">Mutation Result</b>
      <button class="closeBtn" id="closeMmResultBtn" type="button">Close</button>
    </div>

    <div class="modalBody luckyResultBody">
      <div class="luckyResultCard">
        <div class="luckyResultName" id="mmResultName">—</div>
        <div class="luckyResultImgWrap" id="mmResultImgWrap">
          <div class="mmFlipCard energyCharge" id="mmFlipCard">
            <div class="mmFlipInner">
              <div class="mmFlipFace mmFlipBack">
                <img src="cards/card.png" alt="Card back" />
              </div>
              <div class="mmFlipFace mmFlipFront">
                <img id="mmResultImg" src="cards/card.png" alt="Mutated card" />
                <div class="mmMutationBurst" aria-hidden="true"></div>
              </div>
            </div>
          </div></div>
        <div class="small muted" id="mmResultMeta">—</div>
      </div>

      <div class="okRow">
        <button class="btn btnPrimary" id="mmResultOkBtn" type="button">OK</button>
      </div>
    </div>
  </div>
</div>

<!-- Lucky Draw Result Modal -->
<div class="modalOverlay" id="luckyResultOverlay" aria-hidden="true">
  <div class="modal luckyResultModal" id="luckyResultModal" role="dialog" aria-modal="true" aria-labelledby="luckyResultTitle">
    <div class="modalHead">
      <b id="luckyResultTitle">Lucky Draw Reward</b>
      <button class="closeBtn" id="closeLuckyResultBtn" type="button">Close</button>
    </div>

    <div class="modalBody luckyResultBody">
      <div class="luckyResultCard">
        <div class="luckyResultName" id="luckyResultName">—</div>
        <div class="luckyResultImgWrap">
          <img id="luckyResultImg" src="cards/card.png" alt="Lucky draw reward" />
        </div>
        <div class="small muted" id="luckyResultMeta">—</div>
      </div>

      <div class="okRow">
        <button class="btn btnPrimary" id="luckyResultOkBtn" type="button">OK</button>
      </div>
    </div>
  </div>
</div>


</div>



<!-- Profile Modal -->
<div class="modalOverlay" id="profileOverlay" aria-hidden="true">
  <div class="modal profileModal" id="profileModal" role="dialog" aria-modal="true" aria-labelledby="profileTitle">
    <div class="modalHead">
      <b id="profileTitle">Profile</b>
      <button class="closeBtn" id="closeProfileBtn" type="button">Logout</button>
    </div>

    <div class="modalBody">
      <div class="profileTop">
        <div class="profileBigAvatar" id="profileAvatarFrameWrap">
          <div class="profileAvatarWrap" id="profileAvatarWrapModal"><img id="profileModalAvatarImg" src="profile/profile.png" alt="Avatar" onerror="this.style.display='none'"></div>
        </div>
        <div class="profileMeta">
          <div class="profileUserRow">
            <div class="profileUserName" id="profileUserName">Player</div><span class="statusDot offline" id="profileModalStatusDot" aria-label="Offline" title="Offline"></span>
            <div class="profileEquippedTitle hidden" id="profileEquippedTitle"></div>
          </div>
          <div class="profileStatRow">
            <div class="profileStat">
              <div class="k">Total Cards</div>
              <div class="v" id="profileTotalCards">0</div>
            </div>
          </div>
        </div>
      </div>

      
<div class="profileSection">
  <div class="profileSectionTitle">🔥 Player Power Snapshot</div>
  <div class="profileDashGrid">
    <div class="profileDash">
      <div class="k">Current GPS</div>
      <div class="v" id="profileCurGps">0</div>
      <div class="s">Live from your decks</div>
    </div>
    <div class="profileDash">
      <div class="k">Tower Multiplier</div>
      <div class="v" id="profileTowerMult">1.0x</div>
      <div class="s">Based on Summoner tier</div>
    </div>
    <div class="profileDash">
      <div class="k">Tower Stored</div>
      <div class="v" id="profileTowerStored">0</div>
      <div class="s">Ready to collect</div>
    </div>
    <div class="profileDash">
      <div class="k">Top Rarity Owned</div>
      <div class="v" id="profileTopRarity">COMMON</div>
      <div class="s" id="profileRarityCount">0 cards</div>
    </div>
  </div>
</div>

<div class="profileSection">
  <div class="profileSectionTitle">🎨 Profile Theme Selector</div>
  <div class="small muted" style="margin-top:-6px;margin-bottom:10px;">Pick a theme for your UI. Saved automatically.</div>
  <div class="profileThemeGrid" id="profileThemeGrid"></div>
</div>

<div class="profileSection">
  <div class="profileSectionTitle">💎 Cosmetics (Valentines)</div>
  <div class="small muted" style="margin-top:-6px;margin-bottom:10px;">Equip Rose Frame / Premium Title if you own them (permanent).</div>
  <div id="profileCosmeticsGrid"></div>
</div>

<div class="profileSection">
  <div class="profileSectionTitle">🏆 Achievement Badges</div>
  <div class="small muted" style="margin-top:-6px;margin-bottom:10px;">Unlock badges by playing. Hover/press to see details.</div>
  <div class="profileBadgesGrid" id="profileBadgesGrid"></div>
</div>

<div class="profileSection">
  <div class="profileSectionTitle">Flex Showcase (3 slots)</div>

  <!-- Same layout as Notifications > Search User Flex Showcase -->
  <div class="profileFlexGrid userFlexRow">
    <div class="profileFlexSlot userFlexSlot" data-slot="0">
      <div class="userFlexEmpty">Empty</div>
      <div class="flexSub">Tap to pick</div>
    </div>
    <div class="profileFlexSlot userFlexSlot" data-slot="1">
      <div class="userFlexEmpty">Empty</div>
      <div class="flexSub">Tap to pick</div>
    </div>
    <div class="profileFlexSlot userFlexSlot" data-slot="2">
      <div class="userFlexEmpty">Empty</div>
      <div class="flexSub">Tap to pick</div>
    </div>
  </div>

  <div class="profileSmall">Pick any owned cards to show off. Saved automatically.</div>
</div>

      <div class="modalActions">
        <button class="btn btnPrimary okBtn" id="profileOkBtn" type="button">OK</button>
      </div>
    </div>
  </div>
</div>


<!-- Leaderboards Modal -->
<div class="modalOverlay" id="leaderboardOverlay" aria-hidden="true">
  <div class="modal leaderboardModal" id="leaderboardModal" role="dialog" aria-modal="true" aria-labelledby="leaderboardTitle">
    <div class="modalHead">
      <b id="leaderboardTitle">Leaderboards</b>
      <button class="closeBtn" id="closeLeaderboardBtn" type="button" aria-label="Close">✕</button>
    </div>

    <div class="modalBody">
      <div class="small muted" style="margin-bottom:10px;">Ranks are sorted by your <b>highest</b> recorded GPS (Gold/sec).</div>
      <div id="leaderboardBody"></div>

      <div class="okRow">
        <button class="btn btnPrimary" id="leaderboardOkBtn" type="button">OK</button>
      </div>
    </div>
  </div>
</div>

<!-- Summoners Modal -->
<div class="modalOverlay" id="summonersOverlay" aria-hidden="true">
  <div class="modal summonersModal" id="summonersModal" role="dialog" aria-modal="true" aria-labelledby="summonersTitle">
    <div class="modalHead">
      <b id="summonersTitle">Summoners</b>
      <button class="closeBtn" id="closeSummonersBtn" type="button">Close</button>
    </div>

    <div class="modalBody summonersBody">
      <div class="summonersLayout">
        <div class="summonersLeft">
          <div class="summonersList" id="summonersList"></div>
          <div class="summonersLeftBottom">
            <div class="small muted" id="summonerOwnedHint">Selected: <span id="selectedSummonerName">Roylier</span></div>
            <button class="btn btnPrimary" id="upgradeSummonerBtn" type="button">Upgrade</button>
          </div>
        </div>

        <div class="summonersRight">
          <div class="summonerDetails">
            <div class="summonerTitleRow">
              <b id="summonerDetailName">Roylier</b>
              <span class="pill" id="summonerDetailLevel">Lv. 1</span>
            </div>
            <p class="small" id="summonerDetailText">Free summoner. A calm, efficient commander who boosts your collection journey.</p>
            <div class="detailDivider"></div>
            <div class="detailStats">
              <div class="stat"><span class="muted">Bonus</span><b id="summonerBonusText">+0%</b></div>
              <div class="stat"><span class="muted">Upgrade Cost</span><b id="summonerUpgradeCost">100</b></div>
            </div>
            <div class="detailDivider"></div>
            <div class="summonerReq">
              <div class="summonerReqTitle">Next Upgrade Requirements</div>
              <div class="small" id="summonerReqText">—</div>
            </div>
          </div>
        </div>
      </div>

      <div class="okRow">
        <button class="btn btnPrimary" id="summonersOkBtn" type="button">OK</button>
      </div>
    </div>
  </div>
</div>


<!-- How to Play (Beginner Guide) -->
<div class="modalOverlay" id="howtoOverlay" aria-hidden="true">
  <div class="modal howtoModal" id="howtoModal" role="dialog" aria-modal="true" aria-labelledby="howtoTitle">
    <div class="modalHead">
      <b id="howtoTitle">How to Play</b>
      <button class="closeBtn" id="closeHowToBtn" type="button">Close</button>
    </div>

    <div class="modalBody howtoBody">
      <div class="howtoLayout">
        <div class="howtoTabs" id="howtoTabs"></div>

        <div class="howtoMain">
          <div class="howtoTop">
            <div class="howtoStepTitle" id="howtoStepTitle">—</div>
            <div class="howtoDots" id="howtoDots" aria-hidden="true"></div>
          </div>

          <div class="howtoContent" id="howtoContent"></div>

          <div class="howtoFooter">
            <label class="howtoDontShow">
              <input type="checkbox" id="howtoDontShow" />
              <span>Don’t show again</span>
            </label>

            <div class="howtoNav">
              <button class="btn" id="howtoBackBtn" type="button">Back</button>
              <button class="btn btnPrimary" id="howtoNextBtn" type="button">Next</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</div>

<!-- Mobile Rotate Overlay (shows when phone is in portrait) -->
</div>

<div class="toastWrap" id="toasts"></div>

<!-- Valentines Event Modal -->
<div class="modalOverlay" id="valentinesOverlay" aria-hidden="true">
  <div class="modal valModal" id="valentinesModal" role="dialog" aria-modal="true" aria-labelledby="valentinesTitle">
    <div class="modalHead">
      <div class="valHeadRow">
        <b id="valentinesTitle">💘 Bonds of Fate</b>
        <div class="valMetaRow">
          <span class="valChip timer" title="Event countdown"><span>Event ends in:</span> <b id="valEndsIn">—</b></span>
          <span class="valChip heart" title="Event currency"><span class="dot" aria-hidden="true"></span><span>Heart Crystals:</span> <b id="valHearts">0</b></span>
          <span class="valChip" title="Anti-RNG currency"><span>🎟 Fate Tokens:</span> <b id="valTokens">0</b></span>
          <button class="valChip helpBtn" id="openValHelpBtn" type="button" title="How the event works" aria-haspopup="dialog" aria-controls="valentinesHelpOverlay">❓ How Event Works</button>
        </div>
      </div>
      <button class="closeBtn" id="closeValentinesBtn" type="button" aria-label="Close">✕</button>
    </div>
    <div class="modalBody">
      <div class="valLayout">
        <aside class="valLeft" aria-label="Valentines navigation">
          <div class="valLeftHeader">
            <div class="valLeftKicker">VALENTINE'S EVENT</div>
            <div class="valLeftName">Bonds of Fate</div>
            <div class="valLeftHint">Pick a section to explore.</div>
          </div>

          <div class="valTabs" id="valTabs" role="tablist" aria-label="Valentines Event Tabs">
        <button class="valTab isActive" type="button" data-tab="overview" role="tab" aria-selected="true">Overview</button>
        <button class="valTab" type="button" data-tab="forge" role="tab" aria-selected="false">Bond Forge</button>
        <button class="valTab" type="button" data-tab="shop" role="tab" aria-selected="false">Love Shop</button>
        <button class="valTab" type="button" data-tab="milestones" role="tab" aria-selected="false">Milestones</button>
        <button class="valTab" type="button" data-tab="leader" role="tab" aria-selected="false">Event Leaderboard</button>
      </div>

          <div class="valLeftFooter">
            <div class="valLeftNote">Tip: Do daily missions for Hearts + Tokens. Sacrifice extra cards for big Heart gains.</div>
          </div>
        </aside>

        <section class="valCenter" aria-label="Event artwork">
          <div class="valHero" role="img" aria-label="Valentine's Event Updated artwork"></div>
        </section>

        <section class="valRight" aria-label="Valentines content">
          <div class="valRightHeader">
            <div class="valRightTitle">Event Hub</div>
            <div class="valRightSub">Your progress, missions, forging, and rewards live here.</div>
          </div>
          <div class="valBody" id="valBody" aria-live="polite"></div>
        </section>
      </div>
    </div>
</div>
  </div>
</div>


<!-- Valentines Event Help Modal -->
<div class="modalOverlay" id="valentinesHelpOverlay" aria-hidden="true">
  <div class="modal valHelpModal" id="valentinesHelpModal" role="dialog" aria-modal="true" aria-labelledby="valHelpTitle">
    <div class="modalHead">
      <div class="valHeadRow">
        <b id="valHelpTitle">💖 How the Valentines Event Works</b>
        <div class="valMetaRow">
          <span class="valChip heart" title="Your Heart Crystals"><span class="dot" aria-hidden="true"></span><span>Heart Crystals:</span> <b id="valHelpHearts">0</b></span>
          <span class="valChip" title="Your Fate Tokens"><span>🎟 Fate Tokens:</span> <b id="valHelpTokens">0</b></span>
        </div>
      </div>
      <button class="closeBtn" id="closeValHelpBtn" type="button" aria-label="Close">✕</button>
    </div>

    <div class="modalBody valHelpBody">
      <div class="valHelpIntro">
        <div class="valHelpBig">💘 Bonds of Fate is a limited-time event where you bind cards, earn Hearts, and craft guaranteed rewards with Fate Tokens.</div>
        <div class="small muted">Tip: Hearts are your spend currency. Fate Tokens are your guaranteed “pity” currency.</div>
      </div>

      <div class="valHelpGrid">
        <section class="valHelpCard">
          <h3>💎 Heart Crystals</h3>
          <p><b>What it is:</b> The main event currency you grind and spend.</p>
          <div class="valHelpListTitle">How to earn Hearts</div>
          <ul class="valHelpList">
            <li><b>Card Sacrifice:</b> Permanently sacrifice cards for Hearts (higher rarity = more Hearts, mutations add bonus).</li>
            <li><b>Daily Missions:</b> Rotating objectives that award Hearts (and sometimes Fate Tokens).</li>
            <li><b>Gold Donation:</b> Trade gold for Hearts (limited per day).</li>
            <li><b>Love Storm:</b> Optional bonus window that increases event gains.</li>
          </ul>
          <div class="valHelpListTitle">What Hearts are for</div>
          <ul class="valHelpList">
            <li>Buy <b>Valentines Packs</b> (exclusive event cards)</li>
            <li>Buy <b>Bond Booster</b> (+25% Bond XP for 10 minutes)</li>
            <li>Buy <b>Mutation Polish</b> (reroll mutation once/day)</li>
            <li>Buy <b>Fate Token bundles</b> and cosmetics</li>
          </ul>
        </section>

        <section class="valHelpCard">
          <h3>🎟 Fate Tokens</h3>
          <p><b>What it is:</b> Anti-RNG currency for <b>guaranteed crafting</b>. No gambling.</p>
          <div class="valHelpListTitle">How to earn Tokens</div>
          <ul class="valHelpList">
            <li><b>Daily Missions</b> (most consistent)</li>
            <li><b>Bond Forge bonus rolls</b> (chance-based bonus)</li>
            <li><b>Milestones</b> (guaranteed levels)</li>
            <li><b>Love Shop bundles</b> (optional, costs Hearts)</li>
          </ul>
          <div class="valHelpListTitle">Guaranteed crafting</div>
          <div class="valCraftRow">
            <div class="valCraftChip"><b>10</b> Tokens → Guaranteed <b>Valentine Card</b></div>
            <div class="valCraftChip"><b>25</b> Tokens → Guaranteed <b>Mutation Seed</b></div>
            <div class="valCraftChip"><b>40</b> Tokens → <b>Premium</b> Frame/Title Cosmetic</div>
          </div>
        </section>

        <section class="valHelpCard">
          <h3>🔥 Bond Forge</h3>
          <p><b>Core mechanic:</b> Choose <b>Card A</b> + <b>Card B</b> → press <b>Bind</b>. Both cards are consumed.</p>
          <div class="valHelpListTitle">You gain</div>
          <ul class="valHelpList">
            <li><b>Bond XP</b> (levels up your event progress)</li>
            <li><b>Fate Score</b> (for event leaderboard / bragging)</li>
            <li><b>Bonus rewards</b> chance (Tokens, Hearts, XP boosts)</li>
          </ul>
          <div class="valHelpListTitle">Bond bonuses (strategy)</div>
          <ul class="valHelpList">
            <li><b>Same rarity:</b> +20% XP</li>
            <li><b>Same name (duplicate):</b> +30% “True Love”</li>
            <li><b>Both mutated:</b> +25%</li>
            <li><b>Same mutation:</b> +15%</li>
          </ul>
        </section>

        <section class="valHelpCard">
          <h3>🏆 Milestones</h3>
          <p>Bond XP increases your <b>Bond Level</b>. Each level unlocks <b>guaranteed rewards</b> so progress always feels good.</p>
          <ul class="valHelpList">
            <li>Cosmetics (badges, frames, auras)</li>
            <li>Packs and crafting materials</li>
            <li>Guaranteed Valentine card at key levels</li>
          </ul>
          <p class="small muted">Milestone rewards are permanent and saved to your account.</p>
        </section>

        <section class="valHelpCard">
          <h3>💝 Valentines Packs</h3>
          <p>Event packs contain a new rarity: <b>Valentines</b> (rose glow + gold trim).</p>
          <ul class="valHelpList">
            <li>Exclusive event card pool (limited-time)</li>
            <li>Supports mutations like other cards</li>
            <li>Counts toward your collection and deck like normal cards</li>
          </ul>
        </section>

        <section class="valHelpCard">
          <h3>💾 Saving & Safety</h3>
          <ul class="valHelpList">
            <li>Your Hearts, Tokens, Bond XP, and rewards are saved using your normal save system.</li>
            <li>Sacrificed / forged cards are <b>permanently consumed</b>. Use the confirm prompts.</li>
            <li>No pets are used in this event.</li>
          </ul>
        </section>
      </div>

      <div class="okRow">
        <button class="btn btnPrimary" id="valHelpOkBtn" type="button">OK</button>
      </div>
    </div>
  </div>
</div>

  <div id="cardTooltip" class="cardTooltip" aria-hidden="true"></div>
  <div id="deckCardActions" class="deckCardActions hidden" aria-hidden="true">
    <div class="dcaHead"><b id="dcaTitle">Card</b><button id="dcaClose" class="closeBtn" type="button">×</button></div>
    <div class="dcaBody">
      <div class="dcaMeta" id="dcaMeta"></div>
      <div class="dcaBtns">
        <button id="dcaKeep" class="primaryBtn" type="button">Keep in Inventory</button>
        <button id="dcaSell" class="dangerBtn" type="button">Sell Card</button>
      </div>
    </div>
  </div>
  <script>
window.__USER__ = <?php echo json_encode(['id'=>$u['id'], 'username'=>$u['username'], 'email'=>$u['email']], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); ?>;
window.__FRESH_LOGIN__ = <?php echo isset($_GET['fresh']) ? 'true' : 'false'; ?>;
window.__SERVER_STATE__ = <?php echo json_encode($state, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); ?>;
window.__SERVER_STATE_UPDATED_AT__ = <?php echo json_encode($state_updated_at_ms, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); ?>;
</script>
<script src="app.js"></script>

<!-- Currency + Placeholder Modal -->
<div class="modalOverlay" id="currencyPlusOverlay" aria-hidden="true">
  <div class="modal currencyPlusModal" role="dialog" aria-modal="true" aria-labelledby="currencyPlusTitle">
    <div class="modalHead">
      <b id="currencyPlusTitle">Coming Soon</b>
      <button class="closeBtn" id="closeCurrencyPlusBtn" type="button" aria-label="Close">✕</button>
    </div>
    <div class="modalBody">
      <div class="small muted" id="currencyPlusText" style="font-size:13px; line-height:1.6;">Placeholder</div>
      <div class="modalActions" style="margin-top:14px;">
        <button class="btn btnPrimary" id="currencyPlusOkBtn" type="button">OK</button>
      </div>
    </div>
  </div>
</div>

</body>
</html>
