// frontend/js/battleText/lines/itemDialogueText.js
//
// Per-item battle dialogue lines used by item narration builders.
// Supported shapes:
// - itemId: ["line 1", "line 2"]
// - itemId: { default: [...], heal: [...], damage: [...], noEffect: [...] }
//
// Tokens available in each line:
// {actor}, {item}, {target}, {healed}, {damage}

export const itemDialogue = {
  fun_candy: {
    damage: [
      "{actor} pulls out a {item} out of their pocket and chucks it at {target}.",
      "{target} takes {damage} damage."
    ]
  },
  jumbo_candy: {
    damage: [
      "{item} lands like a brick of caramel.",
      "{target} takes {damage} damage."
    ]
  },
  nacho_bomb: {
    damage: [
      "{actor} chucks their box of nachos at {target}.",
      "{item} detonates in a hot, cheesy blast.",
      "{target} takes {damage} damage."
    ]
  },
  stale_popcorn: {
    damage: [
      "{actor} finds some Stale Popcorn on the floor and chucks it.",
      "{item} pelts {target} like tiny rocks.",
      "{target} takes {damage} damage."
    ]
  },
  camcorder: {
    damage: [
      "{actor} pulls out their {item} that they snuck into the theater.",
      "{item} floods the scene with a blinding flash.",
      "{target} takes {damage} damage."
    ]
  },
  camera_phone: {
    damage: [
      "{actor} pulls out their {item}.",
      "It turns on with a sharp white flash.",
      "{target} takes {damage} damage."
    ]
  },
  ringtone_blast: {
    damage: [
      "{item} screeches at full volume.",
      "{target} takes {damage} damage."
    ]
  },
  napkin_dispenser: {
    damage: [
      "{item} slams into {target}.",
      "{target} takes {damage} damage."
    ]
  },
  straw_dispensor: {
    damage: [
      "{item} fires a rapid burst.",
      "{target} takes {damage} damage."
    ]
  },
  laser_pointer: {
    damage: [
      "{item} paints a red line across the battlefield.",
      "{target} takes {damage} damage."
    ]
  },
  soda_launcher: {
    damage: [
      "{item} launches a can at high speed.",
      "{target} takes {damage} damage."
    ]
  },
  projector: {
    damage: [
      "{item} blasts a focused beam of light.",
      "{target} takes {damage} damage."
    ]
  },
  projector_3d: {
    damage: [
      "{item} erupts with dizzying 3D glare.",
      "{target} takes {damage} damage."
    ]
  },
  jumbo_cannon: {
    damage: [
      "{item} recoils with a thunderous boom.",
      "{target} takes {damage} damage."
    ]
  }
};
