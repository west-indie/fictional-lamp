// frontend/js/data/unlockRules.js
//
// Declarative unlock rules.
// Each rule returns true when it should unlock the archetype.
// Rules depend ONLY on GameState, so unlocks can happen from anywhere.

export const unlockRules = [
  {
    id: "unlock_imdb_minmaxer",
    archetypeId: "imdb_minmaxer",
    when: (state) => !!state.flags?.secrets?.imdbSequenceCompleted
  },

  // ✅ NEW: unlock after 10 ACTION battle-wins
  // Requires stats system to track: state.stats.winsByGenre.ACTION
  {
    id: "unlock_dads_dvd_shelf",
    archetypeId: "dads_dvd_shelf",
    when: (state) => (state.stats?.winsByGenre?.ACTION || 0) >= 10
  },

  {
    id: "unlock_directors_cut_purist_on_campaign_clear",
    archetypeId: "directors_cut_purist",
    //when: (state) => !!state.stats?.campaignCleared
    when: (state) => (state.stats?.winsByGenre?.ACTION || 0) >= 1
  },

  // ✅ unlock after 30 Randomize uses on Select
  {
    id: "unlock_ratatouille",
    archetypeId: "ratatouille_only",
    codeLabel: "Congrats!! Now just pick something next time.",
    showOverlay: true,

    // ✅ ONLY allow the unlock to actually fire on the MENU screen
    when: (G) => {
      const curScreen = String(G?.currentScreen || "");
      if (curScreen !== "menu") return false;

      const clicks = Number(G?.stats?.randomizeClicks || 0);

      const trial = G?.flags?.secrets?.ratatouilleTrial;
      const forcedUsed = !!trial?.forcedUsed;
      const completed = !!trial?.completed;

      // ✅ still keep your safety gate (clicks>=30) if you want it,
      // but the REAL gate is forcedUsed + completed and menu-only.
      return clicks >= 30 && forcedUsed && completed;
    }
  },



  // ✅ NEW: unlock after 7 "arthouse" franchise battle-wins
  // Requires movieMeta franchise to include "arthouse" (string or array)
  // Requires stats system to track: state.stats.winsByFranchise.arthouse
  {
    id: "unlock_criterion_goblin",
    archetypeId: "criterion_goblin",
    when: (state) => (state.stats?.winsByFranchise?.Arthouse || 0) >= 7
  }
];
