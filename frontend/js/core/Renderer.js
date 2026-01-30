// frontend/js/core/Renderer.js
//
// Very small helpers to keep game.js simple.

export function updateCurrentScreen(screens, state, input, mouse) {
  const screen = screens[state.currentScreen];
  if (!screen || typeof screen.update !== "function") return;

  screen.update(mouse);
}

export function renderCurrentScreen(ctx, screens, state) {
  const screen = screens[state.currentScreen];
  if (!screen || typeof screen.render !== "function") return;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  screen.render(ctx);
}
