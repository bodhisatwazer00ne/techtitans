import { AttributeScores, AttributeType, Specialization } from '../types';

export interface AvatarEvolutionProfile {
  avatarId: string;
  archetype: Specialization;
  className: string;
  highestStat: AttributeType;
  highestStatValue: number;
  highestStatName: string;
  description: string;
  auraColor: string;
  themeBadge: string;
  statBadgeText: string;
}

/**
 * Maps attribute keys to human-readable names and visual theme colors.
 */
export const ATTRIBUTE_META: Record<
  AttributeType,
  { name: string; icon: string; color: string; specialty: string }
> = {
  str: { name: 'Strength', icon: '⚔️', color: '#dc2626', specialty: 'Heavy Striker' },
  int: { name: 'Intelligence', icon: '🔮', color: '#2563eb', specialty: 'Arcane Sage' },
  end: { name: 'Endurance', icon: '🛡️', color: '#16a34a', specialty: 'Iron Bastion' },
  res: { name: 'Resilience', icon: '🛡️', color: '#ca8a04', specialty: 'Aegis Guardian' },
  wil: { name: 'Willpower', icon: '🧘', color: '#9333ea', specialty: 'Mindful Monk' },
  cre: { name: 'Creativity', icon: '🎨', color: '#059669', specialty: 'Visionary Scout' },
  dis: { name: 'Discipline', icon: '📜', color: '#d97706', specialty: 'Disciplined Warden' },
};

/**
 * Evaluates a character's attribute scores to find the dominant highest stat.
 */
export function getHighestAttribute(attributes: AttributeScores): {
  key: AttributeType;
  value: number;
  isBalanced: boolean;
} {
  const list: { key: AttributeType; val: number }[] = [
    { key: 'str', val: attributes.str ?? 10 },
    { key: 'int', val: attributes.int ?? 10 },
    { key: 'end', val: attributes.end ?? 10 },
    { key: 'res', val: attributes.res ?? 10 },
    { key: 'wil', val: attributes.wil ?? 10 },
    { key: 'cre', val: attributes.cre ?? 10 },
    { key: 'dis', val: attributes.dis ?? 10 },
  ];

  list.sort((a, b) => b.val - a.val);
  const highest = list[0];
  const lowest = list[list.length - 1];

  // If the gap between highest and lowest is 2 or less, consider them balanced
  const isBalanced = highest.val - lowest.val <= 2;

  return {
    key: highest.key,
    value: highest.val,
    isBalanced,
  };
}

/**
 * Dynamically determines the user's avatarId, specialization archetype, and class title
 * strictly based on their dominant highest stat and current level.
 */
export function determineAvatarFromStatsAndLevel(
  attributes: AttributeScores,
  level: number
): AvatarEvolutionProfile {
  const { key: highestKey, value: highestVal, isBalanced } = getHighestAttribute(attributes);

  // Starter/Novice Tier (Levels 1-2 with balanced stats)
  if (level <= 2 && isBalanced) {
    return {
      avatarId: 'hero_novice',
      archetype: 'ADVENTURER',
      className: level === 1 ? 'Novice Adventurer' : 'Aspirant Trainee',
      highestStat: highestKey,
      highestStatValue: highestVal,
      highestStatName: ATTRIBUTE_META[highestKey].name,
      description: 'Balanced potential preparing to awaken a specialized combat archetype.',
      auraColor: '#3b82f6',
      themeBadge: '🌱 BALANCED NOVICE',
      statBadgeText: 'BALANCED POTENTIAL',
    };
  }

  // Determine Class by dominant attribute and level tier
  switch (highestKey) {
    case 'str': {
      let className = 'Iron Striker';
      let desc = 'Focused on explosive physical strikes and heavy kinetic power.';
      if (level >= 15) {
        className = 'Titan Warlord';
        desc = 'Mythic physical force capable of shattering defensive lines with pure might.';
      } else if (level >= 10) {
        className = 'Dreadnought Champion';
        desc = 'Master of heavy broadswords, overwhelming force, and aggressive pressure.';
      } else if (level >= 6) {
        className = 'Ironclad Vanguard';
        desc = 'Hardened frontline fighter delivering brutal physical impact.';
      } else if (level >= 3) {
        className = 'Berserker Striker';
        desc = 'Fierce combatant channeling momentum into crushing blows.';
      }

      return {
        avatarId: 'hero_warrior',
        archetype: 'WARRIOR',
        className,
        highestStat: 'str',
        highestStatValue: highestVal,
        highestStatName: 'Strength',
        description: desc,
        auraColor: '#dc2626',
        themeBadge: '⚔ STRENGTH SPECIALIST',
        statBadgeText: `STR FOCUS (${highestVal} STR)`,
      };
    }

    case 'int': {
      let className = 'Apprentice Scholar';
      let desc = 'Cultivating mental acuity, analytical problem solving, and calculated attacks.';
      if (level >= 15) {
        className = 'Grand Archmage';
        desc = 'Legendary tactical intellect manipulating combat flow with arcane mastery.';
      } else if (level >= 10) {
        className = 'Master Arcanist';
        desc = 'Commanding high-order strategy, exploiting enemy weaknesses with precision.';
      } else if (level >= 6) {
        className = 'Polymath Sage';
        desc = 'Wielding broad knowledge and quick computational tactics in battle.';
      } else if (level >= 3) {
        className = 'Arcane Tactician';
        desc = 'Out-thinking opponents and analyzing combat patterns ahead of time.';
      }

      return {
        avatarId: 'hero_scholar',
        archetype: 'SCHOLAR',
        className,
        highestStat: 'int',
        highestStatValue: highestVal,
        highestStatName: 'Intelligence',
        description: desc,
        auraColor: '#2563eb',
        themeBadge: '🔮 INTELLECT SPECIALIST',
        statBadgeText: `INT FOCUS (${highestVal} INT)`,
      };
    }

    case 'end': {
      let className = 'Sturdy Sentinel';
      let desc = 'Built upon boundless endurance and sustained stamina pools.';
      if (level >= 15) {
        className = 'Unbreakable Colossus';
        desc = 'Living fortress capable of weathering monumental storms without faltering.';
      } else if (level >= 10) {
        className = 'Colossus Protector';
        desc = 'Massive stamina reserves ensuring peak performance through grueling battles.';
      } else if (level >= 6) {
        className = 'Fortress Vanguard';
        desc = 'Steadfast defender that outlasts opponents in deep battles of attrition.';
      } else if (level >= 3) {
        className = 'Iron Bastion';
        desc = 'High stamina and vitals, wearing down aggressive opponents.';
      }

      return {
        avatarId: 'hero_guardian',
        archetype: 'GUARDIAN',
        className,
        highestStat: 'end',
        highestStatValue: highestVal,
        highestStatName: 'Endurance',
        description: desc,
        auraColor: '#16a34a',
        themeBadge: '🛡️ ENDURANCE SPECIALIST',
        statBadgeText: `END FOCUS (${highestVal} END)`,
      };
    }

    case 'res': {
      let className = 'Shield Aspirant';
      let desc = 'Hardened defenses, high armor ratings, and damage mitigation.';
      if (level >= 15) {
        className = 'Radiant Sovereign Aegis';
        desc = 'Impervious defensive ward negating devastating attacks with divine poise.';
      } else if (level >= 10) {
        className = 'Divine Aegis Paladin';
        desc = 'Heavily armored champion standing firm against high-damage strikes.';
      } else if (level >= 6) {
        className = 'Templar Crusader';
        desc = 'Combining resolute armor with tactical barrier warding.';
      } else if (level >= 3) {
        className = 'Bulwark Defender';
        desc = 'Defensive specialist capable of parrying and absorbing shockwaves.';
      }

      return {
        avatarId: 'paladin_female',
        archetype: 'GUARDIAN',
        className,
        highestStat: 'res',
        highestStatValue: highestVal,
        highestStatName: 'Resilience',
        description: desc,
        auraColor: '#ca8a04',
        themeBadge: '🛡️ RESILIENCE SPECIALIST',
        statBadgeText: `RES FOCUS (${highestVal} RES)`,
      };
    }

    case 'wil': {
      let className = 'Focused Ascetic';
      let desc = 'Inner serenity, meditation focus, and high critical resolve.';
      if (level >= 15) {
        className = 'Celestial Grandmaster Monk';
        desc = 'Enlightened mastery converting pure resolve into transcendent critical strikes.';
      } else if (level >= 10) {
        className = 'Ki Grandmaster';
        desc = 'Inner willpower radiating outward, turning defense into swift counter-ripostes.';
      } else if (level >= 6) {
        className = 'Mindful Adept';
        desc = 'Disciplined breathwork granting high critical hit probability.';
      } else if (level >= 3) {
        className = 'Zen Striker';
        desc = 'Calm mind in the chaos of battle, striking key pressure points.';
      }

      return {
        avatarId: 'hero_monk',
        archetype: 'MONK',
        className,
        highestStat: 'wil',
        highestStatValue: highestVal,
        highestStatName: 'Willpower',
        description: desc,
        auraColor: '#9333ea',
        themeBadge: '🧘 WILLPOWER SPECIALIST',
        statBadgeText: `WIL FOCUS (${highestVal} WIL)`,
      };
    }

    case 'cre':
    case 'dis':
    default: {
      let className = 'Artisan Scout';
      let desc = 'Unpredictable battle feints, quick improvisations, and tactical flair.';
      if (level >= 15) {
        className = 'Apex Sovereign Artisan';
        desc = 'Boundless creativity and unmatched agility disorienting even legendary foes.';
      } else if (level >= 10) {
        className = 'Phantom Shadowblade';
        desc = 'Master of creative feints and agile maneuvers that bypass conventional guards.';
      } else if (level >= 6) {
        className = 'Visionary Pathfinder';
        desc = 'Inventive combatant discovering innovative solutions under pressure.';
      } else if (level >= 3) {
        className = 'Trickster Ranger';
        desc = 'Agile and unpredictable, confounding traditional combat routines.';
      }

      return {
        avatarId: 'hero_scout',
        archetype: 'SCOUT',
        className,
        highestStat: highestKey === 'dis' ? 'dis' : 'cre',
        highestStatValue: highestVal,
        highestStatName: highestKey === 'dis' ? 'Discipline' : 'Creativity',
        description: desc,
        auraColor: '#059669',
        themeBadge: '🎨 CREATIVITY SPECIALIST',
        statBadgeText: `CRE FOCUS (${highestVal} CRE)`,
      };
    }
  }
}

/**
 * Returns a tactical scouting note describing an opponent's observable stance
 * without disclosing their exact numeric values (maintaining fog of war).
 */
export function getOpponentStanceObservation(attributes?: AttributeScores): {
  stanceTitle: string;
  observationNote: string;
  threatColor: string;
} {
  if (!attributes) {
    return {
      stanceTitle: 'Versatile Combat Stance',
      observationNote: 'Balanced posture. Attributes are concealed under battle cloak.',
      threatColor: '#3b82f6',
    };
  }

  const { key, isBalanced } = getHighestAttribute(attributes);

  if (isBalanced) {
    return {
      stanceTitle: 'Balanced All-Rounder Stance',
      observationNote: 'Demonstrates even weight distribution. No glaring weaknesses observable.',
      threatColor: '#3b82f6',
    };
  }

  switch (key) {
    case 'str':
      return {
        stanceTitle: 'Heavy Vanguard Stance',
        observationNote: 'Radiates intense physical momentum. Strikes will likely carry devastating kinetic power.',
        threatColor: '#dc2626',
      };
    case 'int':
      return {
        stanceTitle: 'Arcane Focus Stance',
        observationNote: 'Maintains calculating eye contact. Expect analytical feints and tactical counter-maneuvers.',
        threatColor: '#2563eb',
      };
    case 'end':
      return {
        stanceTitle: 'Stalwart Bastion Stance',
        observationNote: 'Imposing stamina footprint. Outlasting them in prolonged combat will require sustained effort.',
        threatColor: '#16a34a',
      };
    case 'res':
      return {
        stanceTitle: 'Impervious Shield Stance',
        observationNote: 'Heavy armor guard locked tight. Direct damage will meet high mitigation resistance.',
        threatColor: '#ca8a04',
      };
    case 'wil':
      return {
        stanceTitle: 'Zen Ki Stance',
        observationNote: 'Breathing remains impeccably steady. Shows signs of high critical resolve when pressured.',
        threatColor: '#9333ea',
      };
    case 'cre':
    default:
      return {
        stanceTitle: 'Agile Trickster Stance',
        observationNote: 'Fluid, unpredictable footing. Prepared to deploy unorthodox creative gambits.',
        threatColor: '#059669',
      };
  }
}
