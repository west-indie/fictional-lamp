// frontend/js/screens/battle/battleMouse.js
// Module C: mouse hover/click handling for battle UI.
// Behavior is intended to match the original inline mouse logic in screens/battle.js.

import {
  getRowMetrics,
  getRowButtonX,
  getTopMiniRects,
  pointInRect
} from "../../ui/battleMenus.js";
import { items } from "../../data/items.js";

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
  playUIMoveBlip,
  setHover,

  // ✅ NEW: keyboard can temporarily “own” selection until the mouse moves again
  mouseSelectEnabled = true
}) {
  if (!mouse) return false;

  let hitSomething = false;
  const uiBaseY = BATTLE_LAYOUT.command.y;

  // ✅ Mouse can own focus only when enabled, moved, or clicked this frame.
  const canMouseDriveSelection = mouseSelectEnabled || mouse.moved || mouse.clicked;

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
        if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");
        if (mouse.clicked) {
          try { playUIBackBlip(); } catch {}
          cancelUI();
          return true;
        }
      } else if (pointInRect(mouse.x, mouse.y, rightRect)) {
        hitAnyConfirmUi = true;
        hitSomething = true;
        setHover({ kind: "miniRight", index: -1 });
        if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");
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
    const { buttonW, buttonH } = getRowMetrics({ SCREEN, BATTLE_LAYOUT, slotCount: actions.length });
    for (let i = 0; i < actions.length; i++) {
      const bx = getRowButtonX(BATTLE_LAYOUT, i, buttonW);
      const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };

      if (pointInRect(mouse.x, mouse.y, r)) {
        hitAnyConfirmUi = true;
        hitSomething = true;
        if (canMouseDriveSelection) setHover({ kind: "action", index: i });
        if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");

        if (canMouseDriveSelection) state.actionIndex = i;

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

    // Clicked elsewhere: cancel confirm mode
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

    // Pause mini (left)
    if ((state.phase === "player" || state.phase === "enemy") && pointInRect(mouse.x, mouse.y, backRect)) {
      hitSomething = true;
      setHover({ kind: "pause", index: -1 });
      if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");
      if (mouse.clicked) {
        openPauseOverlay();
        return true;
      }
    }

    // Action row
    for (let i = 0; i < actions.length; i++) {
      const bx = getRowButtonX(BATTLE_LAYOUT, i, buttonW);
      const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };
      if (pointInRect(mouse.x, mouse.y, r)) {
        hitSomething = true;
        if (canMouseDriveSelection) setHover({ kind: "action", index: i });
        if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");

        if (canMouseDriveSelection) state.actionIndex = i;

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

      if (pointInRect(mouse.x, mouse.y, backRect)) {
        hitSomething = true;
        setHover({ kind: "miniBack", index: -1 });
        if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");
        if (mouse.clicked) {
          try { playUIBackBlip(); } catch {}
          cancelUI();
          return true;
        }
      } else if (pointInRect(mouse.x, mouse.y, rightRect)) {
        hitSomething = true;
        setHover({ kind: "miniRight", index: -1 });
        if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");
        if (mouse.clicked) {
          toggleItemPageInState();
          if (pageCount > 1 && typeof playUIMoveBlip === "function") playUIMoveBlip();
          return true;
        }
      }

      for (let slot = 0; slot < itemSlotsPerPage; slot++) {
        const bx = getRowButtonX(BATTLE_LAYOUT, slot, buttonW);
        const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };
        const idx = pageStart + slot;
        const hasItem = idx < state.inventory.length;
        const entry = hasItem ? state.inventory[idx] : null;
        const def = entry ? items[entry.id] : null;
        const itemId = String(def?.id || entry?.id || "");
        const itemCd = Math.max(0, Math.floor(Number(state?.itemCooldowns?.[itemId] || 0)));
        const itemType = String(def?.type || "").trim().toLowerCase();
        const sharedWeaponCd = itemType === "reusableweapon"
          ? Math.max(0, Math.floor(Number(state?.itemCooldowns?.__weapon__ || 0)))
          : 0;
        const cooldownRemaining = Math.max(itemCd, sharedWeaponCd);
        const ready = cooldownRemaining <= 0;

        // ✅ CHANGE: hover-detect always (even empty slots) so hover ping works
        if (pointInRect(mouse.x, mouse.y, r)) {
          hitSomething = true;
          if (canMouseDriveSelection) setHover({ kind: "itemSlot", index: slot });
          if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");

          // Only drive selection/click if there is a real item
          if (hasItem && canMouseDriveSelection) state.itemIndex = idx;

          if (hasItem && ready && mouse.clicked) {
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

      if (pointInRect(mouse.x, mouse.y, backRect)) {
        hitSomething = true;
        setHover({ kind: "miniBack", index: -1 });
        if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");
        if (mouse.clicked) {
          try { playUIBackBlip(); } catch {}
          cancelUI();
          return true;
        }
      } else if (pointInRect(mouse.x, mouse.y, rightRect)) {
        hitSomething = true;
        setHover({ kind: "miniRight", index: -1 });
        if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");
        if (mouse.clicked) {
          const actor = getCurrentActor();
          const toggled = actor ? toggleSpecialPage(actor) : false;
          if (toggled && typeof playUIMoveBlip === "function") playUIMoveBlip();
          return true;
        }
      }

      for (let i = 0; i < count; i++) {
        const bx = getRowButtonX(BATTLE_LAYOUT, i, buttonW);
        const r = { x: bx, y: uiBaseY, w: buttonW, h: buttonH };
        const sp = state.specialsList[i];
        const ready = !!sp?.ready;

        // ✅ CHANGE: hover-detect always (even not ready) so hover ping works
        if (pointInRect(mouse.x, mouse.y, r)) {
          hitSomething = true;
          if (canMouseDriveSelection) setHover({ kind: "specialSlot", index: i });
          if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");

          if (canMouseDriveSelection) state.specialIndex = i;

          if (ready && mouse.clicked) {
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
    const pendingItemEntry =
      state.uiMode === "itemTarget" &&
      Array.isArray(state.inventory) &&
      Number.isFinite(state.pendingItemIndex) &&
      state.pendingItemIndex >= 0 &&
      state.pendingItemIndex < state.inventory.length
        ? state.inventory[state.pendingItemIndex]
        : null;
    const pendingItemDef = pendingItemEntry ? items[pendingItemEntry.id] : null;
    const allowDownedItemTarget = state.uiMode === "itemTarget" && !!pendingItemDef?.revive;

    let hitTarget = false;
    for (let i = 0; i < state.party.length; i++) {
      const m = state.party[i];
      if (!m) continue;
      if (m.hp <= 0 && !allowDownedItemTarget) continue;

      const r = {
        x: BATTLE_LAYOUT.party.x + i * BATTLE_LAYOUT.party.dx,
        y: BATTLE_LAYOUT.party.y - 6,
        w: BATTLE_LAYOUT.party.dx - 4,
        h: 76
      };
      if (pointInRect(mouse.x, mouse.y, r)) {
        hitTarget = true;
        hitSomething = true;
        if (canMouseDriveSelection) setHover({ kind: "target", index: i });
        if (typeof mouse.setCursor === "function") mouse.setCursor("pointer");

        if (canMouseDriveSelection) state.targetIndex = i;

        if (mouse.clicked) {
          try { playUIConfirmBlip(); } catch {}
          if (state.uiMode === "itemTarget") battleActions.confirmUseItemOnTarget();
          else battleActions.confirmUseSpecialOnTarget();
          return true;
        }
        break;
      }
    }

    // When using an item on a target, clicking anywhere not on a target acts as Back.
    if (state.uiMode === "itemTarget" && mouse.clicked && !hitTarget) {
      try { playUIBackBlip(); } catch {}
      cancelUI();
      return true;
    }
  }

  if (!hitSomething || !canMouseDriveSelection) {
    setHover({ kind: null, index: -1 });
  }

  return false;
}
