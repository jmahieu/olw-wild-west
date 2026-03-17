// === Challenge Definitions ===

const CHALLENGES = [
  {
    id: 'lasso',
    name: 'Lasso-spel',
    description: 'Lasso-beweging maken op het juiste moment bij "Pisk mig hårdt". Laatste groepje standing wint!',
    icon: '🤠',
    type: 'standard',
    color: '#C1440E'
  },
  {
    id: 'dynamiet',
    name: 'Dynamiet-in-de-mijn',
    description: 'Gooi het dynamiet in de mijn (emmer), maar kom niet te dichtbij! Blijf buiten de cirkel van 2-3m.',
    icon: '💥',
    type: 'standard',
    color: '#8B0000'
  },
  {
    id: 'muziekkwis',
    name: 'Muziekkwis',
    description: 'Bluegrass/Country versies van bekende nummers. Raad om ter eerst welk nummer het is!',
    icon: '🎵',
    type: 'standard',
    color: '#4A6FA5'
  },
  {
    id: 'rodeo',
    name: 'Rodeo Stoelendans',
    description: '1 rodeo-rijder per team. Cowboy-stijl lopen om stoelen. Muziek stopt? ZITTEN! Laatste wint.',
    icon: '🐴',
    type: 'standard',
    color: '#8B4513'
  },
  {
    id: 'koetsenrace',
    name: 'Koetsenrace',
    description: 'Estafette! Eén persoon is de koets (op handen), ander houdt benen vast en "rijdt" door het parcours.',
    icon: '🏇',
    type: 'standard',
    color: '#2E5339'
  },
  {
    id: 'blufshot',
    name: 'Blufshot',
    description: 'Vier shotjes: 3x water, 1x tequila. ALLE teams raden welk shotje tequila is. 3 punten per juist antwoord!',
    icon: '🥃',
    type: 'blufshot',
    color: '#DAA520'
  },
  {
    id: 'afvalrace',
    name: 'Afvalrace',
    description: 'Schuif een shotglaasje over de tafel. Te ver of te kort? Afgevallen! Laatste overblijver wint.',
    icon: '🍺',
    type: 'standard',
    color: '#7B2D8E'
  },
  {
    id: 'mijnenveld',
    name: 'Mijnenveld',
    description: 'Vind de klomp goud! Neem de juiste weg door het mijnenveld.',
    icon: '⛏️',
    type: 'standard',
    color: '#1A5276'
  }
];

const EXTRAS = [
  {
    id: 'winkel',
    name: 'Winkel van Sinkel',
    description: 'Drankjes worden uitgeschonken (1 per team). Team aan de leiding kiest eerst. Laatste team drinkt de rest!',
    icon: '🍻',
    type: 'winkel',
    color: '#CD7F32',
    maxCount: 3
  },
  {
    id: 'duel',
    name: 'Duel',
    description: 'Daag een ander team uit! Kies je tegenstander en de inzet (aantal shotjes). Puur drinkspel!',
    icon: '⚔️',
    type: 'duel',
    color: '#3E2723',
    maxCount: 3
  }
];

// Build wheel items with extras interleaved between challenges
function buildWheelItems(playedChallenges = [], extraCounts = { winkel: 3, duel: 3 }) {
  const challenges = [];
  CHALLENGES.forEach(ch => {
    if (!playedChallenges.includes(ch.id)) {
      challenges.push({ ...ch });
    }
  });

  const extras = [];
  EXTRAS.forEach(ex => {
    const count = extraCounts[ex.id] || 0;
    for (let i = 0; i < count; i++) {
      extras.push({ ...ex, instanceId: `${ex.id}_${i}` });
    }
  });

  // Interleave: distribute extras evenly among challenges
  if (challenges.length === 0) return extras;
  if (extras.length === 0) return challenges;

  const items = [];
  const gap = Math.max(1, Math.ceil(challenges.length / (extras.length + 1)));
  let extraIdx = 0;

  for (let i = 0; i < challenges.length; i++) {
    items.push(challenges[i]);
    if ((i + 1) % gap === 0 && extraIdx < extras.length) {
      items.push(extras[extraIdx++]);
    }
  }
  // Append any remaining extras
  while (extraIdx < extras.length) {
    items.push(extras[extraIdx++]);
  }

  return items;
}

function getChallengeById(id) {
  return CHALLENGES.find(c => c.id === id) || EXTRAS.find(e => e.id === id);
}
