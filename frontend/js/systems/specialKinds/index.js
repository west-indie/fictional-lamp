// frontend/js/specialKinds/index.js
//
// Step A — Special Kind Rules (scaffolding).
// Central export surface for kind classification + future label/text unification.

export * from "./specialKindMap.js";

export { kind as kindDamage } from "./kindDamage.js";
export { kind as kindHeal } from "./kindHeal.js";
export { kind as kindShield } from "./kindShield.js";
export { kind as kindBuff } from "./kindBuff.js";
export { kind as kindDebuff } from "./kindDebuff.js";
export { kind as kindFx } from "./kindFx.js";
