import React, { useState, useEffect, useRef } from 'react';
import {
  GameState,
  AttributeType,
  Quest,
  Rival,
  GameSettings,
  BattleRecord,
} from './types';
import {
  loadGameState,
  saveGameState,
  resetGameState,
  initializeNewGame,
  deriveMaxVitals,
  createInitialState,
} from './services/storage';
import { INITIAL_ITEMS } from './data/initialData';
import {
  resolveQuestCompletion,
  checkAndUnlockBadges,
  applyXpGain,
  LevelUpEvent,
} from './services/gameEngine';
import { chiptune } from './services/audio';
import {
  saveUserStateToCloud,
  loadUserStateFromCloud,
  subscribeToUserState,
} from './services/firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/auth/AuthModal';

import { TopBar } from './components/navigation/TopBar';
import { CommandNav, NavScreen } from './components/navigation/CommandNav';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { LevelUpModal } from './components/rpg/LevelUpModal';
import { RewardModal, RewardPayload } from './components/rpg/RewardModal';

import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { QuestBoardScreen } from './components/quests/QuestBoardScreen';
import { CharacterScreen } from './components/character/CharacterScreen';
import { ArenaScreen } from './components/arena/ArenaScreen';
import { AchievementsScreen } from './components/achievements/AchievementsScreen';
import { LeaderboardScreen } from './components/leaderboard/LeaderboardScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';

function LifeRpgApp() {
  const { firebaseUser, isVerified } = useAuth();
  const [gameState, setGameState] = useState<GameState>(() => loadGameState());
  const [currentScreen, setCurrentScreen] = useState<NavScreen>('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Modals
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);
  const [activeReward, setActiveReward] = useState<RewardPayload | null>(null);

  // Avoid circular saves during remote cloud sync updates
  const isSyncingFromCloud = useRef(false);

  // CLOUD SYNC: Load & Subscribe to cloud state when user is authenticated & verified
  useEffect(() => {
    if (!firebaseUser || !isVerified) {
      return;
    }

    let isMounted = true;
    const uid = firebaseUser.uid;

    // Load initial cloud state
    loadUserStateFromCloud(uid)
      .then((cloudState) => {
        if (!isMounted) return;

        if (cloudState && cloudState.user) {
          isSyncingFromCloud.current = true;
          const base = createInitialState();
          const user = { ...base.user, ...cloudState.user };

          const { maxHp, maxStamina } = deriveMaxVitals(
            user.attributes?.end || 0,
            user.attributes?.dis || 0,
            user.level || 1,
            user.attributes?.wil || 0,
            user.attributes?.res || 0
          );
          user.maxHp = maxHp;
          user.maxStamina = maxStamina;

          const quests = (cloudState.quests || base.quests).map((q: any) => {
            const initQ = base.quests.find((bq) => bq.id === q.id);
            return initQ
              ? { ...q, deadline: q.deadline || initQ.deadline, isDaily: q.isDaily ?? initQ.isDaily }
              : q;
          });

          const hydrated: GameState = {
            ...base,
            ...cloudState,
            user,
            quests,
            items: INITIAL_ITEMS,
            battleHistory: cloudState.battleHistory || [],
          };

          setGameState(hydrated);
          saveGameState(hydrated);
          setTimeout(() => {
            isSyncingFromCloud.current = false;
          }, 300);
        } else {
          // Brand new cloud account: seed cloud with current state & username
          const updatedUser = {
            ...gameState.user,
            username: firebaseUser.displayName || gameState.user.username || 'Trainer',
          };
          const stateToSave: GameState = {
            ...gameState,
            user: updatedUser,
          };
          saveUserStateToCloud(uid, stateToSave, firebaseUser.email);
        }
      })
      .catch((err) => {
        console.error('Error fetching initial cloud state:', err);
      });

    // Real-time synchronization across all devices
    const unsubscribe = subscribeToUserState(
      uid,
      (remoteState) => {
        if (!isMounted || !remoteState || !remoteState.user) return;
        isSyncingFromCloud.current = true;

        const base = createInitialState();
        const user = { ...base.user, ...remoteState.user };
        const { maxHp, maxStamina } = deriveMaxVitals(
          user.attributes?.end || 0,
          user.attributes?.dis || 0,
          user.level || 1,
          user.attributes?.wil || 0,
          user.attributes?.res || 0
        );
        user.maxHp = maxHp;
        user.maxStamina = maxStamina;

        const quests = (remoteState.quests || base.quests).map((q: any) => {
          const initQ = base.quests.find((bq) => bq.id === q.id);
          return initQ
            ? { ...q, deadline: q.deadline || initQ.deadline, isDaily: q.isDaily ?? initQ.isDaily }
            : q;
        });

        const synced: GameState = {
          ...base,
          ...remoteState,
          user,
          quests,
          items: INITIAL_ITEMS,
          battleHistory: remoteState.battleHistory || [],
        };

        setGameState(synced);
        saveGameState(synced);

        setTimeout(() => {
          isSyncingFromCloud.current = false;
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
  }, [firebaseUser?.uid, isVerified]);

  // Persist local state and push to Firestore when authenticated & verified
  useEffect(() => {
    saveGameState(gameState);

    if (firebaseUser && isVerified && !isSyncingFromCloud.current) {
      saveUserStateToCloud(firebaseUser.uid, gameState, firebaseUser.email);
    }
  }, [gameState, firebaseUser?.uid, isVerified]);

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

    const updatedUser = {
      ...gameState.user,
      statPoints: gameState.user.statPoints - 1,
      attributes: newAttributes,
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

    if (item.statEffects) {
      if (item.statEffects.hp) {
        updatedUser.hp = Math.min(updatedUser.hp + item.statEffects.hp, updatedUser.maxHp);
      }
      if (item.statEffects.stamina) {
        updatedUser.stamina = Math.min(updatedUser.stamina + item.statEffects.stamina, updatedUser.maxStamina);
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
  const handleBattleVictory = (rival: Rival) => {
    const { updatedUser: xpUser, levelUpEvent: lvlEvt } = applyXpGain(
      gameState.user,
      rival.winRewardXp
    );

    let updatedUser = { ...xpUser };
    updatedUser.hp = updatedUser.maxHp;
    updatedUser.stamina = updatedUser.maxStamina;

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
      details: `Victoriously out-disciplined ${rival.username} (LV. ${rival.level}) in duel combat.`,
    };

    const nextState: GameState = {
      ...gameState,
      user: updatedUser,
      defeatedRivalsCount: (gameState.defeatedRivalsCount || 0) + 1,
      battleHistory: [newRecord, ...(gameState.battleHistory || [])],
    };

    const { state: evaluatedState, newlyUnlocked } = runBadgeChecks(nextState);
    setGameState(evaluatedState);

    setActiveReward({
      title: 'ARENA VICTORY!',
      subtitle: `Defeated ${rival.username}!`,
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
  const handleBattleDefeat = (rival?: Rival) => {
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
          details: `Defeated by ${rival.username} (LV. ${rival.level}). Rebuild resilience through daily habits.`,
        }
      : null;

    setGameState((prev) => ({
      ...prev,
      user: {
        ...prev.user,
        hp: Math.floor(prev.user.maxHp * 0.5),
        stamina: Math.floor(prev.user.maxStamina * 0.5),
      },
      battleHistory: newRecord
        ? [newRecord, ...(prev.battleHistory || [])]
        : (prev.battleHistory || []),
    }));
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

  const activeQuestsCount = gameState.quests.filter((q) => q.status === 'ACTIVE').length;

  return (
    <div
      className={`min-h-screen bg-[#0f0c1a] text-[#f4eee3] flex flex-col font-silkscreen ${
        gameState.settings.crtFilterEnabled ? 'crt-scanlines' : ''
      }`}
    >
      {/* AUTH MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen || (Boolean(firebaseUser) && !isVerified)}
        onClose={() => setIsAuthModalOpen(false)}
        forceVerificationBarrier={Boolean(firebaseUser) && !isVerified}
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

      {/* TOP STATUS BAR WITH USER AUTH & CLOUD WIDGET */}
      <TopBar
        user={gameState.user}
        settings={gameState.settings}
        onUpdateSettings={handleUpdateSettings}
        onNavigate={(screen) => setCurrentScreen(screen as NavScreen)}
        activeTab={currentScreen}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* MAIN LAYOUT WITH DESKTOP COMMAND MENU + CONTENT CANVAS */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 pb-20 lg:pb-8 flex flex-col lg:flex-row gap-4">
        {/* DESKTOP COMMAND MENU */}
        <CommandNav
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          unallocatedPoints={gameState.user.statPoints}
          activeQuestsCount={activeQuestsCount}
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
              onUpdateSettings={handleUpdateSettings}
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
    <AuthProvider>
      <LifeRpgApp />
    </AuthProvider>
  );
}
