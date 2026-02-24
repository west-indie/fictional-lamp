// frontend/js/data/enemyDialogue.js
//
// Compatibility wrapper: canonical battle narration now lives in battleText.

import {
  buildEnemyDefeatLines as getEnemyDefeatLines,
  buildEnemyIntroLines as getEnemyIntroLines
} from "../battleText/engines/buildEnemyMetaLines.js";

export { getEnemyIntroLines, getEnemyDefeatLines };

