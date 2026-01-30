// frontend/js/data/specials.js
//
// Signature (movie-unique) specials.
// These work alongside genre specials via specialSystem.js.
//
// IMPORTANT (per your request):
// - Existing specials below are kept EXACTLY as-is (do not touch).
// - Every movie id in movies.js gets a signature special here.
// - Movies with ONLY ONE genre in movieMeta.js (secondaryGenre: null) get STRONGER specials.
// - Shawshank, Office Space, Mean Girls each get TWO specials via `extraSpecials`.
//
// Notes:
// - cooldownTurns is optional (specialSystem defaults to 3), but kept explicit for clarity.
// - Kinds used here stick to the ones already present in your file: damageEnemy, healSelf, healAlly
//   (to avoid breaking your current specialSystem if it only supports these).

// -----------------------------
// 1) PRIMARY signature special per movie (1 each)
// -----------------------------
export const specials = {
  // ===== EXISTING (DO NOT TOUCH) =====
  godfather: {
    id: "horse_head_warning",
    name: "Horse Head Warning",
    description: "A brutal warning that deals heavy damage to the enemy.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.8,
    cooldownTurns: 3
  },

  dark_knight: {
    id: "why_so_serious",
    name: "Why So Serious?",
    description: "A chaotic strike that deals massive damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 2.0,
    cooldownTurns: 3
  },

  pulp_fiction: {
    id: "royale_with_cheese",
    name: "Royale with Cheese",
    description: "Comfort food heals you up.",
    kind: "healSelf",
    target: "self",
    amount: 40,
    cooldownTurns: 3
  },

  fight_club: {
    id: "project_mayhem",
    name: "Project Mayhem",
    description: "A reckless assault that deals strong damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.7,
    cooldownTurns: 3
  },

  star_wars: {
    id: "use_the_force",
    name: "Use the Force",
    description: "A mystical power that heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 35,
    cooldownTurns: 3
  },

  jurassic_park: {
    id: "t_rex_rampage",
    name: "T-Rex Rampage",
    description: "Summon chaos for huge damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },

  avengers: {
    id: "avengers_assemble",
    name: "Avengers Assemble",
    description: "A coordinated attack dealing heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.8,
    cooldownTurns: 3
  },

  avatar: {
    id: "eywa_blessing",
    name: "Eywa's Blessing",
    description: "Nature restores an ally's health.",
    kind: "healAlly",
    target: "ally",
    amount: 45,
    cooldownTurns: 3
  },

  // ===== NEW: one-per-movie (stronger if secondaryGenre is null in movieMeta.js) =====

  // Core / Starter
  shawshank: {
    // NOTE: second Shawshank special is in extraSpecials below.
    id: "hope_and_redemption",
    name: "Hope & Redemption",
    description: "A surge of hope restores your strength.",
    kind: "healSelf",
    target: "self",
    amount: 60, // stronger (single-genre)
    cooldownTurns: 3
  },
  taxi_driver: {
    id: "you_talkin_to_me",
    name: "You Talkin’ to Me?",
    description: "A tense confrontation that hits hard.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  midsommar: {
    id: "maypole_omen",
    name: "Maypole Omen",
    description: "A ritual dread that punishes the enemy.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  // Blockbusters / Adventure / Franchise
  dark_knight_rises: {
    id: "gotham_rises",
    name: "Gotham Rises",
    description: "A relentless finishing blow.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  back_to_the_future: {
    id: "flux_capacitor",
    name: "Flux Capacitor",
    description: "Temporal advantage restores an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 40,
    cooldownTurns: 3
  },
  et: {
    id: "phone_home",
    name: "Phone Home",
    description: "A gentle miracle heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 42,
    cooldownTurns: 3
  },
  jaws: {
    id: "youre_gonna_need_a_bigger_boat",
    name: "Bigger Boat",
    description: "Panic-fueled survival turns into a vicious hit.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },

  empire_strikes_back: {
    id: "i_am_your_father",
    name: "I Am Your Father",
    description: "A crushing revelation that lands heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  raiders_of_the_lost_ark: {
    id: "ark_unleashed",
    name: "Ark Unleashed",
    description: "Ancient power overwhelms the enemy.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  temple_of_doom: {
    id: "kali_ma",
    name: "Kali Ma",
    description: "A terrifying chant strikes at the enemy’s core.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  last_crusade: {
    id: "choose_wisely",
    name: "Choose Wisely",
    description: "A clever twist restores an ally’s health.",
    kind: "healAlly",
    target: "ally",
    amount: 40,
    cooldownTurns: 3
  },

  // Spider-Man
  spiderverse: {
    id: "leap_of_faith",
    name: "Leap of Faith",
    description: "A stylish strike with extra punch.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  spiderman_2002: {
    id: "with_great_power",
    name: "With Great Power",
    description: "A heroic blow that hits hard.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.75,
    cooldownTurns: 3
  },
  spiderman_2_2004: {
    id: "train_stop",
    name: "Train Line Save",
    description: "An all-out save that restores an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 42,
    cooldownTurns: 3
  },

  // Modern Favorites
  inception: {
    id: "kick_sequence",
    name: "Kick Sequence",
    description: "A reality-shattering hit.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  interstellar: {
    id: "gravity_sling",
    name: "Gravity Sling",
    description: "A cosmic maneuver heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 45,
    cooldownTurns: 3
  },
  the_matrix: {
    id: "bullet_time",
    name: "Bullet Time",
    description: "A precision strike that hits fast and hard.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  dune_2021: {
    id: "voice_command",
    name: "The Voice",
    description: "A dominating command that crushes the enemy.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  blade_runner_2049: {
    id: "baseline_breach",
    name: "Baseline Breach",
    description: "A cold, controlled takedown.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },

  whiplash: {
    id: "not_my_tempo",
    name: "Not My Tempo",
    description: "Relentless pressure breaks through defenses.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.8,
    cooldownTurns: 3
  },
  parasite: {
    id: "con_artist_turn",
    name: "Con Artist Turn",
    description: "A sudden reversal deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  the_social_network: {
    id: "move_fast_and_break_things",
    name: "Move Fast, Break Things",
    description: "A ruthless surge restores your momentum.",
    kind: "healSelf",
    target: "self",
    amount: 55, // stronger (single-genre)
    cooldownTurns: 3
  },
  everything_everywhere: {
    id: "verse_jump",
    name: "Verse Jump",
    description: "Multiversal chaos deals big damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },

  // Musicals
  la_la_land: {
    id: "city_of_stars",
    name: "City of Stars",
    description: "A dreamy moment heals you.",
    kind: "healSelf",
    target: "self",
    amount: 45,
    cooldownTurns: 3
  },
  purple_rain: {
    id: "stage_lightning",
    name: "Let's Go Crazy",
    description: "A blistering performance strikes the enemy.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.75,
    cooldownTurns: 3
  },
  wicked: {
    id: "defying_gravity",
    name: "Defying Gravity",
    description: "A soaring spell heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 45,
    cooldownTurns: 3
  },
  wicked_for_good: {
    id: "for_good",
    name: "For Good",
    description: "A heartfelt bond restores an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 42,
    cooldownTurns: 3
  },

  // Comedy
  mean_girls: {
    // NOTE: second Mean Girls special is in extraSpecials below.
    id: "you_cant_sit_with_us",
    name: "You Can’t Sit With Us",
    description: "Social warfare hits harder than it should.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 2.05, // stronger (single-genre)
    cooldownTurns: 3
  },
  clue: {
    id: "flames_on_the_side",
    name: "Flames… on the Side",
    description: "A chaotic accusation damages the enemy.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.7,
    cooldownTurns: 3
  },
  scott_pilgrim: {
    id: "boss_rush",
    name: "Boss Rush",
    description: "A combo hit that deals big damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.8,
    cooldownTurns: 3
  },
  bull_durham: {
    id: "mound_confidence",
    name: "Mound Confidence",
    description: "A calm reset that heals you.",
    kind: "healSelf",
    target: "self",
    amount: 40,
    cooldownTurns: 3
  },
  truman_show: {
    id: "the_doorway",
    name: "The Doorway",
    description: "A bold exit restores an ally’s resolve.",
    kind: "healAlly",
    target: "ally",
    amount: 42,
    cooldownTurns: 3
  },

  // Anime / Animation
  spirited_away: {
    id: "bathhouse_blessing",
    name: "Bathhouse Blessing",
    description: "A strange kindness heals you.",
    kind: "healSelf",
    target: "self",
    amount: 45,
    cooldownTurns: 3
  },
  your_name: {
    id: "thread_of_fate",
    name: "Thread of Fate",
    description: "A destined pull restores an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 42,
    cooldownTurns: 3
  },
  princess_mononoke: {
    id: "forest_wrath",
    name: "Forest Wrath",
    description: "Nature strikes back with heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  akira: {
    id: "psychic_overload",
    name: "Psychic Overload",
    description: "A violent surge devastates the enemy.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },

  // Wes Anderson
  rushmore: {
    id: "extracurricular_blitz",
    name: "Extracurricular Blitz",
    description: "A frantic plan deals damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.7,
    cooldownTurns: 3
  },
  royal_tenenbaums: {
    id: "family_meltdown",
    name: "Family Meltdown",
    description: "A dramatic spiral damages the enemy.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.7,
    cooldownTurns: 3
  },
  grand_budapest: {
    id: "concierge_escape",
    name: "Concierge Escape",
    description: "A slick getaway heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 40,
    cooldownTurns: 3
  },

  // Crime / Thriller bucket
  godfather_part_ii: {
    id: "the_family_expands",
    name: "The Family Expands",
    description: "A cold consolidation hits the enemy hard.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  goodfellas: {
    id: "lufthansa_score",
    name: "Lufthansa Score",
    description: "A ruthless score deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  reservoir_dogs: {
    id: "stuck_in_the_middle",
    name: "Stuck in the Middle",
    description: "A vicious betrayal hits hard.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 3,
    cooldownTurns: 4
  },
  scarface: {
    id: "say_hello_to_my_little_friend",
    name: "My Little Friend",
    description: "An explosive burst of damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  the_departed: {
    id: "rat_in_the_building",
    name: "Rat in the Building",
    description: "A brutal double-cross deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  se7en: {
    id: "whats_in_the_box",
    name: "What’s in the Box?",
    description: "A devastating moment deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  joker: {
    id: "stair_dance",
    name: "Stair Dance",
    description: "A chilling crescendo hits the enemy hard.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  prestige: {
    id: "the_prestige",
    name: "The Prestige",
    description: "The final turn deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  silence_of_lambs: {
    id: "quid_pro_quo",
    name: "Quid Pro Quo",
    description: "A terrifying bargain deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },

  // Compatibility aliases
  goodfellas_top: {
    id: "lufthansa_score_top",
    name: "Lufthansa Score",
    description: "A ruthless score deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  se7en_top: {
    id: "whats_in_the_box_top",
    name: "What’s in the Box?",
    description: "A devastating moment deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },

  // Horror
  alien: {
    id: "perfect_organism",
    name: "Perfect Organism",
    description: "A relentless hunt deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  the_shining: {
    id: "heres_johnny",
    name: "Here’s Johnny!",
    description: "A horrifying burst of damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  halloween: {
    id: "shape_in_the_shadows",
    name: "Shape in the Shadows",
    description: "A silent terror strikes hard.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  nightmare_on_elm_street: {
    id: "dream_stalker",
    name: "Dream Stalker",
    description: "Nightmare logic devastates the enemy.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 2.05, // stronger (single-genre)
    cooldownTurns: 3
  },
  get_out: {
    id: "the_sunken_place",
    name: "The Sunken Place",
    description: "A chilling dread deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  hereditary: {
    id: "pact_sealed",
    name: "Pact Sealed",
    description: "A cursed blow deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  scream: {
    id: "ghostface_call",
    name: "Ghostface Call",
    description: "A taunting call leads to a brutal hit.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.8,
    cooldownTurns: 3
  },
  zombieland: {
    id: "double_tap",
    name: "Double Tap",
    description: "Rule #2: finish it. Heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.75,
    cooldownTurns: 3
  },
  they_live: {
    id: "obey",
    name: "OBEY",
    description: "Reality snaps into focus—big damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.8,
    cooldownTurns: 3
  },
  the_witch: {
    id: "black_phillip",
    name: "Black Phillip",
    description: "A sinister whisper deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },

  // Romance / Rom-Com
  when_harry_met_sally: {
    id: "i_ll_have_what_she_s_having",
    name: "I’ll Have What She’s Having",
    description: "A burst of confidence heals you.",
    kind: "healSelf",
    target: "self",
    amount: 42,
    cooldownTurns: 3
  },
  ten_things_i_hate_about_you: {
    id: "poem_read",
    name: "Poem Read",
    description: "A sincere moment heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 40,
    cooldownTurns: 3
  },
  notting_hill: {
    id: "just_a_girl",
    name: "Just a Girl",
    description: "A vulnerable confession heals you.",
    kind: "healSelf",
    target: "self",
    amount: 42,
    cooldownTurns: 3
  },
  crazy_rich_asians: {
    id: "family_showdown",
    name: "Family Showdown",
    description: "A sharp confrontation deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.7,
    cooldownTurns: 3
  },

  // Action / Sci-Fi / Cult
  die_hard: {
    id: "yippee_ki_yay",
    name: "Yippee-Ki-Yay",
    description: "A desperate counterattack hits hard.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  the_terminator: {
    id: "i_ll_be_back",
    name: "I’ll Be Back",
    description: "An unstoppable strike deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  terminator_2: {
    id: "hasta_la_vista",
    name: "Hasta la Vista",
    description: "A perfectly timed finisher hits hard.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  mad_max_fury_road: {
    id: "witness_me",
    name: "Witness Me",
    description: "A reckless charge deals massive damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  robocop: {
    id: "prime_directives",
    name: "Prime Directives",
    description: "A precise takedown deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.8,
    cooldownTurns: 3
  },
  tron: {
    id: "disc_duel",
    name: "Disc Duel",
    description: "A clean digital strike deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.8,
    cooldownTurns: 3
  },
  superman_2: {
    id: "fortress_return",
    name: "Fortress of Solitude",
    description: "A heroic surge heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 40,
    cooldownTurns: 3
  },

  // Epics / War / History
  schindlers_list: {
    id: "list_of_life",
    name: "List of Life",
    description: "A defiant act restores your strength.",
    kind: "healSelf",
    target: "self",
    amount: 60, // stronger (single-genre)
    cooldownTurns: 3
  },
  saving_private_ryan: {
    id: "earn_this",
    name: "Earn This",
    description: "A final push deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  seven_samurai: {
    id: "last_stand",
    name: "Last Stand",
    description: "A legendary defense turns into crushing damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  apocalypse_now: {
    id: "horror_show",
    name: "The Horror Show",
    description: "A spiral into darkness deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  good_bad_ugly: {
    id: "triello",
    name: "The Triello",
    description: "A standoff finisher deals huge damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  forrest_gump: {
    id: "run_forrest_run",
    name: "Run, Forrest, Run!",
    description: "A relentless push heals you.",
    kind: "healSelf",
    target: "self",
    amount: 45,
    cooldownTurns: 3
  },
  green_mile: {
    id: "take_it_back",
    name: "Take It Back",
    description: "A miraculous touch heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 45,
    cooldownTurns: 3
  },
  one_flew_over: {
    id: "ward_uprising",
    name: "Ward Uprising",
    description: "A rebellious surge deals massive damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 2.05, // stronger (single-genre)
    cooldownTurns: 3
  },
  american_history_x: {
    id: "curb_moment",
    name: "Curb Moment",
    description: "A brutal turning point deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  the_pianist: {
    id: "survival_sonata",
    name: "Survival Sonata",
    description: "A quiet endurance restores your strength.",
    kind: "healSelf",
    target: "self",
    amount: 60, // stronger (single-genre)
    cooldownTurns: 3
  },
  intouchables: {
    id: "unlikely_friendship",
    name: "Unlikely Friendship",
    description: "A perfect vibe boost heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 42,
    cooldownTurns: 3
  },

  raging_bull: {
    id: "rope_a_dope",
    name: "Rope-a-Dope",
    description: "Absorb, then explode—massive damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 2.05, // stronger (single-genre)
    cooldownTurns: 3
  },
  amadeus_1984: {
    id: "salieri_s_grudge",
    name: "Salieri’s Grudge",
    description: "A poisonous ambition deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.8,
    cooldownTurns: 3
  },

  // Classics / World Cinema
  casablanca: {
    id: "well_always_have_paris",
    name: "We’ll Always Have Paris",
    description: "A bittersweet resolve heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 42,
    cooldownTurns: 3
  },
  citizen_kane: {
    id: "rosebud",
    name: "Rosebud",
    description: "A haunting memory deals massive damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 2.05, // stronger (single-genre)
    cooldownTurns: 3
  },
  rear_window: {
    id: "caught_in_the_lens",
    name: "Caught in the Lens",
    description: "A trapped truth hits hard.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  twelve_angry_men: {
    id: "reasonable_doubt",
    name: "Reasonable Doubt",
    description: "A decisive argument crushes the enemy.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 2.05, // stronger (single-genre)
    cooldownTurns: 3
  },
  singin_in_the_rain: {
    id: "make_em_laugh",
    name: "Make ’Em Laugh",
    description: "A joyful burst heals you.",
    kind: "healSelf",
    target: "self",
    amount: 45,
    cooldownTurns: 3
  },
  harakiri: {
    id: "honor_blade",
    name: "Honor Blade",
    description: "A devastating choice deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  the_400_blows: {
    id: "final_run",
    name: "Final Run",
    description: "A desperate sprint restores your strength.",
    kind: "healSelf",
    target: "self",
    amount: 55, // stronger (single-genre)
    cooldownTurns: 3
  },
  paris_texas: {
    id: "desert_confession",
    name: "Desert Confession",
    description: "A raw truth restores your strength.",
    kind: "healSelf",
    target: "self",
    amount: 55, // stronger (single-genre)
    cooldownTurns: 3
  },
  the_seventh_seal: {
    id: "chess_with_death",
    name: "Chess with Death",
    description: "A fateful move deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  city_of_god: {
    id: "city_burns",
    name: "City Burns",
    description: "A violent escalation deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  oldboy_2003: {
    id: "hallway_hammer",
    name: "Hallway Hammer",
    description: "A relentless brawl deals massive damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  pans_labyrinth: {
    id: "faun_s_path",
    name: "The Faun’s Path",
    description: "Dark magic heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 42,
    cooldownTurns: 3
  },
  amelie: {
    id: "small_joys",
    name: "Small Joys",
    description: "A tiny kindness heals you.",
    kind: "healSelf",
    target: "self",
    amount: 45,
    cooldownTurns: 3
  },
  rebel_without_a_cause: {
    id: "knife_run",
    name: "Knife Run",
    description: "A reckless challenge deals massive damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 2.05, // stronger (single-genre)
    cooldownTurns: 3
  },

  // A24-ish / Awards already in list
  moonlight: {
    id: "quiet_truth",
    name: "Quiet Truth",
    description: "A painful honesty heals you.",
    kind: "healSelf",
    target: "self",
    amount: 45,
    cooldownTurns: 3
  },
  birdman: {
    id: "one_take_fury",
    name: "One-Take Fury",
    description: "A relentless spiral deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.8,
    cooldownTurns: 3
  },
  roma: {
    id: "tidal_memory",
    name: "Tidal Memory",
    description: "A sweeping moment restores your strength.",
    kind: "healSelf",
    target: "self",
    amount: 55, // stronger (single-genre)
    cooldownTurns: 3
  },
  nomadland: {
    id: "open_road",
    name: "Open Road",
    description: "A steady spirit restores your strength.",
    kind: "healSelf",
    target: "self",
    amount: 55, // stronger (single-genre)
    cooldownTurns: 3
  },
  lady_bird: {
    id: "airport_goodbye",
    name: "Airport Goodbye",
    description: "A bittersweet leap heals you.",
    kind: "healSelf",
    target: "self",
    amount: 42,
    cooldownTurns: 3
  },

  // Animation / Family
  lion_king: {
    id: "circle_of_life",
    name: "Circle of Life",
    description: "A triumphant surge heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 45,
    cooldownTurns: 3
  },
  shrek: {
    id: "ogre_roar",
    name: "Ogre Roar",
    description: "A loud, rude hit deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.75,
    cooldownTurns: 3
  },
  shrek_2: {
    id: "hero_time",
    name: "I Need a Hero",
    description: "A ridiculous rally heals an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 40,
    cooldownTurns: 3
  },

  // LOTR
  lotr_fellowship: {
    id: "you_have_my_sword",
    name: "You Have My Sword",
    description: "The fellowship strikes with heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  lotr_two_towers: {
    id: "ride_of_the_rohirrim",
    name: "Ride of the Rohirrim",
    description: "A thunderous charge deals massive damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.95,
    cooldownTurns: 3
  },
  lotr_return_king: {
    id: "for_frodo",
    name: "For Frodo",
    description: "A final stand deals massive damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.95,
    cooldownTurns: 3
  },

  // Locked movies
  blade_runner_final_cut: {
    id: "tears_in_rain",
    name: "Tears in Rain",
    description: "A final monologue restores your strength.",
    kind: "healSelf",
    target: "self",
    amount: 45,
    cooldownTurns: 3
  },
  once_upon_a_time_in_america: {
    id: "years_lost",
    name: "Years Lost",
    description: "A long shadow deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  gladiator: {
    id: "are_you_not_entertained",
    name: "Are You Not Entertained?",
    description: "A crowd-igniting strike deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.9,
    cooldownTurns: 3
  },
  lethal_weapon: {
    id: "buddy_cop_blast",
    name: "Buddy-Cop Blast",
    description: "A chaotic duo moment deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.75,
    cooldownTurns: 3
  },
  the_fugitive: {
    id: "i_didnt_kill_my_wife",
    name: "I Didn’t Kill My Wife!",
    description: "A desperate escape restores your strength.",
    kind: "healSelf",
    target: "self",
    amount: 45,
    cooldownTurns: 3
  },
  ratatouille: {
    id: "anyone_can_cook",
    name: "Anyone Can Cook",
    description: "A perfect dish restores an ally.",
    kind: "healAlly",
    target: "ally",
    amount: 42,
    cooldownTurns: 3
  },
  persona: {
    id: "mirror_self",
    name: "Mirror Self",
    description: "A psychological snap deals heavy damage.",
    kind: "damageEnemy",
    target: "enemy",
    powerMultiplier: 1.85,
    cooldownTurns: 3
  },
  eight_half: {
    id: "creative_crisis",
    name: "Creative Crisis",
    description: "A surreal breakthrough restores your strength.",
    kind: "healSelf",
    target: "self",
    amount: 55, // stronger (single-genre)
    cooldownTurns: 3
  },
  // ✅ Office Space: new "pages" shape, but each move uses the SAME schema your system already supports.
  // Page 0 is default when you open Specials. Press Space in the SPECIAL menu to toggle pages.
  office_space: {
    pages: [
      // Page 0 (default)
      [
        {
          id: "office_space_tps_reports",
          name: "TPS Reports",
          description: "Paperwork panic restores your strength.",
          kind: "healSelf",
          target: "self",
          amount: 45,
          cooldownTurns: 3
        },
        {
          id: "office_space_printer_beatdown",
          name: "Printer Beatdown",
          description: "A cathartic outburst that deals heavy damage.",
          kind: "damageEnemy",
          target: "enemy",
          powerMultiplier: 1.9,
          cooldownTurns: 4
        }
      ],
      // Page 1
      [

        {
          id: "office_space_passive_resistance",
          name: "Passive Resistance",
          description: "You simply stop caring. The enemy’s attacks lose impact.",
          kind: "debuffEnemy",
          target: "enemy",
          defDebuffPct: 0.3,
          defDebuffTurns: 2,
          cooldownTurns: 4
        },

        {
          id: "office_space_red_stapler",
          name: "Red Stapler",
          description: "An oddly comforting fixation heals you.",
          kind: "healSelf",
          target: "self",
          amount: 55,
          cooldownTurns: 3
        },
        {
          id: "office_space_corporate_restructuring",
          name: "Corporate Restructuring",
          description: "Slash inefficiencies—at a personal cost.",
          kind: "damageEnemy",
          target: "enemy",
          powerMultiplier: 4.2,
          selfDefDebuffPct: 0.15,
          seldDefDebuffTurns: 2,
          cooldownTurns: 5
        }
      ],
      // Page 2
      [
        {
          id: "office_space_monday_morning",
          name: "Case of the Mondays",
          description: "Crushing dread slows the enemy’s next move.",
          kind: "statusEnemy",
          target: "enemy",
          nextHitVulnActive: true,
          nextHitVulnPct: 0.35,
          nextHitVulnTurns: 1,
          cooldownTurns: 4
        },
        {
          id: "office_space_flair_compliance",
          name: "Flair Compliance",
          description: "Mandatory positivity boosts team performance.",
          kind: "buffParty",
          target: "party",
          atkBuffPct: 2,
          atkBuffTurns: 2,
          cooldownTurns: 4
        },
        {
          id: "office_space__micromanage",
          name: "Yeeaaaaaaaaaahhhhhhhhhh…",
          description: "A soul-crushing remark hits the enemy hard.",
          kind: "damageEnemy",
          target: "enemy",
          powerMultiplier: 5,
          cooldownTurns: 4
        }
      ]
    ],
    pageMeta: [
      { includeGenre: true },   // page 1: signature + genre
      { includeGenre: false },
      { includeGenre: false} 
    ]
  },
  this_is_spinal_tap: {
    pages: [
      // Page 0 (default)
      [
        {
          id: "turn_it_to_eleven",
          name: "Turn It to Eleven",
          description: "Cranks the chaos for big damage.",
          kind: "damageEnemy",
          target: "enemy",
          powerMultiplier: 1.75,
          cooldownTurns: 3
        }
      ],
      [
        {
          id: "stonehenge",
          name: "Stonehenge",
          description: "The stage spectacle goes hilariously wrong, throwing the enemy off-balance.",
          kind: "ENEMY_DEBUFF",
          target: "enemy",
          atkPct: 0.20,
          defPct: 0.15,
          turns: 2,
          cooldownTurns: 4
        },
        {
          id: "none_more_black",
          name: "None More Black",
          description: "An aggressively dark aesthetic boosts your presence and poise.",
          kind: "SELF_BUFF",
          target: "self",
          atkPct: 0.20,
          defPct: 0.20,
          turns: 2,
          cooldownTurns: 3
        },
        {
          id: "spinal_tap_combustion",
          name: "Spontaneous Combustion",
          description: "A drummer meets a tragic rock-and-roll fate.",
          kind: "damageEnemy",
          target: "enemy",
          powerMultiplier: 1.95,
          cooldownTurns: 4
        }
      ]
    ],
    pageMeta: [
      { includeGenre: true },   // page 1: signature + genre
      { includeGenre: false } 
    ]
  },
  howls_moving_castle: {
    pages: [
      [
        {
        id: "castle_in_motion",
        name: "Castle in Motion",
        description: "A sweeping magical strike.",
        kind: "damageEnemy",
        target: "enemy",
        powerMultiplier: 1.85,
        cooldownTurns: 3
        }
      ],
      [
        {
          id: "calcifers_flare",
          name: "Calcifer’s Flare",
          description: "Calcifer surges—hot enough to melt resolve.",
          kind: "damageEnemy",
          target: "enemy",
          powerMultiplier: 4.2,
          cooldownTurns: 4
        },
        {
          id: "Howl's Heart",
          name: "Howl's Heart",
          description: "A vow of warmth and magic restores what was lost.",
          kind: "healAllyMissingPct",
          target: "ally",
          missingHealPct: 0.8,
          revivePct: 0.8,
          cooldownTurns: 5
        },
        {
          id: "witch_of_the_waste",
          name: "Witch of the Waste",
          description: "A lingering curse saps the enemy’s strength and guard.",
          kind: "ENEMY_DEBUFF",
          target: "enemy",
          atkPct: 0.20,
          defPct: 0.20,
          turns: 2,
          cooldownTurns: 2
        }
      ]
    ],
    pageMeta: [
      { includeGenre: true },   // page 1: signature + genre
      { includeGenre: false }
    ]
  },

  purple_rain: {
    pages: [
      // Page 0 (default)
      [
        {
          id: "purple_rain_go_crazy",
          name: "Let's Go Crazy",
          description: "A holy sermon turns chaos into momentum.",
          kind: "damageEnemy",
          target: "enemy",
          powerMultiplier: 1.75,
          cooldownTurns: 3
        }
      ],

      // Page 1 (Space toggle)
      [
        {
          id: "purple_rain_purple_rain",
          name: "Purple Rain",
          description: "A cathartic storm cleanses the mind and soul.",
          kind: "healTeamMissingPct",
          target: ["team", "heal"],
          missingHealPct: 0.75,
          cooldownTurns: 5
        },
        {
          id: "purple_rain_darling_nikki",
          name: "Darling Nikki",
          description: "A dangerous confession leaves enemies exposed!",
          kind: "damageEnemy",
          target: "enemy",
          powerMultiplier: 1.75,
          cooldownTurns: 3
        },
        {
          id: "purple_rain_lake_minnetonka",
          name: "The Waters of Lake Minnetonka",
          description: "A legendary ritual restores what was lost.",
          kind: "healAllyMissingPct",
          target: "ally",
          missingHealPct: 0.75,
          revivePct: 0.75,
          cooldownTurns: 4,
        }
      ]
    ],
    pageMeta: [
      { includeGenre: true },   // page 1: signature + genre
      { includeGenre: false } 
    ]
  },
};

// -----------------------------
// 2) EXTRA specials (only for the 3 movies you requested)
// -----------------------------
export const extraSpecials = {
  shawshank: [
    {
      id: "rock_hammer_breakout",
      name: "Rock Hammer Breakout",
      description: "A patient plan pays off with a massive hit.",
      kind: "damageEnemy",
      target: "enemy",
      powerMultiplier: 2.1, // stronger (single-genre)
      cooldownTurns: 3
    }
  ],

  mean_girls: [
    {
      id: "burn_book_blast",
      name: "Burn Book Blast",
      description: "Rumors explode into massive damage.",
      kind: "damageEnemy",
      target: "enemy",
      powerMultiplier: 2.1, // stronger (single-genre)
      cooldownTurns: 3
    }
  ]

  // NOTE:
  // Office Space is now handled via specials.office_space.pages,
  // so it does NOT need an extraSpecials entry.
};

// -----------------------------
// 3) Helpers
// -----------------------------

function flattenPages(pages) {
  if (!Array.isArray(pages)) return [];
  const out = [];
  for (const page of pages) {
    if (Array.isArray(page)) out.push(...page.filter(Boolean));
  }
  return out;
}

// Returns an array of all signature specials for a movie (primary + extras).
// Updated to support the new `pages` shape.
export function getAllSignatureSpecials(movieId) {
  const entry = specials[movieId];

  let primary = [];
  if (entry) {
    if (Array.isArray(entry.pages)) {
      primary = flattenPages(entry.pages);
    } else {
      primary = [entry];
    }
  }

  const extra = extraSpecials[movieId] || [];
  return primary.concat(extra);
}
