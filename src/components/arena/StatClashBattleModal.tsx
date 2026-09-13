import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Swords, Shield, Zap, Award, Flame, ChevronRight, RotateCcw, 
  CheckCircle2, XCircle, Brain, Sparkles, Heart, Activity, ArrowRight,
  TrendingUp, TrendingDown, Eye, Play, Pause
} from 'lucide-react';
import { StatBattleSimulation, StatClashRound, AttributeComparison } from '../../types';
import { CharacterSprite, SpriteAnimation } from '../rpg/CharacterSprite';
import { chiptune } from '../../services/audio';

interface StatClashBattleModalProps {
  simulation: StatBattleSimulation;
  playerInfo: {
    username: string;
    level: number;
    title: string;
    avatarId: string;
    hp: number;
    maxHp: number;
  };
  rivalInfo: {
    id: string;
    username: string;
    level: number;
    title: string;
    avatarId: string;
    equipmentName: string;
    hp: number;
    maxHp: number;
  };
  onClose: () => void;
  onRechallenge: () => void;
}

export const StatClashBattleModal: React.FC<StatClashBattleModalProps> = ({
  simulation,
  playerInfo,
  rivalInfo,
  onClose,
  onRechallenge,
}) => {
  // Phase of animation: 'INTRO' -> 'CLASH_ROUNDS' -> 'RESULT'
  const [phase, setPhase] = useState<'INTRO' | 'CLASH_ROUNDS' | 'RESULT'>('INTRO');
  const [activeRoundIndex, setActiveRoundIndex] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [showStatBreakdown, setShowStatBreakdown] = useState<boolean>(false);

  const isPlayerWinner = simulation.winner === 'PLAYER';

  // Sound effects on mount and phase transitions
  useEffect(() => {
    chiptune.playSelect();
  }, []);

  // Auto transition from INTRO to CLASH_ROUNDS after 1.8 seconds
  useEffect(() => {
    if (phase === 'INTRO') {
      const timer = setTimeout(() => {
        setPhase('CLASH_ROUNDS');
      }, 1900);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Round progression in CLASH_ROUNDS
  useEffect(() => {
    if (phase === 'CLASH_ROUNDS' && autoPlay) {
      if (activeRoundIndex < simulation.rounds.length - 1) {
        const timer = setTimeout(() => {
          setActiveRoundIndex(prev => prev + 1);
        }, 2200);
        return () => clearTimeout(timer);
      } else {
        const endTimer = setTimeout(() => {
          setPhase('RESULT');
        }, 2400);
        return () => clearTimeout(endTimer);
      }
    }
  }, [phase, activeRoundIndex, autoPlay, simulation.rounds.length]);

  const currentRound: StatClashRound | undefined = simulation.rounds[activeRoundIndex];

  // Sound cues for clashes and combat resolution
  useEffect(() => {
    if (phase === 'CLASH_ROUNDS' && currentRound) {
      if (currentRound.winner === 'PLAYER') {
        chiptune.playAttack();
        const t = setTimeout(() => {
          if (currentRound.isCrit) {
            chiptune.playCrit();
          } else {
            chiptune.playHit();
          }
        }, 160);
        return () => clearTimeout(t);
      } else if (currentRound.winner === 'RIVAL') {
        chiptune.playAttack();
        const t = setTimeout(() => {
          chiptune.playHit();
        }, 160);
        return () => clearTimeout(t);
      } else {
        chiptune.playCursor();
      }
    } else if (phase === 'RESULT') {
      if (isPlayerWinner) {
        chiptune.playVictory();
      } else {
        chiptune.playDefeat();
      }
    }
  }, [phase, activeRoundIndex, isPlayerWinner, currentRound]);

  // Dynamic HP calculation for visual health bar
  const displayedPlayerHp = useMemo(() => {
    if (phase === 'INTRO') return playerInfo.maxHp || 100;
    if (phase === 'RESULT') return simulation.rounds[simulation.rounds.length - 1].playerHpAfter;
    return currentRound ? currentRound.playerHpAfter : playerInfo.maxHp || 100;
  }, [phase, currentRound, playerInfo.maxHp, simulation.rounds]);

  const displayedRivalHp = useMemo(() => {
    if (phase === 'INTRO') return rivalInfo.maxHp || 100;
    if (phase === 'RESULT') return simulation.rounds[simulation.rounds.length - 1].rivalHpAfter;
    return currentRound ? currentRound.rivalHpAfter : rivalInfo.maxHp || 100;
  }, [phase, currentRound, rivalInfo.maxHp, simulation.rounds]);

  const playerHpPercent = Math.max(0, Math.min(100, (displayedPlayerHp / (playerInfo.maxHp || 100)) * 100));
  const rivalHpPercent = Math.max(0, Math.min(100, (displayedRivalHp / (rivalInfo.maxHp || 100)) * 100));

  // Determine Sprite Animation and floating indicators based on phase & round
  const {
    playerAnimation,
    rivalAnimation,
    playerMotion,
    rivalMotion,
    playerBadge,
    rivalBadge,
  } = useMemo(() => {
    if (phase === 'INTRO') {
      return {
        playerAnimation: 'idle' as SpriteAnimation,
        rivalAnimation: 'idle' as SpriteAnimation,
        playerMotion: { x: [-30, 0], opacity: [0, 1] },
        rivalMotion: { x: [30, 0], opacity: [0, 1] },
        playerBadge: { text: 'READY', bg: 'bg-blue-600', border: 'border-blue-400', color: 'text-blue-100' },
        rivalBadge: { text: 'READY', bg: 'bg-rose-600', border: 'border-rose-400', color: 'text-rose-100' },
      };
    }

    if (phase === 'CLASH_ROUNDS' && currentRound) {
      if (currentRound.winner === 'PLAYER') {
        return {
          playerAnimation: 'attack' as SpriteAnimation,
          rivalAnimation: 'hit' as SpriteAnimation,
          playerMotion: { x: [0, 36, 0] },
          rivalMotion: { x: [0, 14, -8, 4, 0] },
          playerBadge: {
            text: currentRound.isCrit ? '💥 CRIT!' : '⚔️ STRIKE!',
            bg: 'bg-blue-600',
            border: 'border-blue-400',
            color: 'text-white font-bold',
          },
          rivalBadge: {
            text: `-${currentRound.damageToRival} HP`,
            bg: 'bg-rose-600',
            border: 'border-rose-400',
            color: 'text-rose-100 font-bold',
          },
        };
      }

      if (currentRound.winner === 'RIVAL') {
        return {
          playerAnimation: 'hit' as SpriteAnimation,
          rivalAnimation: 'attack' as SpriteAnimation,
          playerMotion: { x: [0, -14, 8, -4, 0] },
          rivalMotion: { x: [0, -36, 0] },
          playerBadge: {
            text: `-${currentRound.damageToPlayer} HP`,
            bg: 'bg-rose-600',
            border: 'border-rose-400',
            color: 'text-rose-100 font-bold',
          },
          rivalBadge: {
            text: '⚔️ STRIKE!',
            bg: 'bg-rose-600',
            border: 'border-rose-400',
            color: 'text-white font-bold',
          },
        };
      }

      // Tie
      return {
        playerAnimation: 'attack' as SpriteAnimation,
        rivalAnimation: 'attack' as SpriteAnimation,
        playerMotion: { x: [0, 16, 0] },
        rivalMotion: { x: [0, -16, 0] },
        playerBadge: { text: '🛡️ PARRIED', bg: 'bg-slate-700', border: 'border-slate-500', color: 'text-slate-200' },
        rivalBadge: { text: '🛡️ PARRIED', bg: 'bg-slate-700', border: 'border-slate-500', color: 'text-slate-200' },
      };
    }

    // RESULT
    if (isPlayerWinner) {
      return {
        playerAnimation: 'victory' as SpriteAnimation,
        rivalAnimation: 'defeat' as SpriteAnimation,
        playerMotion: { y: [0, -12, 0] },
        rivalMotion: { opacity: 0.5, y: 6 },
        playerBadge: { text: '👑 WINNER!', bg: 'bg-amber-500', border: 'border-amber-300', color: 'text-amber-950 font-black' },
        rivalBadge: { text: '💀 DEFEATED', bg: 'bg-slate-800', border: 'border-slate-600', color: 'text-slate-400' },
      };
    } else {
      return {
        playerAnimation: 'defeat' as SpriteAnimation,
        rivalAnimation: 'victory' as SpriteAnimation,
        playerMotion: { opacity: 0.5, y: 6 },
        rivalMotion: { y: [0, -12, 0] },
        playerBadge: { text: '💀 DEFEATED', bg: 'bg-slate-800', border: 'border-slate-600', color: 'text-slate-400' },
        rivalBadge: { text: '👑 WINNER!', bg: 'bg-amber-500', border: 'border-amber-300', color: 'text-amber-950 font-black' },
      };
    }
  }, [phase, currentRound, isPlayerWinner]);

  const getAttributeIcon = (key: string) => {
    switch (key) {
      case 'str': return <Swords className="w-4 h-4 text-rose-500" />;
      case 'end': return <Activity className="w-4 h-4 text-emerald-500" />;
      case 'res': return <Shield className="w-4 h-4 text-amber-500" />;
      case 'wil': return <Flame className="w-4 h-4 text-orange-500" />;
      case 'int': return <Brain className="w-4 h-4 text-indigo-500" />;
      case 'cre': return <Sparkles className="w-4 h-4 text-purple-500" />;
      default: return <Zap className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div 
      id="stat-clash-modal-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto select-none"
    >
      <div 
        id="stat-clash-modal-card"
        className="relative w-full max-w-3xl bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]"
      >
        {/* Top Arena Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-slate-800/90 border-b border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Swords className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wide">
                ARENA STAT CLASH
              </h2>
              <p className="text-[11px] text-slate-400">
                Direct Avatar Battle Simulation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {phase === 'CLASH_ROUNDS' && (
              <button
                id="skip-to-verdict-btn"
                type="button"
                onClick={() => setPhase('RESULT')}
                className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 transition"
              >
                Skip to Result
              </button>
            )}
            <button
              id="close-clash-modal-btn"
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
              title="Close Arena"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Combatants Bar & Live Health Gauges */}
        <div className="px-4 sm:px-6 py-3 bg-gradient-to-b from-slate-800/80 to-slate-900 border-b border-slate-700/60">
          <div className="grid grid-cols-11 items-center gap-2 sm:gap-4">
            {/* Player Side */}
            <div className="col-span-5 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Lv.{playerInfo.level}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-100 truncate max-w-[110px] sm:max-w-[160px]">
                    {playerInfo.username}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-300">
                  {displayedPlayerHp} / {playerInfo.maxHp}
                </span>
              </div>

              {/* Player HP Bar */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <motion.div 
                  className={`h-full ${playerHpPercent > 40 ? 'bg-emerald-500' : playerHpPercent > 15 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  initial={{ width: '100%' }}
                  animate={{ width: `${playerHpPercent}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
            </div>

            {/* VS Badge */}
            <div className="col-span-1 flex flex-col items-center justify-center">
              <motion.div 
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 font-extrabold text-[10px] sm:text-xs shadow"
              >
                VS
              </motion.div>
            </div>

            {/* Rival Side */}
            <div className="col-span-5 flex flex-col text-right">
              <div className="flex items-center justify-between mb-1 flex-row-reverse">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-100 truncate max-w-[110px] sm:max-w-[160px]">
                    {rivalInfo.username}
                  </span>
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    Lv.{rivalInfo.level}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-300">
                  {displayedRivalHp} / {rivalInfo.maxHp}
                </span>
              </div>

              {/* Rival HP Bar */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 flex flex-row-reverse">
                <motion.div 
                  className={`h-full ${rivalHpPercent > 40 ? 'bg-emerald-500' : rivalHpPercent > 15 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  initial={{ width: '100%' }}
                  animate={{ width: `${rivalHpPercent}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CHARACTER AVATAR BATTLE ARENA STAGE */}
        <div className="relative mx-3 sm:mx-6 mt-3 p-4 sm:p-5 bg-gradient-to-b from-[#140e26] via-[#1a1333] to-[#0f0a1d] rounded-xl border-2 border-slate-700 shadow-inner overflow-hidden min-h-[190px] flex items-center justify-between">
          {/* Retro Grid Background */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#fec83e_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-transparent border-t border-slate-700/50" />

          {/* PLAYER AVATAR PLATFORM */}
          <div className="relative z-10 flex flex-col items-center w-28 sm:w-36">
            {/* Floating Action Badge */}
            <AnimatePresence mode="wait">
              {playerBadge && (
                <motion.div
                  key={`p-badge-${activeRoundIndex}-${phase}`}
                  initial={{ opacity: 0, y: 8, scale: 0.8 }}
                  animate={{ opacity: 1, y: -6, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.8 }}
                  className={`absolute -top-7 whitespace-nowrap z-20 font-pixel text-[9px] sm:text-[10px] px-2 py-0.5 rounded shadow-lg border ${playerBadge.bg} ${playerBadge.border} ${playerBadge.color}`}
                >
                  {playerBadge.text}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Animated Sprite */}
            <motion.div
              animate={playerMotion}
              transition={{ duration: 0.3 }}
              className="relative flex flex-col items-center"
            >
              {/* Ground Shadow */}
              <div className="w-16 h-3 rounded-full bg-blue-500/20 blur-[2px] mb-[-4px]" />

              <CharacterSprite
                id={playerInfo.avatarId}
                level={playerInfo.level}
                size={74}
                animation={playerAnimation}
              />
            </motion.div>

            <span className="font-pixel text-[9px] sm:text-[10px] text-blue-300 mt-1 bg-slate-950/80 px-2 py-0.5 rounded border border-blue-500/30 truncate max-w-[100px]">
              {playerInfo.username}
            </span>
          </div>

          {/* ARENA CENTER CLASH INDICATOR */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-1 sm:px-3">
            {phase === 'INTRO' && (
              <motion.div
                animate={{ scale: [0.95, 1.1, 0.95] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 font-black text-sm shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                  VS
                </div>
                <span className="font-pixel text-[8px] sm:text-[9px] text-amber-300 uppercase tracking-wider bg-slate-900/90 px-2 py-0.5 rounded border border-amber-500/40">
                  STAT CLASH
                </span>
              </motion.div>
            )}

            {phase === 'CLASH_ROUNDS' && currentRound && (
              <div className="flex flex-col items-center">
                <motion.div
                  key={`clash-icon-${activeRoundIndex}`}
                  initial={{ scale: 0, rotate: -25 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 18 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-9 h-9 rounded-full bg-amber-500/30 border border-amber-400 flex items-center justify-center text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                    <Swords className="w-5 h-5 animate-pulse" />
                  </div>
                  <span className="font-pixel text-[8px] sm:text-[9px] text-slate-300 mt-1 uppercase font-bold tracking-wide">
                    {currentRound.title}
                  </span>
                  <span className={`font-pixel text-[10px] sm:text-[11px] mt-0.5 font-bold ${
                    currentRound.winner === 'PLAYER' ? 'text-blue-400' :
                    currentRound.winner === 'RIVAL' ? 'text-rose-400' : 'text-slate-300'
                  }`}>
                    {currentRound.winner === 'PLAYER' ? 'YOU LANDED BLOW' :
                     currentRound.winner === 'RIVAL' ? 'RIVAL LANDED BLOW' : 'PARRIED STRIKE'}
                  </span>
                </motion.div>
              </div>
            )}

            {phase === 'RESULT' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-lg ${
                  isPlayerWinner
                    ? 'bg-amber-500/20 text-amber-400 border-amber-400 shadow-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border-rose-400 shadow-rose-500/30'
                }`}>
                  {isPlayerWinner ? <Award className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <span className={`font-pixel text-[9px] sm:text-[10px] mt-1 font-bold ${
                  isPlayerWinner ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {isPlayerWinner ? 'VICTORY' : 'DEFEAT'}
                </span>
              </motion.div>
            )}
          </div>

          {/* RIVAL AVATAR PLATFORM */}
          <div className="relative z-10 flex flex-col items-center w-28 sm:w-36">
            {/* Floating Action Badge */}
            <AnimatePresence mode="wait">
              {rivalBadge && (
                <motion.div
                  key={`r-badge-${activeRoundIndex}-${phase}`}
                  initial={{ opacity: 0, y: 8, scale: 0.8 }}
                  animate={{ opacity: 1, y: -6, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.8 }}
                  className={`absolute -top-7 whitespace-nowrap z-20 font-pixel text-[9px] sm:text-[10px] px-2 py-0.5 rounded shadow-lg border ${rivalBadge.bg} ${rivalBadge.border} ${rivalBadge.color}`}
                >
                  {rivalBadge.text}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Animated Sprite */}
            <motion.div
              animate={rivalMotion}
              transition={{ duration: 0.3 }}
              className="relative flex flex-col items-center"
            >
              {/* Ground Shadow */}
              <div className="w-16 h-3 rounded-full bg-rose-500/20 blur-[2px] mb-[-4px]" />

              <CharacterSprite
                id={rivalInfo.avatarId}
                level={rivalInfo.level}
                size={74}
                flipped={true}
                animation={rivalAnimation}
              />
            </motion.div>

            <span className="font-pixel text-[9px] sm:text-[10px] text-rose-300 mt-1 bg-slate-950/80 px-2 py-0.5 rounded border border-rose-500/30 truncate max-w-[100px]">
              {rivalInfo.username}
            </span>
          </div>
        </div>

        {/* Dynamic Center Stage: Round Flow / Narrative & Final Breakdown */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-3">
          <AnimatePresence mode="wait">
            {/* PHASE 1: INTRO ANIMATION */}
            {phase === 'INTRO' && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="py-4 flex flex-col items-center text-center space-y-2"
              >
                <h3 className="text-sm sm:text-base font-extrabold text-slate-100 tracking-wider">
                  COMBATANTS STEPPING INTO ARENA
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Attributes of Strength, Endurance, Resilience, Willpower, Intelligence, and Creativity clash to decide the victor!
                </p>

                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-medium text-amber-400 animate-pulse">
                    Initiating Clash Sequence...
                  </span>
                </div>
              </motion.div>
            )}

            {/* PHASE 2: ANIMATED CLASH ROUNDS */}
            {phase === 'CLASH_ROUNDS' && currentRound && (
              <motion.div
                key={`round-${currentRound.roundNumber}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {/* Round Tracker Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[11px] font-bold border border-amber-500/30">
                      PHASE {currentRound.roundNumber} OF {simulation.rounds.length}
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wide">
                      {currentRound.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    {simulation.rounds.map((r, i) => (
                      <div
                        key={r.roundNumber}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i === activeRoundIndex 
                            ? 'bg-amber-400 scale-125' 
                            : i < activeRoundIndex 
                            ? 'bg-slate-500' 
                            : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Clash Narrative Box */}
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80">
                  <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-200">
                    <Activity className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      {currentRound.narrative}
                    </p>
                  </div>
                </div>

                {/* Step controls */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setAutoPlay(prev => !prev)}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition"
                  >
                    {autoPlay ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{autoPlay ? 'Auto Playing' : 'Paused (Click to Resume)'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {activeRoundIndex < simulation.rounds.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setActiveRoundIndex(prev => prev + 1)}
                        className="px-3 py-1 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 flex items-center gap-1 transition"
                      >
                        Next Phase <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPhase('RESULT')}
                        className="px-3 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow transition flex items-center gap-1"
                      >
                        View Final Result <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* PHASE 3: FINAL RESULT & ATTRIBUTE COMPARISONS (REVEALED HERE) */}
            {phase === 'RESULT' && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-3"
              >
                {/* Result Announcement */}
                <div className={`p-4 sm:p-5 rounded-xl border text-center relative overflow-hidden ${
                  isPlayerWinner 
                    ? 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/10' 
                    : 'bg-gradient-to-b from-rose-950/40 via-slate-900 to-slate-900 border-rose-500/50 shadow-lg shadow-rose-500/10'
                }`}>
                  <h3 className={`text-xl sm:text-2xl font-black uppercase tracking-wider ${
                    isPlayerWinner ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {isPlayerWinner ? 'VICTORY ACHIEVED!' : 'DEFEAT'}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto mt-1.5 leading-relaxed">
                    {simulation.summary}
                  </p>

                  {/* Streak & XP Badges */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5 mt-3">
                    <div className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 text-xs font-bold ${
                      simulation.newStreak > 0
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : simulation.newStreak < 0
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {simulation.newStreak > 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span>
                        Arena Streak: {simulation.newStreak > 0 ? `+${simulation.newStreak} Wins 🔥` : `${simulation.newStreak} Losses`}
                      </span>
                    </div>

                    {isPlayerWinner && simulation.xpEarned > 0 && (
                      <div className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 text-xs font-bold">
                        <Zap className="w-3.5 h-3.5" />
                        <span>+{simulation.xpEarned} XP Earned</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Revealed 6-Attribute Scaling Comparison */}
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Brain className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wide">
                        Revealed Attribute Scaling Breakdown
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowStatBreakdown(prev => !prev)}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {showStatBreakdown ? 'Hide Details' : 'View Full Formula'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {simulation.comparisons.map((comp) => (
                      <div 
                        key={comp.key}
                        className={`p-2 rounded-lg border text-xs flex flex-col justify-between ${
                          comp.winner === 'PLAYER'
                            ? 'bg-blue-950/20 border-blue-500/30'
                            : comp.winner === 'RIVAL'
                            ? 'bg-rose-950/20 border-rose-500/30'
                            : 'bg-slate-900/60 border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1 font-bold text-slate-200">
                            {getAttributeIcon(comp.key)}
                            <span>{comp.label}</span>
                          </div>
                          <div className="font-mono font-bold text-[11px]">
                            <span className="text-blue-400">{comp.playerVal}</span>
                            <span className="text-slate-500 mx-1">v</span>
                            <span className="text-rose-400">{comp.rivalVal}</span>
                          </div>
                        </div>

                        {showStatBreakdown && (
                          <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                            {comp.narrative}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Power System Indices Breakdown */}
                  {showStatBreakdown && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-1.5 bg-slate-900/70 rounded border border-slate-700/50">
                        <div className="text-[10px] text-slate-400">Physical (STR+RES)</div>
                        <div className="font-mono font-bold text-slate-200 text-xs">
                          {simulation.playerBreakdown.physicalIndex} vs {simulation.rivalBreakdown.physicalIndex}
                        </div>
                      </div>
                      <div className="p-1.5 bg-slate-900/70 rounded border border-slate-700/50">
                        <div className="text-[10px] text-slate-400">Tactical (INT+CRE)</div>
                        <div className="font-mono font-bold text-slate-200 text-xs">
                          {simulation.playerBreakdown.tacticalIndex} vs {simulation.rivalBreakdown.tacticalIndex}
                        </div>
                      </div>
                      <div className="p-1.5 bg-slate-900/70 rounded border border-slate-700/50">
                        <div className="text-[10px] text-slate-400">Survival (END+WIL)</div>
                        <div className="font-mono font-bold text-slate-200 text-xs">
                          {simulation.playerBreakdown.survivalIndex} vs {simulation.rivalBreakdown.survivalIndex}
                        </div>
                      </div>
                      <div className="p-1.5 bg-slate-900/70 rounded border border-slate-700/50">
                        <div className="text-[10px] text-slate-400">Innovation (CRE+DIS)</div>
                        <div className="font-mono font-bold text-slate-200 text-xs">
                          {simulation.playerBreakdown.innovationIndex} vs {simulation.rivalBreakdown.innovationIndex}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Actions Footer */}
        <div className="px-4 sm:px-5 py-3 bg-slate-800/90 border-t border-slate-700/70 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span>Streaks update the public leaderboard in real time!</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {phase === 'RESULT' && (
              <button
                id="rechallenge-clash-btn"
                type="button"
                onClick={onRechallenge}
                className="flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 flex items-center justify-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                Re-challenge Opponent
              </button>
            )}

            <button
              id="finish-clash-btn"
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl shadow transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-900" />
              {phase === 'RESULT' ? 'Return to Arena' : 'Close Battle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
