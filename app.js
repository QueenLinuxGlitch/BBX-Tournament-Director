const STORAGE_KEY = "bbx-tourney-director-v1";

const defaultState = {
  players: [],
  settings: {
    stadium: "Takara Tomy BX-10 Xtreme Stadium",
    swissBattleType: "3on3",
    swissMatchType: 4,
    topCutBattleType: "3on3",
    topCutMatchType: 4,
    swissRounds: 3,
    topCutSize: 8,
    winPoints: 1,
    optionalRules: {
      swiss: {
        ownFinish: false,
        outOfBoundsFinish: false,
        outOfBoundsPoints: 1,
        registeredDeckList: false,
        registeredSideDeck: false,
        paintedBlades: false,
        mnUnbanned: false
      },
      topCut: {
        ownFinish: false,
        outOfBoundsFinish: false,
        outOfBoundsPoints: 1,
        registeredDeckList: false,
        registeredSideDeck: false,
        paintedBlades: false,
        mnUnbanned: false
      }
    }
  },
  swissRounds: [],
  topCutRounds: []
};

let state = loadState();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? mergeState(saved) : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function mergeState(saved) {
  const savedSettings = saved.settings || {};
  const settings = {
    ...defaultState.settings,
    ...savedSettings,
    optionalRules: {
      swiss: { ...defaultState.settings.optionalRules.swiss, ...(savedSettings.optionalRules?.swiss || {}) },
      topCut: { ...defaultState.settings.optionalRules.topCut, ...(savedSettings.optionalRules?.topCut || {}) }
    },
    swissBattleType: savedSettings.swissBattleType || savedSettings.battleType || defaultState.settings.swissBattleType,
    swissMatchType: Number(savedSettings.swissMatchType || savedSettings.matchType || defaultState.settings.swissMatchType),
    topCutBattleType: savedSettings.topCutBattleType || savedSettings.battleType || defaultState.settings.topCutBattleType,
    topCutMatchType: Number(savedSettings.topCutMatchType || savedSettings.matchType || defaultState.settings.topCutMatchType)
  };
  const players = (saved.players || []).map(normalizeEntry);
  return {
    ...structuredClone(defaultState),
    ...saved,
    settings,
    players,
    swissRounds: saved.swissRounds || [],
    topCutRounds: saved.topCutRounds || []
  };
}

function normalizeEntry(entry) {
  if (entry.type === "team") {
    return {
      id: entry.id || uid(),
      type: "team",
      name: entry.name || "Unnamed Team",
      members: Array.isArray(entry.members) ? entry.members.map(normalizeMember) : []
    };
  }

  const decklist = Array.isArray(entry.decklist) ? entry.decklist : splitDecklist(entry.decklist || "");
  return {
    id: entry.id || uid(),
    type: "solo",
    name: entry.name || "Unnamed Blader",
    members: [{ name: entry.name || "Unnamed Blader", decklist }]
  };
}

function normalizeMember(member) {
  return {
    name: member.name || "Unnamed Blader",
    decklist: Array.isArray(member.decklist) ? member.decklist : splitDecklist(member.decklist || "")
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function playerName(id) {
  return state.players.find((player) => player.id === id)?.name || "Unknown";
}

function completedSwissMatches() {
  return state.swissRounds.flatMap((round) => round.matches).filter((match) => match.winnerId || match.isDraw);
}

function standings() {
  const rows = state.players.map((player) => ({
    id: player.id,
    name: player.name,
    wins: 0,
    losses: 0,
    draws: 0,
    byes: 0,
    matchPoints: 0,
    battlePoints: 0,
    opponents: []
  }));

  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const match of completedSwissMatches()) {
    const a = byId.get(match.playerAId);
    const b = match.playerBId ? byId.get(match.playerBId) : null;
    if (!a) continue;

    if (!b) {
      a.wins += 1;
      a.byes += 1;
      a.matchPoints += Number(state.settings.winPoints);
      continue;
    }

    a.battlePoints += Number(match.scoreA || 0);
    b.battlePoints += Number(match.scoreB || 0);
    a.opponents.push(b.id);
    b.opponents.push(a.id);

    if (match.isDraw) {
      a.draws += 1;
      b.draws += 1;
      a.matchPoints += 0.5;
      b.matchPoints += 0.5;
    } else if (match.winnerId === a.id) {
      a.wins += 1;
      b.losses += 1;
      a.matchPoints += Number(state.settings.winPoints);
    } else if (match.winnerId === b.id) {
      b.wins += 1;
      a.losses += 1;
      b.matchPoints += Number(state.settings.winPoints);
    }
  }

  for (const row of rows) {
    row.buchholz = row.opponents.reduce((sum, opponentId) => {
      return sum + (byId.get(opponentId)?.matchPoints || 0);
    }, 0);
  }

  return rows.sort((a, b) =>
    b.matchPoints - a.matchPoints ||
    b.buchholz - a.buchholz ||
    b.battlePoints - a.battlePoints ||
    a.name.localeCompare(b.name)
  );
}

function hasPlayed(idA, idB) {
  return completedSwissMatches().some((match) => {
    return [match.playerAId, match.playerBId].includes(idA) && [match.playerAId, match.playerBId].includes(idB);
  });
}

function currentRound() {
  return state.swissRounds[state.swissRounds.length - 1];
}

function currentRoundComplete() {
  const round = currentRound();
  if (!round) return true;
  return round.matches.every((match) => match.winnerId || match.isDraw);
}

function generateSwissRound() {
  if (state.players.length < 2) {
    alert("Add at least two players before generating a round.");
    return;
  }
  if (!currentRoundComplete()) {
    alert("Finish the current round before generating another one.");
    return;
  }
  if (state.swissRounds.length >= Number(state.settings.swissRounds)) {
    alert("All configured Swiss rounds have already been generated.");
    return;
  }

  const seeded = standings();
  const unpaired = [...seeded];
  const matches = [];

  if (unpaired.length % 2 === 1) {
    const byeCandidate = [...unpaired].reverse().find((row) => row.byes === 0) || unpaired[unpaired.length - 1];
    unpaired.splice(unpaired.findIndex((row) => row.id === byeCandidate.id), 1);
    matches.push({
      id: uid(),
      playerAId: byeCandidate.id,
      playerBId: null,
      scoreA: Number(state.settings.swissMatchType),
      scoreB: 0,
      winnerId: byeCandidate.id,
      isDraw: false,
      battles: []
    });
  }

  while (unpaired.length) {
    const player = unpaired.shift();
    let opponentIndex = unpaired.findIndex((candidate) => !hasPlayed(player.id, candidate.id));
    if (opponentIndex === -1) opponentIndex = 0;
    const opponent = unpaired.splice(opponentIndex, 1)[0];
    matches.push({
      id: uid(),
      playerAId: player.id,
      playerBId: opponent.id,
      scoreA: "",
      scoreB: "",
      winnerId: "",
      isDraw: false,
      battles: []
    });
  }

  state.swissRounds.push({
    id: uid(),
    number: state.swissRounds.length + 1,
    matches
  });
  saveState();
}

function addBattle(stage, matchId, winnerSide, finishType) {
  const match = findMatch(stage, matchId);
  if (!match || !winnerSide || !finishType) return;
  match.battles = match.battles || [];
  const points = finishPoints(stage, finishType);
  if (points === null) return;
  match.battles.push({
    id: uid(),
    winnerSide,
    finishType,
    points
  });
  recalculateMatchFromBattles(stage, match);
  saveState();
}

function deleteBattle(stage, matchId, battleId) {
  const match = findMatch(stage, matchId);
  if (!match) return;
  match.battles = (match.battles || []).filter((battle) => battle.id !== battleId);
  recalculateMatchFromBattles(stage, match);
  saveState();
}

function findMatch(stage, matchId) {
  const rounds = stage === "topCut" ? state.topCutRounds : state.swissRounds;
  return rounds.flatMap((round) => round.matches).find((match) => match.id === matchId);
}

function recalculateMatchFromBattles(stage, match) {
  const target = stage === "topCut" ? Number(state.settings.topCutMatchType) : Number(state.settings.swissMatchType);
  const totals = { a: 0, b: 0 };
  for (const battle of match.battles || []) {
    if (battle.winnerSide === "a") totals.a += Number(battle.points || 0);
    if (battle.winnerSide === "b") totals.b += Number(battle.points || 0);
  }
  match.scoreA = Math.min(totals.a, target);
  match.scoreB = Math.min(totals.b, target);
  match.isDraw = false;
  match.winnerId = "";
  if (totals.a >= target && totals.a > totals.b) match.winnerId = match.playerAId;
  if (totals.b >= target && totals.b > totals.a) match.winnerId = match.playerBId;
}

function finishPoints(stage, finishType) {
  const rules = stageRules(stage);
  const points = {
    spin: 1,
    burst: 2,
    over: 2,
    xtreme: 3,
    own: rules.ownFinish ? 1 : null,
    outOfBounds: rules.outOfBoundsFinish ? Number(rules.outOfBoundsPoints) : null
  };
  return points[finishType] ?? null;
}

function stageRules(stage) {
  return state.settings.optionalRules?.[stage] || defaultState.settings.optionalRules[stage];
}

function finishOptions(stage) {
  const rules = stageRules(stage);
  const options = [
    ["spin", "Spin Finish - 1"],
    ["burst", "Burst Finish - 2"],
    ["over", "Over Finish - 2"],
    ["xtreme", "Xtreme Finish - 3"]
  ];
  if (rules.ownFinish) options.push(["own", "Own Finish - 1"]);
  if (rules.outOfBoundsFinish) options.push(["outOfBounds", `Out-of-Bounds Finish - ${rules.outOfBoundsPoints}`]);
  return options;
}

function finishLabel(finishType) {
  return {
    spin: "Spin Finish",
    burst: "Burst Finish",
    over: "Over Finish",
    xtreme: "Xtreme Finish",
    own: "Own Finish",
    outOfBounds: "Out-of-Bounds Finish"
  }[finishType] || "Finish";
}

function seedTopCut() {
  const requestedCutSize = Number(state.settings.topCutSize);
  const cutSize = largestPowerOfTwoAtMost(Math.min(requestedCutSize, state.players.length));
  if (cutSize < 2) {
    alert("Top cut requires at least two players.");
    return;
  }
  if (!currentRoundComplete()) {
    alert("Finish the current Swiss round before seeding top cut.");
    return;
  }

  const seeded = standings().slice(0, cutSize);
  const seeds = seeded.map((row, index) => ({ seed: index + 1, playerId: row.id }));
  const pairOrder = bracketPairings(cutSize);
  const matches = pairOrder.map(([seedA, seedB]) => {
    const a = seeds.find((seed) => seed.seed === seedA);
    const b = seeds.find((seed) => seed.seed === seedB);
    return {
      id: uid(),
      seedA,
      seedB,
      playerAId: a?.playerId || null,
      playerBId: b?.playerId || null,
      scoreA: "",
      scoreB: "",
      winnerId: "",
      battles: []
    };
  });

  state.topCutRounds = [{ id: uid(), name: roundName(cutSize), matches }];
  saveState();
}

function largestPowerOfTwoAtMost(value) {
  let size = 1;
  while (size * 2 <= value) size *= 2;
  return size;
}

function bracketPairings(size) {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const next = seeds.length * 2 + 1;
    seeds = seeds.flatMap((seed) => [seed, next - seed]);
  }
  const pairs = [];
  for (let i = 0; i < seeds.length; i += 2) {
    pairs.push([seeds[i], seeds[i + 1]]);
  }
  return pairs;
}

function roundName(playersInRound) {
  if (playersInRound === 2) return "Final";
  if (playersInRound === 4) return "Semifinal";
  if (playersInRound === 8) return "Quarterfinal";
  return `Top ${playersInRound}`;
}

function buildNextCutRound() {
  const last = state.topCutRounds[state.topCutRounds.length - 1];
  if (!last) {
    alert("Seed the top cut first.");
    return;
  }
  if (!last.matches.every((match) => match.winnerId)) {
    alert("Record all winners in the current top cut round first.");
    return;
  }
  if (last.matches.length === 1) {
    alert(`${playerName(last.matches[0].winnerId)} is the champion.`);
    return;
  }

  const winners = last.matches.map((match) => match.winnerId);
  const matches = [];
  for (let i = 0; i < winners.length; i += 2) {
    matches.push({
      id: uid(),
      seedA: "",
      seedB: "",
      playerAId: winners[i],
      playerBId: winners[i + 1],
      scoreA: "",
      scoreB: "",
      winnerId: "",
      battles: []
    });
  }
  state.topCutRounds.push({ id: uid(), name: roundName(winners.length), matches });
  saveState();
}

function render() {
  renderSettings();
  renderStatus();
  renderParticipants();
  renderSwiss();
  renderStandings();
  renderTopCut();
}

function renderSettings() {
  setSelectValue("#stadium", state.settings.stadium, defaultState.settings.stadium);
  $("#swissBattleType").value = state.settings.swissBattleType;
  $("#swissMatchType").value = String(state.settings.swissMatchType);
  $("#topCutBattleType").value = state.settings.topCutBattleType;
  $("#topCutMatchType").value = String(state.settings.topCutMatchType);
  $("#swissRounds").value = state.settings.swissRounds;
  $("#topCutSize").value = String(state.settings.topCutSize);
  $("#winPoints").value = state.settings.winPoints;
  renderRuleFields("swiss");
  renderRuleFields("topCut");
  renderEntryTypeFields();
}

function renderRuleFields(stage) {
  const prefix = stage === "topCut" ? "topCut" : "swiss";
  const rules = stageRules(stage);
  $(`#${prefix}OwnFinish`).checked = rules.ownFinish;
  $(`#${prefix}OutOfBounds`).checked = rules.outOfBoundsFinish;
  $(`#${prefix}OutOfBoundsPoints`).value = String(rules.outOfBoundsPoints);
  $(`#${prefix}RegisteredDeckList`).checked = rules.registeredDeckList;
  $(`#${prefix}RegisteredSideDeck`).checked = rules.registeredSideDeck;
  $(`#${prefix}PaintedBlades`).checked = rules.paintedBlades;
  $(`#${prefix}MnUnbanned`).checked = rules.mnUnbanned;
}

function renderStatus() {
  $("#statusPlayers").textContent = state.players.length;
  $("#statusRound").textContent = `${state.swissRounds.length}/${state.settings.swissRounds}`;
  $("#statusSwissFormat").textContent = `${formatBattleType(state.settings.swissBattleType)} / ${state.settings.swissMatchType}-point`;
  $("#statusTopCutFormat").textContent = `${formatBattleType(state.settings.topCutBattleType)} / ${state.settings.topCutMatchType}-point`;
  $("#statusStadium").textContent = state.settings.stadium || "Not set";
  $("#statusCut").textContent = state.settings.topCutSize;
}

function renderParticipants() {
  const list = $("#participantList");
  const count = state.players.length;
  $("#playerCount").textContent = `${count} ${count === 1 ? "entry" : "entries"}`;
  list.innerHTML = "";
  list.classList.toggle("empty", count === 0);
  if (!count) {
    list.textContent = "No players added yet.";
    return;
  }
  for (const player of state.players) {
    const row = document.importNode($("#playerTemplate").content, true);
    const label = row.querySelector("span");
    label.innerHTML = entrySummaryHtml(player);
    row.querySelector(".edit-entry").addEventListener("click", () => editEntry(player.id));
    row.querySelector(".remove-entry").addEventListener("click", () => removePlayer(player.id));
    list.appendChild(row);
  }
}

function renderSwiss() {
  const info = $("#roundInfo");
  const pairings = $("#pairings");
  const round = currentRound();
  pairings.innerHTML = "";

  if (!round) {
    info.textContent = "Generate round 1 after adding players and saving the event settings.";
    return;
  }

  info.textContent = `Round ${round.number} of ${state.settings.swissRounds}. ${formatBattleType(state.settings.swissBattleType)}, ${state.settings.swissMatchType}-point matches.`;
  for (const match of round.matches) {
    pairings.appendChild(swissMatchNode(match));
  }
}

function swissMatchNode(match) {
  const row = document.createElement("div");
  row.className = "match-row";
  if (!match.playerBId) {
    row.innerHTML = `<div class="player-side"><strong>${escapeHtml(playerName(match.playerAId))}</strong><span class="seed-label">Bye</span></div><span class="versus">wins</span><div></div><div></div>`;
    return row;
  }

  row.innerHTML = `
    <div class="player-side">
      <span class="seed-label">Player A</span>
      ${entrantBriefHtml(match.playerAId)}
    </div>
    <span class="versus">vs</span>
    <div class="player-side">
      <span class="seed-label">Player B</span>
      ${entrantBriefHtml(match.playerBId)}
    </div>
    ${battleTrackerHtml("swiss", match)}
  `;

  bindBattleTracker(row, "swiss", match);
  return row;
}

function renderStandings() {
  const body = $("#standingsBody");
  body.innerHTML = "";
  standings().forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(row.name)}</strong></td>
      <td>${row.wins}</td>
      <td>${row.losses}</td>
      <td>${row.draws}</td>
      <td>${row.byes}</td>
      <td>${row.matchPoints}</td>
      <td>${row.buchholz}</td>
      <td>${row.battlePoints}</td>
    `;
    body.appendChild(tr);
  });
}

function renderTopCut() {
  const bracket = $("#bracket");
  const notice = $("#topCutNotice");
  bracket.innerHTML = "";

  if (!state.topCutRounds.length) {
    notice.textContent = "Seed the top cut from standings when Swiss is complete.";
    return;
  }

  const finalRound = state.topCutRounds[state.topCutRounds.length - 1];
  const champion = finalRound.matches.length === 1 && finalRound.matches[0].winnerId;
  notice.textContent = champion ? `Champion: ${playerName(champion)}` : `${formatBattleType(state.settings.topCutBattleType)}, ${state.settings.topCutMatchType}-point final stage.`;

  for (const round of state.topCutRounds) {
    const section = document.createElement("section");
    section.className = "cut-round";
    section.innerHTML = `<h3 class="round-title">${escapeHtml(round.name)}</h3>`;
    for (const match of round.matches) {
      section.appendChild(cutMatchNode(match));
    }
    bracket.appendChild(section);
  }
}

function cutMatchNode(match) {
  const row = document.createElement("div");
  row.className = "cut-match";
  const seedText = match.seedA ? `${match.seedA} vs ${match.seedB}` : "Winners advance";
  row.innerHTML = `
    <div>
      <span class="seed-label">${escapeHtml(seedText)}</span>
      <div class="cut-players">${entrantBriefHtml(match.playerAId)}<span class="versus">vs</span>${entrantBriefHtml(match.playerBId)}</div>
    </div>
    ${battleTrackerHtml("topCut", match)}
  `;
  bindBattleTracker(row, "topCut", match);
  return row;
}

function battleTrackerHtml(stage, match) {
  const totalA = Number(match.scoreA || 0);
  const totalB = Number(match.scoreB || 0);
  const target = stage === "topCut" ? Number(state.settings.topCutMatchType) : Number(state.settings.swissMatchType);
  const winnerText = match.winnerId ? `${playerName(match.winnerId)} wins` : `First to ${target}`;
  const options = finishOptions(stage).map(([value, label]) => {
    return `<option value="${value}">${escapeHtml(label)}</option>`;
  }).join("");
  const battleRows = (match.battles || []).map((battle, index) => {
    const winner = battle.winnerSide === "a" ? playerName(match.playerAId) : playerName(match.playerBId);
    return `
      <li>
        <span>Battle ${index + 1}: ${escapeHtml(winner)} - ${escapeHtml(finishLabel(battle.finishType))} (${battle.points})</span>
        <button type="button" class="mini-btn delete-battle" data-battle-id="${battle.id}">Remove</button>
      </li>
    `;
  }).join("");

  return `
    <div class="battle-tracker">
      <div class="scoreboard">
        <strong>${totalA}</strong>
        <span>-</span>
        <strong>${totalB}</strong>
        <em>${escapeHtml(winnerText)}</em>
      </div>
      <div class="battle-entry">
        <select class="battle-winner" aria-label="Battle winner">
          <option value="">Winner</option>
          <option value="a">${escapeHtml(playerName(match.playerAId))}</option>
          <option value="b">${escapeHtml(playerName(match.playerBId))}</option>
        </select>
        <select class="finish-type" aria-label="Finish type">
          <option value="">Finish</option>
          ${options}
        </select>
        <button type="button" class="ghost-btn add-battle">Add Battle</button>
      </div>
      <ol class="battle-log">${battleRows}</ol>
    </div>
  `;
}

function bindBattleTracker(row, stage, match) {
  const addButton = row.querySelector(".add-battle");
  addButton?.addEventListener("click", () => {
    const winner = row.querySelector(".battle-winner").value;
    const finish = row.querySelector(".finish-type").value;
    addBattle(stage, match.id, winner, finish);
  });
  row.querySelectorAll(".delete-battle").forEach((button) => {
    button.addEventListener("click", () => deleteBattle(stage, match.id, button.dataset.battleId));
  });
}

function addPlayer(name, decklist = "") {
  const clean = name.trim();
  if (!clean) return;
  if (state.players.some((player) => player.name.toLowerCase() === clean.toLowerCase())) return;
  state.players.push({
    id: uid(),
    type: "solo",
    name: clean,
    members: [{ name: clean, decklist: splitDecklist(decklist) }]
  });
  saveState();
}

function addTeam(teamName, memberText) {
  const cleanName = teamName.trim();
  const members = parseTeamMembers(memberText);
  if (!cleanName || members.length === 0) return;
  if (state.players.some((player) => player.name.toLowerCase() === cleanName.toLowerCase())) return;
  state.players.push({
    id: uid(),
    type: "team",
    name: cleanName,
    members
  });
  saveState();
}

function parseTeamMembers(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, ...deckParts] = line.split("|");
      return {
        name: (namePart || "").trim(),
        decklist: splitDecklist(deckParts.join("|"))
      };
    })
    .filter((member) => member.name);
}

function splitDecklist(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function entrySummaryHtml(entry) {
  const typeLabel = entry.type === "team" ? "Team" : "Solo";
  const members = entry.members || [];
  const memberHtml = members.map((member) => {
    const deck = member.decklist?.length ? member.decklist.join("; ") : "No decklist";
    return `<li><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(deck)}</span></li>`;
  }).join("");
  return `
    <span class="entry-name">${escapeHtml(entry.name)}</span>
    <span class="entry-type">${typeLabel}</span>
    <ul class="decklist">${memberHtml}</ul>
  `;
}

function entrantBriefHtml(id) {
  const entry = state.players.find((player) => player.id === id);
  if (!entry) return escapeHtml(playerName(id));
  const memberCount = entry.members?.length || 0;
  const deckCount = (entry.members || []).reduce((sum, member) => sum + (member.decklist?.length || 0), 0);
  const detail = entry.type === "team" ? `${memberCount} players, ${deckCount} Beys listed` : `${deckCount} Beys listed`;
  return `<strong>${escapeHtml(entry.name)}</strong><span class="seed-label">${escapeHtml(detail)}</span>`;
}

function removePlayer(id) {
  const playerHasMatches = state.swissRounds.some((round) =>
    round.matches.some((match) => match.playerAId === id || match.playerBId === id)
  ) || state.topCutRounds.some((round) =>
    round.matches.some((match) => match.playerAId === id || match.playerBId === id)
  );
  if (playerHasMatches && !confirm("This player is already paired. Remove them and clear event results?")) return;
  state.players = state.players.filter((player) => player.id !== id);
  if (playerHasMatches) {
    state.swissRounds = [];
    state.topCutRounds = [];
  }
  saveState();
}

function editEntry(id) {
  const entry = state.players.find((player) => player.id === id);
  if (!entry) return;

  const newName = prompt("Entry name", entry.name);
  if (newName === null || !newName.trim()) return;

  if (entry.type === "team") {
    const currentMembers = (entry.members || []).map((member) => {
      return `${member.name} | ${(member.decklist || []).join("; ")}`;
    }).join("\n");
    const newMembers = prompt("Team players and decklists. Use: Player name | decklist", currentMembers);
    if (newMembers === null) return;
    const members = parseTeamMembers(newMembers);
    if (!members.length) {
      alert("A team needs at least one player.");
      return;
    }
    entry.name = newName.trim();
    entry.members = members;
  } else {
    const currentDeck = entry.members?.[0]?.decklist?.join("\n") || "";
    const newDeck = prompt("Decklist. Use one Bey per line, or separate with semicolons.", currentDeck);
    if (newDeck === null) return;
    entry.name = newName.trim();
    entry.members = [{ name: entry.name, decklist: splitDecklist(newDeck) }];
  }
  saveState();
}

function saveSettingsFromForm() {
  state.settings = {
    stadium: $("#stadium").value || defaultState.settings.stadium,
    swissBattleType: $("#swissBattleType").value,
    swissMatchType: Number($("#swissMatchType").value),
    topCutBattleType: $("#topCutBattleType").value,
    topCutMatchType: Number($("#topCutMatchType").value),
    swissRounds: Number($("#swissRounds").value),
    topCutSize: Number($("#topCutSize").value),
    winPoints: Number($("#winPoints").value),
    optionalRules: {
      swiss: readRuleFields("swiss"),
      topCut: readRuleFields("topCut")
    }
  };
  saveState();
}

function setSelectValue(selector, value, fallback) {
  const select = $(selector);
  const hasValue = Array.from(select.options).some((option) => option.value === value);
  select.value = hasValue ? value : fallback;
  if (!hasValue) {
    state.settings.stadium = fallback;
  }
}

function readRuleFields(stage) {
  const prefix = stage === "topCut" ? "topCut" : "swiss";
  return {
    ownFinish: $(`#${prefix}OwnFinish`).checked,
    outOfBoundsFinish: $(`#${prefix}OutOfBounds`).checked,
    outOfBoundsPoints: Number($(`#${prefix}OutOfBoundsPoints`).value),
    registeredDeckList: $(`#${prefix}RegisteredDeckList`).checked,
    registeredSideDeck: $(`#${prefix}RegisteredSideDeck`).checked,
    paintedBlades: $(`#${prefix}PaintedBlades`).checked,
    mnUnbanned: $(`#${prefix}MnUnbanned`).checked
  };
}

function clearCurrentRound() {
  if (!state.swissRounds.length) return;
  if (!confirm("Clear the latest Swiss round?")) return;
  state.swissRounds.pop();
  saveState();
}

function copyStandings() {
  const text = standings()
    .map((row, index) => `${index + 1}. ${row.name} - ${row.matchPoints} pts, ${row.wins}-${row.losses}-${row.draws}, Buchholz ${row.buchholz}`)
    .join("\n");
  navigator.clipboard.writeText(text);
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bbx-tournament.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importState(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = mergeState(JSON.parse(reader.result));
      saveState();
    } catch {
      alert("That file is not a valid tournament export.");
    }
  };
  reader.readAsText(file);
}

function resetEvent() {
  if (!confirm("Reset the event and remove all saved local data?")) return;
  state = structuredClone(defaultState);
  saveState();
}

function formatBattleType(value) {
  if (value === "counter") return "Counter Battle";
  return `${value} Battle`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindEvents() {
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((item) => item.classList.remove("active"));
      $$(".view").forEach((view) => view.classList.remove("active"));
      tab.classList.add("active");
      $(`#${tab.dataset.tab}`).classList.add("active");
    });
  });

  $("#participantForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if ($("#entryType").value === "team") {
      addTeam($("#playerName").value, $("#teamMembers").value);
      $("#teamMembers").value = "";
    } else {
      addPlayer($("#playerName").value, $("#soloDecklist").value);
      $("#soloDecklist").value = "";
    }
    $("#playerName").value = "";
  });

  $("#bulkAddBtn").addEventListener("click", () => {
    $("#bulkPlayers").value.split(/\r?\n/).forEach(addPlayer);
    $("#bulkPlayers").value = "";
  });

  $("#saveSettingsBtn").addEventListener("click", saveSettingsFromForm);
  $("#settingsForm").addEventListener("change", saveSettingsFromForm);
  $("#entryType").addEventListener("change", renderEntryTypeFields);
  $("#generateRoundBtn").addEventListener("click", generateSwissRound);
  $("#clearRoundBtn").addEventListener("click", clearCurrentRound);
  $("#seedTopCutBtn").addEventListener("click", seedTopCut);
  $("#advanceCutBtn").addEventListener("click", buildNextCutRound);
  $("#copyStandingsBtn").addEventListener("click", copyStandings);
  $("#exportBtn").addEventListener("click", exportState);
  $("#importInput").addEventListener("change", (event) => event.target.files[0] && importState(event.target.files[0]));
  $("#resetBtn").addEventListener("click", resetEvent);
}

function renderEntryTypeFields() {
  const isTeam = $("#entryType").value === "team";
  $("#soloDeckFields").classList.toggle("hidden", isTeam);
  $("#teamFields").classList.toggle("hidden", !isTeam);
}

bindEvents();
render();
