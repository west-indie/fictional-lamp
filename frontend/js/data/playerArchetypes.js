// frontend/js/data/playerArchetypes.js
//
// Shared archetype list for Select + Quickplay.
// - movieIds must exist in frontend/js/data/movies.js
// - hidden archetypes are excluded by default and appear only when unlocked

export const playerArchetypes = [
  // ===== VISIBLE / STANDARD ARCHETYPES =====

  { id: "film_bro", name: "Film Bro", movieIds: ["fight_club", "taxi_driver", "inception", "goodfellas"], hidden: false },
  { id: "oscar_bait", name: "Oscar Bait", movieIds: ["moonlight", "birdman", "roma", "nomadland"], hidden: false },
  { id: "blockbuster_fan", name: "Blockbuster Fan", movieIds: ["star_wars", "raiders_of_the_lost_ark", "jurassic_park", "avengers"], hidden: false },
  { id: "a24_enthusiast", name: "A24 Enthusiast", movieIds: ["hereditary", "midsommar", "lady_bird", "everything_everywhere"], hidden: false },
  { id: "anime_theater_regular", name: "Anime Theater Regular", movieIds: ["spirited_away", "howls_moving_castle", "your_name", "akira"], hidden: false },
  { id: "horror_buff", name: "Horror Buff", movieIds: ["halloween", "the_shining", "alien", "nightmare_on_elm_street"], hidden: false },
  { id: "scifi_purist", name: "Sci-Fi Purist", movieIds: ["the_matrix", "the_terminator", "blade_runner_2049", "interstellar"], hidden: false },
  { id: "romcom_apologist", name: "Rom-Com Apologist", movieIds: ["when_harry_met_sally", "ten_things_i_hate_about_you", "crazy_rich_asians", "notting_hill"], hidden: false },
  { id: "foreign_cinema_nerd", name: "Foreign Cinema Nerd", movieIds: ["parasite", "amelie", "pans_labyrinth", "oldboy_2003"], hidden: false },
  { id: "film_school_professor", name: "Film School Professor", movieIds: ["casablanca", "citizen_kane", "singin_in_the_rain", "rear_window"], hidden: false },
  { id: "test", name: "Test", movieIds: ["everything_everywhere","everything_everywhere","everything_everywhere","everything_everywhere"], hidden: false },
  { id: "2est", name: "2est", movieIds: ["howls_moving_castle","midsommar","wicked","wicked_for_good"], hidden: false },
  

  // ===== HIDDEN / FINAL ARCHETYPES (PER YOUR FINALIZED LIST) =====

  
    // 🧮 IMDb Min-Maxer
  { id: "imdb_minmaxer", name: "IMDb Min-Maxer", movieIds: ["shawshank", "godfather", "dark_knight", "lotr_return_king"], hidden: true },
      // 🐀 Guy Who’s Only Seen Ratatouille
  { id: "ratatouille_only", name: "Guy Who’s Only Seen Ratatouille", quickName: "Only Seen One Movie", movieIds: ["ratatouille", "ratatouille", "ratatouille", "ratatouille"], hidden: true },
  // 📼 Dad’s DVD Shelf
  { id: "dads_dvd_shelf", name: "Dad’s DVD Shelf", movieIds: ["die_hard", "gladiator", "the_fugitive", "lethal_weapon"], hidden: true },
    // 🧪 Criterion Goblin
  { id: "criterion_goblin", name: "Criterion Goblin", movieIds: ["seven_samurai", "persona", "eight_half", "the_400_blows"], hidden: true },
  // 🎬 Director’s Cut Purist
  { id: "directors_cut_purist", name: "Director’s Cut Purist", movieIds: ["blade_runner_final_cut", "once_upon_a_time_in_america", "apocalypse_now", "lotr_return_king"], hidden: true },



];
