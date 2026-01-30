// frontend/js/systems/turnSystem.js

/**
 * Return all alive party members.
 */
export function getAliveParty(party) {
  if (!Array.isArray(party)) return [];
  return party.filter(m => m && m.hp > 0);
}

/**
 * Return the index of the first alive member in the party,
 * or -1 if everyone is down.
 */
export function getFirstAliveIndex(party) {
  if (!Array.isArray(party)) return -1;
  for (let i = 0; i < party.length; i++) {
    const m = party[i];
    if (m && m.hp > 0) return i;
  }
  return -1;
}
