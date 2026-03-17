// === Player Application Controller ===

const playerApp = {
  myTeamId: null,
  myTeam: null,

  async init() {
    await GameState.init(false);

    // Check if team was previously selected
    const savedTeam = localStorage.getItem('olw_myTeam');
    if (savedTeam) {
      this.myTeamId = savedTeam;
    }

    // Listen for game state changes
    dbListen('gameSession', (data) => {
      if (data) {
        GameState.loadFromDb(data);
        this.onGameStateChange(data);
      }
    });
  },

  onGameStateChange(data) {
    // Update team list if we haven't selected yet
    if (!this.myTeamId && data.teams && data.teams.length > 0) {
      this.renderTeamSelection(data.teams);
    }

    // If we have a team, update our reference
    if (this.myTeamId && data.teams) {
      this.myTeam = data.teams.find(t => t.id === this.myTeamId);
      this.updateHeader();
    }

    // Handle phase changes
    if (data.phase && this.myTeamId) {
      this.handlePhase(data.phase);
    }
  },

  // Render team selection buttons
  renderTeamSelection(teams) {
    const grid = document.getElementById('teamSelectGrid');
    grid.innerHTML = '';
    teams.forEach(team => {
      const btn = document.createElement('div');
      btn.className = 'team-select-btn';
      btn.style.backgroundColor = team.color;
      btn.innerHTML = `
        <strong>${team.name || 'Team ' + team.number}</strong>
        <div class="team-members-small">${team.members.join(', ')}</div>
      `;
      btn.addEventListener('click', () => this.selectTeam(team.id));
      grid.appendChild(btn);
    });
  },

  selectTeam(teamId) {
    this.myTeamId = teamId;
    localStorage.setItem('olw_myTeam', teamId);
    this.myTeam = GameState.teams.find(t => t.id === teamId);
    this.updateHeader();
    document.getElementById('playerHeader').classList.remove('hidden');

    // Go to appropriate phase
    this.handlePhase(GameState.phase);
  },

  updateHeader() {
    if (this.myTeam) {
      document.getElementById('playerTeamLabel').textContent =
        `${this.myTeam.name || 'Team ' + this.myTeam.number} — ${this.myTeam.members.join(', ')}`;
    }
  },

  handlePhase(phase) {
    // Determine what player should see
    switch (phase) {
      case 'setup':
      case 'teamReveal':
        if (!this.myTeamId) {
          this.showSection('teamSelect-section');
        } else {
          this.showSection('waiting-section');
          this.setStatus('Wachten op de spelleider...');
        }
        break;

      case 'teamNaming':
        if (this.myTeam && !this.myTeam.name) {
          this.showSection('teamName-section');
        } else {
          this.showSection('waiting-section');
          this.setStatus('Teamnaam al gekozen!');
        }
        break;

      case 'wheel':
      case 'ranking':
      case 'challengeReveal':
        this.showSection('waiting-section');
        this.setStatus('Kijk naar het scherm!');
        this.updateMiniScoreboard();
        break;

      case 'betting':
        // Only saloon teams can bet
        if (GameState.saloonTeams && GameState.saloonTeams.includes(this.myTeamId)) {
          this.showBetting();
        } else {
          this.showSection('waiting-section');
          this.setStatus('Jullie strijden! Veel succes!', true);
        }
        break;

      case 'blufshot':
        this.showBlufshot();
        break;

      case 'challenge':
      case 'winner':
      case 'scoring':
      case 'scoreReveal':
        this.showSection('waiting-section');
        this.setStatus('Kijk naar het scherm!');
        this.updateMiniScoreboard();
        break;

      case 'winkel':
      case 'duel':
        this.showSection('waiting-section');
        this.setStatus('Kijk naar het scherm!');
        break;

      case 'scoreboard':
        this.showSection('waiting-section');
        this.setStatus('Scorebord');
        this.updateMiniScoreboard();
        break;

      default:
        this.showSection('waiting-section');
        this.setStatus('Wachten...');
    }
  },

  showSection(sectionId) {
    document.querySelectorAll('.phase-container').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(sectionId);
    if (el) el.classList.add('active');
  },

  setStatus(text, isCompeting) {
    const bar = document.getElementById('statusBar');
    bar.textContent = text;
    bar.className = 'status-bar mt-2';
    if (isCompeting) bar.classList.add('competing');
    else bar.classList.add('saloon');
  },

  updateMiniScoreboard() {
    const container = document.getElementById('miniScoreboard');
    if (!container) return;
    const sorted = [...GameState.teams].sort((a, b) => b.score - a.score);
    container.innerHTML = sorted.map(t => `
      <div class="mini-score-row" style="border-left: 4px solid ${t.color}">
        <span class="name">${t.name || 'Team ' + t.number}</span>
        <span class="pts">${t.score} pts</span>
      </div>
    `).join('');
  },

  // === TEAM NAMING ===
  async submitTeamName() {
    const input = document.getElementById('teamNameInput');
    const name = input.value.trim();
    if (!name) {
      alert('Vul een teamnaam in!');
      return;
    }
    await GameState.setTeamName(this.myTeamId, name);
    document.getElementById('nameConfirmed').classList.remove('hidden');
    input.disabled = true;
  },

  // === BETTING ===
  showBetting() {
    this.showSection('betting-section');
    document.getElementById('betConfirmed').classList.add('hidden');

    const container = document.getElementById('betButtons');
    container.innerHTML = '';
    container.classList.remove('hidden');

    GameState.competingTeams.forEach(id => {
      const t = getTeamById(GameState.teams, id);
      const btn = document.createElement('button');
      btn.className = 'bet-btn';
      btn.style.backgroundColor = t.color;
      btn.textContent = t.name || 'Team ' + t.number;
      btn.addEventListener('click', () => this.submitBet(id));
      container.appendChild(btn);
    });

    // Listen for lock
    dbListen('currentBetting/locked', (locked) => {
      if (locked) {
        this.showSection('waiting-section');
        this.setStatus('Stemming gesloten! Kijk naar het scherm.');
        dbRemoveListener('currentBetting/locked');
      }
    });
  },

  async submitBet(teamId) {
    await GameState.submitBet(this.myTeamId, teamId);
    document.getElementById('betButtons').classList.add('hidden');
    document.getElementById('betConfirmed').classList.remove('hidden');
  },

  // === BLUFSHOT ===
  showBlufshot() {
    this.showSection('blufshot-section');
    document.getElementById('guessConfirmed').classList.add('hidden');
    document.querySelectorAll('.guess-btn').forEach(btn => {
      btn.classList.remove('selected');
      btn.disabled = false;
    });

    // Listen for current participant
    dbListen('currentBlufshot', (data) => {
      if (data) {
        document.getElementById('playerBlufParticipant').textContent = data.participant || '';

        if (data.guessesOpen) {
          // Reset if new participant
          document.getElementById('guessConfirmed').classList.add('hidden');
          document.querySelectorAll('.guess-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.disabled = false;
          });
          // Check if we already guessed
          if (data.guesses && data.guesses[this.myTeamId]) {
            this.markGuessSubmitted(data.guesses[this.myTeamId]);
          }
        } else {
          // Guesses closed
          document.querySelectorAll('.guess-btn').forEach(btn => btn.disabled = true);
        }
      }
    });
  },

  async submitBlufGuess(shotNumber) {
    await GameState.submitBlufGuess(this.myTeamId, shotNumber);
    this.markGuessSubmitted(shotNumber);
  },

  markGuessSubmitted(shotNumber) {
    document.querySelectorAll('.guess-btn').forEach((btn, idx) => {
      btn.disabled = true;
      if (idx + 1 === parseInt(shotNumber)) btn.classList.add('selected');
    });
    document.getElementById('guessConfirmed').classList.remove('hidden');
  }
};

// Init on load
window.addEventListener('DOMContentLoaded', () => {
  playerApp.init();
});
