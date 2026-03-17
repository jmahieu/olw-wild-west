// === Central Game State Manager ===

const GameState = {
  phase: 'setup', // setup, teamNaming, wheel, ranking, betting, challenge, blufshot, scoring, winkel, duel, results
  round: 0,
  teams: [],
  currentChallenge: null,
  competingTeams: [],
  saloonTeams: [],
  playedChallenges: [],
  extraCounts: { winkel: 3, duel: 3 },
  bets: {},
  blufGuesses: {},
  blufCurrentParticipant: null,
  blufParticipantIndex: 0,
  blufCorrectShot: null,

  // Initialize game
  async init(isHost) {
    initFirebase();
    this.isHost = isHost;

    if (isHost) {
      // Host loads or creates game state
      const existing = await dbGet('gameSession');
      if (existing && existing.teams) {
        this.loadFromDb(existing);
      }
    }
  },

  loadFromDb(data) {
    if (data.phase) this.phase = data.phase;
    if (data.round) this.round = data.round;
    if (data.teams) this.teams = data.teams;
    if (data.currentChallenge) this.currentChallenge = data.currentChallenge;
    if (data.competingTeams) this.competingTeams = data.competingTeams;
    if (data.saloonTeams) this.saloonTeams = data.saloonTeams;
    if (data.playedChallenges) this.playedChallenges = data.playedChallenges;
    if (data.extraCounts) this.extraCounts = data.extraCounts;
  },

  // Save full state to Firebase
  async saveState() {
    await dbSet('gameSession', {
      phase: this.phase,
      round: this.round,
      teams: this.teams,
      currentChallenge: this.currentChallenge,
      competingTeams: this.competingTeams,
      saloonTeams: this.saloonTeams,
      playedChallenges: this.playedChallenges,
      extraCounts: this.extraCounts
    });
  },

  // Phase transitions
  async setPhase(phase) {
    this.phase = phase;
    await this.saveState();
  },

  // Setup teams
  async setupTeams() {
    this.teams = createRandomTeams();
    await this.saveState();
  },

  // Update team name
  async setTeamName(teamId, name) {
    const team = getTeamById(this.teams, teamId);
    if (team) {
      team.name = name;
      await dbSet(`gameSession/teams`, this.teams);
    }
  },

  // Start a new round
  async startRound() {
    this.round++;
    // Split teams based on current ranking
    if (this.round === 1) {
      // First round: random split (all teams are at 0)
      const shuffled = shuffle(this.teams.map(t => t.id));
      this.saloonTeams = shuffled.slice(0, 3);
      this.competingTeams = shuffled.slice(3, 6);
    } else {
      const split = splitTeams(this.teams);
      this.saloonTeams = split.saloon;
      this.competingTeams = split.competing;
    }
    this.bets = {};
    this.blufGuesses = {};
    await dbSet('currentBetting/votes', null);
    await dbSet('currentBetting/open', false);
    await dbSet('currentBlufshot', null);
    await this.saveState();
  },

  // Record wheel result
  async setChallenge(challenge) {
    this.currentChallenge = challenge;
    // Mark as played
    if (challenge.type === 'standard' || challenge.type === 'blufshot') {
      this.playedChallenges.push(challenge.id);
    } else if (challenge.type === 'winkel') {
      this.extraCounts.winkel = Math.max(0, this.extraCounts.winkel - 1);
    } else if (challenge.type === 'duel') {
      this.extraCounts.duel = Math.max(0, this.extraCounts.duel - 1);
    }
    await this.saveState();
  },

  // Open betting
  async openBetting() {
    this.bets = {};
    await dbSet('currentBetting', { open: true, votes: {}, locked: false });
    this.phase = 'betting';
    await this.saveState();
  },

  // Lock betting
  async lockBetting() {
    await dbSet('currentBetting/open', false);
    await dbSet('currentBetting/locked', true);
    // Read final votes
    const votes = await dbGet('currentBetting/votes');
    this.bets = votes || {};
  },

  // Submit bet (from player)
  async submitBet(teamId, betOnTeamId) {
    await dbSet(`currentBetting/votes/${teamId}`, betOnTeamId);
  },

  // Blufshot: set current participant
  async setBlufParticipant(name, index) {
    this.blufCurrentParticipant = name;
    this.blufParticipantIndex = index;
    await dbSet('currentBlufshot', {
      participant: name,
      index: index,
      guessesOpen: true,
      guesses: {}
    });
  },

  // Blufshot: submit guess
  async submitBlufGuess(teamId, shotNumber) {
    await dbSet(`currentBlufshot/guesses/${teamId}`, shotNumber);
  },

  // Blufshot: lock guesses and reveal
  async lockBlufGuesses() {
    await dbSet('currentBlufshot/guessesOpen', false);
    const guesses = await dbGet('currentBlufshot/guesses');
    this.blufGuesses = guesses || {};
  },

  // Apply standard betting score
  applyBettingScore(winnerTeamId) {
    const points = calculateBettingScore(winnerTeamId, this.bets);
    applyPoints(this.teams, points);
    return points;
  },

  // Apply blufshot score
  applyBlufShotScore(correctShot) {
    const points = calculateBlufShotScore(correctShot, this.blufGuesses);
    applyPoints(this.teams, points);
    return points;
  },

  // Get all competing team members (for Blufshot cycling)
  getCompetingMembers() {
    const members = [];
    this.competingTeams.forEach(teamId => {
      const team = getTeamById(this.teams, teamId);
      if (team) {
        team.members.forEach(m => members.push({ name: m, teamId: team.id, teamName: team.name }));
      }
    });
    return members;
  },

  // Reset game
  async resetGame() {
    this.phase = 'setup';
    this.round = 0;
    this.teams = [];
    this.currentChallenge = null;
    this.competingTeams = [];
    this.saloonTeams = [];
    this.playedChallenges = [];
    this.extraCounts = { winkel: 3, duel: 3 };
    this.bets = {};
    await dbSet('gameSession', null);
    await dbSet('currentBetting', null);
    await dbSet('currentBlufshot', null);
  }
};
