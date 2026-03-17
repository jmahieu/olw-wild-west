// === Scoreboard & Scoring Logic ===

// Standard betting score calculation
// winnerTeamId: the team that won the challenge
// bets: { saloonTeamId: competingTeamId } - which team each saloon team bet on
function calculateBettingScore(winnerTeamId, bets) {
  const points = {};
  const betsOnWinner = [];

  Object.entries(bets || {}).forEach(([bettingTeam, betOnTeam]) => {
    if (betOnTeam === winnerTeamId) {
      betsOnWinner.push(bettingTeam);
    }
  });

  const numBets = betsOnWinner.length;
  // Winner gets: 12, 9, 6, or 3 depending on number of bets
  points[winnerTeamId] = Math.max(3, 12 - (3 * numBets));

  // Each correct bettor gets 3
  betsOnWinner.forEach(teamId => {
    points[teamId] = 3;
  });

  return points;
}

// Blufshot score: 3 points per correct guess
// correctShot: number (1-4)
// guesses: { teamId: shotNumber }
function calculateBlufShotScore(correctShot, guesses) {
  const points = {};
  Object.entries(guesses || {}).forEach(([teamId, guess]) => {
    points[teamId] = (parseInt(guess) === parseInt(correctShot)) ? 3 : 0;
  });
  return points;
}

// Apply points to teams array
function applyPoints(teams, pointsMap) {
  teams.forEach(team => {
    if (pointsMap[team.id]) {
      team.score += pointsMap[team.id];
    }
  });
}

// Generate scoreboard HTML for host
function renderScoreboard(teams) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  return sorted.map((team, idx) => {
    return {
      rank: idx + 1,
      team: team,
      isTop3: idx < 3
    };
  });
}
