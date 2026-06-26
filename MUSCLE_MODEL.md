# Flexin Muscle Activation Model — Methodology & Citations

**Version:** 1.0.0  
**Date:** 2026-06-26  
**File:** `client/src/data/muscleContribution.json`

---

## Overview

This document describes the methodology, source literature, and intended use of the muscle-group contribution percentages embedded in `muscleContribution.json`. These values power Flexin's "Muscle Activation Points" feature, which credits users with per-muscle effort estimates when they log a workout.

---

## Disclaimer Text (Show to Users)

> **These percentages are estimates based on published EMG research and may not reflect your individual biomechanics. Flexin's muscle activation scores are for motivational tracking only and are not medical or training advice.**

Suggested placement: below the muscle contribution chart on the exercise detail screen and in a one-time informational modal when the feature is first encountered.

---

## Methodology

### 1. Source Type: Surface EMG (sEMG)

All values are grounded in **surface electromyography (sEMG)** research. sEMG measures the electrical activity of muscles via skin-surface electrodes and is the gold-standard non-invasive method for characterising muscle activation during exercise. Values are typically normalised to a **percentage of maximal voluntary isometric contraction (%MVIC)** or similar normalisation procedure, allowing within-study comparison.

**Important limitation of sEMG:** Raw MVIC values are not directly comparable across muscles, across studies, or across subjects. A biceps brachii reading of 90% MVIC and a gluteus maximus reading of 90% MVIC do not represent equivalent effort levels — they reflect activation relative to each muscle's own maximum capacity. This means the contribution percentages in the JSON are **relative within-exercise weightings**, not absolute effort quantities.

### 2. Constructing the Contribution Percentages

For each exercise, we:

1. Identified which muscles are active as primary movers, synergists, and stabilisers from sEMG literature.
2. Used **relative MVIC amplitude ratios** within the same study where possible (e.g., if bench press pec = 27% MVIC and triceps = 15% MVIC in the same study, the pec:triceps ratio ≈ 1.8:1).
3. Mapped study muscles to Flexin's 11 tracked groups: `chest`, `back`, `shoulders`, `biceps`, `triceps`, `quads`, `glutes`, `hamstrings`, `calves`, `core_abs`, `forearms`.
4. Normalised so all credited groups sum to **~100** per exercise (muscles not meaningfully activated are omitted; e.g., calves receive 0% in a bench press).
5. Where direct sEMG data did not exist for a specific exercise, values were **estimated** by interpolation from anatomically equivalent exercises (noted as "estimated" in `notes` fields).

### 3. Muscle Group Definitions

| JSON Key | Muscles Included |
|---|---|
| `chest` | Pectoralis major (clavicular, sternal, costal heads) |
| `back` | Latissimus dorsi, trapezius (all parts), rhomboids, erector spinae, lumbar multifidus, teres major/minor, infraspinatus |
| `shoulders` | Deltoid (anterior, medial, posterior), rotator cuff (supraspinatus, infraspinatus, subscapularis, teres minor) |
| `biceps` | Biceps brachii (long and short head), brachialis |
| `triceps` | Triceps brachii (long, lateral, medial heads) |
| `quads` | Rectus femoris, vastus lateralis, vastus medialis, vastus intermedius |
| `glutes` | Gluteus maximus, gluteus medius, gluteus minimus |
| `hamstrings` | Biceps femoris (long + short head), semitendinosus, semimembranosus |
| `calves` | Gastrocnemius (medial + lateral), soleus |
| `core_abs` | Rectus abdominis, external obliques, internal obliques, transverse abdominis, hip flexors (iliopsoas, rectus femoris when acting as hip flexor) |
| `forearms` | Brachioradialis, wrist flexors (flexor carpi group), wrist extensors (extensor carpi group) |

---

## Key Source Citations

### Upper Body Push Exercises

**Bench Press / Incline Bench Press**
- Rodríguez-Ridao D, Antequera-Vique JA, Martín-Fuentes I, Muyor JM. *Effect of Five Bench Inclinations on the Electromyographic Activity of the Pectoralis Major, Anterior Deltoid, and Triceps Brachii during the Bench Press Exercise*. Int J Environ Res Public Health. 2020;17(19):7339. PMC7579505. https://pmc.ncbi.nlm.nih.gov/articles/PMC7579505/
  - At 0°: pec upper/mid/lower all ~27% MVIC; AD ~26% MVIC; TB ~15% MVIC at all angles.
  - At 30°: clavicular head increases to ~30% MVIC; AD increases to ~33% MVIC.
- Coratella G, et al. *Specific prime movers' excitation during free-weight bench press variations*. Eur J Sport Sci. 2019. https://air.unimi.it/bitstream/2434/670735/2/EJSS_Bench%20Press%20EMG_Coratella%202019_.pdf
  - Sternocostal head more excited in flat/decline; clavicular head more excited in incline.
- Lauver JD, Cayot TE, Scheuermann BW. *Influence of bench angle on upper extremity muscular activation during bench press exercise*. Eur J Sport Sci. 2016. PLOS ONE systematic review PMC5514590.

**Overhead Press / Dumbbell Shoulder Press**
- Coratella G, et al. *Front vs Back and Barbell vs Machine Overhead Press*. Eur J Sport Sci. 2022. PubMed 35936912. https://pubmed.ncbi.nlm.nih.gov/35936912/
  - Front-OHP: greater anterior deltoid and pec major activation than back-OHP.
- Journal of Human Kinetics. *Different Shoulder Exercises Affect the Activation of Deltoid Portions*. 2020. PMC7706677. https://pmc.ncbi.nlm.nih.gov/articles/PMC7706677/
  - Shoulder press AD: 33.3% MVIC; lateral raise MD: 30.3% MVIC; lateral raise PD: 24% MVIC.
- Int J Exercise Science. *Stability of Resistance Training Implement alters EMG Activity during Overhead Press*. 2018. PMC6033506. https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/
  - Dumbbell OHP: anterior deltoid 63.3±13.3% MVIC.

**Lateral Raise**
- Coratella G, et al. *An Electromyographic Analysis of Lateral Raise Variations and Frontal Raise during Different Shoulder Exercises*. Int J Environ Res Public Health. 2020. PMC7503819. https://pmc.ncbi.nlm.nih.gov/articles/PMC7503819/
  - LR-neutral produces greatest medial deltoid activation; frontal raise greatest anterior deltoid and pec major.
- Wills A. *Electromyographic Analysis of the Deltoid Muscle During Various Shoulder Exercises*. UW-Madison Masters Thesis. 2014. https://minds.wisconsin.edu/handle/1793/70129

### Upper Body Pull Exercises

**Pull-Up / Lat Pulldown**
- Youdas JW, et al. *Surface electromyographic activation patterns and elbow joint kinematics during the pull-up, chin-up, or perfect·pullup*. J Strength Cond Res. 2010. PubMed 21068680. https://pubmed.ncbi.nlm.nih.gov/21068680/
  - Pull-up: LD 117–130% MVIC, BB 78–96% MVIC, lower trapezius 45–56% MVIC, pec major 44–57% MVIC.
- Snarr RL, Esco MR. *A Comparison of Muscle Activation during the Pull-up and Three Pulldown Exercises*. JPFMTS. 2018. https://juniperpublishers.com/jpfmts/pdf/JPFMTS.MS.ID.555669.pdf
- Doma K, Deakin GB, Ness KF. Fatigue-induced changes in muscle activation of pull exercises. J Strength Cond Res. 2013 (Repko summary, repko.app).

**Bent-Over Row / Dumbbell Row**
- Lehman GJ, et al. *Variations in muscle activation levels during traditional latissimus dorsi weight training exercises*. Dynamic Medicine. 2004. PMC449729. https://pmc.ncbi.nlm.nih.gov/articles/PMC449729/
  - Seated row: highest middle trapezius/rhomboid and comparable LD activation.
- Barbell row ROM study: *Impact of different ranges of motion in the prone barbell row on muscle excitation*. PubMed 40513198. 2025. https://pubmed.ncbi.nlm.nih.gov/40513198/
- ACE. *What Is the Best Back Exercise?* ACE Certified. 2018. https://www.acefitness.org/continuing-education/certified/december-2018/7138/

**Face Pull**
- Face pull EMG data (snuggymom.com citing EMG sources): posterior deltoid 70–85% max activation; middle trapezius 60–75%; lower trapezius 50–65%; rhomboids 55–70%. https://snuggymom.com/face-pulls-for-back-or-shoulders/
- Escamilla RF, Yamashiro K, et al. *Electromyographic analysis of the rotator cuff and deltoid musculature during common shoulder exercises*. J Athletic Training. 2004. PubMed 15296366.

### Arm Isolation Exercises

**Biceps Curl**
- Marcolin G, et al. *Differences in electromyographic activity of biceps brachii and brachioradialis while performing three variants of curl*. PeerJ. 2018. https://pdfs.semanticscholar.org/605f/
- Sports (Basel). *Biceps Brachii and Brachioradialis Excitation in Biceps Curl Exercise with Different Forearm Positions*. 2023. PMC10054060. https://pmc.ncbi.nlm.nih.gov/articles/PMC10054060/
  - Supinated grip: highest biceps brachii excitation. Pronated: lowest BB, similar brachioradialis.
- AIP Publishing. *Comparison of EMG Activation of Biceps Brachii, Brachialis, and Brachioradialis During Curl Variants*. 2024. https://pubs.aip.org/aip/acp/article-pdf/doi/10.1063/5.0148594

**Hammer Curl**
- Sports (Basel). PMC10054060 (see above) — lowest BB excitation with pronated/neutral grip.
- Hammer curl vs bicep curl EMG summary: brachioradialis 76–84%, brachialis 68–75%, biceps brachii 42–50% in neutral grip. (Multiple sources aggregated.)

**Triceps Pushdown**
- Villalba M, et al. *Forearm Position Influences EMG Activity in Triceps Push-Down*. efsupit.ro. 2024. https://efsupit.ro/images/stories/octombrie2024/Art%20272.pdf
- Boeckh-Behrens WU, Buskies W. Data adapted by SuppVersity EMG Series — M. Triceps Brachii. 2000/2011. https://suppversity.blogspot.com/2011/08/suppversity-emg-series-m-triceps.html

**Triceps Extension (Overhead)**
- Maeo S, et al. *Triceps brachii hypertrophy is substantially greater after elbow extension training performed in the overhead versus neutral arm position*. PubMed 35819335. 2023. https://pubmed.ncbi.nlm.nih.gov/35819335/
- Kholinne E, et al. *The different role of each head of the triceps brachii muscle in elbow extension*. Acta Orthop Traumatol Turc. 2018. PMC6136322. https://pmc.ncbi.nlm.nih.gov/articles/PMC6136322/
  - Long head dominant at 0° shoulder elevation; medial head at 90°+; lateral head at 180°.

**Dips**
- ACE / University of Wisconsin EMG Analysis of the Triceps Brachii (Boehler 2011): dips comparable to triangle push-ups for triceps activation. https://www.krigolsonteaching.com/uploads/4/3/8/4/43848243/sampleemg-triceps.pdf
- Boeckh-Behrens & Buskies 2000, via SuppVersity: dips effective for both lateral and long heads.

### Lower Body Exercises

**Back Squat / Front Squat**
- Korak JA, et al. (2018) muscle activation comparisons. In: Martín-Fuentes I, Oliva-Lozano JM, Muyor JM. *Electromyographic activity in deadlift exercise and its variants*. PLoS ONE. 2020. PMC7046193. https://pmc.ncbi.nlm.nih.gov/articles/PMC7046193/
  - Parallel back squat: Gmax 80%, BF 78%, VL 97%, VM 96%, RF 102% (all %1RM).
  - Parallel front squat: Gmax 94%, BF 81%, VL 102%, VM 98%, RF 101%.
- Applied Bionics & Biomechanics. *Kinematic and Electromyographic Activity Changes during Back Squats*. 2017. PMC5435978. https://pmc.ncbi.nlm.nih.gov/articles/PMC5435978/
- Inara Technology. *Squat EMG Studies: Quadriceps and Glute Activation Compared*. 2026. https://inara.technology/blog/squat-emg-guide

**Leg Press**
- Lower Extremity Review. *Plantar Flexor Activation in Multi- and Single-Joint Resistance Exercises*. https://lermagazine.com/article/plantar-flexor-activation-in-multi-and-single-joint-resistance-exercises
  - Leg press gastrocnemius lateralis 49.2%, medialis 51.31%, soleus 50.76% MVIC (no significant difference from calf raise).

**Lunge / Bulgarian Split Squat**
- Mausehund L, et al. *Muscle Activation in Unilateral Barbell Exercises*. NSCR. 2018. https://www.klokeavskade.no/globalassets/publications/mausehund_2018_nscr_muscle-activiation-in-unilateral-barbell-exercises.pdf
- PLoS ONE. *Muscle Activity of Bulgarian Squat*. 2019. PMC6709890. https://pmc.ncbi.nlm.nih.gov/articles/PMC6709890/
  - RF, BF, gluteus medius, VM, VL measured; gluteus medius ICC 0.895 in Bulgarian squat.
- Towards evidence-based strength training: BMC Sports Sci Med Rehab. 2017. PMC5513080. https://pmc.ncbi.nlm.nih.gov/articles/PMC5513080/

### Posterior Chain Exercises

**Conventional Deadlift / Romanian Deadlift**
- Martín-Fuentes I, Oliva-Lozano JM, Muyor JM. *Electromyographic activity in deadlift exercise and its variants. A systematic review*. PLoS ONE. 2020. PMC7046193. https://pmc.ncbi.nlm.nih.gov/articles/PMC7046193/
  - Conventional DL: Andersen (2018) — Gmax ~95%, BF ~108%, ES ~86%; Korak (2018) — Gmax 72%, VL 104%; Lee (2018) — Gmax 51.52%, BF 57.45% peak RMS.
  - RDL: Lee (2018) — Gmax 46.88%, BF 56.66% peak RMS; McCurdy (2018) — stiff leg DL Gmax 51.1%, hamstrings 39.8% mean concentric.

**Hip Thrust**
- Contreras B, Vigotsky AD, Schoenfeld BJ, et al. *A Comparison of Gluteus Maximus, Biceps Femoris, and Vastus Lateralis EMG Amplitude in the Back Squat and Barbell Hip Thrust*. J Appl Biomech. 2015. https://andrewvigotsky.com/static/studies/Contreras_2015_JAB_squat_hip_thrust_sEMG.pdf
  - Hip thrust: upper Gmax mean 69.46% MVIC, lower Gmax 86.75% MVIC, BF 40.78% MVIC, VL 99.47% MVIC.
- Poin-T GO Research. *Hip Thrust vs Glute Bridge: EMG and Selection Guide*. 2026. https://research.poin-t-go.com/en/exercises/hip-thrust-vs-glute-bridge-difference
  - Bilateral BHT Gmax 119% MVC, gluteus medius 68% MVC, BF 58% MVC.
- Journal of Sports Science & Medicine. *Gluteus Maximus Activation during Common Strength and Conditioning Exercises*. 2019. PMC6544005. https://pmc.ncbi.nlm.nih.gov/articles/PMC6544005/
  - Mean BHT Gmax and BF varied between 55–105% and 40–85% MVIC respectively.

**Glute Bridge**
- Contreras B, Cronin J, Schoenfeld BJ. (2011, 2015) — glute bridge ~65% MVIC vs hip thrust ~78% MVIC at equivalent loads. As cited in Poin-T GO Research (2026).

**Hamstring Curl**
- Bourne MN, et al. (2017) biceps femoris ~55% mean concentric in stiff-leg DL-type movements. In PMC7046193.
- IJSPT. *Cross-sectional Study of EMG and EMG Rise During Fast and Slow Hamstring Exercises*. 2021. https://ijspt.scholasticahq.com/article/25364

**Calf Raise**
- Lower Extremity Review. *Plantar Flexor Activation in Multi- and Single-Joint Resistance Exercises*. https://lermagazine.com/article/plantar-flexor-activation-in-multi-and-single-joint-resistance-exercises
  - Standing calf raise: gastrocnemius lateralis 50.7%, medialis 52.19%, soleus 51.34% MVIC.

### Core Exercises

**Plank**
- efsupit.ro. *Electromyographic analysis of core muscle activity during variations of the plank exercise*. 2025. https://efsupit.ro/images/stories/january2025/Art%2020.pdf
  - RA 37.17%, EO 33.77%; RA+EO+IO collectively >87% of plank muscle activation.
- Sports. *Spinal Muscle Thickness and Activation during Abdominal Exercises*. 2023. PMC10458255. https://pmc.ncbi.nlm.nih.gov/articles/PMC10458255/
  - Plank RA > EO > IL activation hierarchy (all statistically significant p<0.01).

**Cable Crunch**
- Phys Ther Sport. *EMG activation of abdominal muscles in the crunch exercise performed with loads*. 2009. PubMed 19376473. https://pubmed.ncbi.nlm.nih.gov/19376473/
  - Crunch at high loads (80–100% 1RM): significantly greater RA, obliquus externus, RF activation.
- MedCrave. *Core muscle activity in exercise*. 2024. https://medcraveonline.com/IJFCM/core-muscle-activity-in-exercise.html
  - Static curl-up: RA 81.00±10.90% MVIC.

**Russian Twist**
- Estimated from oblique-dominant rotational exercise patterns and plank/crunch comparative EMG data. No high-quality peer-reviewed sEMG study specific to Russian twist was identified in the literature review; noted accordingly in the JSON notes field.

---

## Limitations and Caveats

1. **Cross-study variability:** EMG normalisation methods (MVIC, peak dynamic, mean dynamic) vary across studies, making exact cross-study comparisons imprecise. Where multiple studies reported values, we prioritised internal ratios from single studies and applied them to the contribution model.

2. **Population heterogeneity:** Most EMG studies used trained males, 20–35 years old, in laboratory settings. Activation patterns may differ for beginners, females, older adults, or those with injuries.

3. **Load dependency:** Muscle activation ratios can shift with load (%1RM). Heavy loads typically increase absolute MVIC values for all muscles but don't always change relative contributions. We modelled moderate-to-high load patterns (65–85% 1RM range).

4. **Individual biomechanics:** Limb lengths, insertion angles, and motor unit recruitment patterns vary significantly. A 50/20/25 chest/shoulder/triceps ratio for bench press is a sensible population average; any individual may deviate substantially.

5. **Multi-muscle group mapping:** Muscles that span groups (e.g., gastrocnemius crossing both knee and ankle; rectus femoris as both hip flexor and quad) are credited to their primary functional role in each exercise context.

6. **Exercises marked "estimated":** Russian twist, glute bridge (relative to hip thrust data), dumbbell row (relative to barbell row), and hanging leg raise (partial estimation from pull-up data) carry additional uncertainty. The `notes` field in the JSON flags these explicitly.

---

## Recommended Update Process

This model should be revisited when:
- New high-quality systematic sEMG reviews are published for specific exercises.
- User feedback or coach review identifies obvious outliers.
- New exercises are added to the Flexin library.

Target review cadence: **annually** or when 3+ new relevant studies emerge for a given exercise category.

---

## Attribution

Research compiled by Flexin Engineering, June 2026. Primary sources: peer-reviewed publications indexed in PubMed/PMC, NSCA/JSCR, ACE Research, and pre-print repositories. Full URLs provided above and in individual exercise `notes` fields.
