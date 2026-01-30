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
    description: "Heals 25 HP.",
    heal: 25,
    target: "ally"
  },
  small_soda: {
    id: "small_soda",
    name: "Small Soda",
    shortTitle: "Small Soda",
    description: "Heals 15 HP.",
    heal: 15,
    target: "ally"
  },
  jumbo_popcorn: {
    id: "jumbo_popcorn",
    name: "Jumbo Popcorn",
    shortTitle: "Jumbo Popcorn",
    description: "Heals 50 HP.",
    heal: 50,
    target: "ally"
  },
  large_soda: {
    id: "large_soda",
    name: "Large Soda",
    shortTitle: "Large Soda",
    description: "Heals 30 HP.",
    heal: 30,
    target: "ally"
  },
  fun_candy: {
    id: "fun_candy",
    name: "Funsize Candy",
    shortTitle: "Funsize Candy",
    description: "Heals 5 HP.",
    heal: 5,
    target: "ally"
  },
  jumbo_candy: {
    id: "jumbo_candy",
    name: "Jumbo Candybar",
    shortTitle: "Jumbo Candybar",
    description: "Heals 20 HP.",
    heal: 20,
    target: "ally"
  },
  camcorder: {
    id: "camcorder",
    name: "Camcorder Flash",
    shortTitle: "Camcorder",
    description: "Deals 25 HP.",
    heal: 20,
    target: "ally"
  },
  camera_phone: {
    id: "camera_phone",
    name: "Camera Phone Flash",
    shortTitle: "Camera Phone",
    description: "Deals 15 HP.",
    heal: 20,
    target: "ally"
  },
  soda_launcher: {
    id: "soda_launcher",
    name: "Soda Can Launcher",
    shortTitle: "Soda Launcher",
    description: "Deals 25 HP.",
    heal: 20,
    target: "ally"
  },
  nacho_bomb: {
    id: "nacho_bomb",
    name: "Nacho Bomb",
    shortTitle: "Nacho Bomb",
    description: "Deals 20 HP.",
    heal: 20,
    target: "ally"
  }
};
