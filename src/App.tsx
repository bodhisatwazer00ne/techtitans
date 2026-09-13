import React, { useState, useEffect, useRef } from 'react';
import {
  GameState,
  AttributeType,
  Quest,
  Rival,
  GameSettings,
  BattleRecord,
  User,
  InventoryItem,
  Specialization,
  DuelChallenge,
} from './types';
import {
  loadGameState,
  saveGameState,
  resetGameState,
  initializeNewGame,
  deriveMaxVitals,
  createInitialState,
} from './services/storage';
import { INITIAL_ITEMS, ARCHETYPES, INITIAL_BADGES } from './data/initialData';
import {
  resolveQuestCompletion,
  checkAndUnlockBadges,
  applyXpGain,
  LevelUpEvent,
} from './services/gameEngine';
import { determineAvatarFromStatsAndLevel } from './services/avatarSystem';
import { chiptune } from './services/audio';
import {
  saveUserStateToCloud,
  loadUserStateFromCloud,
  subscribeToUserState,
  checkUserHasClaimedUsername,
  syncPublicTrainerProfile,
  updateTrainerProfile,
  updateTrainerPresence,
  subscribeToIncomingChallenges,
  subscribeToOutgoingChallenges,
  acceptDuelChallengeAndStartBattle,
  respondToDuelChallenge,
  deleteDuelChallenge,
} from './services/firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AuthHomePage } from './components/auth/AuthHomePage';
import { ClaimUsernameModal } from './components/auth/ClaimUsernameModal';

import { TopBar } from './components/navigation/TopBar';
import { CommandNav, NavScreen } from './components/navigation/CommandNav';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { LevelUpModal } from './components/rpg/LevelUpModal';
import { RewardModal, RewardPayload } from './components/rpg/RewardModal';

import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { QuestBoardScreen } from './components/quests/QuestBoardScreen';
import { CharacterScreen } from './components/character/CharacterScreen';
import { ArenaScreen, convertChallengeToRival } from './components/arena/ArenaScreen';
import { DuelChallengeModal } from './components/arena/DuelChallengeModal';
import { AchievementsScreen } from './components/achievements/AchievementsScreen';
import { LeaderboardScreen } from './components/leaderboard/LeaderboardScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';

function LifeRpgApp() {
  const { firebaseUser, isVerified, loading: authLoading, signOutUser, updateUserDisplayName } = useAuth();
  const [gameState, setGameState] = useState<GameState>(() => loadGameState());
  const [currentScreen, setCurrentScreen] = useState<NavScreen>('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Unique username verification & claim status across all accounts
  const [hasClaimedUsername, setHasClaimedUsername] = useState<boolean | null>(null);
  const [checkingUsernameStatus, setCheckingUsernameStatus] = useState<boolean>(true);

  // Incoming duel challenges for live arena notifications and modals
  const [incomingDuelChallenges, setIncomingDuelChallenges] = useState<DuelChallenge[]>([]);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState<boolean>(false);
  const [pendingInitialBattle, setPendingInitialBattle] = useState<{ battleId: string; rival: Rival } | null>(null);
  const prevChallengesCountRef = useRef<number>(0);

  // Modals
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);
  const [activeReward, setActiveReward] = useState<RewardPayload | null>(null);

  // Guards against race conditions, blank-state overwrites, and circular saves
  const isHydratedRef = useRef(false);
  const isRemoteSyncingRef = useRef(false);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);

  // UNIFIED AUTH & CLOUD STATE HYDRATION
  // Guarantees cloud state is fully checked and loaded BEFORE any auto-saving can occur
  useEffect(() => {
    let isMounted = true;

    if (!firebaseUser) {
      isHydratedRef.current = false;
      isRemoteSyncingRef.current = false;
      setHasClaimedUsername(null);
      setCheckingUsernameStatus(false);
      setIsDataLoading(false);
      setGameState(createInitialState('Trainer', 'user_guest'));
      return;
    }

    const uid = firebaseUser.uid;
    const email = firebaseUser.email;

    isHydratedRef.current = false;
    isRemoteSyncingRef.current = true;
    setIsDataLoading(true);
    setCheckingUsernameStatus(true);

    // 1. Instantly load local cache if available for fast initial rendering
    const cachedLocal = loadGameState(uid);
    const guestState = loadGameState('user_guest');
    const cleanEmail = email ? email.toLowerCase().trim() : '';
    const emailPrefix = cleanEmail ? cleanEmail.split('@')[0].toLowerCase() : '';

    const isCleanTrainerName = (val: string | null | undefined): boolean => {
      if (!val) return false;
      const t = val.trim();
      if (!t || t === 'Trainer') return false;
      if (emailPrefix && t.toLowerCase() === emailPrefix) return false;
      return true;
    };

    const storedTrainerNameByEmail = cleanEmail && typeof window !== 'undefined'
      ? (localStorage.getItem(`liferpg_trainer_name_email_${cleanEmail}`) ||
         localStorage.getItem(`liferpg_trainer_name_${cleanEmail}`))
      : null;
    const storedClaimedByEmail = cleanEmail && typeof window !== 'undefined'
      ? (localStorage.getItem(`liferpg_claimed_email_${cleanEmail}`) === 'true' ||
         localStorage.getItem(`liferpg_username_claimed_email_${cleanEmail}`) === 'true')
      : false;

    const storedTrainerNameByUid = typeof window !== 'undefined' ? localStorage.getItem(`liferpg_trainer_name_${uid}`) : null;
    const storedTrainerName = storedTrainerNameByEmail || storedTrainerNameByUid;

    // Resolve an established trainer name from available user sources (never defaulting to email prefix)
    const candidateUsername =
      (storedTrainerName && isCleanTrainerName(storedTrainerName) ? storedTrainerName : null) ||
      (firebaseUser.displayName?.trim() && isCleanTrainerName(firebaseUser.displayName) ? firebaseUser.displayName.trim() : null) ||
      (cachedLocal.user?.username && isCleanTrainerName(cachedLocal.user.username) ? cachedLocal.user.username : null) ||
      (guestState.user?.username && isCleanTrainerName(guestState.user.username) ? guestState.user.username : null) ||
      'Trainer';

    // Fast initial local display with resolved trainer name
    const initialLocalWithResolvedName: GameState = {
      ...cachedLocal,
      user: {
        ...cachedLocal.user,
        id: uid,
        username: isCleanTrainerName(cachedLocal.user?.username) ? cachedLocal.user.username : candidateUsername,
      },
      hasClaimedUsername: true,
    };
    setGameState(initialLocalWithResolvedName);
    setHasClaimedUsername(true);

    // 2. Fetch authoritative cloud state (checks by UID and falls back to email)
    loadUserStateFromCloud(uid, email)
      .then((cloudState) => {
        if (!isMounted) return;

        if (cloudState && cloudState.user) {
          // Existing cloud account found! Hydrate state with full user data
          const cloudName = cloudState.user?.username;
          const finalUsername =
            (cloudName && isCleanTrainerName(cloudName))
              ? cloudName
              : (candidateUsername && candidateUsername !== 'Trainer' ? candidateUsername : (cloudName || 'Trainer'));

          const base = createInitialState(finalUsername, uid);
          const user = { ...base.user, ...cloudState.user, id: uid, username: finalUsername };

          const { maxHp, maxStamina } = deriveMaxVitals(
            user.attributes?.end || 0,
            user.attributes?.dis || 0,
            user.level || 1,
            user.attributes?.wil || 0,
            user.attributes?.res || 0
          );
          user.maxHp = maxHp;
          user.maxStamina = maxStamina;

          // Dynamically compute avatar & archetype from user stats and level
          const avatarProfile = determineAvatarFromStatsAndLevel(user.attributes || base.user.attributes, user.level || 1);
          user.avatarId = avatarProfile.avatarId;
          user.specialization = avatarProfile.archetype;

          const hydrated: GameState = {
            ...base,
            ...cloudState,
            user,
            quests: cloudState.quests || [],
            items: INITIAL_ITEMS,
            battleHistory: cloudState.battleHistory || [],
            hasClaimedUsername: true,
          };

          setGameState(hydrated);
          saveGameState(hydrated, uid);
          setHasClaimedUsername(true);

          if (typeof window !== 'undefined' && finalUsername && finalUsername !== 'Trainer') {
            localStorage.setItem(`liferpg_trainer_name_${uid}`, finalUsername);
            if (cleanEmail) {
              localStorage.setItem(`liferpg_trainer_name_email_${cleanEmail}`, finalUsername);
            }
            localStorage.setItem(`liferpg_username_claimed_${uid}`, 'true');
          }

          // Sync public trainer profile
          const completedCount = (hydrated.quests || []).filter((q) => q.status === 'COMPLETED').length;
          syncPublicTrainerProfile(
            uid,
            user,
            completedCount,
            hydrated.defeatedRivalsCount || 0
          ).catch((e) => console.warn('Public trainer sync:', e));
        } else {
          // No cloud document exists yet: initialize with our established candidate username and seed cloud
          const base = createInitialState(candidateUsername, uid);
          const stateWithUid: GameState = {
            ...base,
            ...cachedLocal,
            user: {
              ...base.user,
              ...cachedLocal.user,
              id: uid,
              username: candidateUsername,
            },
            hasClaimedUsername: true,
          };

          setGameState(stateWithUid);
          saveGameState(stateWithUid, uid);
          setHasClaimedUsername(true);

          if (typeof window !== 'undefined') {
            localStorage.setItem(`liferpg_trainer_name_${uid}`, candidateUsername);
            localStorage.setItem(`liferpg_username_claimed_${uid}`, 'true');
          }

          saveUserStateToCloud(uid, stateWithUid, email).catch((err) =>
            console.warn('Initial cloud seed error:', err)
          );
        }
      })
      .catch((err) => {
        console.warn('Failed to load cloud state:', err);
        if (!isMounted) return;
        setHasClaimedUsername(true);
      })
      .finally(() => {
        if (!isMounted) return;
        setCheckingUsernameStatus(false);
        setIsDataLoading(false);
        // Enable auto-saving now that initial cloud load is complete!
        setTimeout(() => {
          if (isMounted) {
            isHydratedRef.current = true;
            isRemoteSyncingRef.current = false;
          }
        }, 150);
      });

    return () => {
      isMounted = false;
    };
  }, [firebaseUser?.uid, firebaseUser?.email]);

  // Real-time synchronization across devices (only after claimed and hydrated)
  useEffect(() => {
    if (!firebaseUser?.uid || !hasClaimedUsername) {
      return;
    }

    let isMounted = true;
    const uid = firebaseUser.uid;

    const unsubscribe = subscribeToUserState(
      uid,
      (remoteState) => {
        if (!isMounted || !remoteState || !remoteState.user) return;
        // Flag to prevent echoing the remote state back to the cloud
        isRemoteSyncingRef.current = true;

        const base = createInitialState('Trainer', uid);
        const user = { ...base.user, ...remoteState.user, id: uid };
        const { maxHp, maxStamina } = deriveMaxVitals(
          user.attributes?.end || 0,
          user.attributes?.dis || 0,
          user.level || 1,
          user.attributes?.wil || 0,
          user.attributes?.res || 0
        );
        user.maxHp = maxHp;
        user.maxStamina = maxStamina;

        const synced: GameState = {
          ...base,
          ...remoteState,
          user,
          quests: remoteState.quests || [],
          items: INITIAL_ITEMS,
          battleHistory: remoteState.battleHistory || [],
          hasClaimedUsername: true,
        };

        setGameState(synced);
        saveGameState(synced, uid);

        setTimeout(() => {
          if (isMounted) {
            isRemoteSyncingRef.current = false;
          }
        }, 300);
      },
      (err) => {
        console.warn('Realtime subscription notification:', err);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [firebaseUser?.uid, hasClaimedUsername]);

  // Continuous app-wide online presence tracking for authenticated trainers
  useEffect(() => {
    if (!firebaseUser?.uid || !hasClaimedUsername) return;
    const uid = firebaseUser.uid;

    // Immediately mark as online upon authentication
    updateTrainerPresence(uid, true);

    // Heartbeat every 30 seconds while the application is active
    const heartbeatInterval = setInterval(() => {
      updateTrainerPresence(uid, true);
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateTrainerPresence(uid, true);
      }
    };

    const handleBeforeUnload = () => {
      updateTrainerPresence(uid, false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updateTrainerPresence(uid, false);
    };
  }, [firebaseUser?.uid, hasClaimedUsername]);

  // App-wide listener for incoming challenges to alert user and badge the Arena tab
  useEffect(() => {
    if (!firebaseUser?.uid || !hasClaimedUsername) {
      setIncomingDuelChallenges([]);
      setIsChallengeModalOpen(false);
      prevChallengesCountRef.current = 0;
      return;
    }

    const unsub = subscribeToIncomingChallenges(
      firebaseUser.uid,
      (challenges) => {
        setIncomingDuelChallenges(challenges);
        if (challenges.length > prevChallengesCountRef.current) {
          chiptune.playLevelUp();
          setIsChallengeModalOpen(true);
        }
        prevChallengesCountRef.current = challenges.length;
      },
      (err) => {
        console.warn('App challenges listener error:', err);
      }
    );

    return () => unsub();
  }, [firebaseUser?.uid, hasClaimedUsername]);

  const handleAcceptDuelChallenge = async (challenge: DuelChallenge) => {
    chiptune.playLevelUp();
    try {
      const battleId = await acceptDuelChallengeAndStartBattle(challenge, gameState.user);
      const rival = convertChallengeToRival(challenge, gameState.user.level);
      setPendingInitialBattle({
        battleId,
        rival,
      });
      setCurrentScreen('arena');
      setIsChallengeModalOpen(false);
    } catch (err: any) {
      console.error('Failed to accept duel challenge:', err);
      throw err;
    }
  };

  const handleDeclineDuelChallenge = async (challenge: DuelChallenge) => {
    chiptune.playCursor();
    try {
      await respondToDuelChallenge(challenge.id, false);
      setIncomingDuelChallenges((prev) => prev.filter((c) => c.id !== challenge.id));
    } catch (err: any) {
      console.error('Failed to decline duel challenge:', err);
      throw err;
    }
  };

  // App-wide listener for outgoing challenges (if opponent accepts while browsing other screens, take user to Arena)
  useEffect(() => {
    if (!firebaseUser?.uid || !hasClaimedUsername) return;

    const unsub = subscribeToOutgoingChallenges(
      firebaseUser.uid,
      (outgoing) => {
        const accepted = outgoing.find((c) => c.status === 'ACCEPTED' && c.battleId);
        if (accepted) {
          setCurrentScreen((prev) => {
            if (prev !== 'arena') {
              chiptune.playLevelUp();
              return 'arena';
            }
            return prev;
          });
        }
      },
      (err) => {
        console.warn('App outgoing challenges listener notice:', err);
      }
    );

    return () => unsub();
  }, [firebaseUser?.uid, hasClaimedUsername]);

  // Persist local state and push to Firestore when authenticated & claimed username
  useEffect(() => {
    saveGameState(gameState, firebaseUser?.uid);

    // CRITICAL GUARD: Only save to Firestore if:
    // 1. Authenticated user exists
    // 2. Initial cloud hydration has completed (isHydratedRef.current === true)
    // 3. We are not actively receiving a remote update
    // 4. Username has been claimed
    // 5. GameState belongs to the current user
    if (
      firebaseUser &&
      hasClaimedUsername &&
      isHydratedRef.current &&
      !isRemoteSyncingRef.current &&
      gameState.user &&
      gameState.user.id === firebaseUser.uid
    ) {
      saveUserStateToCloud(firebaseUser.uid, gameState, firebaseUser.email);
    }
  }, [gameState, firebaseUser?.uid, hasClaimedUsername]);

  // Audio setup according to settings
  useEffect(() => {
    chiptune.isEnabled = gameState.settings.soundEnabled;
  }, [gameState.settings.soundEnabled]);

  // Helper to trigger badge unlock checks
  const runBadgeChecks = (state: GameState) => {
    const { updatedBadges, newlyUnlocked } = checkAndUnlockBadges(state);
    if (newlyUnlocked.length > 0) {
      newlyUnlocked.forEach((b) => {
        state = {
          ...state,
          user: {
            ...state.user,
            xp: state.user.xp + (b.xpReward || 60),
          },
        };
      });
      state = { ...state, badges: updatedBadges };
    }
    return { state, newlyUnlocked };
  };

  // Onboarding Complete handler
  const handleOnboardingComplete = (username: string) => {
    const freshState = initializeNewGame(username);
    setGameState(freshState);
    setCurrentScreen('dashboard');
  };

  // Complete a Quest
  const handleCompleteQuest = (questId: string) => {
    const { updatedUser, updatedQuest, levelUpEvent: lvlEvt } = resolveQuestCompletion(
      gameState.user,
      gameState.quests,
      questId
    );

    const updatedQuests = gameState.quests.map((q) => (q.id === questId ? updatedQuest : q));
    let nextState: GameState = {
      ...gameState,
      user: updatedUser,
      quests: updatedQuests,
    };

    const { state: evaluatedState, newlyUnlocked } = runBadgeChecks(nextState);
    nextState = evaluatedState;

    setGameState(nextState);

    setActiveReward({
      title: 'QUEST CLEARED!',
      subtitle: updatedQuest.title,
      xp: updatedQuest.xpReward,
      statGains: updatedQuest.attributeRewards,
      unlockedBadge: newlyUnlocked[0] || undefined,
    });

    if (lvlEvt) {
      setTimeout(() => {
        setLevelUpEvent(lvlEvt);
      }, 500);
    }
  };

  // Create a Custom Quest
  const handleCreateQuest = (newQuestData: Omit<Quest, 'id' | 'status' | 'completedAt'>) => {
    const newQuest: Quest = {
      ...newQuestData,
      id: `quest-custom-${Date.now()}`,
      status: 'ACTIVE',
    };

    setGameState((prev) => ({
      ...prev,
      quests: [newQuest, ...prev.quests],
    }));
  };

  // Delete / Abandon Quest
  const handleDeleteQuest = (questId: string) => {
    setGameState((prev) => ({
      ...prev,
      quests: prev.quests.filter((q) => q.id !== questId),
    }));
  };

  // Allocate Stat Point
  const handleAllocateStatPoint = (attr: AttributeType) => {
    if (gameState.user.statPoints <= 0) return;

    const currentVal = gameState.user.attributes[attr] || 0;
    const newAttributes = {
      ...gameState.user.attributes,
      [attr]: currentVal + 1,
    };

    const { maxHp, maxStamina } = deriveMaxVitals(
      newAttributes.end,
      newAttributes.dis,
      gameState.user.level,
      newAttributes.wil,
      newAttributes.res
    );

    // Dynamically change avatar and class based on updated stats and level
    const avatarProfile = determineAvatarFromStatsAndLevel(newAttributes, gameState.user.level);

    const updatedUser = {
      ...gameState.user,
      statPoints: gameState.user.statPoints - 1,
      attributes: newAttributes,
      avatarId: avatarProfile.avatarId,
      specialization: avatarProfile.archetype,
      maxHp,
      maxStamina,
      hp: Math.min(gameState.user.hp + 2, maxHp),
      stamina: Math.min(gameState.user.stamina + 2, maxStamina),
    };

    let nextState: GameState = {
      ...gameState,
      user: updatedUser,
    };

    const { state: evaluatedState } = runBadgeChecks(nextState);
    setGameState(evaluatedState);
    chiptune.playLevelUp();
  };

  // Use Consumable Item
  const handleUseConsumable = (itemId: string): boolean => {
    const item = gameState.items.find((i) => i.id === itemId);
    const invItem = gameState.inventory.find((i) => i.itemId === itemId && i.quantity > 0);

    if (!item || !invItem) return false;

    let updatedUser = { ...gameState.user };

    if (item.consumableEffect) {
      if (item.consumableEffect.hp) {
        updatedUser.hp = Math.min(updatedUser.hp + item.consumableEffect.hp, updatedUser.maxHp);
      }
      if (item.consumableEffect.stamina) {
        updatedUser.stamina = Math.min(updatedUser.stamina + item.consumableEffect.stamina, updatedUser.maxStamina);
      }
    }

    const updatedInventory = gameState.inventory
      .map((i) => {
        if (i.itemId === itemId) {
          return { ...i, quantity: i.quantity - 1 };
        }
        return i;
      })
      .filter((i) => i.quantity > 0);

    setGameState((prev) => ({
      ...prev,
      user: updatedUser,
      inventory: updatedInventory,
    }));

    chiptune.playHeal();
    return true;
  };

  // Battle Victory
  const handleBattleVictory = (rival: Rival, customDetails?: string) => {
    const { updatedUser: xpUser, levelUpEvent: lvlEvt } = applyXpGain(
      gameState.user,
      rival.winRewardXp
    );

    const currentStreak = gameState.user.arenaStreak ?? 0;
    const newStreak = currentStreak > 0 ? currentStreak + 1 : 1;
    const newWins = (gameState.user.arenaWins ?? 0) + 1;

    let updatedUser = { ...xpUser };
    updatedUser.hp = updatedUser.maxHp;
    updatedUser.stamina = updatedUser.maxStamina;
    updatedUser.arenaStreak = newStreak;
    updatedUser.arenaWins = newWins;
    updatedUser.arenaLosses = gameState.user.arenaLosses ?? 0;

    const newRecord: BattleRecord = {
      id: `battle-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      rivalId: rival.id,
      rivalName: rival.username,
      rivalAvatarId: rival.avatarId,
      rivalLevel: rival.level,
      rivalTitle: rival.title,
      result: 'VICTORY',
      date: new Date().toISOString(),
      xpEarned: rival.winRewardXp,
      details: customDetails || `Victoriously outmatched ${rival.username} (LV. ${rival.level}) in arena stat duel.`,
    };

    const nextState: GameState = {
      ...gameState,
      user: updatedUser,
      defeatedRivalsCount: (gameState.defeatedRivalsCount || 0) + 1,
      battleHistory: [newRecord, ...(gameState.battleHistory || [])],
    };

    const { state: evaluatedState, newlyUnlocked } = runBadgeChecks(nextState);
    setGameState(evaluatedState);

    // Sync public trainer profile so arena streak is immediately live on leaderboard
    const completedCount = (evaluatedState.quests || []).filter((q) => q.status === 'COMPLETED').length;
    syncPublicTrainerProfile(
      evaluatedState.user.id,
      evaluatedState.user,
      completedCount,
      evaluatedState.defeatedRivalsCount || 0
    ).catch((e) => console.warn('Public trainer sync:', e));

    setActiveReward({
      title: 'ARENA VICTORY!',
      subtitle: `Defeated ${rival.username}! Current Arena Streak: +${newStreak} 🔥`,
      xp: rival.winRewardXp,
      unlockedBadge: newlyUnlocked[0] || undefined,
    });

    if (lvlEvt) {
      setTimeout(() => {
        setLevelUpEvent(lvlEvt);
      }, 600);
    }

    setCurrentScreen('arena');
  };

  // Battle Defeat
  const handleBattleDefeat = (rival?: Rival, customDetails?: string) => {
    const currentStreak = gameState.user.arenaStreak ?? 0;
    const newStreak = currentStreak < 0 ? currentStreak - 1 : -1;
    const newLosses = (gameState.user.arenaLosses ?? 0) + 1;

    const updatedUser = {
      ...gameState.user,
      hp: Math.floor(gameState.user.maxHp * 0.5),
      stamina: Math.floor(gameState.user.maxStamina * 0.5),
      arenaStreak: newStreak,
      arenaLosses: newLosses,
      arenaWins: gameState.user.arenaWins ?? 0,
    };

    const newRecord: BattleRecord | null = rival
      ? {
          id: `battle-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          rivalId: rival.id,
          rivalName: rival.username,
          rivalAvatarId: rival.avatarId,
          rivalLevel: rival.level,
          rivalTitle: rival.title,
          result: 'DEFEAT',
          date: new Date().toISOString(),
          xpEarned: 0,
          details: customDetails || `Defeated by ${rival.username} (LV. ${rival.level}). Rebuild discipline to break the streak.`,
        }
      : null;

    const nextState: GameState = {
      ...gameState,
      user: updatedUser,
      battleHistory: newRecord
        ? [newRecord, ...(gameState.battleHistory || [])]
        : (gameState.battleHistory || []),
    };

    setGameState(nextState);

    // Sync public trainer profile so arena streak is immediately live on leaderboard
    const completedCount = (nextState.quests || []).filter((q) => q.status === 'COMPLETED').length;
    syncPublicTrainerProfile(
      nextState.user.id,
      nextState.user,
      completedCount,
      nextState.defeatedRivalsCount || 0
    ).catch((e) => console.warn('Public trainer sync:', e));

    setCurrentScreen('arena');
  };

  // Battle Fled / Run
  const handleBattleRun = (rival?: Rival) => {
    if (!rival) return;
    const newRecord: BattleRecord = {
      id: `battle-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      rivalId: rival.id,
      rivalName: rival.username,
      rivalAvatarId: rival.avatarId,
      rivalLevel: rival.level,
      rivalTitle: rival.title,
      result: 'FLED',
      date: new Date().toISOString(),
      xpEarned: 0,
      details: `Tactically retreated from combat with ${rival.username}.`,
    };
    setGameState((prev) => ({
      ...prev,
      battleHistory: [newRecord, ...(prev.battleHistory || [])],
    }));
  };

  // Settings update
  const handleUpdateSettings = (newSettings: Partial<GameSettings>) => {
    setGameState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...newSettings,
      },
    }));
  };

  // Trainer profile (username & tagline) update - Username is trainer name itself across the application
  const handleUpdateUserProfile = async (updates: { username: string; title: string }) => {
    const cleanUsername = updates.username.trim();
    const cleanTitle = updates.title.trim() || 'Blank Slate & Pure Potential';

    if (firebaseUser) {
      const res = await updateTrainerProfile(
        firebaseUser.uid,
        cleanUsername,
        cleanTitle,
        gameState.user.username,
        firebaseUser.email
      );
      if (!res.success) {
        throw new Error(res.error || 'Failed to update profile.');
      }
      await updateUserDisplayName(cleanUsername);
    }

    // Persist trainer name to local storage keys immediately
    if (typeof window !== 'undefined') {
      try {
        if (firebaseUser?.uid) {
          localStorage.setItem(`liferpg_trainer_name_${firebaseUser.uid}`, cleanUsername);
        }
        const cleanEmail = (firebaseUser?.email || '').toLowerCase().trim();
        if (cleanEmail) {
          localStorage.setItem(`liferpg_trainer_name_email_${cleanEmail}`, cleanUsername);
          localStorage.setItem(`liferpg_trainer_name_${cleanEmail}`, cleanUsername);
        }
        localStorage.setItem('liferpg_trainer_name_user_player', cleanUsername);
        localStorage.setItem('liferpg_trainer_name_user_guest', cleanUsername);
        localStorage.setItem('liferpg_current_username', cleanUsername);
      } catch {
        // Ignore local storage error
      }
    }

    const updatedUser: User = {
      ...gameState.user,
      username: cleanUsername,
      title: cleanTitle,
      updatedAt: new Date().toISOString(),
    };

    const updatedState: GameState = {
      ...gameState,
      user: updatedUser,
      hasClaimedUsername: true,
    };

    setGameState(updatedState);
    saveGameState(updatedState);

    // Immediately push new trainer username and stats to Firestore publicTrainers
    const targetUid = firebaseUser?.uid || gameState.user.id || 'user_player';
    const completedQuests = (gameState.quests || []).filter((q) => q.status === 'COMPLETED').length;

    syncPublicTrainerProfile(
      targetUid,
      updatedUser,
      completedQuests,
      gameState.defeatedRivalsCount || 0
    ).catch(() => {});

    if (firebaseUser) {
      saveUserStateToCloud(targetUid, updatedState, firebaseUser.email).catch(() => {});
    }
  };

  // Reset Game
  const handleResetGame = () => {
    const fresh = resetGameState();
    setGameState(fresh);
    setCurrentScreen('dashboard');
  };

  // Export Save
  const handleExportSave = () => {
    return JSON.stringify(gameState, null, 2);
  };

  // Import Save
  const handleImportSave = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.user && parsed.quests && parsed.inventory) {
        setGameState(parsed);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Handle unique username claim & starter character creation
  const handleClaimSuccess = async (
    username: string, 
    avatarId: string
  ) => {
    if (!firebaseUser) return;

    // Check if character already has existing progression to preserve
    const hasExistingProgress = Boolean(
      gameState.user && (
        (gameState.user.level && gameState.user.level > 1) ||
        (gameState.user.xp && gameState.user.xp > 0) ||
        (gameState.quests && gameState.quests.length > 0) ||
        (gameState.inventory && gameState.inventory.length > 0)
      )
    );

    let nextUser: User;
    let nextState: GameState;
    let starterWeaponName = 'Training Blade';

    if (hasExistingProgress) {
      // Retain all existing stats, quests, badges, and inventory; update username & avatar
      nextUser = {
        ...gameState.user,
        id: firebaseUser.uid,
        username: username,
        avatarId: avatarId,
        updatedAt: new Date().toISOString(),
      };
      nextState = {
        ...gameState,
        user: nextUser,
        hasClaimedUsername: true,
      };
    } else {
      // Fresh new trainer setup
      const arch = ARCHETYPES.ADVENTURER;
      const initialAttrs = arch.initialAttributes;
      const { maxHp, maxStamina } = deriveMaxVitals(
        initialAttrs.end,
        initialAttrs.dis,
        1,
        initialAttrs.wil,
        initialAttrs.res
      );

      nextUser = {
        id: firebaseUser.uid,
        username: username,
        title: arch.role,
        level: 1,
        xp: 0,
        maxXp: 100,
        hp: maxHp,
        maxHp: maxHp,
        stamina: maxStamina,
        maxStamina: maxStamina,
        specialization: arch.id,
        avatarId: avatarId,
        streak: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        statPoints: 0,
        attributes: initialAttrs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const starterWeapon = INITIAL_ITEMS.find((it) => it.id === arch.starterWeaponId) || INITIAL_ITEMS[0];
      starterWeaponName = starterWeapon.name;
      const starterPotion = INITIAL_ITEMS.find((it) => it.id === 'item-potion-minor') || INITIAL_ITEMS[2];

      const inventory: InventoryItem[] = [
        {
          id: `inv-${Date.now()}-1`,
          itemId: starterWeapon.id,
          quantity: 1,
        },
        {
          id: `inv-${Date.now()}-2`,
          itemId: starterPotion.id,
          quantity: 2,
        },
      ];

      nextState = {
        user: nextUser,
        inventory,
        items: INITIAL_ITEMS,
        quests: [],
        badges: INITIAL_BADGES,
        rivals: [],
        settings: {
          soundEnabled: true,
          crtFilterEnabled: false,
          gameboyFilterEnabled: false,
          reducedMotion: false,
        },
        hasCompletedOnboarding: true,
        hasClaimedUsername: true,
        defeatedRivalsCount: 0,
        battleHistory: [],
      };
    }

    setGameState(nextState);
    saveGameState(nextState, firebaseUser.uid);
    setHasClaimedUsername(true);
    isHydratedRef.current = true;

    if (typeof window !== 'undefined') {
      const cleanEmail = firebaseUser.email ? firebaseUser.email.toLowerCase().trim() : '';
      if (cleanEmail) {
        localStorage.setItem(`liferpg_trainer_name_email_${cleanEmail}`, username);
        localStorage.setItem(`liferpg_username_claimed_email_${cleanEmail}`, 'true');
        localStorage.setItem(`liferpg_claimed_email_${cleanEmail}`, 'true');
      }
      localStorage.setItem(`liferpg_trainer_name_${firebaseUser.uid}`, username);
      localStorage.setItem(`liferpg_username_claimed_${firebaseUser.uid}`, 'true');
    }

    try {
      await saveUserStateToCloud(firebaseUser.uid, nextState, firebaseUser.email);
      const completedCount = (nextState.quests || []).filter((q) => q.status === 'COMPLETED').length;
      await syncPublicTrainerProfile(
        firebaseUser.uid,
        nextUser,
        completedCount,
        nextState.defeatedRivalsCount || 0,
        starterWeaponName
      );
    } catch (e) {
      console.error('Failed to initialize cloud state:', e);
    }
  };

  const activeQuestsCount = gameState.quests.filter((q) => q.status === 'ACTIVE').length;

  // 1. Loading screen while auth or username archives are verified
  if (authLoading || (firebaseUser && (checkingUsernameStatus || isDataLoading))) {
    return (
      <div className="min-h-screen bg-[#0f0c1a] flex flex-col items-center justify-center font-silkscreen text-[#f4eee3] p-4 select-none">
        <div className="w-12 h-12 bg-[#e43b44] border-2 border-[#fff] flex items-center justify-center mb-3 animate-pulse shadow-[4px_4px_0px_#000]">
          <span className="font-pixel text-lg text-white font-bold">L</span>
        </div>
        <div className="font-pixel text-xs text-[#fec83e] animate-pulse">
          CONNECTING TO REALM ARCHIVES...
        </div>
        <p className="font-silkscreen text-xs text-[#8f85a3] mt-2 text-center">
          Verifying trainer accounts & arena records
        </p>
      </div>
    );
  }

  // 2. Unauthenticated: Home page is strictly the Sign in / Log in Page
  if (!firebaseUser) {
    return <AuthHomePage />;
  }

  // 3. Authenticated: Only prompt if user has no assigned username whatsoever
  // Check if this email has already established or claimed a trainer name previously
  const cleanEmail = firebaseUser.email ? firebaseUser.email.toLowerCase().trim() : '';
  const isEmailAlreadyClaimed = cleanEmail && typeof window !== 'undefined' && (
    localStorage.getItem(`liferpg_claimed_email_${cleanEmail}`) === 'true' ||
    localStorage.getItem(`liferpg_username_claimed_email_${cleanEmail}`) === 'true' ||
    Boolean(localStorage.getItem(`liferpg_trainer_name_email_${cleanEmail}`))
  );

  const needsUsernameClaim = !isEmailAlreadyClaimed && !hasClaimedUsername && (!gameState.user?.username || gameState.user.username === 'Trainer');
  if (needsUsernameClaim) {
    return (
      <ClaimUsernameModal
        userId={firebaseUser.uid}
        currentUsername={firebaseUser.displayName || ''}
        onClaimSuccess={handleClaimSuccess}
        onSignOut={signOutUser}
      />
    );
  }

  // 4. Authenticated & Claimed: Full Life RPG Application
  return (
    <div
      className={`min-h-screen bg-[#0f0c1a] text-[#f4eee3] flex flex-col font-silkscreen ${
        gameState.settings.crtFilterEnabled ? 'crt-scanlines' : ''
      }`}
    >
      {/* AUTH MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* ONBOARDING MODAL IF BRAND NEW TRAINER */}
      {!gameState.hasCompletedOnboarding && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}

      {/* LEVEL UP CELEBRATION MODAL */}
      {levelUpEvent && (
        <LevelUpModal
          event={levelUpEvent}
          onClose={() => setLevelUpEvent(null)}
        />
      )}

      {/* REWARD / QUEST COMPLETION MODAL */}
      {activeReward && (
        <RewardModal
          reward={activeReward}
          onClose={() => setActiveReward(null)}
        />
      )}

      {/* INCOMING DUEL CHALLENGE PROMPT MODAL */}
      {isChallengeModalOpen && incomingDuelChallenges.length > 0 && (
        <DuelChallengeModal
          challenges={incomingDuelChallenges}
          currentUser={gameState.user}
          onAccept={handleAcceptDuelChallenge}
          onDecline={handleDeclineDuelChallenge}
          onClose={() => setIsChallengeModalOpen(false)}
        />
      )}

      {/* TOP STATUS BAR WITH USER AUTH & CLOUD WIDGET */}
      <TopBar
        user={gameState.user}
        settings={gameState.settings}
        onUpdateSettings={handleUpdateSettings}
        onNavigate={(screen) => setCurrentScreen(screen as NavScreen)}
        activeTab={currentScreen}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* TOP NOTIFICATION BANNER FOR LIVE DUEL CHALLENGE */}
      {incomingDuelChallenges.length > 0 && (
        <div className="max-w-7xl w-full mx-auto px-2 sm:px-4 pt-2">
          <div className="bg-[#fffbeb] border-4 border-[#dc2626] p-3 shadow-[4px_4px_0px_#120e1d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-[#dc2626] animate-ping shrink-0" />
              <div>
                <div className="font-pixel text-xs sm:text-sm text-[#991b1b] font-bold flex items-center gap-2">
                  <span>⚔ LIVE ARENA CHALLENGE RECEIVED!</span>
                  {incomingDuelChallenges.length > 1 && (
                    <span className="bg-[#dc2626] text-white text-[10px] px-1.5 py-0.5">
                      +{incomingDuelChallenges.length - 1} MORE
                    </span>
                  )}
                </div>
                <div className="font-silkscreen text-[11px] text-[#7f1d1d] mt-0.5">
                  Trainer <span className="font-bold">{incomingDuelChallenges[0].challengerName}</span> (Lv.{incomingDuelChallenges[0].challengerLevel}) challenges you to an online duel!
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={() => handleAcceptDuelChallenge(incomingDuelChallenges[0])}
                className="flex-1 sm:flex-initial font-pixel text-xs bg-[#16a34a] hover:bg-[#15803d] text-white px-3 sm:px-4 py-2 border-2 border-[#14532d] shadow-[2px_2px_0px_#000] cursor-pointer"
              >
                ⚔ ACCEPT & PLAY ▶
              </button>
              <button
                onClick={() => handleDeclineDuelChallenge(incomingDuelChallenges[0])}
                className="flex-1 sm:flex-initial font-pixel text-xs bg-[#1f2937] hover:bg-[#111827] text-white px-3 sm:px-4 py-2 border-2 border-[#000] shadow-[2px_2px_0px_#000] cursor-pointer"
              >
                ✕ DECLINE
              </button>
              <button
                onClick={() => {
                  chiptune.playSelect();
                  setIsChallengeModalOpen(true);
                }}
                className="font-pixel text-xs bg-[#e5e7eb] hover:bg-[#d1d5db] text-[#1f2937] px-2.5 py-2 border-2 border-[#9ca3af] shadow-[2px_2px_0px_#000] cursor-pointer"
                title="View Challenger Profile"
              >
                👁 DETAILS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT WITH DESKTOP COMMAND MENU + CONTENT CANVAS */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 pb-20 lg:pb-8 flex flex-col lg:flex-row gap-4">
        {/* DESKTOP COMMAND MENU */}
        <CommandNav
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          unallocatedPoints={gameState.user.statPoints}
          activeQuestsCount={activeQuestsCount}
          incomingChallengesCount={incomingDuelChallenges.length}
        />

        {/* SCREEN VIEWS */}
        <section className="flex-1 min-w-0" aria-label="Main Application Screen">
          {currentScreen === 'dashboard' && (
            <DashboardScreen
              user={gameState.user}
              quests={gameState.quests}
              badges={gameState.badges}
              items={gameState.items}
              inventory={gameState.inventory}
              onCompleteQuest={handleCompleteQuest}
              onNavigate={(s) => setCurrentScreen(s as NavScreen)}
            />
          )}

          {currentScreen === 'quests' && (
            <QuestBoardScreen
              quests={gameState.quests}
              onCompleteQuest={handleCompleteQuest}
              onCreateQuest={handleCreateQuest}
              onDeleteQuest={handleDeleteQuest}
            />
          )}

          {currentScreen === 'character' && (
            <CharacterScreen
              user={gameState.user}
              items={gameState.items}
              inventory={gameState.inventory}
              badges={gameState.badges}
              onAllocateStatPoint={handleAllocateStatPoint}
              onNavigate={(s) => setCurrentScreen(s as NavScreen)}
            />
          )}

          {(currentScreen === 'arena' || (currentScreen as string) === 'rivals' || (currentScreen as string) === 'battle') && (
            <ArenaScreen
              user={gameState.user}
              items={gameState.items}
              inventory={gameState.inventory}
              battleHistory={gameState.battleHistory || []}
              onVictory={handleBattleVictory}
              onDefeat={handleBattleDefeat}
              onRun={handleBattleRun}
              onUseItemInBattle={handleUseConsumable}
              initialBattleId={pendingInitialBattle?.battleId}
              initialBattleRival={pendingInitialBattle?.rival}
              onClearInitialBattle={() => setPendingInitialBattle(null)}
            />
          )}

          {currentScreen === 'achievements' && (
            <AchievementsScreen badges={gameState.badges} />
          )}

          {currentScreen === 'leaderboard' && (
            <LeaderboardScreen
              user={gameState.user}
              quests={gameState.quests}
              badges={gameState.badges}
            />
          )}

          {currentScreen === 'settings' && (
            <SettingsScreen
              settings={gameState.settings}
              user={gameState.user}
              onUpdateSettings={handleUpdateSettings}
              onUpdateUserProfile={handleUpdateUserProfile}
              onResetGame={handleResetGame}
              onExportSave={handleExportSave}
              onImportSave={handleImportSave}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="LIFE RPG APPLICATION RECOVERY">
      <AuthProvider>
        <LifeRpgApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
