# BattleText Token Reference

This file documents the token vocabulary used by battle-text authoring and runtime builders.
It is documentation only and does not affect gameplay/runtime behavior.

## Marker Tokens (UI/Help Labels)

These are used by marker inference/formatting in target/help labels.

- `DMG`
- `HEAL` (normalized from legacy `+HP`)
- `SHIELD`
- `FX`
- `BUFF`
- `DEBUFF`
- `+ATK`
- `+DEF`
- `+CRIT`
- `-ATK`
- `-DEF`
- `UTILITY` (ordering bucket; not typically authored directly)

Primary sources:

- `frontend/js/battleText/engines/format.js`
- `frontend/js/battleText/engines/inferMarkers.js`
- `frontend/js/battleText/engines/targets.js`

## Template Placeholders

These placeholders are used in authored line templates and replaced at runtime.

Common battle placeholders:

- `{actor}`
- `{move}`
- `{target}`
- `{enemy}`
- `{dmg}`
- `{heal}`
- `{teamHeal}`
- `{value}`
- `{status}`
- `{statusName}`

Duration/context placeholders:

- `{turnsPhrase}`
- `{buffTurnsPhrase}`
- `{debuffTurnsPhrase}`
- `{shieldTurnsPhrase}`
- `{drTurnsPhrase}`

Item dialogue placeholders:

- `{item}`
- `{healed}`
- `{damage}`

Runtime UI/help template placeholders (internal template rendering):

- `{actorName}`
- `{action}`
- `{moveName}`
- `{targetName}`
- `{targetSummary}`
- `{hints}`
- `{name}`
- `{n}`
- `{cd}`
- `{plural}`
- `{who}`
- `{lvl}`
- `{gain}`
- `{shield}`

Primary sources:

- `frontend/js/battleText/lines/*.js`
- `frontend/js/battleText/engines/*.js`

## Special Target Tags

Normalized by `specialTags` (trim + lowercase).

Standard base tags:

- `self`
- `ally`
- `enemy`
- `team`
- `party` (mapped to team behavior in helpers)

Tag normalization source:

- `frontend/js/systems/specialTags.js`

## Notes

- Keep authored line catalogs in `frontend/js/battleText/lines/`.
- Keep rendering/inference logic in `frontend/js/battleText/engines/`.
- If you add new placeholders or markers, update this file in the same change.
