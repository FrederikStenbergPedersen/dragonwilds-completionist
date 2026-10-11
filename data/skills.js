// Skill XP curve (CT_XPByLevel) and skill save-file ids.
const XP_CURVE = [0, 0, 33, 70, 111, 156, 206, 261, 322, 389, 463, 545, 636, 736, 847, 969, 1104, 1253, 1417, 1598, 1798, 2018, 2261, 2529, 2825, 3152, 3512, 3910, 4349, 4833, 5367, 5957, 6608, 7326, 8118, 8993, 9958, 11023, 12199, 13496, 14929, 16510, 18255, 20181, 22307, 24654, 27245, 30105, 33262, 36747, 40594, 44581, 48717, 52997, 57421, 61990, 66702, 71560, 76562, 81708, 86998, 92433, 98012, 103735, 109603, 115616, 121772, 128073, 134518, 141108, 147842, 154720, 161743, 168910, 176222, 183678, 191278, 199022, 206911, 214944, 223122, 231444, 239910, 248521, 257276, 266176, 275219, 284407, 293740, 303217, 312838, 322604, 332514, 342568, 395129, 447689, 543044, 666881, 819200, 1000000];
const SKILLS = [
  ["attack", "Attack", "4pefO9k1lUqfA6mvHNi1SA"], ["ranged", "Ranged", "heq7u88Q2UuLXFqLGTVwQw"], ["magic", "Magic", "0hreSMRVXUihq9qjDO2CFA"],
  ["mining", "Mining", "jqX0Gh6QI0GFFPCDFK_CJQ"], ["woodcutting", "Woodcutting", "4zYUGF5u_0KbMLkWJmmBbQ"], ["fishing", "Fishing", "vwY5IkQJJDwb2PKEfoc8MQ"],
  ["farming", "Farming", "PyUi-0LU_riFY46AnnFiWg"], ["cooking", "Cooking", "Tn7t6DQyX0-Q0cM5K7B90A"], ["artisan", "Artisan", "Wf3i7Ha-B06DH719j1vtBw"],
  ["construction", "Construction", "waK-8EyQFQ2xEjCGYmuTRQ"], ["runecrafting", "Runecrafting", "NOqC-z-2ckqi0El22qMFlw"], ["agility", "Agility", "pJggvotwOkuoc98igUn7xA"],
].map(([k, n, pid]) => ({ id: "s-" + k, n, pid }));
