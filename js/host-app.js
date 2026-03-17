// === Host Application Controller ===

const hostApp = {
  wheel: null,
  bettingInterval: null,
  bettingSeconds: 30,

  async init() {
    await GameState.init(true);
    // Check if there's an existing game
    const existing = await dbGet('gameSession');
    if (existing && existing.teams && existing.teams.length > 0) {
      GameState.loadFromDb(existing);
      this.restorePhase();
    }
  },

  restorePhase() {
    // Restore to last known phase
    switch (GameState.phase) {
      case 'setup':
        // Stay on setup
        break;
      case 'teamReveal':
        this.renderTeamCards('teamsGrid', false);
        this.showPhase('teamReveal-phase');
        break;
      case 'teamNaming':
        this.renderTeamNaming();
        this.showPhase('teamNaming-phase');
        break;
      case 'ranking':
      case 'wheel':
      case 'betting':
      case 'challenge':
      case 'blufshot':
      case 'scoring':
      case 'scoreReveal':
      case 'scoreboard':
      case 'winkel':
      case 'duel':
        this.renderScoreboard();
        this.showPhase('scoreboard-phase');
        break;
      case 'results':
        this.showResults();
        break;
      default:
        // Unknown phase, stay on setup
        break;
    }
  },

  // Phase management
  showPhase(phaseId) {
    document.querySelectorAll('.phase-container').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(phaseId);
    if (el) el.classList.add('active');
  },

  // === SETUP ===
  async revealTeams() {
    await GameState.setupTeams();
    await GameState.setPhase('teamReveal');
    this.renderTeamCards('teamsGrid', false);
    this.showPhase('teamReveal-phase');
  },

  renderTeamCards(containerId, showScore) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    GameState.teams.forEach((team, idx) => {
      const card = document.createElement('div');
      card.className = `team-card`;
      card.style.backgroundColor = team.color;
      card.style.animationDelay = `${idx * 0.15}s`;
      card.innerHTML = `
        <h3>Team ${team.number}</h3>
        <div class="team-name-display" id="teamName_${team.id}">${team.name || '???'}</div>
        <div class="members">${team.members.join('<br>')}</div>
        ${showScore ? `<div class="team-score">${team.score} pts</div>` : ''}
      `;
      container.appendChild(card);
    });
  },

  // === TEAM NAMING ===
  async startTeamNaming() {
    await GameState.setPhase('teamNaming');
    this.renderTeamNaming();
    this.showPhase('teamNaming-phase');
    // Listen for name updates
    dbListen('gameSession/teams', (teams) => {
      if (teams) {
        GameState.teams = teams;
        this.updateTeamNames();
      }
    });
  },

  renderTeamNaming() {
    this.renderTeamCards('namingGrid', false);
  },

  updateTeamNames() {
    GameState.teams.forEach(team => {
      const el = document.getElementById(`teamName_${team.id}`);
      if (el && team.name) {
        el.textContent = team.name;
        el.style.animation = 'popIn 0.3s ease';
      }
    });
  },

  // === START GAME ===
  async startGame() {
    await GameState.startRound();
    await GameState.setPhase('ranking');
    this.showRanking();
  },

  // === SCOREBOARD ===
  showScoreboard() {
    this.renderScoreboard();
    GameState.setPhase('scoreboard');
    this.showPhase('scoreboard-phase');
  },

  renderScoreboard() {
    const container = document.getElementById('scoreboardDisplay');
    const data = renderScoreboard(GameState.teams);
    container.innerHTML = data.map(item => `
      <div class="scoreboard-row" style="border-left: 6px solid ${item.team.color}">
        <div class="rank-num">#${item.rank}</div>
        <div class="team-color-dot" style="background:${item.team.color}"></div>
        <div class="team-name">${item.team.name || 'Team ' + item.team.number}</div>
        <div class="team-points">${item.team.score} pts</div>
      </div>
    `).join('');
    document.getElementById('roundInfo').textContent = `Ronde ${GameState.round}`;
  },

  // === NEXT ROUND (from scoreboard) ===
  async nextRound() {
    await GameState.startRound();
    await GameState.setPhase('ranking');
    this.showRanking();
  },

  // === RANKING ===
  async showRanking() {
    document.getElementById('roundNumber').textContent = GameState.round;
    document.getElementById('roundInfo').textContent = `Ronde ${GameState.round}`;

    // Competing teams
    const compList = document.getElementById('competingList');
    compList.innerHTML = GameState.competingTeams.map(id => {
      const t = getTeamById(GameState.teams, id);
      return `<div class="ranking-team" style="background:${t.color};color:white;">
        <span class="team-info">${t.name || 'Team ' + t.number}</span>
        <span class="points">${t.score} pts</span>
      </div>`;
    }).join('');

    // Saloon teams
    const salList = document.getElementById('saloonList');
    salList.innerHTML = GameState.saloonTeams.map(id => {
      const t = getTeamById(GameState.teams, id);
      return `<div class="ranking-team" style="background:${t.color};color:white;">
        <span class="team-info">${t.name || 'Team ' + t.number}</span>
        <span class="points">${t.score} pts</span>
      </div>`;
    }).join('');

    await GameState.setPhase('ranking');
    this.showPhase('ranking-phase');
  },

  // === WHEEL ===
  showWheel() {
    this.showPhase('wheel-phase');
    const items = buildWheelItems(GameState.playedChallenges, GameState.extraCounts);

    if (items.length === 0) {
      alert('Alle opdrachten zijn gespeeld!');
      this.showResults();
      return;
    }

    this.wheel = new SpinningWheel('wheelCanvas', items);
    this.wheel.onResult = (result) => this.onWheelResult(result);

    document.getElementById('wheelHint').textContent = 'Klik op SPATIE om te draaien!';
    document.getElementById('wheelHint').classList.remove('hidden');

    this.wheelState = 'ready'; // ready -> spinning -> stopping -> done
  },

  onWheelResult(result) {
    if (!result) return;
    this.wheelState = 'done';
    document.getElementById('wheelHint').classList.add('hidden');

    GameState.setChallenge(result);

    // Short delay then show result
    setTimeout(() => {
      this.showChallengeReveal(result);
    }, 800);
  },

  showChallengeReveal(challenge) {
    document.getElementById('challengeName').textContent = challenge.icon + ' ' + challenge.name;
    document.getElementById('challengeDesc').textContent = challenge.description;

    const actions = document.getElementById('challengeActions');

    if (challenge.type === 'standard') {
      actions.innerHTML = `<button class="btn btn-green btn-large" onclick="hostApp.startBetting()">Start Gokronde</button>`;
    } else if (challenge.type === 'blufshot') {
      actions.innerHTML = `<button class="btn btn-gold btn-large" onclick="hostApp.startBlufshot()">Start Blufshot!</button>`;
    } else if (challenge.type === 'winkel') {
      actions.innerHTML = `<button class="btn btn-green btn-large" onclick="hostApp.showWinkel()">Ga Verder</button>`;
    } else if (challenge.type === 'duel') {
      actions.innerHTML = `<button class="btn btn-rust btn-large" onclick="hostApp.showDuel()">Start Duel!</button>`;
    }

    this.showPhase('challengeReveal-phase');
  },

  // === BETTING ===
  async startBetting() {
    await GameState.openBetting();
    this.showPhase('betting-phase');
    this.renderBettingDisplay();
    this.startBettingTimer();

    // Listen for votes
    dbListen('currentBetting/votes', (votes) => {
      this.updateVoteDisplay(votes || {});
    });
  },

  renderBettingDisplay() {
    const container = document.getElementById('bettingDisplay');
    container.innerHTML = GameState.competingTeams.map(id => {
      const t = getTeamById(GameState.teams, id);
      return `
        <div class="vote-bar-container">
          <div class="vote-bar-label">
            <span>${t.name || 'Team ' + t.number}</span>
            <span id="voteCount_${id}">0 stemmen</span>
          </div>
          <div class="vote-bar">
            <div class="vote-bar-fill" id="voteBar_${id}" style="width:0%;background:${t.color}"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  updateVoteDisplay(votes) {
    const counts = {};
    GameState.competingTeams.forEach(id => counts[id] = 0);
    Object.values(votes).forEach(betOn => {
      if (counts[betOn] !== undefined) counts[betOn]++;
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const maxVotes = 3; // max 3 saloon teams can vote

    GameState.competingTeams.forEach(id => {
      const bar = document.getElementById(`voteBar_${id}`);
      const count = document.getElementById(`voteCount_${id}`);
      if (bar) bar.style.width = `${(counts[id] / maxVotes) * 100}%`;
      if (count) count.textContent = `${counts[id]} ${counts[id] === 1 ? 'stem' : 'stemmen'}`;
    });
  },

  startBettingTimer() {
    this.bettingSeconds = 30;
    const timerEl = document.getElementById('bettingTimer');
    timerEl.textContent = this.bettingSeconds;

    this.bettingInterval = setInterval(() => {
      this.bettingSeconds--;
      timerEl.textContent = this.bettingSeconds;
      if (this.bettingSeconds <= 0) {
        this.lockBets();
      }
    }, 1000);
  },

  async lockBets() {
    if (this.bettingInterval) clearInterval(this.bettingInterval);
    dbRemoveListener('currentBetting/votes');
    await GameState.lockBetting();
    this.showWinnerSelection();
  },

  showWinnerSelection() {
    const container = document.getElementById('winnerButtons');
    container.innerHTML = GameState.competingTeams.map(id => {
      const t = getTeamById(GameState.teams, id);
      return `<button class="btn winner-btn" style="background:${t.color};color:white;"
                onclick="hostApp.selectWinner('${id}')">${t.name || 'Team ' + t.number}</button>`;
    }).join('');
    this.showPhase('winner-phase');
  },

  async selectWinner(teamId) {
    const points = GameState.applyBettingScore(teamId);
    await GameState.saveState();
    this.showRoundScore(points);
  },

  showRoundScore(points) {
    const container = document.getElementById('roundScoreDisplay');
    const entries = Object.entries(points)
      .filter(([_, pts]) => pts > 0)
      .sort((a, b) => b[1] - a[1]);

    container.innerHTML = entries.map(([teamId, pts]) => {
      const t = getTeamById(GameState.teams, teamId);
      return `
        <div class="scoreboard-row" style="border-left: 6px solid ${t.color}">
          <div class="team-name">${t.name || 'Team ' + t.number}</div>
          <div class="team-points score-update">+${pts} pts</div>
        </div>
      `;
    }).join('');

    this.showPhase('scoreReveal-phase');
  },

  // === BLUFSHOT ===
  async startBlufshot() {
    this.blufMembers = GameState.getBlufRepresentatives();
    this.blufIndex = 0;
    await GameState.setPhase('blufshot');
    await this.showBlufParticipant(0);
    this.showPhase('blufshot-phase');
  },

  async showBlufParticipant(index) {
    if (index >= this.blufMembers.length) {
      // All participants done, show final blufshot score
      this.showScoreboard();
      return;
    }

    const member = this.blufMembers[index];
    this.blufIndex = index;

    document.getElementById('blufParticipant').textContent = member.name;
    const team = getTeamById(GameState.teams, member.teamId);
    document.getElementById('blufTeamLabel').textContent = `(${team.name || 'Team ' + team.number})`;

    // Reset UI
    document.querySelectorAll('.shot-glass').forEach(sg => sg.classList.remove('revealed-correct'));
    for (let i = 1; i <= 4; i++) document.getElementById(`guessCount${i}`).textContent = '0';
    document.getElementById('blufActions').classList.remove('hidden');
    document.getElementById('blufRevealSection').classList.add('hidden');
    document.getElementById('blufNextSection').classList.add('hidden');

    await GameState.setBlufParticipant(member.name, index);

    // Listen for guesses
    dbListen('currentBlufshot/guesses', (guesses) => {
      this.updateBlufGuessDisplay(guesses || {});
    });
  },

  updateBlufGuessDisplay(guesses) {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    Object.values(guesses).forEach(shot => {
      if (counts[shot] !== undefined) counts[shot]++;
    });
    for (let i = 1; i <= 4; i++) {
      document.getElementById(`guessCount${i}`).textContent = counts[i];
    }
  },

  async lockBlufGuesses() {
    dbRemoveListener('currentBlufshot/guesses');
    await GameState.lockBlufGuesses();
    document.getElementById('blufActions').classList.add('hidden');
    document.getElementById('blufRevealSection').classList.remove('hidden');
  },

  async revealBlufShot(correctShot) {
    // Highlight correct shot
    document.querySelectorAll('.shot-glass').forEach(sg => {
      if (parseInt(sg.dataset.shot) === correctShot) {
        sg.classList.add('revealed-correct');
      }
    });

    const points = GameState.applyBlufShotScore(correctShot);
    await GameState.saveState();

    // Show round score
    const scoreHtml = Object.entries(points)
      .filter(([_, pts]) => pts > 0)
      .map(([teamId, pts]) => {
        const t = getTeamById(GameState.teams, teamId);
        return `<span style="color:${t.color};font-weight:bold;">${t.name || 'Team ' + t.number}: +${pts}</span>`;
      }).join(' | ');

    document.getElementById('blufRoundScore').innerHTML = scoreHtml || 'Niemand goed!';
    document.getElementById('blufRevealSection').classList.add('hidden');
    document.getElementById('blufNextSection').classList.remove('hidden');

    // Update button text if last participant
    if (this.blufIndex >= this.blufMembers.length - 1) {
      document.getElementById('blufNextBtn').textContent = 'Naar Scorebord';
    }
  },

  async nextBlufParticipant() {
    this.blufIndex++;
    if (this.blufIndex >= this.blufMembers.length) {
      this.showScoreboard();
    } else {
      await this.showBlufParticipant(this.blufIndex);
    }
  },

  // === WINKEL VAN SINKEL ===
  showWinkel() {
    const sorted = [...GameState.teams].sort((a, b) => b.score - a.score);
    const orderDiv = document.getElementById('winkelOrder');
    orderDiv.innerHTML = sorted.map((t, idx) => `
      <div class="ranking-team" style="background:${t.color};color:white;margin:0.5rem 0;">
        <span class="rank">${idx + 1}.</span>
        <span class="team-info">${t.name || 'Team ' + t.number}</span>
        <span>${idx === sorted.length - 1 ? '← drinkt de rest!' : 'kiest'}</span>
      </div>
    `).join('');
    this.showPhase('winkel-phase');
  },

  // === DUEL ===
  showDuel() {
    const content = document.getElementById('duelContent');
    content.innerHTML = `
      <p style="font-size:1.2rem;">Welk team daagt uit? En wie wordt uitgedaagd?</p>
      <p class="mt-2" style="font-family:'Rye',cursive;font-size:1.5rem;color:var(--rust);">
        Puur drinkspel — geen punten!
      </p>
      <p class="mt-2">De verliezer drinkt het afgesproken aantal shotjes.</p>
    `;
    this.showPhase('duel-phase');
  },

  // Finish extra (winkel/duel) and return to wheel
  async finishExtra() {
    this.showWheel();
  },

  // === FINAL RESULTS ===
  showResults() {
    const sorted = [...GameState.teams].sort((a, b) => b.score - a.score);

    // Podium
    const podium = document.getElementById('podium');
    const places = ['first', 'second', 'third'];
    const medals = ['🥇', '🥈', '🥉'];
    podium.innerHTML = sorted.slice(0, 3).map((t, i) => `
      <div class="podium-place ${places[i]}">
        <div class="podium-rank">${medals[i]}</div>
        <div class="podium-name">${t.name || 'Team ' + t.number}</div>
        <div class="podium-score">${t.score} punten</div>
      </div>
    `).join('');

    // Full scoreboard
    const sb = document.getElementById('finalScoreboard');
    sb.innerHTML = sorted.map((t, idx) => `
      <div class="scoreboard-row" style="border-left: 6px solid ${t.color}">
        <div class="rank-num">#${idx + 1}</div>
        <div class="team-name">${t.name || 'Team ' + t.number}</div>
        <div class="team-points">${t.score} pts</div>
      </div>
    `).join('');

    this.showPhase('results-phase');
  },

  // === RESET ===
  resetConfirm() {
    if (confirm('Weet je zeker dat je het spel wilt resetten? Alle voortgang gaat verloren!')) {
      GameState.resetGame().then(() => {
        location.reload();
      });
    }
  }
};

// === Keyboard controls ===
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (hostApp.wheel) {
      if (hostApp.wheelState === 'ready') {
        hostApp.wheel.spin();
        hostApp.wheelState = 'spinning';
        document.getElementById('wheelHint').textContent = 'Druk nogmaals op SPATIE om te stoppen!';
      } else if (hostApp.wheelState === 'spinning') {
        hostApp.wheel.stop();
        hostApp.wheelState = 'stopping';
        document.getElementById('wheelHint').textContent = 'Het rad stopt...';
      }
    }
  }
});

// Init on load
window.addEventListener('DOMContentLoaded', () => {
  hostApp.init();
});
