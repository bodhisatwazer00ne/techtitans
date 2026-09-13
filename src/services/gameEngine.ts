import { 
  User, Quest, Badge, GameState, AttributeScores,
  PowerScalingBreakdown, AttributeComparison, StatClashRound, StatBattleSimulation
} from '../types';
import { 
  calculateXpForLevel,
  getTrainerTitleForLevel,
  getNextTrainerRankMilestone,
  INITIAL_BADGES,
} from '../data/initialData';
import { computeEffectiveAttributes, deriveMaxVitals } from './storage';
import { determineAvatarFromStatsAndLevel } from './avatarSystem';

export {
  calculateXpForLevel,
  getTrainerTitleForLevel,
  getNextTrainerRankMilestone,
  determineAvatarFromStatsAndLevel,
};

export interface LevelUpEvent {
  oldLevel: number;
  newLevel: number;
  oldTitle: string;
  newTitle: string;
  isNewTitle: boolean;
  avatarId?: string;
  statPointsGained: number;
  attributeIncreases: {
    str: number;
    int: number;
    end: number;
    res: number;
    dis: number;
    wil: number;
    cre: number;
  };
}

export function applyXpGain(user: User, xpGain: number): { updatedUser: User; levelUpEvent: LevelUpEvent | null } {
  return processXpGain(user, xpGain);
}

export function checkAndUnlockBadges(state: GameState): { updatedBadges: Badge[]; newlyUnlocked: Badge[] } {
  const previousUnlockedIds = new Set(state.badges.filter(b => b.unlockedAt).map(b => b.id));
  const newlyUnlocked = evaluateBadges(state);
  return {
    updatedBadges: state.badges,
    newlyUnlocked,
  };
}

export function resolveQuestCompletion(
  user: User,
  quests: Quest[],
  questId: string
): { updatedUser: User; updatedQuest: Quest; levelUpEvent: LevelUpEvent | null } {
  const quest = quests.find(q => q.id === questId);
  if (!quest) {
    throw new Error(`Quest ${questId} not found`);
  }

  // Update streak and calculate daily streak attribute bonuses
  const { updatedStreak, newDate, streakBonusAwarded } = updateDailyStreak(user);

  // Apply Attribute Rewards from Quest
  let updatedAttrs = { ...user.attributes };
  if (quest.attributeRewards) {
    Object.entries(quest.attributeRewards).forEach(([stat, val]) => {
      const key = stat as keyof typeof updatedAttrs;
      if (typeof updatedAttrs[key] === 'number') {
        updatedAttrs[key] += val;
      }
    });
  }

  // Daily task completion boosts endurance, resilience, discipline, willpower
  if (quest.isDaily) {
    updatedAttrs.end += 1;
    updatedAttrs.res += 1;
    updatedAttrs.dis += 1;
    updatedAttrs.wil += 1;
  }

  // When streak increments on consecutive days, award extra endurance, resilience, discipline, willpower
  if (streakBonusAwarded) {
    updatedAttrs.end += 1;
    updatedAttrs.res += 1;
    updatedAttrs.dis += 1;
    updatedAttrs.wil += 1;
  }

  // HP derived from endurance, willpower, and resilience (cultivated by workout & wellness)
  const { maxHp, maxStamina } = deriveMaxVitals(
    updatedAttrs.end,
    updatedAttrs.dis,
    user.level,
    updatedAttrs.wil,
    updatedAttrs.res
  );

  let updatedUser: User = {
    ...user,
    streak: updatedStreak,
    lastActiveDate: newDate,
    attributes: updatedAttrs,
    maxHp,
    maxStamina,
    hp: Math.min(user.hp + (quest.isDaily ? 5 : 0), maxHp),
    stamina: Math.min(user.stamina + 5, maxStamina),
  };

  // Process XP and Level Up
  const { updatedUser: userAfterXp, levelUpEvent } = processXpGain(updatedUser, quest.xpReward);

  const updatedQuest: Quest = {
    ...quest,
    status: 'COMPLETED',
    completedAt: new Date().toISOString(),
  };

  return {
    updatedUser: userAfterXp,
    updatedQuest,
    levelUpEvent,
  };
}

export function processXpGain(user: User, xpGain: number): { updatedUser: User; levelUpEvent: LevelUpEvent | null } {
  let currentXp = user.xp + xpGain;
  let currentLevel = user.level;
  let maxXp = user.maxXp;
  let statPointsGained = 0;
  const initialLevel = user.level;

  const totalAttrIncreases = { str: 0, int: 0, end: 0, res: 0, dis: 0, wil: 0, cre: 0 };

  while (currentXp >= maxXp) {
    currentXp -= maxXp;
    currentLevel += 1;
    maxXp = calculateXpForLevel(currentLevel);
    statPointsGained += 2;

    // Automatic minor attribute bump based on class or balanced
    totalAttrIncreases.str += 1;
    totalAttrIncreases.int += 1;
    totalAttrIncreases.end += 1;
    totalAttrIncreases.res += 1;
    totalAttrIncreases.dis += 1;
    totalAttrIncreases.wil += 1;
    totalAttrIncreases.cre += 1;
  }

  const updatedAttrs = {
    str: (user.attributes.str || 0) + totalAttrIncreases.str,
    int: (user.attributes.int || 0) + totalAttrIncreases.int,
    end: (user.attributes.end || 0) + totalAttrIncreases.end,
    res: (user.attributes.res || 0) + totalAttrIncreases.res,
    dis: (user.attributes.dis || 0) + totalAttrIncreases.dis,
    wil: (user.attributes.wil || 0) + totalAttrIncreases.wil,
    cre: (user.attributes.cre || 0) + totalAttrIncreases.cre,
  };

  const { maxHp, maxStamina } = deriveMaxVitals(
    updatedAttrs.end,
    updatedAttrs.dis,
    currentLevel,
    updatedAttrs.wil,
    updatedAttrs.res
  );

  const oldTitle = user.title || getTrainerTitleForLevel(initialLevel);
  const newTitle = getTrainerTitleForLevel(currentLevel);
  const isNewTitle = newTitle !== oldTitle;
  const avatarProfile = determineAvatarFromStatsAndLevel(updatedAttrs, currentLevel);
  const newAvatarId = avatarProfile.avatarId;

  const updatedUser: User = {
    ...user,
    level: currentLevel,
    title: newTitle,
    avatarId: newAvatarId,
    specialization: avatarProfile.archetype,
    xp: currentXp,
    maxXp,
    // On level-up, fully restore vitals!
    hp: currentLevel > initialLevel ? maxHp : Math.min(user.hp, maxHp),
    maxHp,
    stamina: currentLevel > initialLevel ? maxStamina : Math.min(user.stamina, maxStamina),
    maxStamina,
    statPoints: user.statPoints + statPointsGained,
    attributes: updatedAttrs,
    updatedAt: new Date().toISOString(),
  };

  const levelUpEvent: LevelUpEvent | null = currentLevel > initialLevel ? {
    oldLevel: initialLevel,
    newLevel: currentLevel,
    oldTitle,
    newTitle,
    isNewTitle,
    avatarId: newAvatarId,
    statPointsGained,
    attributeIncreases: totalAttrIncreases,
  } : null;

  return { updatedUser, levelUpEvent };
}

export function updateDailyStreak(user: User): { updatedStreak: number; newDate: string; streakBonusAwarded: boolean } {
  const today = new Date().toISOString().split('T')[0];
  if (user.lastActiveDate === today) {
    return { updatedStreak: user.streak, newDate: today, streakBonusAwarded: false };
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  let newStreak = user.streak;
  let streakBonusAwarded = false;

  if (user.lastActiveDate === yesterday) {
    newStreak += 1;
    streakBonusAwarded = true;
  } else {
    newStreak = 1;
  }

  return { updatedStreak: newStreak, newDate: today, streakBonusAwarded };
}

export function evaluateBadges(state: GameState, lastCompletedQuestId?: string): Badge[] {
  const newlyUnlocked: Badge[] = [];
  const completedQuests = state.quests.filter((q) => q.status === 'COMPLETED');
  const completedCount = completedQuests.length;
  const effective = computeEffectiveAttributes(state.user, state.inventory, state.items);

  // Category counts
  const workoutCount = completedQuests.filter((q) => q.category === 'WORKOUT').length;
  const studyCount = completedQuests.filter((q) => q.category === 'STUDY').length;
  const disciplineCount = completedQuests.filter((q) => q.category === 'DISCIPLINE').length;
  const wellnessCount = completedQuests.filter((q) => q.category === 'WELLNESS').length;
  const creativityCount = completedQuests.filter((q) => q.category === 'CREATIVITY').length;
  const workCount = completedQuests.filter((q) => q.category === 'WORK').length;

  // Difficulty counts
  const hardCount = completedQuests.filter((q) => q.difficulty === 'HARD').length;
  const epicCount = completedQuests.filter((q) => q.difficulty === 'EPIC').length;

  // Ensure current user's badges list has all initial badges known
  const existingBadgeIds = new Set(state.badges.map((b) => b.id));
  const fullBadgesList = [
    ...state.badges,
    ...INITIAL_BADGES.filter((b) => !existingBadgeIds.has(b.id)),
  ];

  const updatedBadges = fullBadgesList.map((badge) => {
    if (badge.unlockedAt) return badge; // already unlocked

    let shouldUnlock = false;

    // Progression
    if (badge.id === 'badge-first-quest' && completedCount >= 1) shouldUnlock = true;
    else if (badge.id === 'badge-quests-10' && completedCount >= 10) shouldUnlock = true;
    else if (badge.id === 'badge-quests-25' && completedCount >= 25) shouldUnlock = true;
    else if (badge.id === 'badge-quests-50' && completedCount >= 50) shouldUnlock = true;
    else if (badge.id === 'badge-level-10' && state.user.level >= 10) shouldUnlock = true;
    else if (badge.id === 'badge-level-20' && state.user.level >= 20) shouldUnlock = true;

    // Consistency & Streaks
    else if (badge.id === 'badge-streak-3' && state.user.streak >= 3) shouldUnlock = true;
    else if (badge.id === 'badge-streak-7' && state.user.streak >= 7) shouldUnlock = true;
    else if (badge.id === 'badge-streak-14' && state.user.streak >= 14) shouldUnlock = true;
    else if (badge.id === 'badge-streak-30' && state.user.streak >= 30) shouldUnlock = true;

    // Category: Workout
    else if (badge.id === 'badge-cat-workout-1' && workoutCount >= 1) shouldUnlock = true;
    else if (badge.id === 'badge-cat-workout-5' && workoutCount >= 5) shouldUnlock = true;
    else if (badge.id === 'badge-cat-workout-15' && workoutCount >= 15) shouldUnlock = true;

    // Category: Study
    else if (badge.id === 'badge-cat-study-1' && studyCount >= 1) shouldUnlock = true;
    else if (badge.id === 'badge-cat-study-5' && studyCount >= 5) shouldUnlock = true;
    else if (badge.id === 'badge-cat-study-15' && studyCount >= 15) shouldUnlock = true;

    // Category: Discipline
    else if (badge.id === 'badge-cat-discipline-1' && disciplineCount >= 1) shouldUnlock = true;
    else if (badge.id === 'badge-cat-discipline-5' && disciplineCount >= 5) shouldUnlock = true;
    else if (badge.id === 'badge-cat-discipline-15' && disciplineCount >= 15) shouldUnlock = true;

    // Category: Wellness
    else if (badge.id === 'badge-cat-wellness-1' && wellnessCount >= 1) shouldUnlock = true;
    else if (badge.id === 'badge-cat-wellness-5' && wellnessCount >= 5) shouldUnlock = true;
    else if (badge.id === 'badge-cat-wellness-15' && wellnessCount >= 15) shouldUnlock = true;

    // Category: Creativity
    else if (badge.id === 'badge-cat-creativity-1' && creativityCount >= 1) shouldUnlock = true;
    else if (badge.id === 'badge-cat-creativity-5' && creativityCount >= 5) shouldUnlock = true;
    else if (badge.id === 'badge-cat-creativity-15' && creativityCount >= 15) shouldUnlock = true;

    // Category: Work
    else if (badge.id === 'badge-cat-work-1' && workCount >= 1) shouldUnlock = true;
    else if (badge.id === 'badge-cat-work-5' && workCount >= 5) shouldUnlock = true;
    else if (badge.id === 'badge-cat-work-15' && workCount >= 15) shouldUnlock = true;

    // Difficulty
    else if (badge.id === 'badge-diff-hard-1' && hardCount >= 1) shouldUnlock = true;
    else if (badge.id === 'badge-diff-hard-5' && hardCount >= 5) shouldUnlock = true;
    else if (badge.id === 'badge-diff-epic-1' && epicCount >= 1) shouldUnlock = true;
    else if (badge.id === 'badge-diff-epic-3' && epicCount >= 3) shouldUnlock = true;

    // Combat & Arena
    else if (badge.id === 'badge-first-battle' && state.defeatedRivalsCount >= 1) shouldUnlock = true;
    else if (badge.id === 'badge-combat-5' && state.defeatedRivalsCount >= 5) shouldUnlock = true;
    else if (badge.id === 'badge-combat-10' && state.defeatedRivalsCount >= 10) shouldUnlock = true;
    else if (badge.id === 'badge-live-duel-1' && state.defeatedRivalsCount >= 1) shouldUnlock = true;
    else if (badge.id === 'badge-arena-streak-3' && (state.user.arenaStreak || 0) >= 3) shouldUnlock = true;
    else if (badge.id === 'badge-arena-streak-5' && (state.user.arenaStreak || 0) >= 5) shouldUnlock = true;

    // Attribute Milestones
    else if (badge.id === 'badge-strength-20' && effective.total.str >= 20) shouldUnlock = true;
    else if (badge.id === 'badge-intellect-20' && effective.total.int >= 20) shouldUnlock = true;
    else if (badge.id === 'badge-endurance-20' && effective.total.end >= 20) shouldUnlock = true;
    else if (badge.id === 'badge-resilience-20' && effective.total.res >= 20) shouldUnlock = true;
    else if (badge.id === 'badge-discipline-20' && effective.total.dis >= 20) shouldUnlock = true;
    else if (badge.id === 'badge-willpower-20' && effective.total.wil >= 20) shouldUnlock = true;

    if (shouldUnlock) {
      const unlocked = { ...badge, unlockedAt: new Date().toISOString() };
      newlyUnlocked.push(unlocked);
      return unlocked;
    }

    return badge;
  });

  state.badges = updatedBadges;
  return newlyUnlocked;
}

export function calculateBattleDamage(
  attackerStr: number,
  defenderRes: number,
  isSpecial: boolean,
  isDefending: boolean,
  critChance: number = 0.1,
  attackerLevel: number = 1,
  attackerDis: number = 0,
  attackerWil: number = 0,
  attackerWellnessBonus: number = 0
): { damage: number; isCrit: boolean } {
  const lvl = Math.max(1, attackerLevel);

  // Attack power incorporates Strength, Discipline, Willpower, and Wellness (overall physical-mental vitality)
  // Base attack power formula:
  const attackRating = attackerStr * 1.0 + attackerDis * 0.4 + attackerWil * 0.35 + attackerWellnessBonus * 0.25;

  const baseDamage = isSpecial
    ? (14 + lvl * 4.2 + attackRating * 1.7) - (defenderRes * 0.3)
    : (8 + lvl * 2.8 + attackRating * 1.35) - (defenderRes * 0.35);

  const variance = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
  let finalDamage = Math.max(isSpecial ? 12 : 7, Math.floor(baseDamage + variance));

  const isCrit = Math.random() < critChance;
  if (isCrit) {
    finalDamage = Math.floor(finalDamage * 1.55);
  }

  if (isDefending) {
    finalDamage = Math.max(3, Math.floor(finalDamage * 0.5));
  }

  return { damage: finalDamage, isCrit };
}

/**
 * Normalizes and guarantees non-zero valid attributes for power scaling,
 * deriving balanced creativity if missing.
 */
export function getNormalizedAttributes(
  attrs?: Partial<AttributeScores>,
  level: number = 1
): { str: number; int: number; end: number; res: number; dis: number; wil: number; cre: number } {
  const lvl = Math.max(1, level);
  const str = Math.max(1, Math.round(attrs?.str ?? (6 + lvl * 2)));
  const int = Math.max(1, Math.round(attrs?.int ?? (6 + lvl * 2)));
  const end = Math.max(1, Math.round(attrs?.end ?? (6 + lvl * 2)));
  const res = Math.max(1, Math.round(attrs?.res ?? (6 + lvl * 2)));
  const dis = Math.max(1, Math.round(attrs?.dis ?? (6 + lvl * 2)));
  const wil = Math.max(1, Math.round(attrs?.wil ?? (6 + lvl * 2)));
  const cre = Math.max(
    1,
    Math.round(
      attrs?.cre !== undefined && attrs.cre > 0
        ? attrs.cre
        : Math.max(4, Math.round(int * 0.5 + wil * 0.4 + lvl * 0.8))
    )
  );

  return { str, int, end, res, dis, wil, cre };
}

/**
 * Power Scaling Engine:
 * Evaluates the combat power of a player using the 6 core attributes:
 * - Strength: Kinetic force & physical impact
 * - Endurance: Longevity, vital pools & stamina reserve
 * - Resilience: Armor mitigation, posture & damage absorption
 * - Willpower: Clutch resolve, determination & critical threshold
 * - Intelligence: Tactical depth, precision strikes & weakness exploitation
 * - Creativity: Unorthodox feints, unpredictable technique & counterplay
 */
export function calculatePowerScaling(
  level: number,
  attrs?: Partial<AttributeScores>
): PowerScalingBreakdown {
  const norm = getNormalizedAttributes(attrs, level);
  const lvl = Math.max(1, level);

  // 1. Physical Index (Might & Fortification)
  const physicalIndex = Math.round(norm.str * 2.3 + norm.res * 1.7);

  // 2. Tactical Index (Tactics & Battle IQ)
  const tacticalIndex = Math.round(norm.int * 2.2 + norm.cre * 1.8);

  // 3. Survival Index (Vitality & Perseverance)
  const survivalIndex = Math.round(norm.end * 2.1 + norm.wil * 1.8);

  // 4. Innovation Index (Unpredictability & Cadence)
  const innovationIndex = Math.round(norm.cre * 1.7 + norm.dis * 1.3);

  // 5. Cross-Attribute Synergy Factor
  const synergyFactor = Math.round(
    ((norm.str * norm.end) + (norm.int * norm.cre) + (norm.wil * norm.res)) / 210
  );

  // 6. Level Factor
  const levelScaling = lvl * 22;

  const totalPower = Math.round(
    physicalIndex + tacticalIndex + survivalIndex + Math.round(innovationIndex * 0.4) + synergyFactor + levelScaling
  );

  let tier: PowerScalingBreakdown['tier'] = 'NOVICE';
  if (totalPower >= 1400) tier = 'MYTHIC';
  else if (totalPower >= 900) tier = 'APEX';
  else if (totalPower >= 600) tier = 'CHAMPION';
  else if (totalPower >= 350) tier = 'VETERAN';
  else if (totalPower >= 180) tier = 'ADEPT';
  else tier = 'NOVICE';

  return {
    totalPower,
    physicalIndex,
    tacticalIndex,
    survivalIndex,
    innovationIndex,
    attributeRatings: {
      str: norm.str,
      end: norm.end,
      res: norm.res,
      wil: norm.wil,
      int: norm.int,
      cre: norm.cre,
    },
    tier,
  };
}

/**
 * Direct comparison of the 6 core attributes between two fighters.
 */
export function compareAttributes(
  playerAttrs?: Partial<AttributeScores>,
  rivalAttrs?: Partial<AttributeScores>,
  playerLevel: number = 1,
  rivalLevel: number = 1
): AttributeComparison[] {
  const p = getNormalizedAttributes(playerAttrs, playerLevel);
  const r = getNormalizedAttributes(rivalAttrs, rivalLevel);

  const configs: {
    key: 'str' | 'end' | 'res' | 'wil' | 'int' | 'cre';
    label: string;
    sublabel: string;
  }[] = [
    { key: 'str', label: 'STRENGTH', sublabel: 'Kinetic strike impact' },
    { key: 'end', label: 'ENDURANCE', sublabel: 'Stamina & vital depth' },
    { key: 'res', label: 'RESILIENCE', sublabel: 'Damage mitigation & grit' },
    { key: 'wil', label: 'WILLPOWER', sublabel: 'Clutch resolve & focus' },
    { key: 'int', label: 'INTELLIGENCE', sublabel: 'Tactical analysis & precision' },
    { key: 'cre', label: 'CREATIVITY', sublabel: 'Unorthodox feints & trick gambits' },
  ];

  return configs.map(({ key, label, sublabel }) => {
    const playerVal = p[key];
    const rivalVal = r[key];
    const diff = playerVal - rivalVal;
    let winner: 'PLAYER' | 'RIVAL' | 'TIE' = 'TIE';
    let narrative = '';

    if (diff > 0) {
      winner = 'PLAYER';
      narrative = `+${diff} Advantage: Your superior ${label} controls ${sublabel.toLowerCase()}.`;
    } else if (diff < 0) {
      winner = 'RIVAL';
      narrative = `-${Math.abs(diff)} Deficit: Opponent's higher ${label} dominates ${sublabel.toLowerCase()}.`;
    } else {
      winner = 'TIE';
      narrative = `Deadlock: Both fighters possess identical ${label} ratings (${playerVal} pts).`;
    }

    return {
      key,
      label,
      playerVal,
      rivalVal,
      winner,
      diff,
      narrative,
    };
  });
}

/**
 * Simulates a comprehensive stat-based clash between the challenger and the opponent.
 * Resolves without requiring turn-based input from both sides, producing a rich
 * multi-phase simulation with cinematic round results, HP depletion, and winner calculation.
 */
export function simulateStatClash(
  player: {
    username: string;
    level: number;
    attributes: AttributeScores;
    hp: number;
    maxHp: number;
    arenaStreak?: number;
  },
  rival: {
    id: string;
    username: string;
    level: number;
    attributes: AttributeScores;
    hp: number;
    maxHp: number;
    winRewardXp?: number;
    title?: string;
  }
): StatBattleSimulation {
  const playerBreakdown = calculatePowerScaling(player.level, player.attributes);
  const rivalBreakdown = calculatePowerScaling(rival.level, rival.attributes);
  const comparisons = compareAttributes(player.attributes, rival.attributes, player.level, rival.level);

  const pNorm = playerBreakdown.attributeRatings;
  const rNorm = rivalBreakdown.attributeRatings;

  let playerSimHp = Math.max(60, player.maxHp || 100);
  let rivalSimHp = Math.max(60, rival.maxHp || 100);
  const initialPlayerHp = playerSimHp;
  const initialRivalHp = rivalSimHp;

  const rounds: StatClashRound[] = [];

  // ROUND 1: Vanguard Clash (Strength vs Resilience & Endurance)
  const r1PlayerScore = Math.round(pNorm.str * 2.5 + pNorm.res * 1.2);
  const r1RivalScore = Math.round(rNorm.str * 2.5 + rNorm.res * 1.2);
  const r1Diff = r1PlayerScore - r1RivalScore;
  const r1PlayerWin = r1Diff >= 0;
  const r1Crit = Math.abs(r1Diff) > 12;

  const r1DamageToRival = r1PlayerWin
    ? Math.max(18, Math.round(24 + (r1Diff * 0.8) + (player.level * 2)))
    : Math.max(8, Math.round(14 + (pNorm.str * 0.4)));
  const r1DamageToPlayer = !r1PlayerWin
    ? Math.max(18, Math.round(24 + (Math.abs(r1Diff) * 0.8) + (rival.level * 2)))
    : Math.max(8, Math.round(14 + (rNorm.str * 0.4)));

  rivalSimHp = Math.max(0, rivalSimHp - r1DamageToRival);
  playerSimHp = Math.max(0, playerSimHp - r1DamageToPlayer);

  rounds.push({
    roundNumber: 1,
    title: 'THE VANGUARD CLASH',
    phase: 'POWER_CLASH',
    playerStatLabel: `STR ${pNorm.str} / RES ${pNorm.res}`,
    rivalStatLabel: `STR ${rNorm.str} / RES ${rNorm.res}`,
    playerScore: r1PlayerScore,
    rivalScore: r1RivalScore,
    damageToRival: r1DamageToRival,
    damageToPlayer: r1DamageToPlayer,
    playerHpAfter: playerSimHp,
    rivalHpAfter: rivalSimHp,
    isCrit: r1Crit,
    winner: r1Diff > 0 ? 'PLAYER' : r1Diff < 0 ? 'RIVAL' : 'DRAW',
    narrative: r1Diff > 0
      ? `${player.username}'s brute Strength overpowered the frontline, driving ${r1DamageToRival} damage straight through ${rival.username}'s guard!`
      : r1Diff < 0
      ? `${rival.username} absorbed the opening assault and countered with kinetic force, inflicting ${r1DamageToPlayer} damage!`
      : `Blades and fists collided with equal ferocity! Both fighters traded heavy opening blows.`,
  });

  // ROUND 2: Tactical Mind-Game (Intelligence & Willpower)
  const r2PlayerScore = Math.round(pNorm.int * 2.4 + pNorm.wil * 1.4);
  const r2RivalScore = Math.round(rNorm.int * 2.4 + rNorm.wil * 1.4);
  const r2Diff = r2PlayerScore - r2RivalScore;
  const r2PlayerWin = r2Diff >= 0;
  const r2Crit = Math.abs(r2Diff) > 10;

  const r2DamageToRival = r2PlayerWin
    ? Math.max(20, Math.round(26 + (r2Diff * 0.9) + (player.level * 2)))
    : Math.max(10, Math.round(12 + (pNorm.int * 0.5)));
  const r2DamageToPlayer = !r2PlayerWin
    ? Math.max(20, Math.round(26 + (Math.abs(r2Diff) * 0.9) + (rival.level * 2)))
    : Math.max(10, Math.round(12 + (rNorm.int * 0.5)));

  rivalSimHp = Math.max(0, rivalSimHp - r2DamageToRival);
  playerSimHp = Math.max(0, playerSimHp - r2DamageToPlayer);

  rounds.push({
    roundNumber: 2,
    title: 'TACTICAL MANEUVER',
    phase: 'TACTICAL_MANEUVER',
    playerStatLabel: `INT ${pNorm.int} / WIL ${pNorm.wil}`,
    rivalStatLabel: `INT ${rNorm.int} / WIL ${rNorm.wil}`,
    playerScore: r2PlayerScore,
    rivalScore: r2RivalScore,
    damageToRival: r2DamageToRival,
    damageToPlayer: r2DamageToPlayer,
    playerHpAfter: playerSimHp,
    rivalHpAfter: rivalSimHp,
    isCrit: r2Crit,
    winner: r2Diff > 0 ? 'PLAYER' : r2Diff < 0 ? 'RIVAL' : 'DRAW',
    narrative: r2Diff > 0
      ? `Exploiting tactical analysis (INT ${pNorm.int}), ${player.username} predicted ${rival.username}'s footwork, landing a surgical strike!`
      : r2Diff < 0
      ? `${rival.username}'s strategic acumen outmaneuvered the flank, dealing precision damage!`
      : `High-speed tactical feints cancelled each other out as both fighters guarded vital points.`,
  });

  // ROUND 3: Endurance & Resilience Siege (Endurance & Resilience)
  const r3PlayerScore = Math.round(pNorm.end * 2.3 + pNorm.res * 1.8);
  const r3RivalScore = Math.round(rNorm.end * 2.3 + rNorm.res * 1.8);
  const r3Diff = r3PlayerScore - r3RivalScore;
  const r3PlayerWin = r3Diff >= 0;
  const r3Crit = Math.abs(r3Diff) > 10;

  const r3DamageToRival = r3PlayerWin
    ? Math.max(22, Math.round(24 + (r3Diff * 0.85)))
    : Math.max(10, Math.round(14 + (pNorm.end * 0.4)));
  const r3DamageToPlayer = !r3PlayerWin
    ? Math.max(22, Math.round(24 + (Math.abs(r3Diff) * 0.85)))
    : Math.max(10, Math.round(14 + (rNorm.end * 0.4)));

  rivalSimHp = Math.max(0, rivalSimHp - r3DamageToRival);
  playerSimHp = Math.max(0, playerSimHp - r3DamageToPlayer);

  rounds.push({
    roundNumber: 3,
    title: 'RESILIENCE SIEGE',
    phase: 'RESILIENCE_SIEGE',
    playerStatLabel: `END ${pNorm.end} / RES ${pNorm.res}`,
    rivalStatLabel: `END ${rNorm.end} / RES ${rNorm.res}`,
    playerScore: r3PlayerScore,
    rivalScore: r3RivalScore,
    damageToRival: r3DamageToRival,
    damageToPlayer: r3DamageToPlayer,
    playerHpAfter: playerSimHp,
    rivalHpAfter: rivalSimHp,
    isCrit: r3Crit,
    winner: r3Diff > 0 ? 'PLAYER' : r3Diff < 0 ? 'RIVAL' : 'DRAW',
    narrative: r3Diff > 0
      ? `Fortified by iron habit Endurance, ${player.username} absorbed the heavy barrage and crushed forward through the shockwave!`
      : r3Diff < 0
      ? `${rival.username}'s unyielding Resilience absorbed incoming blows and wore down stamina!`
      : `An agonizing battle of attrition! Both combatants stood their ground with iron fortitude.`,
  });

  // ROUND 4: Creative Gambit (Creativity & Willpower)
  const r4PlayerScore = Math.round(pNorm.cre * 2.7 + pNorm.wil * 1.5);
  const r4RivalScore = Math.round(rNorm.cre * 2.7 + rNorm.wil * 1.5);
  const r4Diff = r4PlayerScore - r4RivalScore;
  const r4PlayerWin = r4Diff >= 0;
  const r4Crit = Math.abs(r4Diff) > 8;

  const r4DamageToRival = r4PlayerWin
    ? Math.max(25, Math.round(30 + (r4Diff * 1.1)))
    : Math.max(12, Math.round(15 + (pNorm.cre * 0.5)));
  const r4DamageToPlayer = !r4PlayerWin
    ? Math.max(25, Math.round(30 + (Math.abs(r4Diff) * 1.1)))
    : Math.max(12, Math.round(15 + (rNorm.cre * 0.5)));

  rivalSimHp = Math.max(0, rivalSimHp - r4DamageToRival);
  playerSimHp = Math.max(0, playerSimHp - r4DamageToPlayer);

  rounds.push({
    roundNumber: 4,
    title: 'CREATIVE GAMBIT',
    phase: 'CREATIVITY_GAMBIT',
    playerStatLabel: `CRE ${pNorm.cre} / WIL ${pNorm.wil}`,
    rivalStatLabel: `CRE ${rNorm.cre} / WIL ${rNorm.wil}`,
    playerScore: r4PlayerScore,
    rivalScore: r4RivalScore,
    damageToRival: r4DamageToRival,
    damageToPlayer: r4DamageToPlayer,
    playerHpAfter: playerSimHp,
    rivalHpAfter: rivalSimHp,
    isCrit: r4Crit,
    winner: r4Diff > 0 ? 'PLAYER' : r4Diff < 0 ? 'RIVAL' : 'DRAW',
    narrative: r4Diff > 0
      ? `Unleashing unorthodox Creativity (${pNorm.cre} CRE), ${player.username} executed a breathtaking feint combo that caught ${rival.username} completely unprepared!`
      : r4Diff < 0
      ? `${rival.username} executed an unpredictable trick maneuver, catching the challenger off-balance!`
      : `Both fighters traded inventive improvisation, showcasing remarkable combat flair!`,
  });

  // ROUND 5: Final Overdrive (Total Combat Power)
  const finalDiff = playerBreakdown.totalPower - rivalBreakdown.totalPower;
  const isPlayerDecisiveWinner = finalDiff >= 0;
  const r5DamageToRival = isPlayerDecisiveWinner ? Math.max(35, Math.round(45 + finalDiff * 0.15)) : 15;
  const r5DamageToPlayer = !isPlayerDecisiveWinner ? Math.max(35, Math.round(45 + Math.abs(finalDiff) * 0.15)) : 15;

  rivalSimHp = isPlayerDecisiveWinner ? 0 : Math.max(10, rivalSimHp - r5DamageToRival);
  playerSimHp = !isPlayerDecisiveWinner ? 0 : Math.max(10, playerSimHp - r5DamageToPlayer);

  rounds.push({
    roundNumber: 5,
    title: 'APEX OVERDRIVE FINISH',
    phase: 'FINAL_OVERDRIVE',
    playerStatLabel: `PWR ${playerBreakdown.totalPower} (${playerBreakdown.tier})`,
    rivalStatLabel: `PWR ${rivalBreakdown.totalPower} (${rivalBreakdown.tier})`,
    playerScore: playerBreakdown.totalPower,
    rivalScore: rivalBreakdown.totalPower,
    damageToRival: r5DamageToRival,
    damageToPlayer: r5DamageToPlayer,
    playerHpAfter: playerSimHp,
    rivalHpAfter: rivalSimHp,
    isCrit: true,
    winner: isPlayerDecisiveWinner ? 'PLAYER' : 'RIVAL',
    narrative: isPlayerDecisiveWinner
      ? `Channeling ${playerBreakdown.totalPower} Combat Power, ${player.username} shattered the stalemate with a decisive finishing combo!`
      : `${rival.username} tapped into their ${rivalBreakdown.totalPower} Combat Power, securing the winning blow!`,
  });

  const winner: 'PLAYER' | 'RIVAL' = isPlayerDecisiveWinner ? 'PLAYER' : 'RIVAL';

  // Calculate XP reward
  const baseXp = rival.winRewardXp || (rival.level * 30 + 40);
  const levelDiffBonus = Math.max(0, (rival.level - player.level) * 20);
  const powerDiffBonus = winner === 'PLAYER' && rivalBreakdown.totalPower > playerBreakdown.totalPower ? 25 : 0;
  const xpEarned = winner === 'PLAYER' ? (baseXp + levelDiffBonus + powerDiffBonus) : 0;

  // Calculate updated arena streak
  const previousStreak = player.arenaStreak || 0;
  let newStreak = 0;
  if (winner === 'PLAYER') {
    newStreak = previousStreak > 0 ? previousStreak + 1 : 1;
  } else {
    newStreak = previousStreak < 0 ? previousStreak - 1 : -1;
  }

  const summary = winner === 'PLAYER'
    ? `VICTORY! With ${playerBreakdown.totalPower} Combat Power vs ${rivalBreakdown.totalPower}, you triumphed over ${rival.username} and advanced your arena streak to ${newStreak > 0 ? `+${newStreak}` : newStreak}!`
    : `DEFEAT! ${rival.username} prevailed with ${rivalBreakdown.totalPower} Combat Power. Fortify your attributes with daily habit quests and challenge again!`;

  return {
    winner,
    playerPower: playerBreakdown.totalPower,
    rivalPower: rivalBreakdown.totalPower,
    playerBreakdown,
    rivalBreakdown,
    comparisons,
    rounds,
    xpEarned,
    previousStreak,
    newStreak,
    summary,
  };
}
