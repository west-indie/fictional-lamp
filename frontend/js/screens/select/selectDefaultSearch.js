// frontend/js/screens/select/selectDefaultSearch.js
//
// Backwards-compatible facade around the modular search system.

export {
  ensureSearchState,
  bindSearchKeyboard,
  updateSearchFromQueue,
  handleSearchPointer,
  handleSearchHover,
  isMouseOverSearchDropdown,
  closeSearchDropdown,
  renderSearchDropdown,
  enterPickSlotMode,
  exitPickSlotMode,
  getSearchModeValue as getSearchMode,
  setSearchModeValue as setSearchMode
} from "./search/searchEngine.js";

