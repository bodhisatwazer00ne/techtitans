import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Rival, Item, InventoryItem, BattleRecord, PublicTrainer, DuelChallenge, StatBattleSimulation } from '../../types';
import { PixelButton } from '../rpg/PixelButton';
import { CharacterSprite } from '../rpg/CharacterSprite';
import { BattleHistoryView } from './BattleHistoryView';
import { StatClashBattleModal } from './StatClashBattleModal';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useAuth } from '../../context/AuthContext';
import { emailToAccountId } from '../../services/accountAuth';
import { 
  subscribeToPublicTrainers, 
  subscribeToIncomingChallenges, 
  subscribeToOutgoingChallenges,
  sendDuelChallenge, 
  respondToDuelChallenge, 
  deleteDuelChallenge,
  acceptDuelChallengeAndStartBattle,
  isTrainerOnline,
  updateTrainerPresence,
  emailToSafeAccountId
} from '../../services/firebase';
import { simulateStatClash, calculatePowerScaling } from '../../services/gameEngine';
import { determineAvatarFromStatsAndLevel, getOpponentStanceObservation } from '../../services/avatarSystem';
import { chiptune } from '../../services/audio';
import { 
  Swords, Shield, Flame, Zap, Brain, Sparkles, Activity, 
  TrendingUp, TrendingDown, RefreshCw, Trophy, Target, History,
  Lock, Eye
} from 'lucide-react';

interface ArenaScreenProps {
  user: User;
  items: Item[];
  inventory: InventoryItem[];
  battleHistory?: BattleRecord[];
  onVictory: (rival: Rival, customDetails?: string) => void;
  onDefeat: (rival?: Rival, customDetails?: string) => void;
  onRun?: (rival?: Rival) => void;
  onUseItemInBattle: (inventoryItemId: string) => void;
  initialBattleId?: string | null;
  initialBattleRival?: Rival | null;
  onClearInitialBattle?: () => void;
}

type ArenaFilter = 'MATCH_RANGE' | 'ALL' | 'ONLINE_ONLY' | 'CHALLENGERS' | 'UNDERDOGS';

// Convert a DuelChallenge to a combat Rival
export const convertChallengeToRival = (chal: DuelChallenge, userLevel: number = 1): Rival => {
  return {
    id: chal.challengerId,
    username: chal.challengerName,
    title: chal.challengerTitle || 'Adventurer',
    avatarId: chal.challengerAvatarId,
    level: chal.challengerLevel,
    hp: chal.challengerStats?.maxHp || 40,
    maxHp: chal.challengerStats?.maxHp || 40,
    stamina: chal.challengerStats?.maxStamina || 45,
    maxStamina: chal.challengerStats?.maxStamina || 45,
    attributes: chal.challengerStats?.attributes || {
      str: chal.challengerLevel * 2,
      int: chal.challengerLevel * 2,
      end: chal.challengerLevel * 2,
      res: chal.challengerLevel * 2,
      dis: chal.challengerLevel * 2,
      wil: chal.challengerLevel * 2,
      cre: chal.challengerLevel * 2,
    },
    equipmentName: 'Adventurer Gear',
    bio: 'Real-world player duel challenger',
    difficulty: chal.challengerLevel > userLevel ? 'VETERAN' : 'ADEPT',
    winRewardXp: 60 + chal.challengerLevel * 35,
    winRewardGold: 0,
    specialSkillName: 'Real-World Focus Strike',
    acceptanceQuote: `I have issued you a challenge! Let's see your discipline in action!`,
    status: 'ONLINE',
  };
};

// Convert a PublicTrainer from Firestore to a standard Rival for stat clashes
export const convertPublicTrainerToRival = (pt: PublicTrainer, userLevel: number = 1): Rival => {
  const isUnderdog = pt.level < userLevel;
  const isChallenger = pt.level > userLevel;

  let difficulty: Rival['difficulty'] = 'ADEPT';
  if (isUnderdog) difficulty = 'NOVICE';
  else if (isChallenger) difficulty = 'VETERAN';

  return {
    id: pt.userId,
    username: pt.username,
    title: pt.title || 'Guild Trainer',
    avatarId: pt.avatarId || 'avatar-warrior',
    level: pt.level || 1,
    hp: pt.hp || pt.maxHp || (40 + pt.level * 10),
    maxHp: pt.maxHp || (40 + pt.level * 10),
    stamina: pt.stamina || pt.maxStamina || (40 + pt.level * 5),
    maxStamina: pt.maxStamina || (40 + pt.level * 5),
    attributes: {
      str: pt.attributes?.str ?? Math.max(1, pt.level * 2),
      int: pt.attributes?.int ?? Math.max(1, pt.level * 2),
      end: pt.attributes?.end ?? Math.max(1, pt.level * 2),
      res: pt.attributes?.res ?? Math.max(1, pt.level * 2),
      dis: pt.attributes?.dis ?? Math.max(1, pt.level * 2),
      wil: pt.attributes?.wil ?? Math.max(1, pt.level * 2),
      cre: pt.attributes?.cre ?? Math.max(1, pt.level * 2),
    },
    equipmentName: pt.equipmentName || 'Trained Adventurer Gear',
    bio: `${pt.questsCleared || 0} quests completed | ${pt.streak || 0} day streak`,
    difficulty,
    winRewardXp: 50 + pt.level * 35,
    winRewardGold: 20 + pt.level * 10,
    specialSkillName: `${pt.specialization || 'Discipline'} Burst`,
    streak: pt.arenaStreak ?? (pt.streak || 0),
    acceptanceQuote: 'I cultivate my discipline daily in the real world. Let us spar with honor!',
    status: isTrainerOnline(pt) ? 'ONLINE' : 'LOOKING_FOR_DUEL',
  };
};

export const ArenaScreen: React.FC<ArenaScreenProps> = ({
  user,
  battleHistory = [],
  onVictory,
  onDefeat,
  initialBattleId = null,
  initialBattleRival = null,
  onClearInitialBattle,
}) => {
  const [realTrainers, setRealTrainers] = useState<PublicTrainer[]>([]);
  const [incomingChallenges, setIncomingChallenges] = useState<DuelChallenge[]>([]);
  const [outgoingChallenges, setOutgoingChallenges] = useState<DuelChallenge[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAcceptingId, setIsAcceptingId] = useState<string | null>(null);

  // Active Screen View: Roster vs Battle History
  const [viewMode, setViewMode] = useState<'ROSTER' | 'HISTORY'>('ROSTER');

  // Filter for matching trainers - defaults to LEVEL RANGE ±2
  const [filter, setFilter] = useState<ArenaFilter>('MATCH_RANGE');

  // Active Stat Battle Simulation state for modal
  const [activeSimulation, setActiveSimulation] = useState<StatBattleSimulation | null>(null);
  const [activeClashRival, setActiveClashRival] = useState<Rival | null>(null);

  // Toast / notification feedback
  const [dispatchedChallengeMsg, setDispatchedChallengeMsg] = useState<string | null>(null);

  // Track battles already processed
  const processedBattlesRef = useRef<Set<string>>(new Set());

  const { firebaseUser } = useAuth();

  // All IDs and usernames belonging to the active user (to guarantee their own profile NEVER appears in the arena)
  const userOwnedIds = useMemo(() => {
    const ids = new Set<string>();
    if (user.id) ids.add(user.id);
    ids.add('user_player');
    ids.add('user_guest');
    if (firebaseUser?.uid) ids.add(firebaseUser.uid);
    const cleanEmail = (firebaseUser?.email || '').toLowerCase().trim();
    if (cleanEmail) {
      ids.add(emailToAccountId(cleanEmail));
      ids.add(emailToSafeAccountId(cleanEmail));
    }
    return ids;
  }, [user.id, firebaseUser?.uid, firebaseUser?.email]);

  const userOwnedNames = useMemo(() => {
    const names = new Set<string>();
    if (user.username) names.add(user.username.toLowerCase().trim());
    if (firebaseUser?.displayName) names.add(firebaseUser.displayName.toLowerCase().trim());
    const cleanEmail = (firebaseUser?.email || '').toLowerCase().trim();
    if (cleanEmail) {
      names.add(cleanEmail.split('@')[0].toLowerCase().trim());
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(`liferpg_trainer_name_email_${cleanEmail}`);
        if (stored) names.add(stored.toLowerCase().trim());
      }
    }
    if (typeof window !== 'undefined' && user.id) {
      const storedUid = localStorage.getItem(`liferpg_trainer_name_${user.id}`);
      if (storedUid) names.add(storedUid.toLowerCase().trim());
    }
    names.add('trainer');
    return names;
  }, [user.username, user.id, firebaseUser?.displayName, firebaseUser?.email]);

  const isOwnProfile = (t: { userId?: string; id?: string; username: string }) => {
    if (!t) return true;
    const cid = t.userId || t.id;
    if (cid && userOwnedIds.has(cid)) return true;
    if (t.username && userOwnedNames.has(t.username.toLowerCase().trim())) return true;
    return false;
  };

  // Level bounds: +2 / -2 range of player's level
  const minMatchLevel = Math.max(1, user.level - 2);
  const maxMatchLevel = user.level + 2;

  // Compute player power scaling with all 6 attributes
  const playerPower = useMemo(() => {
    return calculatePowerScaling(user.level, user.attributes);
  }, [user.level, user.attributes]);

  // Ensure current user's presence is marked online
  useEffect(() => {
    updateTrainerPresence(user.id, true);
  }, [user.id]);

  // Subscribe to real-world players in the Arena (strictly filtering out the user's own profile)
  useEffect(() => {
    const unsubTrainers = subscribeToPublicTrainers(
      (trainers) => {
        const rivals = trainers.filter((t) => !isOwnProfile(t));
        const uniqueRivals: PublicTrainer[] = [];
        const seen = new Set<string>();
        for (const r of rivals) {
          const key = r.username.toLowerCase().trim();
          if (!seen.has(key) && !userOwnedNames.has(key)) {
            seen.add(key);
            uniqueRivals.push(r);
          }
        }
        setRealTrainers(uniqueRivals);
        setLoading(false);
      },
      (err) => {
        console.warn('Public trainers subscription note:', err);
        setLoading(false);
      }
    );

    return () => unsubTrainers();
  }, [user.id, user.username, userOwnedIds, userOwnedNames]);

  // Subscribe to real-time incoming challenges directed to current user (excluding challenges from oneself)
  useEffect(() => {
    const unsubChallenges = subscribeToIncomingChallenges(
      user.id,
      (challenges) => {
        const validChallenges = challenges.filter(
          (c) => !userOwnedIds.has(c.challengerId) && !userOwnedNames.has(c.challengerName.toLowerCase().trim())
        );
        setIncomingChallenges(validChallenges);
        if (validChallenges.length > 0) {
          chiptune.playLevelUp();
        }
      },
      (err) => {
        console.warn('Incoming challenges subscription note:', err);
      }
    );

    return () => unsubChallenges();
  }, [user.id, userOwnedIds, userOwnedNames]);

  // Subscribe to outgoing challenges
  useEffect(() => {
    const unsubOutgoing = subscribeToOutgoingChallenges(user.id, (outgoingList) => {
      setOutgoingChallenges(outgoingList);
    });

    return () => unsubOutgoing();
  }, [user.id]);

  // Unified opponent roster: Merges other registered Firestore trainers with active arena challengers
  // GUARANTEE: The user's own profile is NEVER included, showing only other players!
  const unifiedContenders: Rival[] = useMemo(() => {
    const roster: Rival[] = [];
    const seenNames = new Set<string>();

    // Mark current user's names as seen so they can NEVER enter roster
    userOwnedNames.forEach((n) => seenNames.add(n));

    // Real players from Firestore publicTrainers
    for (const pt of realTrainers) {
      if (isOwnProfile(pt)) continue;
      const nameKey = pt.username.toLowerCase().trim();
      if (!seenNames.has(nameKey)) {
        seenNames.add(nameKey);
        roster.push(convertPublicTrainerToRival(pt, user.level));
      }
    }

    // Sort by level ascending, then by name
    return roster.sort((a, b) => a.level - b.level || a.username.localeCompare(b.username));
  }, [realTrainers, user.level, userOwnedNames]);

  // Filtered opponents according to active filter
  const filteredContenders = useMemo(() => {
    return unifiedContenders.filter((rival) => {
      if (filter === 'MATCH_RANGE') {
        return rival.level >= minMatchLevel && rival.level <= maxMatchLevel;
      }
      if (filter === 'ONLINE_ONLY') {
        return rival.status === 'ONLINE';
      }
      if (filter === 'CHALLENGERS') {
        return rival.level > user.level;
      }
      if (filter === 'UNDERDOGS') {
        return rival.level < user.level;
      }
      // 'ALL'
      return true;
    });
  }, [unifiedContenders, filter, minMatchLevel, maxMatchLevel, user.level]);

  // Count opponents in level match range
  const matchRangeCount = useMemo(() => {
    return unifiedContenders.filter(
      (r) => r.level >= minMatchLevel && r.level <= maxMatchLevel
    ).length;
  }, [unifiedContenders, minMatchLevel, maxMatchLevel]);

  // Launch Stat Clash Battle against chosen rival
  const handleLaunchStatClash = (rival: Rival) => {
    chiptune.playSelect();
    try {
      const sim = simulateStatClash(user, rival);
      setActiveClashRival(rival);
      setActiveSimulation(sim);
    } catch (err) {
      console.error('Stat battle simulation error:', err);
    }
  };

  // When clash animation finishes or user closes result
  const handleStatClashComplete = () => {
    if (!activeSimulation || !activeClashRival) {
      setActiveSimulation(null);
      setActiveClashRival(null);
      return;
    }

    const sim = activeSimulation;
    const rival = activeClashRival;

    // Reset active modal
    setActiveSimulation(null);
    setActiveClashRival(null);

    // Call app-wide victory or defeat handler
    if (sim.winner === 'PLAYER') {
      onVictory(rival, sim.summary);
    } else {
      onDefeat(rival, sim.summary);
    }
  };

  // Re-challenge opponent directly
  const handleRechallenge = () => {
    if (!activeClashRival) return;
    chiptune.playSelect();
    const newSim = simulateStatClash(user, activeClashRival);
    setActiveSimulation(newSim);
  };

  // Re-challenge from historical battle record
  const handleRechallengeFromHistory = (record: BattleRecord) => {
    // Look up rival in unified list or build from record
    let targetRival = unifiedContenders.find((r) => r.id === record.rivalId || r.username === record.rivalName);
    if (!targetRival) {
      targetRival = {
        id: record.rivalId || `hist-${Date.now()}`,
        username: record.rivalName,
        title: record.rivalTitle || 'Rival Trainer',
        avatarId: record.rivalAvatarId || 'avatar-warrior',
        level: record.rivalLevel || user.level,
        hp: 50 + (record.rivalLevel || 1) * 10,
        maxHp: 50 + (record.rivalLevel || 1) * 10,
        stamina: 50 + (record.rivalLevel || 1) * 5,
        maxStamina: 50 + (record.rivalLevel || 1) * 5,
        attributes: {
          str: Math.max(1, (record.rivalLevel || 1) * 2),
          int: Math.max(1, (record.rivalLevel || 1) * 2),
          end: Math.max(1, (record.rivalLevel || 1) * 2),
          res: Math.max(1, (record.rivalLevel || 1) * 2),
          dis: Math.max(1, (record.rivalLevel || 1) * 2),
          wil: Math.max(1, (record.rivalLevel || 1) * 2),
          cre: Math.max(1, (record.rivalLevel || 1) * 2),
        },
        equipmentName: 'Adventurer Gear',
        bio: 'Past Arena Rival',
        difficulty: (record.rivalLevel || 1) > user.level ? 'VETERAN' : 'ADEPT',
        winRewardXp: 50 + (record.rivalLevel || 1) * 35,
        winRewardGold: 25,
        specialSkillName: 'Focused Strike',
        acceptanceQuote: 'A rematch! Let us see if you have grown stronger!',
        status: 'ONLINE',
      };
    }

    setViewMode('ROSTER');
    handleLaunchStatClash(targetRival);
  };

  // Handle incoming challenge
  const handleAcceptIncomingChallenge = (chal: DuelChallenge) => {
    if (isAcceptingId) return;
    setIsAcceptingId(chal.id);
    chiptune.playHit();
    const challengerRival: Rival = {
      id: chal.challengerId,
      username: chal.challengerName,
      title: chal.challengerTitle || 'Arena Challenger',
      avatarId: chal.challengerAvatarId || 'avatar-warrior',
      level: chal.challengerLevel,
      hp: chal.challengerStats?.maxHp || 60,
      maxHp: chal.challengerStats?.maxHp || 60,
      stamina: chal.challengerStats?.maxStamina || 50,
      maxStamina: chal.challengerStats?.maxStamina || 50,
      attributes: {
        str: chal.challengerStats?.attributes?.str ?? chal.challengerLevel * 2,
        int: chal.challengerStats?.attributes?.int ?? chal.challengerLevel * 2,
        end: chal.challengerStats?.attributes?.end ?? chal.challengerLevel * 2,
        res: chal.challengerStats?.attributes?.res ?? chal.challengerLevel * 2,
        dis: chal.challengerStats?.attributes?.dis ?? chal.challengerLevel * 2,
        wil: chal.challengerStats?.attributes?.wil ?? chal.challengerLevel * 2,
        cre: chal.challengerStats?.attributes?.cre ?? chal.challengerLevel * 2,
      },
      equipmentName: 'Duel Challenger Gear',
      bio: 'Challenged your habits in the Arena',
      difficulty: chal.challengerLevel > user.level ? 'VETERAN' : 'ADEPT',
      winRewardXp: 60 + chal.challengerLevel * 35,
      winRewardGold: 30,
      specialSkillName: 'Discipline Clash',
      streak: 1,
      acceptanceQuote: 'I challenge you to a duel of discipline and habit power!',
      status: 'ONLINE',
    };

    setIsAcceptingId(null);
    handleLaunchStatClash(challengerRival);
  };

  // If viewing previous battle chronicles
  if (viewMode === 'HISTORY') {
    return (
      <BattleHistoryView
        battleHistory={battleHistory}
        onReturnToRoster={() => setViewMode('ROSTER')}
        onRechallenge={handleRechallengeFromHistory}
      />
    );
  }

  return (
    <div className="space-y-4 select-none">
      {/* STAT CLASH BATTLE ANIMATION MODAL */}
      {activeSimulation && activeClashRival && (
        <StatClashBattleModal
          simulation={activeSimulation}
          playerInfo={{
            username: user.username,
            level: user.level,
            title: user.title,
            avatarId: user.avatarId || determineAvatarFromStatsAndLevel(
              user.attributes || { str: 10, int: 10, end: 10, res: 10, wil: 10, cre: 10, dis: 10 },
              user.level
            ).avatarId,
            hp: user.hp,
            maxHp: user.maxHp,
          }}
          rivalInfo={{
            id: activeClashRival.id,
            username: activeClashRival.username,
            level: activeClashRival.level,
            title: activeClashRival.title,
            avatarId: activeClashRival.avatarId || determineAvatarFromStatsAndLevel(
              activeClashRival.attributes || { str: 10, int: 10, end: 10, res: 10, wil: 10, cre: 10, dis: 10 },
              activeClashRival.level
            ).avatarId,
            equipmentName: activeClashRival.equipmentName,
            hp: activeClashRival.hp,
            maxHp: activeClashRival.maxHp,
          }}
          onClose={handleStatClashComplete}
          onRechallenge={handleRechallenge}
        />
      )}

      {/* ARENA HEADER BANNER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#f5eedb] border-4 border-[#120e1d] p-4 shadow-[4px_4px_0px_#120e1d]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-pixel text-xs bg-[#e43b44] text-white px-2 py-0.5 border border-[#7f1d1d]">
              STAT CLASH ARENA
            </span>
            <h2 className="font-pixel text-base sm:text-lg text-[#181425]">
              TRAINER BATTLE ARENA
            </h2>
          </div>
          <p className="font-silkscreen text-xs text-[#5e5443] mt-1">
            Challenge opponents in your level range (Lv. {minMatchLevel} – Lv. {maxMatchLevel}). Stats are compared across 6 attributes to decide the victor!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Player Combat Power Widget */}
          <div className="font-pixel text-xs bg-[#201933] text-[#fec83e] px-3 py-2 border-2 border-[#120e1d] shadow-[2px_2px_0px_#000] flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>POWER: {playerPower.totalPower}</span>
            <span className="text-[10px] text-amber-300 uppercase">({playerPower.tier})</span>
          </div>

          {/* Current Arena Streak */}
          <div className="font-pixel text-xs px-3 py-2 border-2 border-[#120e1d] shadow-[2px_2px_0px_#000] flex items-center gap-1.5 bg-[#fcf8f0]">
            {(user.arenaStreak ?? 0) > 0 ? (
              <span className="text-[#15803d] font-bold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                STREAK: +{user.arenaStreak} WINS 🔥
              </span>
            ) : (user.arenaStreak ?? 0) < 0 ? (
              <span className="text-[#b91c1c] font-bold flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                STREAK: {user.arenaStreak} LOSSES 💀
              </span>
            ) : (
              <span className="text-[#64748b]">
                STREAK: 0 (EVEN)
              </span>
            )}
          </div>

          {/* Battle History Button */}
          <PixelButton
            variant="gold"
            size="sm"
            onClick={() => {
              chiptune.playSelect();
              setViewMode('HISTORY');
            }}
          >
            📜 PREVIOUS BATTLES ({battleHistory.length})
          </PixelButton>
        </div>
      </div>

      {/* DISPATCH CONFIRMATION POPUP */}
      {dispatchedChallengeMsg && (
        <div className="bg-[#dbeafe] border-4 border-[#120e1d] p-3.5 flex items-center justify-between gap-2 shadow-[4px_4px_0px_#120e1d]">
          <span className="font-silkscreen text-xs text-[#1e40af]">
            {dispatchedChallengeMsg}
          </span>
          <PixelButton
            variant="dark"
            size="sm"
            onClick={() => setDispatchedChallengeMsg(null)}
          >
            DISMISS
          </PixelButton>
        </div>
      )}

      {/* REAL-TIME INCOMING CHALLENGES */}
      {incomingChallenges.map((chal) => (
        <div
          key={chal.id}
          className="border-4 border-[#120e1d] p-4 bg-[#fffbeb] shadow-[4px_4px_0px_#120e1d] animate-pulse"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-pixel text-xs px-2.5 py-1 bg-[#dc2626] text-white border border-[#7f1d1d]">
              ⚔ INCOMING ARENA CHALLENGE!
            </span>
            <span className="font-pixel text-xs text-[#854d0e] bg-[#fef08a] px-2 py-0.5 border border-[#ca8a04]">
              LV. {chal.challengerLevel} REAL PLAYER
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-3 pt-3 border-t-2 border-[#e7d8b8]">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-[#181425] border-2 border-[#120e1d] p-1 flex items-center justify-center">
                <CharacterSprite id={chal.challengerAvatarId} level={chal.challengerLevel} size={44} />
              </div>
              <div>
                <h3 className="font-pixel text-sm text-[#181425] font-bold">
                  {chal.challengerName}
                </h3>
                <span className="font-silkscreen text-xs text-[#6b5c46]">
                  {chal.challengerTitle || 'Adventurer'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <PixelButton
                variant="green"
                size="md"
                onClick={() => handleAcceptIncomingChallenge(chal)}
              >
                ⚔ ACCEPT STAT CLASH ▶
              </PixelButton>
              <PixelButton
                variant="dark"
                size="md"
                onClick={async () => {
                  chiptune.playCursor();
                  await respondToDuelChallenge(chal.id, false);
                }}
              >
                ✕ DECLINE
              </PixelButton>
            </div>
          </div>
        </div>
      ))}

      {/* FILTER TABS */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#d4c5a9] pb-2">
        <div className="flex flex-wrap items-center gap-1 font-pixel text-[10px]">
          {/* LEVEL MATCH RANGE (DEFAULT) */}
          <button
            type="button"
            onClick={() => {
              chiptune.playSelect();
              setFilter('MATCH_RANGE');
            }}
            className={`px-3 py-1.5 border-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
              filter === 'MATCH_RANGE'
                ? 'bg-[#15803d] text-white border-[#120e1d] shadow-[2px_2px_0px_#000]'
                : 'bg-[#ede3ce] text-[#2b2540] border-[#d4c5a9] hover:bg-[#dfd3bc]'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-emerald-300" />
            LEVEL RANGE [LV. {minMatchLevel} - {maxMatchLevel}] ({matchRangeCount})
          </button>

          <button
            type="button"
            onClick={() => {
              chiptune.playSelect();
              setFilter('ALL');
            }}
            className={`px-3 py-1.5 border-2 cursor-pointer transition-colors ${
              filter === 'ALL'
                ? 'bg-[#201933] text-[#fec83e] border-[#120e1d] shadow-[2px_2px_0px_#000]'
                : 'bg-[#ede3ce] text-[#2b2540] border-[#d4c5a9] hover:bg-[#dfd3bc]'
            }`}
          >
            ALL CONTENDERS ({unifiedContenders.length})
          </button>

          <button
            type="button"
            onClick={() => {
              chiptune.playSelect();
              setFilter('ONLINE_ONLY');
            }}
            className={`px-3 py-1.5 border-2 cursor-pointer transition-colors ${
              filter === 'ONLINE_ONLY'
                ? 'bg-[#201933] text-[#fec83e] border-[#120e1d] shadow-[2px_2px_0px_#000]'
                : 'bg-[#ede3ce] text-[#2b2540] border-[#d4c5a9] hover:bg-[#dfd3bc]'
            }`}
          >
            ● ONLINE NOW
          </button>

          <button
            type="button"
            onClick={() => {
              chiptune.playSelect();
              setFilter('CHALLENGERS');
            }}
            className={`px-3 py-1.5 border-2 cursor-pointer transition-colors ${
              filter === 'CHALLENGERS'
                ? 'bg-[#201933] text-[#fec83e] border-[#120e1d] shadow-[2px_2px_0px_#000]'
                : 'bg-[#ede3ce] text-[#2b2540] border-[#d4c5a9] hover:bg-[#dfd3bc]'
            }`}
          >
            HIGHER LEVELS (+1+)
          </button>

          <button
            type="button"
            onClick={() => {
              chiptune.playSelect();
              setFilter('UNDERDOGS');
            }}
            className={`px-3 py-1.5 border-2 cursor-pointer transition-colors ${
              filter === 'UNDERDOGS'
                ? 'bg-[#201933] text-[#fec83e] border-[#120e1d] shadow-[2px_2px_0px_#000]'
                : 'bg-[#ede3ce] text-[#2b2540] border-[#d4c5a9] hover:bg-[#dfd3bc]'
            }`}
          >
            LOWER LEVELS (-1-)
          </button>
        </div>

        <span className="font-silkscreen text-[11px] text-[#71634d]">
          Showing {filteredContenders.length} opponents • 1 Player is enough to challenge & play!
        </span>
      </div>

      {/* CONTENDERS ROSTER GRID */}
      {loading ? (
        <div className="p-8 text-center font-pixel text-xs text-[#6b5c46] animate-pulse">
          SCANNING ARENA FOR CONTENDERS IN YOUR LEVEL BRACKET...
        </div>
      ) : filteredContenders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredContenders.map((rival) => {
            const levelDelta = rival.level - user.level;
            const isOnline = rival.status === 'ONLINE';

            // Dynamically evaluate rival's avatar based on their highest stat & level
            const rivalAvatarProfile = determineAvatarFromStatsAndLevel(
              rival.attributes || { str: 10, int: 10, end: 10, res: 10, wil: 10, cre: 10, dis: 10 },
              rival.level
            );
            const effectiveAvatarId = rival.avatarId || rivalAvatarProfile.avatarId;
            const stanceObs = getOpponentStanceObservation(rival.attributes);

            const threatBadge = 
              levelDelta >= 2 ? '⚠️ EXTREME THREAT' :
              levelDelta === 1 ? '⚔️ HIGH THREAT' :
              levelDelta === 0 ? '⚖️ BALANCED MATCH' :
              '🛡️ FAVORABLE';

            return (
              <div
                key={rival.id}
                className="bg-[#fcf8f0] border-4 border-[#120e1d] p-4 shadow-[4px_4px_0px_#120e1d] flex flex-col justify-between hover:border-[#3b2d54] transition-colors"
              >
                <div>
                  {/* Top Card Strip */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 bg-[#181425] border-2 border-[#120e1d] p-1 flex items-center justify-center shrink-0 relative">
                        <CharacterSprite id={effectiveAvatarId} level={rival.level} size={52} />
                        <span className="absolute -bottom-1 -right-1 font-pixel text-[8px] bg-[#201933] text-[#fec83e] px-1 border border-black">
                          LV.{rival.level}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-pixel text-xs sm:text-sm text-[#181425] font-bold">
                            {rival.username}
                          </h3>
                          {isOnline ? (
                            <span className="flex items-center gap-1 font-pixel text-[8px] text-[#15803d] bg-[#dcfce7] px-1.5 py-0.5 border border-[#86efac]">
                              <span className="w-1.5 h-1.5 bg-[#22c55e] inline-block rounded-full animate-ping" />
                              ONLINE
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-pixel text-[8px] text-[#64748b] bg-[#f1f5f9] px-1.5 py-0.5 border border-[#cbd5e1]">
                              <span className="w-1.5 h-1.5 bg-[#94a3b8] inline-block rounded-full" />
                              ARENA READY
                            </span>
                          )}
                        </div>

                        <p className="font-silkscreen text-[11px] text-[#6b5c46]">
                          {rival.title}
                        </p>

                        {/* Arena Streak / Record badge */}
                        {(rival.streak !== undefined && rival.streak !== 0) && (
                          <div className="mt-1">
                            {rival.streak > 0 ? (
                              <span className="inline-flex items-center gap-1 font-pixel text-[8px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 border border-emerald-300 font-bold shadow-[1px_1px_0px_#15803d]">
                                <TrendingUp className="w-2.5 h-2.5" />
                                +{rival.streak} ARENA WINS 🔥
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-pixel text-[8px] bg-rose-100 text-rose-800 px-1.5 py-0.5 border border-rose-300 font-bold">
                                <TrendingDown className="w-2.5 h-2.5" />
                                {rival.streak} LOSSES 💀
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Level & Matchup Status */}
                    <div className="text-right">
                      <div className="font-pixel text-xs font-bold bg-[#201933] text-[#fec83e] px-2.5 py-1 border border-[#120e1d] inline-block shadow-[1px_1px_0px_#000]">
                        LV. {rival.level}
                      </div>
                      <div className="mt-1.5">
                        {levelDelta === 0 ? (
                          <span className="font-pixel text-[8px] bg-[#dcfce7] text-[#15803d] px-1.5 py-0.5 border border-[#86efac] font-bold">
                            ±0 EQUAL MATCH
                          </span>
                        ) : levelDelta > 0 ? (
                          <span className="font-pixel text-[8px] bg-[#fee2e2] text-[#b91c1c] px-1.5 py-0.5 border border-[#fca5a5] font-bold">
                            +{levelDelta} CHALLENGER
                          </span>
                        ) : (
                          <span className="font-pixel text-[8px] bg-[#dbeafe] text-[#1d4ed8] px-1.5 py-0.5 border border-[#93c5fd] font-bold">
                            {levelDelta} UNDERDOG
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tactical Scouting & Fog of War: Stats are concealed until battle! */}
                  <div className="mt-3 p-2.5 bg-[#ede3ce] border border-[#c4b59a] space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-silkscreen text-[#554a37]">
                      <div className="flex items-center gap-1.5 font-bold truncate max-w-[200px]">
                        <Shield className="w-3.5 h-3.5 text-[#854d0e] shrink-0" />
                        <span>LOADOUT:</span>
                        <span className="text-[#181425] italic truncate">{rival.equipmentName}</span>
                      </div>
                      <span className="font-pixel text-[9px] px-1.5 py-0.5 bg-[#201933] text-[#fec83e] border border-black shrink-0">
                        {threatBadge}
                      </span>
                    </div>

                    {/* Stance Observation without disclosing raw numbers */}
                    <div className="flex items-start gap-1.5 text-[10px] font-silkscreen bg-[#fcf8f0] p-1.5 border border-[#c4b59a]">
                      <Eye className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700" />
                      <div>
                        <span className="font-bold text-[#181425]">{stanceObs.stanceTitle}: </span>
                        <span className="text-[#6b5c46] italic">{stanceObs.observationNote}</span>
                      </div>
                    </div>

                    {/* Concealed Attributes Fog of War Badge */}
                    <div className="bg-[#241c38] text-[#fec83e] p-1.5 border border-[#120e1d] flex items-center justify-center gap-2 font-pixel text-[9px] tracking-wide shadow-[1px_1px_0px_#000]">
                      <Lock className="w-3 h-3 text-[#fec83e]" />
                      <span>ATTRIBUTES CONCEALED • REVEALED IN BATTLE CLASH</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Strip: Instant Stat Clash Battle */}
                <div className="mt-4 pt-3 border-t border-[#d4c5a9] flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="font-silkscreen text-[10px] text-[#71634d] truncate">
                    Reward: <span className="font-pixel text-[#15803d]">+{rival.winRewardXp} XP</span>
                  </div>

                  <PixelButton
                    variant="red"
                    size="sm"
                    onClick={() => handleLaunchStatClash(rival)}
                    className="w-full sm:w-auto font-bold tracking-wide"
                  >
                    ⚔ CHALLENGE STAT BATTLE ▶
                  </PixelButton>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        unifiedContenders.length === 0 ? (
          <div className="bg-[#f5eedb] border-4 border-[#120e1d] p-8 text-center space-y-4 shadow-[4px_4px_0px_#120e1d]">
            <div className="w-16 h-16 mx-auto bg-[#181425] border-2 border-[#120e1d] p-1 flex items-center justify-center">
              <CharacterSprite id={user.avatarId} size={48} />
            </div>
            <div>
              <h3 className="font-pixel text-sm text-[#181425] font-bold">
                ARENA AWAITS NEW CONTENDERS
              </h3>
              <p className="font-silkscreen text-xs text-[#5e5443] max-w-md mx-auto mt-1.5 leading-relaxed">
                You are currently the reigning champion in the arena! When other players register their trainer accounts, their real-time character profiles will appear here for Stat Clashes, Duels, and multiplayer battles.
              </p>
            </div>
            <div className="font-pixel text-[10px] text-[#2563eb] bg-[#dbeafe] border border-[#93c5fd] p-2 max-w-xs mx-auto">
              TIP: Register another trainer in an incognito window to test live duels!
            </div>
          </div>
        ) : (
          <div className="bg-[#f5eedb] border-4 border-[#120e1d] p-8 text-center space-y-4 shadow-[4px_4px_0px_#120e1d]">
            <div className="w-16 h-16 mx-auto bg-[#181425] border-2 border-[#120e1d] p-1 flex items-center justify-center">
              <CharacterSprite id={user.avatarId} size={48} />
            </div>
            <div>
              <h3 className="font-pixel text-sm text-[#181425] font-bold">
                NO OPPONENTS IN THIS FILTER
              </h3>
              <p className="font-silkscreen text-xs text-[#5e5443] max-w-md mx-auto mt-1.5 leading-relaxed">
                No contenders currently match the &ldquo;{filter}&rdquo; filter. Switch to &ldquo;ALL CONTENDERS&rdquo; or complete quests to level up your character into new brackets!
              </p>
            </div>

            <div className="pt-2">
              <PixelButton
                variant="gold"
                size="md"
                onClick={() => {
                  chiptune.playSelect();
                  setFilter('ALL');
                }}
              >
                VIEW ALL CONTENDERS ({unifiedContenders.length})
              </PixelButton>
            </div>
          </div>
        )
      )}
    </div>
  );
};
