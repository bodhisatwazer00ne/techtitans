import React, { useState, useEffect, useRef } from 'react';
import { User, Rival, Item, InventoryItem, ActiveBattleSession, BattleActionType, BattleLogEntry, BattleTurnAction } from '../../types';
import { RpgWindow } from '../rpg/RpgWindow';
import { PixelButton } from '../rpg/PixelButton';
import { StatBar } from '../rpg/StatBar';
import { CharacterSprite, SpriteAnimation } from '../rpg/CharacterSprite';
import { 
  subscribeToActiveBattle, 
  submitTurnBasedAction, 
  forfeitActiveBattle,
  subscribeToTrainerPresence,
  handleBattleOpponentDisconnect,
} from '../../services/firebase';
import { chiptune } from '../../services/audio';

interface TurnBasedBattleArenaProps {
  user: User;
  rival: Rival;
  battleId: string;
  items: Item[];
  inventory: InventoryItem[];
  onVictory: (rival: Rival) => void;
  onDefeat: (rival: Rival) => void;
  onRun: (rival: Rival) => void;
}

type BattleEffectType = 'slash' | 'energy_beam' | 'guard_barrier' | 'heal_sparkles';

interface ActiveEffect {
  type: BattleEffectType;
  target: 'player' | 'rival';
}

export const TurnBasedBattleArena: React.FC<TurnBasedBattleArenaProps> = ({
  user,
  rival,
  battleId,
  onVictory,
  onDefeat,
  onRun,
}) => {
  const [session, setSession] = useState<ActiveBattleSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Animations & Visual FX
  const [playerAnimation, setPlayerAnimation] = useState<SpriteAnimation>('idle');
  const [rivalAnimation, setRivalAnimation] = useState<SpriteAnimation>('idle');
  const [playerDash, setPlayerDash] = useState<boolean>(false);
  const [rivalDash, setRivalDash] = useState<boolean>(false);
  const [shakeScreen, setShakeScreen] = useState<boolean>(false);
  const [flashScreen, setFlashScreen] = useState<boolean>(false);
  const [activeEffect, setActiveEffect] = useState<ActiveEffect | null>(null);

  // Floating text
  const [playerFloatingText, setPlayerFloatingText] = useState<{ text: string; isCrit?: boolean; isHeal?: boolean; isBlock?: boolean } | null>(null);
  const [rivalFloatingText, setRivalFloatingText] = useState<{ text: string; isCrit?: boolean; isHeal?: boolean; isBlock?: boolean } | null>(null);

  // Battle log
  const [logs, setLogs] = useState<BattleLogEntry[]>([
    {
      id: 'init-log',
      text: `⚔️ Real-time Turn-Based Arena Duel! Stats & attributes govern every strike!`,
      type: 'info',
    },
  ]);

  const lastProcessedActionTimeRef = useRef<number>(0);

  // 1. Subscribe to the real-time ActiveBattle document
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToActiveBattle(
      battleId,
      (liveBattle) => {
        if (!liveBattle) {
          setLoading(false);
          return;
        }
        setSession(liveBattle);
        setLoading(false);
      },
      (err) => {
        console.warn('Turn-based battle subscription error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [battleId]);

  // Monitor rival's real-time online presence during active duel
  const [isRivalOnline, setIsRivalOnline] = useState<boolean>(true);
  const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!session || session.status !== 'IN_PROGRESS' || !rival?.id) return;

    const unsubPresence = subscribeToTrainerPresence(rival.id, (online) => {
      setIsRivalOnline(online);
      if (!online) {
        if (!disconnectTimerRef.current) {
          setDisconnectCountdown(20);
          disconnectTimerRef.current = setInterval(() => {
            setDisconnectCountdown((prev) => {
              if (prev === null || prev <= 1) {
                clearInterval(disconnectTimerRef.current!);
                disconnectTimerRef.current = null;
                handleBattleOpponentDisconnect(battleId, rival.id).catch(() => {});
                return null;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } else {
        if (disconnectTimerRef.current) {
          clearInterval(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        setDisconnectCountdown(null);
      }
    });

    return () => {
      unsubPresence();
      if (disconnectTimerRef.current) {
        clearInterval(disconnectTimerRef.current);
      }
    };
  }, [session?.status, rival?.id, battleId, user.id]);

  // Determine role
  const isPlayer1 = session?.player1?.id === user.id;
  const myState = isPlayer1 ? session?.player1 : session?.player2;
  const rivalState = isPlayer1 ? session?.player2 : session?.player1;

  // Is it my turn?
  const isMyTurn = session?.status === 'IN_PROGRESS' && session?.currentTurn === user.id;

  // Handle combat animations whenever lastAction changes in Firestore!
  useEffect(() => {
    const lastAction = session?.lastAction;
    if (!lastAction || !lastAction.timestamp) return;
    if (lastAction.timestamp <= lastProcessedActionTimeRef.current) return;
    lastProcessedActionTimeRef.current = lastAction.timestamp;

    const actorIsMe = lastAction.actorId === user.id;

    // Trigger animations based on action type
    if (lastAction.action === 'STRIKE' || lastAction.action === 'FOCUS_SURGE') {
      const isArcane = lastAction.action === 'FOCUS_SURGE';
      if (actorIsMe) {
        setPlayerDash(true);
        setPlayerAnimation('attack');
        setActiveEffect({ type: isArcane ? 'energy_beam' : 'slash', target: 'rival' });
      } else {
        setRivalDash(true);
        setRivalAnimation('attack');
        setActiveEffect({ type: isArcane ? 'energy_beam' : 'slash', target: 'player' });
      }

      if (lastAction.isCrit) {
        chiptune.playCrit();
      } else {
        chiptune.playAttack();
      }

      setTimeout(() => {
        if (lastAction.isCrit) {
          setShakeScreen(true);
          setFlashScreen(true);
          setTimeout(() => {
            setFlashScreen(false);
            setShakeScreen(false);
          }, 240);
        } else {
          chiptune.playHit();
        }

        // Damage reaction on target
        if (actorIsMe) {
          setRivalAnimation('hit');
          setRivalFloatingText({
            text: lastAction.isCrit ? `CRIT! -${lastAction.damage}` : `-${lastAction.damage}`,
            isCrit: lastAction.isCrit,
          });
        } else {
          setPlayerAnimation('hit');
          setPlayerFloatingText({
            text: lastAction.isCrit ? `CRIT! -${lastAction.damage}` : `-${lastAction.damage}`,
            isCrit: lastAction.isCrit,
          });
        }

        // Reset visual effect and positions
        setTimeout(() => {
          setActiveEffect(null);
          setPlayerDash(false);
          setRivalDash(false);
          setPlayerAnimation('idle');
          setRivalAnimation('idle');
          setPlayerFloatingText(null);
          setRivalFloatingText(null);
          setActionInProgress(false);
        }, 650);
      }, 280);
    } else if (lastAction.action === 'DEFEND') {
      chiptune.playSelect();
      if (actorIsMe) {
        setActiveEffect({ type: 'guard_barrier', target: 'player' });
        setPlayerFloatingText({ text: `GUARD UP!`, isBlock: true });
      } else {
        setActiveEffect({ type: 'guard_barrier', target: 'rival' });
        setRivalFloatingText({ text: `GUARD UP!`, isBlock: true });
      }

      setTimeout(() => {
        setActiveEffect(null);
        setPlayerFloatingText(null);
        setRivalFloatingText(null);
        setActionInProgress(false);
      }, 700);
    } else if (lastAction.action === 'HEAL_POTION') {
      chiptune.playLevelUp();
      if (actorIsMe) {
        setActiveEffect({ type: 'heal_sparkles', target: 'player' });
        setPlayerFloatingText({ text: `+${lastAction.heal} HP`, isHeal: true });
      } else {
        setActiveEffect({ type: 'heal_sparkles', target: 'rival' });
        setRivalFloatingText({ text: `+${lastAction.heal} HP`, isHeal: true });
      }

      setTimeout(() => {
        setActiveEffect(null);
        setPlayerFloatingText(null);
        setRivalFloatingText(null);
        setActionInProgress(false);
      }, 700);
    }

    // Append to battle log
    setLogs((prev) => [
      ...prev.slice(-6),
      {
        id: `turn-${lastAction.timestamp}-${Math.random()}`,
        text: lastAction.message,
        type: lastAction.isCrit ? 'crit' : 'info',
      },
    ]);
  }, [session?.lastAction, user.id]);

  // Execute turn action
  const handleAction = async (action: BattleActionType) => {
    if (!session || session.status !== 'IN_PROGRESS' || !isMyTurn || actionInProgress) return;
    setActionInProgress(true);
    chiptune.playSelect();

    try {
      await submitTurnBasedAction(battleId, user.id, action);
    } catch (err: any) {
      console.warn('Turn action error:', err);
      setActionInProgress(false);
    }
  };

  // Handle forfeit
  const handleForfeit = async () => {
    chiptune.playHit();
    try {
      await forfeitActiveBattle(battleId, user.id);
    } catch (err) {
      console.warn('Forfeit notice:', err);
    }
    onRun(rival);
  };

  if (loading || !session || !myState || !rivalState) {
    return (
      <div className="bg-[#1b1429] border-4 border-[#120e1d] p-8 text-center text-[#f4eee3] space-y-3 shadow-[4px_4px_0px_#120e1d]">
        <div className="font-pixel text-base text-[#fec83e] animate-pulse">
          SYNCHRONIZING TURN-BASED ARENA...
        </div>
        <p className="font-silkscreen text-xs text-[#a594c7]">
          Connecting real-time turn state with trainer {rival.username}...
        </p>
      </div>
    );
  }

  const isResolved = session.status === 'RESOLVED' || session.status === 'FORFEIT';
  const isWinner = session.winnerId === user.id;

  return (
    <div
      className={`space-y-4 select-none relative ${
        shakeScreen ? 'animate-bounce' : ''
      } ${flashScreen ? 'brightness-150' : ''}`}
    >
      {/* ARENA HEADER: Turn-based Battle Info */}
      <div className="bg-[#181425] border-4 border-[#120e1d] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[#f4eee3] shadow-[4px_4px_0px_#120e1d]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-ping" />
          <span className="font-pixel text-xs text-[#fec83e] tracking-wider">
            TURN-BASED MULTIPLAYER ARENA
          </span>
          <span className="font-pixel text-[10px] bg-[#2d1b4e] text-[#a78bfa] px-2 py-0.5 border border-[#5b21b6]">
            ROUND {session.round} (TURN {session.turnCount || 1})
          </span>
          {disconnectCountdown !== null ? (
            <span className="inline-flex items-center gap-1 font-pixel text-[9px] bg-[#7f1d1d] text-[#fca5a5] px-2 py-0.5 border border-[#b91c1c] animate-pulse">
              ⚠️ RIVAL RECONNECTING ({disconnectCountdown}s)
            </span>
          ) : isRivalOnline ? (
            <span className="hidden sm:inline-flex items-center gap-1 font-pixel text-[9px] bg-[#064e3b] text-[#6ee7b7] px-2 py-0.5 border border-[#047857]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-ping" />
              ONLINE
            </span>
          ) : null}
        </div>

        {/* ACTIVE TURN BANNER */}
        {!isResolved && (
          <div className="flex items-center gap-2">
            {isMyTurn ? (
              <span className="font-pixel text-xs bg-[#b45309] text-[#fef08a] px-3 py-1 border-2 border-[#fef08a] animate-pulse shadow-[2px_2px_0px_#000]">
                ⚔️ YOUR TURN TO MOVE!
              </span>
            ) : (
              <span className="font-pixel text-xs bg-[#1e1b4b] text-[#c7d2fe] px-3 py-1 border-2 border-[#6366f1] shadow-[2px_2px_0px_#000]">
                ⏳ {rivalState.username.toUpperCase()}'S TURN...
              </span>
            )}
          </div>
        )}
      </div>

      {/* COMBAT STAGE */}
      <div className="relative bg-[#120e1d] border-4 border-[#120e1d] p-6 min-h-[340px] flex flex-col justify-between overflow-hidden shadow-[inset_0px_0px_20px_rgba(0,0,0,0.8)]">
        {/* Background Dungeon Grid */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#4a3b63 1px, transparent 1px), linear-gradient(90deg, #4a3b63 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* 1. RIVAL HUD & SPRITE (TOP RIGHT) */}
        <div className="flex justify-between items-start z-10">
          <div className="bg-[#1b1429]/95 border-2 border-[#5a4878] p-3 w-64 shadow-[4px_4px_0px_#000] relative">
            <div className="flex justify-between items-center mb-1">
              <span className="font-pixel text-xs text-[#e43b44] font-bold truncate">
                {rivalState.username}
              </span>
              <span className="font-pixel text-[10px] text-[#fec83e]">
                LV.{rivalState.level}
              </span>
            </div>

            <StatBar
              label="HP"
              current={rivalState.hp}
              max={rivalState.maxHp}
              type="hp"
            />
            <div className="mt-1">
              <StatBar
                label="STA"
                current={rivalState.stamina}
                max={rivalState.maxStamina}
                type="stamina"
              />
            </div>

            {rivalState.isDefending && (
              <div className="mt-1.5 flex items-center gap-1 font-pixel text-[9px] text-[#67e8f9] bg-[#0e3b43] px-1.5 py-0.5 border border-[#155e75]">
                <span>🛡️</span> DEFENDING (-65% DMG)
              </div>
            )}
          </div>

          {/* RIVAL SPRITE */}
          <div className="relative flex flex-col items-center mr-8 sm:mr-16">
            {/* Floating popups on rival */}
            {rivalFloatingText && (
              <div
                className={`absolute -top-8 font-pixel text-sm font-bold z-30 animate-bounce ${
                  rivalFloatingText.isCrit
                    ? 'text-[#fec83e] text-base drop-shadow-[0_2px_4px_rgba(254,200,62,0.8)]'
                    : rivalFloatingText.isHeal
                    ? 'text-[#22c55e] drop-shadow-[0_2px_4px_rgba(34,197,94,0.8)]'
                    : rivalFloatingText.isBlock
                    ? 'text-[#67e8f9] drop-shadow-[0_2px_4px_rgba(103,232,249,0.8)]'
                    : 'text-[#e43b44] drop-shadow-[0_2px_4px_rgba(228,59,68,0.8)]'
                }`}
              >
                {rivalFloatingText.text}
              </div>
            )}

            {/* Visual Effect Overlay on Rival */}
            {activeEffect?.target === 'rival' && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                {activeEffect.type === 'slash' && (
                  <div className="w-16 h-16 border-r-4 border-b-4 border-[#e43b44] rotate-45 animate-ping" />
                )}
                {activeEffect.type === 'energy_beam' && (
                  <div className="w-20 h-20 rounded-full bg-[#a855f7] opacity-80 animate-ping border-4 border-[#c084fc]" />
                )}
                {activeEffect.type === 'guard_barrier' && (
                  <div className="w-20 h-20 rounded-full border-4 border-[#67e8f9] bg-[#0891b2]/30 animate-pulse" />
                )}
                {activeEffect.type === 'heal_sparkles' && (
                  <div className="w-16 h-16 rounded-full border-4 border-[#22c55e] bg-[#16a34a]/30 animate-pulse" />
                )}
              </div>
            )}

            <div
              className={`transition-transform duration-300 ${
                rivalDash ? '-translate-x-16 translate-y-8 scale-110' : ''
              }`}
            >
              <CharacterSprite
                id={rivalState.avatarId || 'avatar-2'}
                animation={rivalAnimation}
                flipped={true}
                size={56}
              />
            </div>
            {/* Sprite shadow */}
            <div className="w-16 h-4 bg-[#08060d]/80 rounded-full blur-[2px] mt-1" />
          </div>
        </div>

        {/* 2. PLAYER HUD & SPRITE (BOTTOM LEFT) */}
        <div className="flex justify-between items-end z-10 mt-6">
          {/* PLAYER SPRITE */}
          <div className="relative flex flex-col items-center ml-8 sm:ml-16">
            {/* Floating popups on player */}
            {playerFloatingText && (
              <div
                className={`absolute -top-8 font-pixel text-sm font-bold z-30 animate-bounce ${
                  playerFloatingText.isCrit
                    ? 'text-[#fec83e] text-base drop-shadow-[0_2px_4px_rgba(254,200,62,0.8)]'
                    : playerFloatingText.isHeal
                    ? 'text-[#22c55e] drop-shadow-[0_2px_4px_rgba(34,197,94,0.8)]'
                    : playerFloatingText.isBlock
                    ? 'text-[#67e8f9] drop-shadow-[0_2px_4px_rgba(103,232,249,0.8)]'
                    : 'text-[#e43b44] drop-shadow-[0_2px_4px_rgba(228,59,68,0.8)]'
                }`}
              >
                {playerFloatingText.text}
              </div>
            )}

            {/* Visual Effect Overlay on Player */}
            {activeEffect?.target === 'player' && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                {activeEffect.type === 'slash' && (
                  <div className="w-16 h-16 border-r-4 border-b-4 border-[#e43b44] rotate-45 animate-ping" />
                )}
                {activeEffect.type === 'energy_beam' && (
                  <div className="w-20 h-20 rounded-full bg-[#a855f7] opacity-80 animate-ping border-4 border-[#c084fc]" />
                )}
                {activeEffect.type === 'guard_barrier' && (
                  <div className="w-20 h-20 rounded-full border-4 border-[#67e8f9] bg-[#0891b2]/30 animate-pulse" />
                )}
                {activeEffect.type === 'heal_sparkles' && (
                  <div className="w-16 h-16 rounded-full border-4 border-[#22c55e] bg-[#16a34a]/30 animate-pulse" />
                )}
              </div>
            )}

            <div
              className={`transition-transform duration-300 ${
                playerDash ? 'translate-x-16 -translate-y-8 scale-110' : ''
              }`}
            >
              <CharacterSprite
                id={myState.avatarId || user.avatarId || 'avatar-1'}
                animation={playerAnimation}
                flipped={false}
                size={56}
              />
            </div>
            {/* Sprite shadow */}
            <div className="w-16 h-4 bg-[#08060d]/80 rounded-full blur-[2px] mt-1" />
          </div>

          {/* PLAYER HUD */}
          <div className="bg-[#1b1429]/95 border-2 border-[#5a4878] p-3 w-64 shadow-[4px_4px_0px_#000]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-pixel text-xs text-[#22c55e] font-bold truncate">
                {myState.username} (YOU)
              </span>
              <span className="font-pixel text-[10px] text-[#fec83e]">
                LV.{myState.level}
              </span>
            </div>

            <StatBar
              label="HP"
              current={myState.hp}
              max={myState.maxHp}
              type="hp"
            />
            <div className="mt-1">
              <StatBar
                label="STA"
                current={myState.stamina}
                max={myState.maxStamina}
                type="stamina"
              />
            </div>

            {myState.isDefending && (
              <div className="mt-1.5 flex items-center gap-1 font-pixel text-[9px] text-[#67e8f9] bg-[#0e3b43] px-1.5 py-0.5 border border-[#155e75]">
                <span>🛡️</span> DEFENDING (-65% DMG)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COMBAT CHRONICLE & ACTION PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* COMBAT LOG */}
        <div className="md:col-span-1">
          <RpgWindow title="COMBAT CHRONICLE" className="h-44 flex flex-col">
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 text-[11px] font-silkscreen">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`leading-relaxed p-1 border-l-2 ${
                    log.type === 'player_atk'
                      ? 'border-[#fec83e] text-[#fec83e] bg-[#2d1b4e]/30'
                      : log.type === 'enemy_atk'
                      ? 'border-[#e43b44] text-[#f4eee3]'
                      : 'border-[#5a4878] text-[#a594c7]'
                  }`}
                >
                  {log.text}
                </div>
              ))}
            </div>
          </RpgWindow>
        </div>

        {/* TURN-BASED ACTION CONTROLS */}
        <div className="md:col-span-2">
          <RpgWindow
            title={
              isResolved
                ? 'DUEL RESOLUTION'
                : isMyTurn
                ? '⚔️ YOUR MOVE: CHOOSE COMBAT ACTION'
                : `⏳ OPPONENT'S TURN: WAITING FOR ${rivalState.username.toUpperCase()}...`
            }
            className="h-44 flex flex-col justify-between"
          >
            {isResolved ? (
              <div className="flex flex-col items-center justify-center p-2 text-center space-y-2">
                <div
                  className={`font-pixel text-base ${
                    isWinner ? 'text-[#22c55e]' : 'text-[#e43b44]'
                  }`}
                >
                  {isWinner ? '🏆 VICTORY ACHIEVED!' : '💀 DEFEAT IN COMBAT'}
                </div>
                <p className="font-silkscreen text-xs text-[#a594c7]">
                  {isWinner
                    ? `You overpowered Trainer ${rivalState.username} in glorious turn-based arena combat!`
                    : `Trainer ${rivalState.username} claimed victory this time. Train hard and challenge again!`}
                </p>
                <div className="pt-2">
                  <PixelButton
                    variant={isWinner ? 'gold' : 'dark'}
                    size="md"
                    onClick={() => {
                      if (isWinner) {
                        chiptune.playLevelUp();
                        onVictory(rival);
                      } else {
                        onDefeat(rival);
                      }
                    }}
                  >
                    RETURN TO ARENA
                  </PixelButton>
                </div>
              </div>
            ) : isMyTurn ? (
              <div className="grid grid-cols-2 gap-2 h-full p-1">
                {/* STRIKE */}
                <PixelButton
                  variant="red"
                  size="md"
                  disabled={actionInProgress}
                  onClick={() => handleAction('STRIKE')}
                  className="flex flex-col items-center justify-center py-2"
                >
                  <span className="font-pixel text-xs">⚔️ STRIKE</span>
                  <span className="font-silkscreen text-[9px] text-white/80">
                    Physical (STR: {myState.attributes?.str ?? 10}) • 10 STA
                  </span>
                </PixelButton>

                {/* FOCUS SURGE */}
                <PixelButton
                  variant="gold"
                  size="md"
                  disabled={actionInProgress || (myState.stamina < 15)}
                  onClick={() => handleAction('FOCUS_SURGE')}
                  className="flex flex-col items-center justify-center py-2"
                >
                  <span className="font-pixel text-xs">🔥 FOCUS SURGE</span>
                  <span className="font-silkscreen text-[9px] text-[#2d1b4e]">
                    Arcane (INT: {myState.attributes?.int ?? 10}) • 22 STA
                  </span>
                </PixelButton>

                {/* DEFEND */}
                <PixelButton
                  variant="blue"
                  size="md"
                  disabled={actionInProgress}
                  onClick={() => handleAction('DEFEND')}
                  className="flex flex-col items-center justify-center py-2"
                >
                  <span className="font-pixel text-xs">🛡️ DEFEND</span>
                  <span className="font-silkscreen text-[9px] text-white/80">
                    -65% DMG • +18 STA
                  </span>
                </PixelButton>

                {/* HEAL / RECOVER */}
                <PixelButton
                  variant="green"
                  size="md"
                  disabled={actionInProgress || (myState.stamina < 10) || (myState.hp >= myState.maxHp)}
                  onClick={() => handleAction('HEAL_POTION')}
                  className="flex flex-col items-center justify-center py-2"
                >
                  <span className="font-pixel text-xs">🧪 HEAL</span>
                  <span className="font-silkscreen text-[9px] text-white/80">
                    Recover HP (WIL: {myState.attributes?.wil ?? 10})
                  </span>
                </PixelButton>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2 p-2">
                <div className="w-8 h-8 border-4 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
                <div className="font-pixel text-xs text-[#a78bfa]">
                  OPPONENT'S TURN
                </div>
                <p className="font-silkscreen text-[11px] text-[#8f85a3]">
                  Waiting for {rivalState.username} to calculate their move...
                </p>
                <div className="pt-1">
                  <button
                    onClick={handleForfeit}
                    className="font-pixel text-[9px] text-[#e43b44] hover:underline"
                  >
                    FORFEIT MATCH
                  </button>
                </div>
              </div>
            )}
          </RpgWindow>
        </div>
      </div>
    </div>
  );
};
