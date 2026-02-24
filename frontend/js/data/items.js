// frontend/js/data/items.js

// Simple, SNES-style items.
// Very data-driven so you can easily add more later.
//
// target:
// - "self" → can only be used on the acting character
// - "ally" → can be used on any living party member

export const items = {
  small_popcorn: {
    id: "small_popcorn",
    name: "Small Popcorn",
    shortTitle: "Small Popcorn",
    description: "Heals 30 HP to target.",
    type: "health",
    heal: 30,
    target: "ally"
  },
  jumbo_popcorn: {
    id: "jumbo_popcorn",
    name: "Jumbo Popcorn",
    shortTitle: "Jumbo Popcorn",
    description: "Heals 60 HP to target.",
    type: "health",
    heal: 60,
    target: "ally"
  },
  butter_popcorn: {
    id: "butter_popcorn",
    name: "Butter Popcorn",
    shortTitle: "Butter Pop",
    description: "Heals 40 HP to target. May cause some side effects.",
    type: "health",
    heal: 40,
    target: "ally",
    defBuffPct: 0.25,
    defBuffTurns: 2
  },
  caramel_popcorn: {
    id: "caramel_popcorn",
    name: "Caramel Popcorn",
    shortTitle: "Caramel Pop",
    description: "Heals 40 HP. May cause some side effects.",
    type: "health",
    heal: 40,
    target: "ally",
    atkBuffPct: 0.25,
    atkBuffTurns: 2
  },
  bottom_popcorn: {
    id: "bottom_popcorn",
    name: "Bottomless Popcorn",
    shortTitle: "∞ Popcorn",
    description: "More popcorn than you could ever imagine! Heals about 150 HP.",
    type: "health",
    heal: 150,
    target: "ally"
  },
  whole_pretzel: {
    id: "whole_pretzel",
    name: "Pretzel",
    shortTitle: "Pretzel",
    description: "Yes, a WHOLE pretzel. Heals 45 HP.",
    type: "health",
    heal: 45,
    target: "ally"
  },
    pretzel_bites: {
    id: "pretzel_bites",
    name: "Pretzel Bites",
    shortTitle: "Pretzel Bites",
    description: "Pretzel for all! Heals 30 HP for the whole team.",
    type: "health",
    heal: 25,
    target: "team"
  },
  small_chips: {
    id: "small_chips",
    name: "Small Bag o' Chips",
    shortTitle: "Small Chips",
    description: "Heals 15 HP for the whole team.",
    type: "health",
    heal: 15,
    target: "team"
  },
  large_chips: {
    id: "large_chips",
    name: "Large Bag o' Chips",
    shortTitle: "Large Chips",
    description: "Heals 45 HP for the whole team.",
    type: "health",
    heal: 45,
    target: "team"
  },
  small_soda: {
    id: "small_soda",
    name: "Small Soda",
    shortTitle: "Small Soda",
    description: "Heals 20 HP.",
    type: "health",
    heal: 20,
    target: "ally"
  },
  large_soda: {
    id: "large_soda",
    name: "Large Soda",
    shortTitle: "Large Soda",
    description: "Heals 55 HP.",
    type: "health",
    heal: 55,
    target: "ally"
  },
  blue_slush: {
    id: "blue_slush",
    name: "Blue Raspberry Slushy",
    shortTitle: "Blue Slush",
    description: "Heals 35 HP. May cause some side effects.",
    type: "health",
    heal: 35,
    target: "ally",
    defBuffPct: 0.2,
    defBuffTurns: 2
  },
  red_slush: {
    id: "red_slush",
    name: "Wild Cherry Slushy",
    shortTitle: "Red Slush",
    description: "Heals 35 HP. May cause some side effects.",
    type: "health",
    heal: 35,
    target: "ally",
    atkBuffPct: 0.2,
    atkBuffTurns: 2
  },
  green_slush: {
    id: "green_slush",
    name: "Green Apple Slushy",
    shortTitle: "Green Slush",
    description: "Heals 35 HP. May cause some side effects.",
    type: "health",
    heal: 35,
    target: "ally",
    critChanceBuffPct: 0.25,
    critChanceBuffTurns: 4,
    critDamageBuffPct: 0.3,
    critDamageBuffTurns: 2
  },
  purple_slush: {
    id: "purple_slush",
    name: "Mysterious Slushy",
    shortTitle: "Purple Slush",
    description: "Heals, I think? I don't know man, you're on your own for this one.",
    type: "health",
    heal: 100,
    target: "ally",
    revive: true
  },
  fun_candy: {
    id: "fun_candy",
    name: "Funsize Candy",
    shortTitle: "Funsize Candy",
    description: "Sticky and Savory, Deals about 20 HP of pure sugary damage.",
    type: "explosive",
    damageMin: 20,
    damageMax: 20,
    target: "enemy"
  },
  jumbo_candy: {
    id: "jumbo_candy",
    name: "Jumbo Candybar",
    shortTitle: "Jumbo Candybar",
    description: "Deals about 40 HP of pure sugary damage, enough to go around!",
    type: "explosive",
    damageMin: 40,
    damageMax: 40,
    target: "enemy"
  },
  nacho_bomb: {
    id: "nacho_bomb",
    name: "Nacho Bomb",
    shortTitle: "Nacho Bomb",
    description: "Deals about 30 HP. This just nacho day man.",
    type: "explosive",
    damageMin: 30,
    damageMax: 30,
    target: "enemy",
    enemyAtkDebuffPct: 0.3,
    enemyAtkDebuffTurns: 2,
    enemyActionsLimit: 1,
    enemyActionsLimitTurns: 1
  },
  stale_popcorn: {
    id: "stale_popcorn",
    name: "Stale Popcorn",
    shortTitle: "Stale Popcorn",
    description: "Aged to Perfection! Deals about 40 HP.",
    type: "explosive",
    damageMin: 40,
    damageMax: 40,
    target: "enemy"
  },
  camcorder: {
    id: "camcorder",
    name: "Camcorder Flash",
    shortTitle: "Camcorder",
    description: "Deals about 25 HP. How the hell you sneak this in??",
    type: "explosive",
    damageMin: 25,
    damageMax: 25,
    target: "enemy"
  },
  camera_phone: {
    id: "camera_phone",
    name: "Camera Phone Flash",
    shortTitle: "Camera Phone",
    description: "Deals about 15 HP.",
    type: "explosive",
    damageMin: 15,
    damageMax: 15,
    target: "enemy"
  },
  ringtone_blast: {
    id: "ringtone_blast",
    name: "Flip Phone Ringtone Blast",
    shortTitle: "Flip Phone",
    description: "Deals 40 HP.",
    type: "explosive",
    damageMin: 40,
    damageMax: 40,
    target: "enemy"
  },
  napkin_dispenser: {
    id: "napkin_dispenser",
    name: "Napkin Dispenser",
    shortTitle: "Napkin Disp.",
    description: "Deals 18 HP and lowers enemy ATK for 2 turns.",
    type: "reusableWeapon",
    damageMin: 18,
    damageMax: 18,
    target: "enemy",
    enemyAtkDebuffPct: 0.15,
    enemyAtkDebuffTurns: 2,
    cooldownTurns: 1,
    consumable: false
  },
  straw_dispensor: {
    id: "straw_dispensor",
    name: "Straw Dispensor",
    shortTitle: "Straw Disp.",
    description: "Deals 22 HP with a chance for an extra hit.",
    type: "reusableWeapon",
    damageMin: 22,
    damageMax: 22,
    target: "enemy",
    extraHitChance: 0.35,
    extraHitMinPct: 0.5,
    extraHitMaxPct: 0.8,
    cooldownTurns: 1,
    consumable: false
  },
  laser_pointer: {
    id: "laser_pointer",
    name: "Laser Pointer",
    shortTitle: "Laser Pointer",
    description: "Deals 20 HP.",
    type: "reusableWeapon",
    damageMin: 20,
    damageMax: 20,
    target: "enemy",
    consumable: false,
    cooldownTurns: 2,
    dazedTurns: 1,
    dazedChance: 0.2
  },
  soda_launcher: {
    id: "soda_launcher",
    name: "Soda Can Launcher",
    shortTitle: "Soda Launcher",
    description: "Deals 25 HP.",
    type: "reusableWeapon",
    damageMin: 25,
    damageMax: 25,
    target: "enemy",
    cooldownTurns: 2,
    consumable: false
  },
  projector: {
    id: "projector",
    name: "Handheld Projector",
    shortTitle: "Projector",
    description: "Deals 45 HP.",
    type: "reusableWeapon",
    damageMin: 45,
    damageMax: 45,
    target: "enemy",
    consumable: false,
    cooldownTurns: 3,
    dazedTurns: 1
  },
  projector_3d: {
    id: "projector_3d",
    name: "3D Projector",
    shortTitle: "3D Projector",
    description: "Deals 65 HP and can confuse the enemy.",
    type: "reusableWeapon",
    damageMin: 65,
    damageMax: 65,
    target: "enemy",
    consumable: false,
    cooldownTurns: 4,
    confusedChance: 1,
    confuseProcChance: 0.35,
    confuseClearChance: 0.25,
    confuseRampProc: 0.1,
    confuseRampClear: 0.1
  },
  jumbo_cannon: {
    id: "jumbo_cannon",
    name: "Jumbo Cola Cannon",
    shortTitle: "Cola Cannon",
    description: "Deals 50 HP.",
    type: "reusableWeapon",
    damageMin: 75,
    damageMax: 75,
    target: "enemy",
    cooldownTurns: 5,
    consumable: false
  },
};
