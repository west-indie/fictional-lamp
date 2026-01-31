// frontend/js/screens/battle/battleMouse.js
// Module C: mouse hover/click handling for battle UI.
// Behavior is intended to match the original inline mouse logic in screens/battle.js.

import {
  getRowMetrics,
  getRowButtonX,
  getTopMiniRects,
  pointInRect
} from "../../ui/battleMenus.js";

/**
 * Handles mouse interactions during PLAYER phase.
 * Returns true if it performed an action that should end the frame (caller should `return`).
 */
export function handleBattleMouse({
  mouse,
  state,
  SCREEN,
  BATTLE_LAYOUT,
  actions,
  itemSlotsPerPage,
  battleActions,
  clampItemPagingAndSelection,
  getItemPageCount,
  getItemPageStart,
  toggleItemPageInState,
  toggleSpecialPage,
  getCurrentActor,
  cancelUI,
  openPauseOverlay,
  playUIBackBlip,
  playUIConfirmBlip,
  playUIMoveBlip, // kept: used for Toggle click
  setHover
}) {
  if (!mouse) return false;
  if (!(mouse.moved || mouse.pressed || mouse.released || mouse.clicked || mouse.down)) return false;

  let hitSomething = false;
  const uiBaseY = BATTLE_LAYOUT.command.y;

  // --- confirm mode minis + command-row behavior ---
  if (state.uiMode === "confirm") {
    let hitAnyConfirmUi = false;
    const a = state.confirmAction;

    // Minis (back/confirm) only exist for simple confirms
    if (a === "ATTACK" || a === "DEFEND" || a === "RUN") {
      const { buttonW } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: actions.length });
      const { backRect, rightRect } = getTopMiniRects({
        SCREEN,
        BATTLE_LAYOUT,
        uiBaseY,
        slotCount: actions.length,
        buttonW,
        itemSlotsPerPage
      });

      if (pointInRect(mouse.x, mouse.y, backRect)) {
        hitAnyConfirmUi = true;
        hitSomething = true;
        setHover({ kind: "miniBack", index: -1 });
        mouse.setCursor("pointer");
        if (mouse.clicked) {
          try { playUIBackBlip(); } catch {}
          cancelUI();
          return true;
        }
      } else if (pointInRect(mouse.x, mouse.y, rightRect)) {
        hitAnyConfirmUi = true;
        hitSomething = true;
        setHover({ kind: "miniRight", index: -1 });
        mouse.setCursor("pointer");
        if (mouse.clicked) {
          try { playUIConfirmBlip(); } catch {}
          const act = state.confirmAction;
          state.confirmAction = null;
          state.uiMode = "command";
          if (act) battleActions.runConfirmedAction(act);
          return true;
        }
      }
    }

    // Clicking on command buttons while confirm-pending:
    // - Click SAME command again => execute (confirm ping)
    // - Click DIFFERENT command => cancel confirm mode (back ping)
    const { buttonW, buttonH } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: actions.length });
    for (let i = 0; i < actions.length; i++) {
      const bx = getRowButtonX(BATTLE_LAYOUT, i, buttonW);
      const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };
      if (pointInRect(mouse.x, mouse.y, r)) {
        hitAnyConfirmUi = true;
        hitSomething = true;
        setHover({ kind: "action", index: i });
        mouse.setCursor("pointer");
        state.actionIndex = i;

        if (mouse.clicked) {
          const clickedAct = actions[i];

          if (clickedAct === state.confirmAction) {
            try { playUIConfirmBlip(); } catch {}
            const act = state.confirmAction;
            state.confirmAction = null;
            state.uiMode = "command";
            if (act) battleActions.runConfirmedAction(act);
            return true;
          }

          try { playUIBackBlip(); } catch {}
          state.confirmAction = null;
          state.uiMode = "command";
          return true;
        }
        break;
      }
    }

    // Clicked elsewhere: cancel confirm mode (back/cancel ping)
    if (mouse.clicked && !hitAnyConfirmUi) {
      try { playUIBackBlip(); } catch {}
      state.confirmAction = null;
      state.uiMode = "command";
      return true;
    }
  }

  // --- command mode: pause mini + action buttons ---
  if (state.uiMode === "command") {
    const { buttonW, buttonH } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: actions.length });
    const { backRect } = getTopMiniRects({
      SCREEN,
      BATTLE_LAYOUT,
      uiBaseY,
      slotCount: actions.length,
      buttonW,
      itemSlotsPerPage
    });

    // Pause mini (left) — hover move ping handled by setHover; click opens overlay
    if ((state.phase === "player" || state.phase === "enemy") && pointInRect(mouse.x, mouse.y, backRect)) {
      hitSomething = true;
      setHover({ kind: "pause", index: -1 });
      mouse.setCursor("pointer");
      if (mouse.clicked) {
        openPauseOverlay();
        return true;
      }
    }

    // Action row — click should play confirm ping
    for (let i = 0; i < actions.length; i++) {
      const bx = getRowButtonX(BATTLE_LAYOUT, i, buttonW);
      const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };
      if (pointInRect(mouse.x, mouse.y, r)) {
        hitSomething = true;
        setHover({ kind: "action", index: i });
        mouse.setCursor("pointer");
        state.actionIndex = i;

        if (mouse.clicked) {
          try { playUIConfirmBlip(); } catch {}
          battleActions.handlePlayerActionFromCommand();
          if (state.uiMode === "item") clampItemPagingAndSelection();
          return true;
        }
        break;
      }
    }
  }

  // --- item mode: minis + slots ---
  if (state.uiMode === "item") {
    if (state.inventory && state.inventory.length > 0) {
      clampItemPagingAndSelection();
      const pageCount = getItemPageCount();
      const pageStart = getItemPageStart(state.itemsPageIndex);
      const { buttonW, buttonH } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: itemSlotsPerPage });
      const { backRect, rightRect } = getTopMiniRects({
        SCREEN,
        BATTLE_LAYOUT,
        uiBaseY,
        slotCount: itemSlotsPerPage,
        buttonW,
        itemSlotsPerPage
      });

      // Back mini — click should play back ping
      if (pointInRect(mouse.x, mouse.y, backRect)) {
        hitSomething = true;
        setHover({ kind: "miniBack", index: -1 });
        mouse.setCursor("pointer");
        if (mouse.clicked) {
          try { playUIBackBlip(); } catch {}
          cancelUI();
          return true;
        }
      }
      // Toggle mini — click keeps move ping (like arrow key navigation)
      else if (pointInRect(mouse.x, mouse.y, rightRect)) {
        hitSomething = true;
        setHover({ kind: "miniRight", index: -1 });
        mouse.setCursor("pointer");
        if (mouse.clicked) {
          toggleItemPageInState();
          if (pageCount > 1 && typeof playUIMoveBlip === "function") playUIMoveBlip();
          return true;
        }
      }

      // Item slots — click should play confirm ping
      for (let slot = 0; slot < itemSlotsPerPage; slot++) {
        const bx = getRowButtonX(BATTLE_LAYOUT, slot, buttonW);
        const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };
        const idx = pageStart + slot;
        const hasItem = idx < state.inventory.length;

        if (hasItem && pointInRect(mouse.x, mouse.y, r)) {
          hitSomething = true;
          setHover({ kind: "itemSlot", index: slot });
          mouse.setCursor("pointer");
          state.itemIndex = idx;

          if (mouse.clicked) {
            try { playUIConfirmBlip(); } catch {}
            battleActions.confirmUseSelectedItem();
            return true;
          }
          break;
        }
      }
    }
  }

  // --- special mode: minis + slots ---
  if (state.uiMode === "special") {
    if (state.specialsList && state.specialsList.length > 0) {
      const count = state.specialsList.length;
      const { buttonW, buttonH } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: count });
      const { backRect, rightRect } = getTopMiniRects({
        SCREEN,
        BATTLE_LAYOUT,
        uiBaseY,
        slotCount: count,
        buttonW,
        itemSlotsPerPage
      });

      // Back mini — click should play back ping
      if (pointInRect(mouse.x, mouse.y, backRect)) {
        hitSomething = true;
        setHover({ kind: "miniBack", index: -1 });
        mouse.setCursor("pointer");
        if (mouse.clicked) {
          try { playUIBackBlip(); } catch {}
          cancelUI();
          return true;
        }
      }
      // Toggle mini — click keeps move ping (like navigation)
      else if (pointInRect(mouse.x, mouse.y, rightRect)) {
        hitSomething = true;
        setHover({ kind: "miniRight", index: -1 });
        mouse.setCursor("pointer");
        if (mouse.clicked) {
          const actor = getCurrentActor();
          const toggled = actor ? toggleSpecialPage(actor) : false;
          if (toggled && typeof playUIMoveBlip === "function") playUIMoveBlip();
          return true;
        }
      }

      // Special slots — click should play confirm ping
      for (let i = 0; i < count; i++) {
        const bx = getRowButtonX(BATTLE_LAYOUT, i, buttonW);
        const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };
        const sp = state.specialsList[i];
        const ready = !!sp?.ready;

        if (ready && pointInRect(mouse.x, mouse.y, r)) {
          hitSomething = true;
          setHover({ kind: "specialSlot", index: i });
          mouse.setCursor("pointer");
          state.specialIndex = i;

          if (mouse.clicked) {
            try { playUIConfirmBlip(); } catch {}
            battleActions.confirmUseSelectedSpecial();
            return true;
          }
          break;
        }
      }
    }
  }

  // --- target modes: choose an ally ---
  if (state.uiMode === "itemTarget" || state.uiMode === "specialTarget") {
    let hitTarget = false;

    for (let i = 0; i < state.party.length; i++) {
      const m = state.party[i];
      if (!m) continue;
      if (m.hp <= 0) continue;

      const r = {
        x: BATTLE_LAYOUT.party.x + i * BATTLE_LAYOUT.party.dx,
        y: BATTLE_LAYOUT.party.y - 6,
        w: BATTLE_LAYOUT.party.dx - 4,
        h: 76
      };

      if (pointInRect(mouse.x, mouse.y, r)) {
        hitTarget = true;
        hitSomething = true;
        setHover({ kind: "target", index: i });
        mouse.setCursor("pointer");
        state.targetIndex = i;

        if (mouse.clicked) {
          try { playUIConfirmBlip(); } catch {}
          if (state.uiMode === "itemTarget") battleActions.confirmUseItemOnTarget();
          else battleActions.confirmUseSpecialOnTarget();
          return true;
        }
        break;
      }
    }

    // In itemTarget, clicking anywhere not on a target acts as Back (back ping)
    if (state.uiMode === "itemTarget" && mouse.clicked && !hitTarget) {
      try { playUIBackBlip(); } catch {}
      cancelUI();
      return true;
    }
  }

  // ✅ If we didn't hit anything interactive, clear hover.
  // This ensures hover-change pings re-trigger correctly when re-entering a button.
  if (!hitSomething) {
    setHover({ kind: null, index: -1 });
  }

  return false;
}
