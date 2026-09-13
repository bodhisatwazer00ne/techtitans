import React, { useState, useEffect, useMemo } from 'react';
import { User, Quest, Badge, PublicTrainer } from '../../types';
import { RpgWindow } from '../rpg/RpgWindow';
import { CharacterSprite } from '../rpg/CharacterSprite';
import { PixelIcon } from '../rpg/PixelIcon';
import { useAuth } from '../../context/AuthContext';
import { subscribeToPublicTrainers } from '../../services/firebase';
import { calculatePowerScaling } from '../../services/gameEngine';
import { Swords, Flame, Trophy, TrendingUp, TrendingDown, Zap } from 'lucide-react';

interface LeaderboardScreenProps {
  user: User;
  quests: Quest[];
  badges: Badge[];
}

interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  avatarId: string;
  title: string;
  specialization: string;
  level: number;
  streak: number;
  questsCleared: number;
  arenaStreak: number;
  arenaWins: number;
  arenaLosses: number;
  totalPower: number;
  tier: string;
  isPlayer?: boolean;
}

type LeaderboardTab = 'OVERALL' | 'ARENA_STREAK' | 'COMBAT_POWER';

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  user,
  quests,
}) => {
  const [realTrainers, setRealTrainers] = useState<PublicTrainer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('OVERALL');

  const completedQuestsCount = quests.filter((q) => q.status === 'COMPLETED').length;

  useEffect(() => {
    const unsub = subscribeToPublicTrainers(
      (trainers) => {
        setRealTrainers(trainers);
        setLoading(false);
      },
      (err) => {
        console.warn('Leaderboard public trainer subscription note:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const { firebaseUser } = useAuth();

  // Deduplicate entries by username and id, ensuring player is uniquely identified
  const isCurrentPlayer = (id: string, name: string) => {
    if (id === user.id || id === 'user_player' || id === 'user_guest') return true;
    if (firebaseUser?.uid && id === firebaseUser.uid) return true;
    const n = name.toLowerCase().trim();
    if (n === user.username.toLowerCase().trim()) return true;
    if (firebaseUser?.displayName && n === firebaseUser.displayName.toLowerCase().trim()) return true;
    const cleanEmail = (firebaseUser?.email || '').toLowerCase().trim();
    if (cleanEmail && n === cleanEmail.split('@')[0].toLowerCase().trim()) return true;
    return false;
  };

  // Filter out any realTrainers matching current player so current player is never duplicated
  const otherTrainers = realTrainers.filter(
    (t) => !isCurrentPlayer(t.userId, t.username)
  );

  const entriesMap = new Map<string, Omit<LeaderboardEntry, 'rank'>>();
  // Add other real Firestore trainers deduplicated by username
  for (const t of otherTrainers) {
    const key = t.username.toLowerCase().trim();
    if (!entriesMap.has(key)) {
      const power = calculatePowerScaling(t.level, t.attributes);
      entriesMap.set(key, {
        id: t.userId,
        name: t.username,
        avatarId: t.avatarId,
        title: t.title,
        specialization: t.specialization || 'ADVENTURER',
        level: t.level,
        streak: t.streak,
        questsCleared: t.questsCleared,
        arenaStreak: t.arenaStreak ?? 0,
        arenaWins: t.arenaWins ?? 0,
        arenaLosses: t.arenaLosses ?? 0,
        totalPower: power.totalPower,
        tier: power.tier,
        isPlayer: false,
      });
    }
  }

  // Add the player entry exactly once
  const playerPower = calculatePowerScaling(user.level, user.attributes);
  entriesMap.set(user.username.toLowerCase().trim(), {
    id: user.id,
    name: user.username,
    avatarId: user.avatarId,
    title: user.title,
    specialization: user.specialization,
    level: user.level,
    streak: user.streak,
    questsCleared: completedQuestsCount,
    arenaStreak: user.arenaStreak ?? 0,
    arenaWins: user.arenaWins ?? 0,
    arenaLosses: user.arenaLosses ?? 0,
    totalPower: playerPower.totalPower,
    tier: playerPower.tier,
    isPlayer: true,
  });

  const allEntries: Omit<LeaderboardEntry, 'rank'>[] = Array.from(entriesMap.values());

  // Sort based on active tab
  const sortedEntries: LeaderboardEntry[] = useMemo(() => {
    return allEntries
      .sort((a, b) => {
        if (activeTab === 'ARENA_STREAK') {
          return b.arenaStreak - a.arenaStreak || b.arenaWins - a.arenaWins || b.level - a.level;
        }
        if (activeTab === 'COMBAT_POWER') {
          return b.totalPower - a.totalPower || b.level - a.level;
        }
        // OVERALL tab
        return b.level - a.level || b.questsCleared - a.questsCleared || b.streak - a.streak;
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }, [allEntries, activeTab]);

  const playerRank = sortedEntries.find((e) => e.isPlayer)?.rank || 1;

  return (
    <div className="space-y-4 select-none">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#f5eedb] border-4 border-[#120e1d] p-4 shadow-[4px_4px_0px_#120e1d]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[10px] bg-[#241c38] text-[#fec83e] px-2 py-0.5 border border-[#120e1d]">
              RANKINGS
            </span>
            <h2 className="font-pixel text-base sm:text-lg text-[#181425]">
              GLOBAL REAL-WORLD TRAINER RANKINGS
            </h2>
          </div>
          <p className="font-silkscreen text-xs text-[#5e5443] mt-0.5">
            Public leaderboards showing trainer level, real-world habit consistency, combat power, and arena winning/losing streaks!
          </p>
        </div>

        <div className="font-pixel text-xs bg-[#241c38] text-[#fec83e] px-3 py-2 border-2 border-[#120e1d] shadow-[2px_2px_0px_#000]">
          YOUR STANDING: #{playerRank} OF {sortedEntries.length} PLAYERS
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-[#d4c5a9] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('OVERALL')}
          className={`font-pixel text-[11px] px-3 py-1.5 border-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'OVERALL'
              ? 'bg-[#241c38] text-[#fec83e] border-[#120e1d] shadow-[2px_2px_0px_#000]'
              : 'bg-[#ede3ce] text-[#2b2540] border-[#d4c5a9] hover:bg-[#dfd3bc]'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-[#fec83e]" />
          OVERALL LEVEL & QUESTS
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ARENA_STREAK')}
          className={`font-pixel text-[11px] px-3 py-1.5 border-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'ARENA_STREAK'
              ? 'bg-[#15803d] text-white border-[#12361d] shadow-[2px_2px_0px_#000]'
              : 'bg-[#ede3ce] text-[#2b2540] border-[#d4c5a9] hover:bg-[#dfd3bc]'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          ARENA STREAKS & CLASHES
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('COMBAT_POWER')}
          className={`font-pixel text-[11px] px-3 py-1.5 border-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'COMBAT_POWER'
              ? 'bg-[#b45309] text-white border-[#451a03] shadow-[2px_2px_0px_#000]'
              : 'bg-[#ede3ce] text-[#2b2540] border-[#d4c5a9] hover:bg-[#dfd3bc]'
          }`}
        >
          <Swords className="w-3.5 h-3.5 text-amber-300" />
          COMBAT POWER SCALING (6 STATS)
        </button>
      </div>

      {/* Leaderboard Table */}
      <RpgWindow variant="parchment" title="REAL TRAINERS HALL OF FAME">
        {loading ? (
          <div className="p-8 text-center font-pixel text-xs text-[#6b5c46] animate-pulse">
            LOADING REAL-TIME GLOBAL TRAINER RANKINGS...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-pixel text-xs">
              <thead>
                <tr className="bg-[#ede3ce] border-b-2 border-[#120e1d] text-left text-[10px] text-[#554a37]">
                  <th className="p-2.5">RANK</th>
                  <th className="p-2.5">TRAINER</th>
                  <th className="p-2.5 text-center">LEVEL</th>
                  <th className="p-2.5 text-center">COMBAT POWER</th>
                  <th className="p-2.5 text-center">ARENA STREAK</th>
                  <th className="p-2.5 text-center">HABIT STREAK</th>
                  <th className="p-2.5 text-right">QUESTS</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => {
                  const isPlayer = entry.isPlayer;

                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-[#d4c5a9] transition-colors ${
                        isPlayer
                          ? 'bg-[#fef9c3] font-bold border-l-4 border-l-[#ca8a04]'
                          : 'hover:bg-[#fcf8f0]'
                      }`}
                    >
                      {/* Rank */}
                      <td className="p-2.5">
                        <span
                          className={`inline-block w-6 h-6 leading-6 text-center text-[10px] border ${
                            entry.rank === 1
                              ? 'bg-[#fef08a] text-[#854d0e] border-[#ca8a04]'
                              : entry.rank === 2
                              ? 'bg-[#e2e8f0] text-[#334155] border-[#94a3b8]'
                              : entry.rank === 3
                              ? 'bg-[#fed7aa] text-[#7c2d12] border-[#ea580c]'
                              : 'bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1]'
                          }`}
                        >
                          #{entry.rank}
                        </span>
                      </td>

                      {/* Trainer Info */}
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-[#1e1832] border border-[#120e1d] p-0.5 shrink-0 flex items-center justify-center">
                            <CharacterSprite id={entry.avatarId} size={28} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#181425]">{entry.name}</span>
                              {isPlayer && (
                                <span className="text-[8px] bg-[#38b764] text-[#0d2a15] px-1 border border-[#257142]">
                                  YOU
                                </span>
                              )}
                            </div>
                            <span className="font-silkscreen text-[10px] text-[#6b5c46] block">
                              {entry.title}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Level */}
                      <td className="p-2.5 text-center">
                        <span className="text-[#1d4ed8] font-bold">LV. {entry.level}</span>
                      </td>

                      {/* Combat Power Scaling */}
                      <td className="p-2.5 text-center">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-600/30 text-amber-800 font-mono text-[11px] font-bold">
                          <Zap className="w-3 h-3 text-amber-600" />
                          <span>{entry.totalPower}</span>
                          <span className="text-[9px] text-[#854d0e] uppercase">({entry.tier})</span>
                        </div>
                      </td>

                      {/* Arena Streak (Visible to all users) */}
                      <td className="p-2.5 text-center">
                        {entry.arenaStreak > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold shadow-[1px_1px_0px_#15803d]">
                            <TrendingUp className="w-3 h-3 text-emerald-600" />
                            +{entry.arenaStreak} WINS 🔥
                          </span>
                        ) : entry.arenaStreak < 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-bold">
                            <TrendingDown className="w-3 h-3 text-rose-600" />
                            {entry.arenaStreak} LOSSES 💀
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10px]">
                            0 (Even)
                          </span>
                        )}
                      </td>

                      {/* Daily Habit Streak */}
                      <td className="p-2.5 text-center">
                        <span className="text-[#ea580c] flex items-center justify-center gap-1 font-bold">
                          <PixelIcon name="flame" size={14} /> {entry.streak}D
                        </span>
                      </td>

                      {/* Quests */}
                      <td className="p-2.5 text-right font-silkscreen text-xs text-[#15803d]">
                        {entry.questsCleared} Cleared
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </RpgWindow>
    </div>
  );
};

