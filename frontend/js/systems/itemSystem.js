// frontend/js/systems/itemSystem.js

import { items } from "../data/items.js";
import { applyHeal } from "./damageSystem.js";

/**
 * Resolve an inventory entry to an item definition from data/items.js.
 */
function getInventoryItemDef(entry) {
  if (!entry) return null;
  return items[entry.id] || null;
}

/**
 * Apply an item's effect to an actor.
 *
 * entry: { id, count }
 * actor: { hp, maxHp, movie }
 *
 * Returns:
 * {
 *   used: boolean,        // true if the item was actually consumed
 *   message: string,      // combat log text
 *   item?: {...}          // the item definition
 * }
 */
export function applyItemToActor(entry, actor) {
  const def = getInventoryItemDef(entry);
  if (!def) {
    return {
      used: false,
      message: "Nothing happens."
    };
  }

  // Healing items
  if (def.heal && def.heal > 0) {
    const healed = applyHeal(actor, def.heal);
    const shortTitle = actor.movie.title.slice(0, 10);
    const text = `${shortTitle} heals ${healed} HP with ${def.name}.`;
    return {
      used: healed > 0,
      message: text,
      item: def
    };
  }

  // Non-healing items can be expanded later
  return {
    used: false,
    message: `${def.name} has no effect (yet).`,
    item: def
  };
}
