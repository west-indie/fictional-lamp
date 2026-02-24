// frontend/js/data/starterKits.js

// Opening kits are offered at the start of a campaign run.
// Midrun kits are a separate pool for between-battle/shop systems.

export const openingKits = [
  {
    id: "kids_meal",
    name: "The Kids Meal",
    theme: "Variety",
    items: [
      { id: "laser_pointer", count: 1 },
      { id: "fun_candy", count: 2 },
      { id: "small_soda", count: 2 },
      { id: "small_popcorn", count: 2 },
      { id: "small_chips", count: 2 }
    ]
  },
  {
    id: "annoying_audience_member",
    name: "Annoying Audience Member Starter Pack",
    theme: "Explosive Leaning",
    items: [
      { id: "laser_pointer", count: 1 },
      { id: "camera_phone", count: 3 },
      { id: "camcorder", count: 2 },
      { id: "jumbo_candy", count: 1 },
      { id: "small_chips", count: 2 }
    ]
  },
  {
    id: "candy_counter",
    name: "Candy Counter Combo",
    theme: "Perfectly Balanced",
    items: [
      { id: "laser_pointer", count: 1 },
      { id: "fun_candy", count: 3 },
      { id: "jumbo_candy", count: 1 },
      { id: "small_chips", count: 2 },
      { id: "small_soda", count: 2 }
    ]
  },
  {
    id: "soda_jerk",
    name: "Soda Jerk Special",
    theme: "Soda Launcher Kit",
    items: [
      { id: "soda_launcher", count: 1 },
      { id: "fun_candy", count: 2 },
      { id: "small_soda", count: 3 },
      { id: "large_soda", count: 1 },
      { id: "small_popcorn", count: 2 }
    ]
  },
  {
    id: "family_bucket",
    name: "Family Bucket Special",
    theme: "Health Focused",
    items: [
      { id: "napkin_dispenser", count: 1 },
      { id: "large_chips", count: 1 },
      { id: "small_chips", count: 2 },
      { id: "jumbo_popcorn", count: 2 },
      { id: "large_soda", count: 1 }
    ]
  },
  {
    id: "marathon_starter_pack",
    name: "Marathon Starter Pack",
    theme: "Health Focused",
    items: [
      { id: "napkin_dispenser", count: 1 },
      { id: "whole_pretzel", count: 1 },
      { id: "small_chips", count: 3 },
      { id: "large_soda", count: 2 },
      { id: "jumbo_popcorn", count: 1 }
    ]
  },
  {
    id: "date_night_meal",
    name: "Date Night Meal",
    theme: "Variety",
    items: [
      { id: "straw_dispensor", count: 1 },
      { id: "fun_candy", count: 4 },
      { id: "jumbo_popcorn", count: 1 },
      { id: "small_soda", count: 2 },
      { id: "small_chips", count: 2 }
    ]
  },
  {
    id: "theater_floor_combo",
    name: "Theater Floor Combo",
    theme: "Explosive Focused",
    items: [
      { id: "straw_dispensor", count: 1 },
      { id: "fun_candy", count: 3 },
      { id: "jumbo_candy", count: 2 },
      { id: "stale_popcorn", count: 1 },
      { id: "small_soda", count: 2 }
    ]
  }
];

export const midrunKits = [
  {
    id: "midrun_placeholder",
    name: "Midrun Placeholder",
    theme: "Placeholder",
    items: [
      { id: "small_soda", count: 1 },
      { id: "small_popcorn", count: 1 },
      { id: "fun_candy", count: 1 }
    ]
  }
];
