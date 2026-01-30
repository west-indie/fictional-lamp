// frontend/js/systems/menuLayeredMusic.js
import { createLayeredBgm } from "./layeredBgmSystem.js";

export const MENU_MIX = { layer1: 1, layer2: 0 };         // ✅ main menu: ONLY layer1
export const NAV_MIX  = { layer1: 1, layer2: 1 };         // (for later) quickplay/select: layer1+layer2
export const SILENT_MIX = { layer1: 0, layer2: 0 };       // optional utility

export const MenuLayers = createLayeredBgm({
  stems: {
    layer1: "frontend/assets/audio/bgm/Menu01.ogg",
    layer2: "frontend/assets/audio/bgm/Menu02.ogg",
  },
  initialMix: SILENT_MIX,
});
