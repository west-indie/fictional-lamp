// frontend/js/data/movieMeta.js
//
// Allowed genres (conceptually):
// ACTION, ADVENTURE, DRAMA, COMEDY, HORROR, THRILLER, MYSTERY,
// SCIFI, FANTASY, ANIMATION, CRIME, ROMANCE, MUSICAL, DOCUMENTARY
//
// Allowed tones (for now):
// SERIOUS, FUNNY, DARK, EPIC, QUIRKY
//
// Eras will be derived from year:
// Classic       <= 1965
// New Hollywood 1966–1980
// Modern        1981–2000
// Contemporary  >= 2001
//
// UPDATE:
// - `franchise` now supports:
//   - null
//   - a single string (legacy)
//   - an array of strings (new)

export const movieMeta = {
  // =========================
  // Core / Starter + Popular
  // =========================
  shawshank: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 1994, franchise: null },
  dark_knight: { primaryGenre: "ACTION", secondaryGenre: "CRIME", tone: "DARK", year: 2008, franchise: ["Batman", "TDK", "Nolan"] },
  godfather: { primaryGenre: "DRAMA", secondaryGenre: "CRIME", tone: "SERIOUS", year: 1972, franchise: ["The Godfather"] },
  pulp_fiction: { primaryGenre: "CRIME", secondaryGenre: "DRAMA", tone: "QUIRKY", year: 1994, franchise: ["QT"] },
  taxi_driver: { primaryGenre: "DRAMA", secondaryGenre: "CRIME", tone: "DARK", year: 1976, franchise: null },
  midsommar: { primaryGenre: "HORROR", secondaryGenre: "DRAMA", tone: "DARK", year: 2019, franchise: ["A24", "Arthouse"] },
  howls_moving_castle: { primaryGenre: "ANIMATION", secondaryGenre: "FANTASY", tone: "EPIC", year: 2004, franchise: ["Ghibli"] },
  office_space: { primaryGenre: "COMEDY", secondaryGenre: null, tone: "FUNNY", year: 1999, franchise: ["JUDGE"] },
  this_is_spinal_tap: { primaryGenre: "COMEDY", secondaryGenre: "MUSICAL", tone: "QUIRKY", year: 1984, franchise: null },


  harry_potter_2001: {
    primaryGenre: "FANTASY",
    secondaryGenre: "ADVENTURE",
    tone: "QUIRKY",
    year: 2001,
    franchise: ["Harry Potter"]
  },

  love_and_mercy: {
    primaryGenre: "DRAMA",
    secondaryGenre: "MUSICAL",
    tone: "SERIOUS",
    year: 2014,
    franchise: null
  },

  steve_jobs_2015: {
    primaryGenre: "DRAMA",
    secondaryGenre: null,
    tone: "SERIOUS",
    year: 2015,
    franchise: ["Apple", "Steve Jobs"]
  },

  // =========================
  // Blockbusters / Adventure / Franchise
  // =========================
  dark_knight_rises: { primaryGenre: "ACTION", secondaryGenre: "CRIME", tone: "DARK", year: 2012, franchise: ["Batman", "TDK", "Nolan"] },
  avengers: { primaryGenre: "ACTION", secondaryGenre: "SCIFI", tone: "EPIC", year: 2012, franchise: ["MCU", "AVENGERS"] },
  jurassic_park: { primaryGenre: "ADVENTURE", secondaryGenre: "SCIFI", tone: "EPIC", year: 1993, franchise: ["Jurassic Park", "Jurassic"] },
  avatar: { primaryGenre: "SCIFI", secondaryGenre: "ADVENTURE", tone: "EPIC", year: 2009, franchise: ["Avatar", "Cameron"] },
  back_to_the_future: { primaryGenre: "SCIFI", secondaryGenre: "COMEDY", tone: "QUIRKY", year: 1985, franchise: ["Back to the Future"] },
  et: { primaryGenre: "SCIFI", secondaryGenre: "DRAMA", tone: "SERIOUS", year: 1982, franchise: ["Spielberg"] },
  jaws: { primaryGenre: "THRILLER", secondaryGenre: "HORROR", tone: "DARK", year: 1975, franchise: ["Jaws", "Spielberg"] },

  star_wars: { primaryGenre: "SCIFI", secondaryGenre: "ADVENTURE", tone: "EPIC", year: 1977, franchise: ["Star Wars"] },
  empire_strikes_back: { primaryGenre: "SCIFI", secondaryGenre: "ADVENTURE", tone: "EPIC", year: 1980, franchise: ["Star Wars"] },

  raiders_of_the_lost_ark: { primaryGenre: "ADVENTURE", secondaryGenre: "ACTION", tone: "EPIC", year: 1981, franchise: ["Indiana Jones"] },
  temple_of_doom: { primaryGenre: "ADVENTURE", secondaryGenre: "ACTION", tone: "DARK", year: 1984, franchise: ["Indiana Jones"] },
  last_crusade: { primaryGenre: "ADVENTURE", secondaryGenre: "COMEDY", tone: "QUIRKY", year: 1989, franchise: ["Indiana Jones"] },

  spiderverse: { primaryGenre: "ANIMATION", secondaryGenre: "ACTION", tone: "QUIRKY", year: 2018, franchise: ["Spider-Man"] },
  spiderman_2002: { primaryGenre: "ACTION", secondaryGenre: "ADVENTURE", tone: "EPIC", year: 2002, franchise: ["Spider-Man", "SM02", "Raimi"] },
  spiderman_2_2004: { primaryGenre: "ACTION", secondaryGenre: "ADVENTURE", tone: "EPIC", year: 2004, franchise: ["Spider-Man", "SM02", "Raimi"] },

  // =========================
  // Modern Favorites
  // =========================
  inception: { primaryGenre: "SCIFI", secondaryGenre: "THRILLER", tone: "SERIOUS", year: 2010, franchise: ["Nolan"] },
  interstellar: { primaryGenre: "SCIFI", secondaryGenre: "DRAMA", tone: "EPIC", year: 2014, franchise: ["Nolan"] },
  the_matrix: { primaryGenre: "SCIFI", secondaryGenre: "ACTION", tone: "EPIC", year: 1999, franchise: ["The Matrix"] },
  dune_2021: { primaryGenre: "SCIFI", secondaryGenre: "ADVENTURE", tone: "EPIC", year: 2021, franchise: ["Dune"] },
  blade_runner_2049: { primaryGenre: "SCIFI", secondaryGenre: "THRILLER", tone: "SERIOUS", year: 2017, franchise: ["Blade Runner"] },

  fight_club: { primaryGenre: "DRAMA", secondaryGenre: "THRILLER", tone: "DARK", year: 1999, franchise: null },
  whiplash: { primaryGenre: "DRAMA", secondaryGenre: "MUSICAL", tone: "SERIOUS", year: 2014, franchise: null },
  parasite: { primaryGenre: "THRILLER", secondaryGenre: "DRAMA", tone: "DARK", year: 2019, franchise: ["Arthouse"] },
  the_social_network: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 2010, franchise: null },
  everything_everywhere: { primaryGenre: "SCIFI", secondaryGenre: "COMEDY", tone: "QUIRKY", year: 2022, franchise: ["A24"] },

  // =========================
  // Comedy (incl. Musicals + Anime mixed in your list)
  // =========================
  mean_girls: { primaryGenre: "COMEDY", secondaryGenre: null, tone: "FUNNY", year: 2004, franchise: null },
  clue: { primaryGenre: "COMEDY", secondaryGenre: "MYSTERY", tone: "QUIRKY", year: 1985, franchise: null },
  scott_pilgrim: { primaryGenre: "COMEDY", secondaryGenre: "ACTION", tone: "QUIRKY", year: 2010, franchise: null },
  bull_durham: { primaryGenre: "ROMANCE", secondaryGenre: "COMEDY", tone: "QUIRKY", year: 1988, franchise: null },
  truman_show: { primaryGenre: "DRAMA", secondaryGenre: "COMEDY", tone: "QUIRKY", year: 1998, franchise: ["Carrey"] },

  rushmore: { primaryGenre: "COMEDY", secondaryGenre: "DRAMA", tone: "QUIRKY", year: 1998, franchise: ["WA"] },
  royal_tenenbaums: { primaryGenre: "COMEDY", secondaryGenre: "DRAMA", tone: "QUIRKY", year: 2001, franchise: ["WA"] },
  grand_budapest: { primaryGenre: "COMEDY", secondaryGenre: "DRAMA", tone: "QUIRKY", year: 2014, franchise: ["WA"] },

  // Musicals
  la_la_land: { primaryGenre: "MUSICAL", secondaryGenre: "ROMANCE", tone: "EPIC", year: 2016, franchise: null },
  purple_rain: { primaryGenre: "MUSICAL", secondaryGenre: "DRAMA", tone: "EPIC", year: 1984, franchise: ["Prince"] },
  wicked: { primaryGenre: "MUSICAL", secondaryGenre: "FANTASY", tone: "EPIC", year: 2024, franchise: ["Wicked", "OZ"] },
  wicked_for_good: { primaryGenre: "MUSICAL", secondaryGenre: "FANTASY", tone: "EPIC", year: 2025, franchise: ["Wicked", "OZ"] },

  // Anime / Animation mixed in
  spirited_away: { primaryGenre: "ANIMATION", secondaryGenre: "FANTASY", tone: "QUIRKY", year: 2001, franchise: ["Ghibli"] },
  your_name: { primaryGenre: "ANIMATION", secondaryGenre: "ROMANCE", tone: "SERIOUS", year: 2016, franchise: null },
  princess_mononoke: { primaryGenre: "ANIMATION", secondaryGenre: "FANTASY", tone: "EPIC", year: 1997, franchise: ["Ghibli"] },
  akira: { primaryGenre: "ANIMATION", secondaryGenre: "SCIFI", tone: "DARK", year: 1988, franchise: null },

  // =========================
  // Crime + Thriller (combined bucket in your ordering)
  // =========================
  godfather_part_ii: { primaryGenre: "DRAMA", secondaryGenre: "CRIME", tone: "SERIOUS", year: 1974, franchise: ["The Godfather"] },
  goodfellas: { primaryGenre: "CRIME", secondaryGenre: "DRAMA", tone: "DARK", year: 1990, franchise: null },
  reservoir_dogs: { primaryGenre: "CRIME", secondaryGenre: "THRILLER", tone: "DARK", year: 1992, franchise: ["QT"] },
  scarface: { primaryGenre: "CRIME", secondaryGenre: "DRAMA", tone: "DARK", year: 1983, franchise: null },
  the_departed: { primaryGenre: "CRIME", secondaryGenre: "THRILLER", tone: "DARK", year: 2006, franchise: null },

  se7en: { primaryGenre: "THRILLER", secondaryGenre: "MYSTERY", tone: "DARK", year: 1995, franchise: null },
  joker: { primaryGenre: "DRAMA", secondaryGenre: "CRIME", tone: "DARK", year: 2019, franchise: ["DC"] },
  prestige: { primaryGenre: "MYSTERY", secondaryGenre: "THRILLER", tone: "SERIOUS", year: 2006, franchise: null },
  silence_of_lambs: { primaryGenre: "THRILLER", secondaryGenre: "CRIME", tone: "DARK", year: 1991, franchise: null },
  // =========================
  // Horror / Monsters / Zombies
  // =========================
  hereditary: { primaryGenre: "HORROR", secondaryGenre: "THRILLER", tone: "DARK", year: 2018, franchise: ["A24", "Arthouse"] },
  the_witch: { primaryGenre: "HORROR", secondaryGenre: "MYSTERY", tone: "DARK", year: 2015, franchise: ["A24", "Arthouse"] },
  the_shining: { primaryGenre: "HORROR", secondaryGenre: "THRILLER", tone: "DARK", year: 1980, franchise: ["Kubrick"] },
  halloween: { primaryGenre: "HORROR", secondaryGenre: "THRILLER", tone: "DARK", year: 1978, franchise: ["Halloween", "Carpenter"] },
  get_out: { primaryGenre: "HORROR", secondaryGenre: "THRILLER", tone: "DARK", year: 2017, franchise: null },
  alien: { primaryGenre: "SCIFI", secondaryGenre: "HORROR", tone: "DARK", year: 1979, franchise: ["Alien"] },
  nightmare_on_elm_street: { primaryGenre: "HORROR", secondaryGenre: null, tone: "DARK", year: 1984, franchise: ["Nightmare on Elm Street"] },
  scream: { primaryGenre: "HORROR", secondaryGenre: "MYSTERY", tone: "DARK", year: 1996, franchise: ["Scream"] },
  zombieland: { primaryGenre: "COMEDY", secondaryGenre: "HORROR", tone: "QUIRKY", year: 2009, franchise: ["Zombieland"] },
  they_live: { primaryGenre: "SCIFI", secondaryGenre: "HORROR", tone: "QUIRKY", year: 1988, franchise: ["Carpenter"] },

  // =========================
  // Romance / Rom-Com
  // =========================
  when_harry_met_sally: { primaryGenre: "ROMANCE", secondaryGenre: "COMEDY", tone: "FUNNY", year: 1989, franchise: null },
  ten_things_i_hate_about_you: { primaryGenre: "ROMANCE", secondaryGenre: "COMEDY", tone: "FUNNY", year: 1999, franchise: null },
  crazy_rich_asians: { primaryGenre: "ROMANCE", secondaryGenre: "COMEDY", tone: "FUNNY", year: 2018, franchise: null },
  notting_hill: { primaryGenre: "ROMANCE", secondaryGenre: "COMEDY", tone: "SERIOUS", year: 1999, franchise: null },

  // =========================
  // Action / Sci-Fi / Cult
  // =========================
  die_hard: { primaryGenre: "ACTION", secondaryGenre: "THRILLER", tone: "EPIC", year: 1988, franchise: ["Die Hard"] },
  the_terminator: { primaryGenre: "SCIFI", secondaryGenre: "ACTION", tone: "DARK", year: 1984, franchise: ["Terminator", "Cameron"] },
  terminator_2: { primaryGenre: "SCIFI", secondaryGenre: "ACTION", tone: "EPIC", year: 1991, franchise: ["Terminator", "Cameron"] },
  mad_max_fury_road: { primaryGenre: "ACTION", secondaryGenre: "ADVENTURE", tone: "EPIC", year: 2015, franchise: ["Mad Max"] },
  robocop: { primaryGenre: "SCIFI", secondaryGenre: "ACTION", tone: "DARK", year: 1987, franchise: ["RoboCop"] },
  tron: { primaryGenre: "SCIFI", secondaryGenre: "ACTION", tone: "QUIRKY", year: 1982, franchise: ["Tron"] },
  superman_2: { primaryGenre: "ACTION", secondaryGenre: "SCIFI", tone: "EPIC", year: 1980, franchise: ["Superman", "SM78", "DC"] },

  // =========================
  // Epics / War / History / Big Drama
  // =========================
  schindlers_list: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 1993, franchise: ["Spielberg"] },
  saving_private_ryan: { primaryGenre: "DRAMA", secondaryGenre: "ACTION", tone: "SERIOUS", year: 1998, franchise: ["Spielberg"] },
  seven_samurai: { primaryGenre: "ADVENTURE", secondaryGenre: "DRAMA", tone: "EPIC", year: 1954, franchise: ["Arthouse"] },
  apocalypse_now: { primaryGenre: "DRAMA", secondaryGenre: "THRILLER", tone: "DARK", year: 1979, franchise: null },
  good_bad_ugly: { primaryGenre: "ADVENTURE", secondaryGenre: "CRIME", tone: "EPIC", year: 1966, franchise: null },
  forrest_gump: { primaryGenre: "DRAMA", secondaryGenre: "ROMANCE", tone: "SERIOUS", year: 1994, franchise: null },
  green_mile: { primaryGenre: "DRAMA", secondaryGenre: "FANTASY", tone: "SERIOUS", year: 1999, franchise: null },
  one_flew_over: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "DARK", year: 1975, franchise: null },
  american_history_x: { primaryGenre: "DRAMA", secondaryGenre: "CRIME", tone: "DARK", year: 1998, franchise: null },
  the_pianist: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 2002, franchise: ["Arthouse"] },
  intouchables: { primaryGenre: "COMEDY", secondaryGenre: "DRAMA", tone: "FUNNY", year: 2011, franchise: ["Arthouse"] },

  raging_bull: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 1980, franchise: ["Arthouse"] },
  amadeus_1984: { primaryGenre: "DRAMA", secondaryGenre: "MUSICAL", tone: "SERIOUS", year: 1984, franchise: null },

  // =========================
  // Classics / Essentials / World Cinema
  // =========================
  casablanca: { primaryGenre: "DRAMA", secondaryGenre: "ROMANCE", tone: "SERIOUS", year: 1942, franchise: null },
  citizen_kane: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 1941, franchise: null },
  singin_in_the_rain: { primaryGenre: "MUSICAL", secondaryGenre: "COMEDY", tone: "FUNNY", year: 1952, franchise: null },
  rear_window: { primaryGenre: "THRILLER", secondaryGenre: "MYSTERY", tone: "SERIOUS", year: 1954, franchise: null },
  twelve_angry_men: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 1957, franchise: null },
  harakiri: { primaryGenre: "DRAMA", secondaryGenre: "ACTION", tone: "SERIOUS", year: 1962, franchise: ["Arthouse"] },
  the_400_blows: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 1959, franchise: ["Arthouse"] },
  paris_texas: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 1984, franchise: ["Arthouse"] },
  the_seventh_seal: { primaryGenre: "DRAMA", secondaryGenre: "MYSTERY", tone: "SERIOUS", year: 1957, franchise: ["Arthouse"] },
  city_of_god: { primaryGenre: "CRIME", secondaryGenre: "DRAMA", tone: "DARK", year: 2002, franchise: ["Arthouse"] },
  oldboy_2003: { primaryGenre: "THRILLER", secondaryGenre: "ACTION", tone: "DARK", year: 2003, franchise: ["Arthouse"] },
  pans_labyrinth: { primaryGenre: "FANTASY", secondaryGenre: "DRAMA", tone: "DARK", year: 2006, franchise: ["Arthouse"] },
  amelie: { primaryGenre: "ROMANCE", secondaryGenre: "COMEDY", tone: "QUIRKY", year: 2001, franchise: ["Arthouse"] },
  rebel_without_a_cause: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 1955, franchise: null },

  // =========================
  // Animation / Family
  // =========================
  lion_king: { primaryGenre: "ANIMATION", secondaryGenre: "DRAMA", tone: "EPIC", year: 1994, franchise: ["Disney"] },
  shrek: { primaryGenre: "ANIMATION", secondaryGenre: "COMEDY", tone: "FUNNY", year: 2001, franchise: ["Shrek"] },
  shrek_2: { primaryGenre: "ANIMATION", secondaryGenre: "COMEDY", tone: "FUNNY", year: 2004, franchise: ["Shrek"] },

  // =========================
  // Fantasy Epics
  // =========================
  lotr_fellowship: { primaryGenre: "FANTASY", secondaryGenre: "ADVENTURE", tone: "EPIC", year: 2001, franchise: ["The Lord of the Rings"] },
  lotr_two_towers: { primaryGenre: "FANTASY", secondaryGenre: "ADVENTURE", tone: "EPIC", year: 2002, franchise: ["The Lord of the Rings"] },
  lotr_return_king: { primaryGenre: "FANTASY", secondaryGenre: "ADVENTURE", tone: "EPIC", year: 2003, franchise: ["The Lord of the Rings"] },

  // =========================
  // Additional existing titles (already in your ecosystem)
  // =========================
  moonlight: { primaryGenre: "DRAMA", secondaryGenre: "ROMANCE", tone: "SERIOUS", year: 2016, franchise: ["Arthouse"] },
  birdman: { primaryGenre: "DRAMA", secondaryGenre: "COMEDY", tone: "QUIRKY", year: 2014, franchise: ["Arthouse"] },
  roma: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 2018, franchise: ["Arthouse"] },
  nomadland: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 2020, franchise: ["Arthouse"] },
  lady_bird: { primaryGenre: "DRAMA", secondaryGenre: "COMEDY", tone: "QUIRKY", year: 2017, franchise: ["Arthouse"] },

  // =========================
  // Locked movies (must exist here too)
  // =========================
  blade_runner_final_cut: { primaryGenre: "SCIFI", secondaryGenre: "THRILLER", tone: "SERIOUS", year: 1982, franchise: ["Blade Runner"] },
  once_upon_a_time_in_america: { primaryGenre: "CRIME", secondaryGenre: "DRAMA", tone: "SERIOUS", year: 1984, franchise: ["Arthouse"] },
  gladiator: { primaryGenre: "ACTION", secondaryGenre: "DRAMA", tone: "EPIC", year: 2000, franchise: null },
  lethal_weapon: { primaryGenre: "ACTION", secondaryGenre: "COMEDY", tone: "QUIRKY", year: 1987, franchise: ["Lethal Weapon"] },
  ratatouille: { primaryGenre: "ANIMATION", secondaryGenre: "COMEDY", tone: "QUIRKY", year: 2007, franchise: ["Pixar"] },
  persona: { primaryGenre: "DRAMA", secondaryGenre: "MYSTERY", tone: "SERIOUS", year: 1966, franchise: ["Arthouse"] },
  eight_half: { primaryGenre: "DRAMA", secondaryGenre: null, tone: "SERIOUS", year: 1963, franchise: ["Arthouse"] }
};
