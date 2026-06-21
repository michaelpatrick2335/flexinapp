// ────────────────────────────────────────────────────────────────────────────
// Body-type avatar catalog. 10 male + 10 female silhouettes used both for
// the onboarding AvatarSelect picker AND the Home dashboard hero image.
//
// The key (`id`) is what gets stored on the user record (user.avatarBodyType).
// ────────────────────────────────────────────────────────────────────────────
import maleSlim from "@/assets/avatars/avatar_male_1_slim.png";
import maleLean from "@/assets/avatars/avatar_male_2_lean.png";
import maleAthletic from "@/assets/avatars/avatar_male_3_athletic.png";
import maleMuscular from "@/assets/avatars/avatar_male_4_muscular.png";
import maleBodybuilder from "@/assets/avatars/avatar_male_5_bodybuilder.png";
import maleAverageFit from "@/assets/avatars/avatar_male_6_averagefit.png";
import maleSoft from "@/assets/avatars/avatar_male_7_soft.png";
import maleOverweight from "@/assets/avatars/avatar_male_8_overweight.png";
import maleOutOfShape from "@/assets/avatars/avatar_male_9_outofshape.png";
import maleTransform from "@/assets/avatars/avatar_male_10_transform.png";

import femaleLean from "@/assets/avatars/avatar_female_1_lean.png";
import femaleAthletic from "@/assets/avatars/avatar_female_2_athletic.png";
import femaleToned from "@/assets/avatars/avatar_female_3_toned.png";
import femaleFit from "@/assets/avatars/avatar_female_4_fit.png";
import femaleMuscular from "@/assets/avatars/avatar_female_5_muscular.png";
import femaleAverage from "@/assets/avatars/avatar_female_6_average.png";
import femaleCurvy from "@/assets/avatars/avatar_female_7_curvy.png";
import femalePlusSize from "@/assets/avatars/avatar_female_8_plussize.png";
import femaleOverweight from "@/assets/avatars/avatar_female_9_overweight.png";
import femaleFuller from "@/assets/avatars/avatar_female_10_fuller.png";

export interface AvatarOption {
  id: string;          // stored on user record
  label: string;       // big label shown on the card
  sublabel: string;    // small line under label
  image: string;       // imported asset URL
}

export const MALE_AVATARS: AvatarOption[] = [
  { id: "male_1_slim",         label: "Slim",         sublabel: "Lean & Narrow",      image: maleSlim },
  { id: "male_2_lean",         label: "Lean",         sublabel: "Fit & Toned",        image: maleLean },
  { id: "male_3_athletic",     label: "Athletic",     sublabel: "Strong & Balanced",  image: maleAthletic },
  { id: "male_4_muscular",     label: "Muscular",     sublabel: "Built & Defined",    image: maleMuscular },
  { id: "male_5_bodybuilder",  label: "Bodybuilder",  sublabel: "Mass & Size",        image: maleBodybuilder },
  { id: "male_6_averagefit",   label: "Average Fit",  sublabel: "Healthy & Active",   image: maleAverageFit },
  { id: "male_7_soft",         label: "Soft",         sublabel: "Not Quite There",    image: maleSoft },
  { id: "male_8_overweight",   label: "Overweight",   sublabel: "Starting My Journey",image: maleOverweight },
  { id: "male_9_outofshape",   label: "Out of Shape", sublabel: "New Beginnings",     image: maleOutOfShape },
  { id: "male_10_transform",   label: "Transform",    sublabel: "Ready For Change",   image: maleTransform },
];

export const FEMALE_AVATARS: AvatarOption[] = [
  { id: "female_1_lean",       label: "Lean",         sublabel: "Slim & Light",        image: femaleLean },
  { id: "female_2_athletic",   label: "Athletic",     sublabel: "Strong & Defined",    image: femaleAthletic },
  { id: "female_3_toned",      label: "Toned",        sublabel: "Sleek & Sculpted",    image: femaleToned },
  { id: "female_4_fit",        label: "Fit",          sublabel: "Healthy & Strong",    image: femaleFit },
  { id: "female_5_muscular",   label: "Muscular",     sublabel: "Built & Powerful",    image: femaleMuscular },
  { id: "female_6_average",    label: "Average",      sublabel: "Everyday Body",       image: femaleAverage },
  { id: "female_7_curvy",      label: "Curvy",        sublabel: "Hourglass Frame",     image: femaleCurvy },
  { id: "female_8_plussize",   label: "Plus Size",    sublabel: "Soft & Strong",       image: femalePlusSize },
  { id: "female_9_overweight", label: "Overweight",   sublabel: "Starting My Journey", image: femaleOverweight },
  { id: "female_10_fuller",    label: "Fuller",       sublabel: "New Beginnings",      image: femaleFuller },
];

/**
 * Resolve a saved avatarBodyType id back to its image URL.
 * Falls back to a sensible default for the user's sex if missing.
 */
export function avatarImageFor(
  avatarBodyType: string | null | undefined,
  sex: string | null | undefined
): string {
  const all = [...MALE_AVATARS, ...FEMALE_AVATARS];
  const hit = all.find((a) => a.id === avatarBodyType);
  if (hit) return hit.image;
  // fallback: athletic
  if ((sex || "").toLowerCase() === "female") return femaleAthletic;
  return maleAthletic;
}

export function avatarsForSex(sex: string | null | undefined): AvatarOption[] {
  return (sex || "").toLowerCase() === "female" ? FEMALE_AVATARS : MALE_AVATARS;
}
