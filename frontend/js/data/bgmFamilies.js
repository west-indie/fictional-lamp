// frontend/js/data/bgmFamilies.js
export const BGM_BY_FAMILY = {
  // Old style (loop only) — still supported:
  Comfort: ["frontend/assets/audio/bgm/Comfort_01.ogg"],
  Snob: [ { url: "frontend/assets/audio/bgm/Straight_Loop.ogg", introUrl: "frontend/assets/audio/bgm/Straight_Intro.ogg" },
        "frontend/assets/audio/bgm/Snob_01.ogg"
        ],
  Internet: [ { url: "frontend/assets/audio/bgm/Straight_Loop.ogg", introUrl: "frontend/assets/audio/bgm/Straight_Intro.ogg" }
            ],
  Art: ["frontend/assets/audio/bgm/Art_01.ogg"],
  Cinephile: ["frontend/assets/audio/bgm/Art_01.ogg"],
  Disney: ["frontend/assets/audio/bgm/Disney_01.ogg"],
  Secret: ["frontend/assets/audio/bgm/Straight_Loop.ogg"]

  // New style example:
  // Snob: [
  //   { url: "/assets/audio/bgm/Snob_Loop.ogg", introUrl: "/assets/audio/bgm/Snob_Intro.ogg" }
  // ]
};

export const DEFAULT_BGM_FAMILY = "Comfort";

export function pickFamilyBgm(family) {
  const list = BGM_BY_FAMILY[family] || BGM_BY_FAMILY[DEFAULT_BGM_FAMILY];
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}
