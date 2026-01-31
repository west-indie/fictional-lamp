// frontend/js/screens/battle/battleInput.js
// Module B: keyboard input routing for battle UI modes.
// Behavior is intended to match the original inline logic in screens/battle.js.

function isSpacePressed(Input) {
  return Input.pressed("Space");
}

function consumeSpace(Input) {
  Input.consume("Space");
}

/**
 * Handles keyboard input for the PLAYER phase when msgBox is not busy and no modal overlay is open.
 *
 * Returns true if input caused the caller to early-return (i.e., mode handled).
 */
export function handleBattleKeyboardInput({
  state,
  Input,
  actions,
  battleActions,
  clampItemPagingAndSelection,
  toggleItemPageInState,
  moveItemCursorWithinCurrentPage,
  moveTargetCursor,
  getCurrentActor,
  toggleSpecialPage,
  playUIMoveBlip,
  msgBox
}) {
  // CONFIRM MODE
  if (state.uiMode === "confirm") {
    if (Input.pressed("Enter")) {
      Input.consume("Enter");
      const a = state.confirmAction;
      state.confirmAction = null;
      state.uiMode = "command";
      if (a) battleActions.runConfirmedAction(a);
    }
    return true;
  }

  // COMMAND MODE
  if (state.uiMode === "command") {
    if (Input.pressed("ArrowLeft")) {
      Input.consume("ArrowLeft");
      state.actionIndex = (state.actionIndex - 1 + actions.length) % actions.length;
    }
    if (Input.pressed("ArrowRight")) {
      Input.consume("ArrowRight");
      state.actionIndex = (state.actionIndex + 1) % actions.length;
    }
    if (Input.pressed("Enter")) {
      Input.consume("Enter");
      battleActions.handlePlayerActionFromCommand();
      if (state.uiMode === "item") clampItemPagingAndSelection();
    }
    return true;
  }

  // ITEM MODE
  if (state.uiMode === "item") {
    if (state.inventory.length > 0) {
      clampItemPagingAndSelection();

      if (isSpacePressed(Input)) {
        const changed = toggleItemPageInState();
        consumeSpace(Input);
        if (changed && typeof playUIMoveBlip === "function") playUIMoveBlip();
      }

      if (Input.pressed("ArrowLeft")) {
        Input.consume("ArrowLeft");
        moveItemCursorWithinCurrentPage(-1);
      }
      if (Input.pressed("ArrowRight")) {
        Input.consume("ArrowRight");
        moveItemCursorWithinCurrentPage(1);
      }
      if (Input.pressed("Enter")) {
        Input.consume("Enter");
        battleActions.confirmUseSelectedItem();
      }
    } else {
      // Preserve original behavior: auto-return to command and queue message.
      state.uiMode = "command";
      msgBox.queue(["You have no items!"], () => {
        state.actionIndex = 0;
      });
    }
    return true;
  }

  // ITEM TARGET MODE
  if (state.uiMode === "itemTarget") {
    if (Input.pressed("ArrowLeft")) {
      Input.consume("ArrowLeft");
      moveTargetCursor(-1);
    }
    if (Input.pressed("ArrowRight")) {
      Input.consume("ArrowRight");
      moveTargetCursor(1);
    }
    if (Input.pressed("Enter")) {
      Input.consume("Enter");
      battleActions.confirmUseItemOnTarget();
    }
    return true;
  }

  // SPECIAL MODE
  if (state.uiMode === "special") {
    const actor = getCurrentActor();

    if (isSpacePressed(Input)) {
      const toggled = actor ? toggleSpecialPage(actor) : false;
      consumeSpace(Input);
      if (toggled && typeof playUIMoveBlip === "function") playUIMoveBlip();
    }

    if (state.specialsList.length > 0) {
      if (Input.pressed("ArrowLeft")) {
        Input.consume("ArrowLeft");
        state.specialIndex =
          (state.specialIndex - 1 + state.specialsList.length) % state.specialsList.length;
      }
      if (Input.pressed("ArrowRight")) {
        Input.consume("ArrowRight");
        state.specialIndex = (state.specialIndex + 1) % state.specialsList.length;
      }
      if (Input.pressed("Enter")) {
        Input.consume("Enter");
        battleActions.confirmUseSelectedSpecial();
      }
    } else {
      state.uiMode = "command";
    }
    return true;
  }

  // SPECIAL TARGET MODE
  if (state.uiMode === "specialTarget") {
    if (Input.pressed("ArrowLeft")) {
      Input.consume("ArrowLeft");
      moveTargetCursor(-1);
    }
    if (Input.pressed("ArrowRight")) {
      Input.consume("ArrowRight");
      moveTargetCursor(1);
    }
    if (Input.pressed("Enter")) {
      Input.consume("Enter");
      battleActions.confirmUseSpecialOnTarget();
    }
    return true;
  }

  return false;
}
