// === Team Management ===

const ALL_PARTICIPANTS = [
  'Anaïs', 'Anneleen', 'Arseen', 'Hernot', 'Jan',
  'Janne', 'Leen VDA', 'Lenard', 'Lien', 'Linde',
  'Maaike', 'Mieke', 'Orinda', 'Ruud', 'Saartje',
  'Simon', 'Stijn', 'Tim', 'Velleke', 'Zana'
];

const TEAM_SIZES = [3, 3, 3, 3, 4, 4]; // 4 teams of 3, 2 teams of 4

const TEAM_COLORS = [
  { bg: '#C1440E', name: 'Roest' },
  { bg: '#2E5339', name: 'Saloon Groen' },
  { bg: '#4A6FA5', name: 'Hemelblauw' },
  { bg: '#DAA520', name: 'Goud' },
  { bg: '#7B2D8E', name: 'Paars' },
  { bg: '#1A5276', name: 'Donkerblauw' }
];

// Fisher-Yates shuffle
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createRandomTeams() {
  const shuffled = shuffle(ALL_PARTICIPANTS);
  const teams = [];
  let idx = 0;

  TEAM_SIZES.forEach((size, i) => {
    teams.push({
      id: `team${i + 1}`,
      number: i + 1,
      name: '', // Wordt later gekozen
      members: shuffled.slice(idx, idx + size),
      score: 0,
      color: TEAM_COLORS[i].bg,
      colorName: TEAM_COLORS[i].name
    });
    idx += size;
  });

  return teams;
}

function getTeamById(teams, id) {
  return teams.find(t => t.id === id);
}

// Rank teams by score descending, return ordered array of team ids
function rankTeams(teams) {
  return [...teams]
    .sort((a, b) => b.score - a.score)
    .map(t => t.id);
}

// Get bottom 3 (competing) and top 3 (saloon)
function splitTeams(teams) {
  const ranked = rankTeams(teams);
  return {
    saloon: ranked.slice(0, 3),    // top 3
    competing: ranked.slice(3, 6)  // bottom 3
  };
}
