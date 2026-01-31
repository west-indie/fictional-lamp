// frontend/js/data/movies.js
//
// Adds `shortTitle` for nameplate use (retro-friendly shorthands).
// Full `title` remains unchanged for search + full display elsewhere.

export const movies = [
  // =========================
  // POPULAR / STARTER PICKS (forced top order)
  // =========================
  { id: "shawshank", title: "The Shawshank Redemption", shortTitle: "The Shawshank Redemption", runtime: 142, imdb: 9.3 },
  { id: "taxi_driver", title: "Taxi Driver", shortTitle: "Taxi Driver", runtime: 114, imdb: 8.2 },
  { id: "inception", title: "Inception", shortTitle: "Inception", runtime: 148, imdb: 8.8 },
  { id: "the_shining", title: "The Shining", shortTitle: "The Shining", runtime: 146, imdb: 8.4 },
  { id: "star_wars", title: "Star Wars", shortTitle: "Star Wars", runtime: 121, imdb: 8.6 },
  { id: "midsommar", title: "Midsommar", shortTitle: "Midsommar", runtime: 147, imdb: 7.1 },
  { id: "office_space", title: "Office Space", shortTitle: "Office Space", runtime: 89, imdb: 7.7 },
  { id: "howls_moving_castle", title: "Howl's Moving Castle", shortTitle: "Howl's Moving Castle", runtime: 119, imdb: 8.2 },
  { id: "spirited_away", title: "Spirited Away", shortTitle: "Spirited Away", runtime: 125, imdb: 8.6 },
  { id: "interstellar", title: "Interstellar", shortTitle: "Interstellar", runtime: 169, imdb: 8.6 },
  { id: "scream", title: "Scream", shortTitle: "Scream", runtime: 111, imdb: 7.4 },
  { id: "seven_samurai", title: "Seven Samurai", shortTitle: "Seven Samurai", runtime: 207, imdb: 8.6 },
  { id: "dark_knight", title: "The Dark Knight", shortTitle: "The Dark Knight", runtime: 152, imdb: 9.0 },
  { id: "amadeus_1984", title: "Amadeus (1984)", shortTitle: "Amadeus (1984)", runtime: 160, imdb: 8.4 }, 
  { id: "the_departed", title: "The Departed", shortTitle: "The Departed", runtime: 151, imdb: 8.5 },
  { id: "pulp_fiction", title: "Pulp Fiction", shortTitle: "Pulp Fiction", runtime: 154, imdb: 8.9 },
  { id: "reservoir_dogs", title: "Reservoir Dogs", shortTitle: "Reservoir Dogs", runtime: 99, imdb: 8.3 },
  { id: "purple_rain", title: "Purple Rain", shortTitle: "Purple Rain", runtime: 111, imdb: 6.5 },
  { id: "scarface", title: "Scarface", shortTitle: "Scarface (1983)", runtime: 170, imdb: 8.3 },
  { id: "bull_durham", title: "Bull Durham", shortTitle: "Bull Durham", runtime: 108, imdb: 7.1 },
  { id: "they_live", title: "They Live", shortTitle: "They Live", runtime: 94, imdb: 7.2 },
  { id: "mean_girls", title: "Mean Girls", shortTitle: "Mean Girls", runtime: 97, imdb: 7.1 },
  { id: "wicked", title: "Wicked", shortTitle: "Wicked", runtime: 160, imdb: 7.4 },
  { id: "wicked_for_good", title: "Wicked: For Good", shortTitle: "Wicked: For Good", runtime: 137, imdb: 6.9 },
  { id: "parasite", title: "Parasite", shortTitle: "Parasite", runtime: 132, imdb: 8.6 },
  { id: "avengers", title: "The Avengers", shortTitle: "The Avengers", runtime: 143, imdb: 8.0 },
  { id: "empire_strikes_back", title: "The Empire Strikes Back", shortTitle: "The Empire Strikes Back", runtime: 124, imdb: 8.7 },
  { id: "mad_max_fury_road", title: "Mad Max: Fury Road", shortTitle: "Mad Max: Fury Road", runtime: 120, imdb: 8.1 },
  { id: "harry_potter_2001", title: "Harry Potter and the Sorcerer's Stone", shortTitle: "Harry Potter (2001)", runtime: 152, imdb: 7.6 },
  { id: "avatar", title: "Avatar", shortTitle: "Avatar", runtime: 162, imdb: 7.8 },
  { id: "zombieland", title: "Zombieland", shortTitle: "Zombieland", runtime: 88, imdb: 7.5 },
  { id: "la_la_land", title: "La La Land", shortTitle: "La La Land", runtime: 128, imdb: 8.0 },
  { id: "get_out", title: "Get Out", shortTitle: "Get Out", runtime: 104, imdb: 7.7 },
  { id: "jurassic_park", title: "Jurassic Park", shortTitle: "Jurassic Park", runtime: 127, imdb: 8.2 },
  { id: "whiplash", title: "Whiplash", shortTitle: "Whiplash", runtime: 106, imdb: 8.5 },
  { id: "akira", title: "Akira", shortTitle: "Akira", runtime: 124, imdb: 8.0 },
  { id: "spiderverse", title: "Spider-Man: Into the Spider-Verse", shortTitle: "Into the Spider-Verse", runtime: 117, imdb: 8.4 },
  { id: "truman_show", title: "The Truman Show", shortTitle: "The Truman Show", runtime: 103, imdb: 8.2 },
  { id: "alien", title: "Alien", shortTitle: "Alien", runtime: 117, imdb: 8.4 },
  { id: "joker", title: "Joker", shortTitle: "Joker", runtime: 122, imdb: 8.4 },
  { id: "princess_mononoke", title: "Princess Mononoke", shortTitle: "Princess Mononoke", runtime: 134, imdb: 8.4 },
  { id: "jaws", title: "Jaws", shortTitle: "Jaws", runtime: 124, imdb: 8.1 },
  { id: "the_social_network", title: "The Social Network", shortTitle: "The Social Network", runtime: 120, imdb: 7.8 },
  { id: "halloween", title: "Halloween", shortTitle: "Halloween", runtime: 91, imdb: 7.7 },
  { id: "this_is_spinal_tap", title: "This Is Spinal Tap", shortTitle: "This Is Spinal Tap", runtime: 82, imdb: 8.0 },
  { id: "scott_pilgrim", title: "Scott Pilgrim vs. the World", shortTitle: "Scott Pilgrim vs. the World", runtime: 112, imdb: 7.5 },
  { id: "spiderman_2002", title: "Spider-Man (2002)", shortTitle: "Spider-Man (2002)", runtime: 121, imdb: 7.4 },
  { id: "spiderman_2_2004", title: "Spider-Man 2 (2004)", shortTitle: "Spider-Man 2", runtime: 127, imdb: 7.5 },
  { id: "grand_budapest", title: "The Grand Budapest Hotel", shortTitle: "The Grand Budapest Hotel", runtime: 99, imdb: 8.1 },
  { id: "love_and_mercy", title: "Love & Mercy", shortTitle: "Love & Mercy", runtime: 121, imdb: 7.4 },
  { id: "steve_jobs_2015", title: "Steve Jobs", shortTitle: "Steve Jobs", runtime: 122, imdb: 7.2 },
  { id: "ten_things_i_hate_about_you", title: "10 Things I Hate About You", shortTitle: "10 Things I Hate About You", runtime: 97, imdb: 7.3 },
  { id: "your_name", title: "Your Name", shortTitle: "Your Name", runtime: 106, imdb: 8.4 },
  { id: "raiders_of_the_lost_ark", title: "Raiders of the Lost Ark", shortTitle: "Raiders of the Lost Ark", runtime: 115, imdb: 8.4 },
  { id: "temple_of_doom", title: "Indiana Jones and the Temple of Doom", shortTitle: "Temple of Doom", runtime: 118, imdb: 7.5 },
  { id: "last_crusade", title: "Indiana Jones and the Last Crusade", shortTitle: "The Last Crusade", runtime: 127, imdb: 8.2 },
  { id: "the_terminator", title: "The Terminator", shortTitle: "The Terminator", runtime: 107, imdb: 8.1 },
  { id: "clue", title: "Clue", shortTitle: "Clue", runtime: 97, imdb: 7.3 },
  { id: "blade_runner_2049", title: "Blade Runner 2049", shortTitle: "Blade Runner 2049", runtime: 164, imdb: 8.0 },
  { id: "et", title: "E.T. the Extra-Terrestrial", shortTitle: "E.T. Extra Terrestrial", runtime: 115, imdb: 7.9 },
  { id: "everything_everywhere", title: "Everything Everywhere All at Once", shortTitle: "Everything Everywhere All", runtime: 139, imdb: 7.8 },
  { id: "when_harry_met_sally", title: "When Harry Met Sally", shortTitle: "When Harry Met Sally", runtime: 96, imdb: 7.7 },
  { id: "city_of_god", title: "City of God", shortTitle: "City of God", runtime: 130, imdb: 8.6 },
  { id: "die_hard", title: "Die Hard", shortTitle: "Die Hard", runtime: 132, imdb: 8.2 },
  { id: "harakiri", title: "Harakiri", shortTitle: "Harakiri", runtime: 133, imdb: 8.6 },
  { id: "shrek", title: "Shrek", shortTitle: "Shrek", runtime: 90, imdb: 7.9 },
  { id: "shrek_2", title: "Shrek 2", shortTitle: "Shrek 2", runtime: 93, imdb: 7.4 },
  { id: "the_witch", title: "The Witch", shortTitle: "The Witch", runtime: 92, imdb: 6.9 },
  { id: "apocalypse_now", title: "Apocalypse Now", shortTitle: "Apocalypse Now", runtime: 147, imdb: 8.4 },
  { id: "notting_hill", title: "Notting Hill", shortTitle: "Notting Hill", runtime: 124, imdb: 7.2 },
  { id: "prestige", title: "The Prestige", shortTitle: "The Prestige", runtime: 130, imdb: 8.5 },
  { id: "american_history_x", title: "American History X", shortTitle: "American History X", runtime: 119, imdb: 8.5 },
  { id: "rear_window", title: "Rear Window", shortTitle: "Rear Window", runtime: 112, imdb: 8.4 },
  { id: "roma", title: "Roma", shortTitle: "Roma", runtime: 135, imdb: 7.6 },
  { id: "good_bad_ugly", title: "The Good, the Bad and the Ugly", shortTitle: "The Good The Bad The Ugly", runtime: 161, imdb: 8.8 },
  { id: "crazy_rich_asians", title: "Crazy Rich Asians", shortTitle: "Crazy Rich Asians", runtime: 120, imdb: 6.9 },
  { id: "one_flew_over", title: "One Flew Over the Cuckoo's Nest", shortTitle: "One Flew Over", runtime: 133, imdb: 8.7 },
  { id: "nightmare_on_elm_street", title: "A Nightmare on Elm Street", shortTitle: "Nightmare on Elm Street", runtime: 91, imdb: 7.4 },
  { id: "tron", title: "Tron", shortTitle: "Tron", runtime: 96, imdb: 6.7 },
  { id: "citizen_kane", title: "Citizen Kane", shortTitle: "Citizen Kane", runtime: 119, imdb: 8.3 },
  { id: "amelie", title: "Amélie", shortTitle: "Amélie", runtime: 122, imdb: 8.3 },
  { id: "green_mile", title: "The Green Mile", shortTitle: "The Green Mile", runtime: 189, imdb: 8.6 },
  { id: "the_pianist", title: "The Pianist", shortTitle: "The Pianist", runtime: 150, imdb: 8.5 },
  { id: "oldboy_2003", title: "Oldboy (2003)", shortTitle: "Oldboy (2003)", runtime: 120, imdb: 8.3 },
  { id: "nomadland", title: "Nomadland", shortTitle: "Nomadland", runtime: 108, imdb: 7.3 },
  { id: "pans_labyrinth", title: "Pan's Labyrinth", shortTitle: "Pan's Labyrinth", runtime: 118, imdb: 8.2 },
  { id: "raging_bull", title: "Raging Bull", shortTitle: "Raging Bull", runtime: 129, imdb: 8.1 },
  { id: "casablanca", title: "Casablanca", shortTitle: "Casablanca", runtime: 102, imdb: 8.5 },
  { id: "intouchables", title: "The Intouchables", shortTitle: "The Intouchables", runtime: 112, imdb: 8.5 },
  { id: "birdman", title: "Birdman or (The Unexpected Virtue of Ignorance)", shortTitle: "Birdman", runtime: 119, imdb: 7.7 },
  { id: "rushmore", title: "Rushmore", shortTitle: "Rushmore", runtime: 93, imdb: 7.6 },
  { id: "royal_tenenbaums", title: "The Royal Tenenbaums", shortTitle: "The Royal Tenenbaums", runtime: 109, imdb: 7.6 },
  { id: "the_400_blows", title: "The 400 Blows", shortTitle: "The 400 Blows", runtime: 99, imdb: 8.1 },
  { id: "robocop", title: "RoboCop", shortTitle: "RoboCop", runtime: 102, imdb: 7.6 },
  { id: "hereditary", title: "Hereditary", shortTitle: "Hereditary", runtime: 127, imdb: 7.3 },
  { id: "godfather", title: "The Godfather", shortTitle: "The Godfather", runtime: 175, imdb: 9.2 },
  { id: "godfather_part_ii", title: "The Godfather Part II", shortTitle: "The Godfather Part II", runtime: 202, imdb: 9.0 },
  { id: "the_matrix", title: "The Matrix", shortTitle: "The Matrix", runtime: 136, imdb: 8.7 },
  { id: "fight_club", title: "Fight Club", shortTitle: "Fight Club", runtime: 139, imdb: 8.8 },
  { id: "goodfellas", title: "Goodfellas", shortTitle: "Goodfellas", runtime: 146, imdb: 8.7 },
  { id: "se7en", title: "Se7en", shortTitle: "Se7en", runtime: 127, imdb: 8.6 },
  { id: "paris_texas", title: "Paris, Texas", shortTitle: "Paris, Texas", runtime: 145, imdb: 8.1 },
  { id: "rebel_without_a_cause", title: "Rebel Without a Cause", shortTitle: "Rebel without a Cause", runtime: 111, imdb: 7.6 },
  { id: "moonlight", title: "Moonlight", shortTitle: "Moonlight", runtime: 111, imdb: 7.4 }, 
  { id: "silence_of_lambs", title: "The Silence of the Lambs", shortTitle: "Silence of the Lambs", runtime: 118, imdb: 8.6 },
  { id: "schindlers_list", title: "Schindler's List", shortTitle: "Schindler's List", runtime: 195, imdb: 9.0 },
  { id: "twelve_angry_men", title: "12 Angry Men", shortTitle: "12 Angry Men", runtime: 96, imdb: 9.0 },
  { id: "singin_in_the_rain", title: "Singin' in the Rain", shortTitle: "Singin' in the Rain", runtime: 103, imdb: 8.3 },
  { id: "the_seventh_seal", title: "The Seventh Seal", shortTitle: "The Seventh Seal", runtime: 96, imdb: 8.2 }, 
  { id: "saving_private_ryan", title: "Saving Private Ryan", shortTitle: "Saving Private Ryan", runtime: 169, imdb: 8.6 },
  { id: "forrest_gump", title: "Forrest Gump", shortTitle: "Forrest Gump", runtime: 142, imdb: 8.8 },
  { id: "lady_bird", title: "Lady Bird", shortTitle: "Lady Bird", runtime: 94, imdb: 7.4 },
  { id: "dark_knight_rises", title: "The Dark Knight Rises", shortTitle: "The Dark Knight Rises", runtime: 164, imdb: 8.4 },
  { id: "lion_king", title: "The Lion King", shortTitle: "The Lion King", runtime: 88, imdb: 8.5 },
  { id: "back_to_the_future", title: "Back to the Future", shortTitle: "Back to the Future", runtime: 116, imdb: 8.5 },
  { id: "superman_2", title: "Superman II", shortTitle: "Superman II", runtime: 127, imdb: 6.8 },
  { id: "terminator_2", title: "Terminator 2: Judgment Day", shortTitle: "T2: Judgment Day", runtime: 137, imdb: 8.6 },
  { id: "lotr_fellowship", title: "The Lord of the Rings: The Fellowship of the Ring", shortTitle: "LOTR: Fellowship", runtime: 178, imdb: 8.8 },
  { id: "lotr_two_towers", title: "The Lord of the Rings: The Two Towers", shortTitle: "LOTR: The Two Towers", runtime: 179, imdb: 8.7 },
  { id: "lotr_return_king", title: "The Lord of the Rings: The Return of the King", shortTitle: "Return of the King", runtime: 201, imdb: 9.0 },
  { id: "dune_2021", title: "Dune (2021)", shortTitle: "Dune (2021)", runtime: 155, imdb: 8.0 },
  // =========================
  // ====== ONLY THESE MOVIES ARE HIDDEN UNTIL UNLOCKED (per your request) ======
  // =========================

  // Director’s Cut Purist unlocks
  {
    id: "blade_runner_final_cut",
    title: "Blade Runner (Final Cut)",
    shortTitle: "Blade Runner: Final Cut",
    runtime: 117,
    imdb: 8.1,
    lockedBy: "directors_cut_purist"
  },
  {
    id: "once_upon_a_time_in_america",
    title: "Once Upon a Time in America",
    shortTitle: "Once Upon a Time America",
    runtime: 229,
    imdb: 8.3,
    lockedBy: "directors_cut_purist"
  },

  // Dad’s DVD Shelf unlocks
  { id: "gladiator", title: "Gladiator", shortTitle: "Gladiator", runtime: 155, imdb: 8.5, lockedBy: "dads_dvd_shelf" },
  { id: "lethal_weapon", title: "Lethal Weapon", shortTitle: "Lethal Weapon", runtime: 110, imdb: 7.6, lockedBy: "dads_dvd_shelf" },
  { id: "the_fugitive", title: "The Fugitive", shortTitle: "The Fugitive", runtime: 130, imdb: 7.8, lockedBy: "dads_dvd_shelf"},

  // Ratatouille archetype unlocks
  { id: "ratatouille", title: "Ratatouille", shortTitle: "Ratatouille", runtime: 111, imdb: 8.1, lockedBy: "ratatouille_only" },

  // Criterion Goblin unlocks
  { id: "persona", title: "Persona", shortTitle: "Persona", runtime: 83, imdb: 8.1, lockedBy: "criterion_goblin" },
  { id: "eight_half", title: "8½", shortTitle: "8½", runtime: 138, imdb: 8.0, lockedBy: "criterion_goblin" }
];

// Returns movies filtered by what’s unlocked.
// - If a movie has no lockedBy, it’s always visible.
// - If it has lockedBy, it’s visible only when unlocks.archetypes[lockedBy] is true.
export function getAvailableMovies(unlocks) {
  const flags = unlocks?.archetypes || {};
  return movies.filter((m) => !m.lockedBy || !!flags[m.lockedBy]);
}
