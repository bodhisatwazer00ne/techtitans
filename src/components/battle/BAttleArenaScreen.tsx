import React, { useState, useEffect } from 'react';
import { User, Rival, Item, InventoryItem, BattleState, BattleLogEntry, AttributeType } from '../../types';
import { RpgWindow } from '../rpg/RpgWindow';
import { PixelButton } from '../rpg/PixelButton';
import { StatBar } from '../rpg/StatBar';
import { CharacterSprite, SpriteAnimation } from '../rpg/CharacterSprite';
import { computeEffectiveAttributes } from '../../services/storage';
import { calculateBattleDamage } from '../../services/gameEngine';
import { chiptune } from '../../services/audio';

interface BattleArenaScreenProps {
    user: User;
    rival: Rival;
    items: Item[];
    inventory: InventoryItem[];
    onVictory: (rival: Rival) => void;
    onDefeat: () => void;
    onRun: () => void;
    onUseItemInBattle: (inventoryItemId: string) => void;
}

export const BattleArenaScreen: React.FC<BattleArenaScreenProps> = ({
    user,
    rival,
    items,
    inventory,
    onVictory,
    onDefeat,
    onRun,
    onUseItemInBattle,
}) => {
    const effective = computeEffectiveAttributes(user, inventory, items);

    // Battle dynamic states
    const [playerHp, setPlayerHp] = useState<number>(user.hp);
    const [playerStamina, setPlayerStamina] = useState<number>(user.stamina);
    const [rivalHp, setRivalHp] = useState<number>(rival.hp);

    const [battleState, setBattleState] = useState<BattleState>('PLAYER_TURN');
    const [isPlayerDefending, setIsPlayerDefending] = useState<boolean>(false);
    const [isRivalDefending, setIsRivalDefending] = useState<boolean>(false);

    // Animations
    const [playerAnimation, setPlayerAnimation] = useState<SpriteAnimation>('idle');
    const [rivalAnimation, setRivalAnimation] = useState<SpriteAnimation>('idle');
    const [shakeScreen, setShakeScreen] = useState<boolean>(false);

    // Floating battle popups
    const [playerFloatingText, setPlayerFloatingText] = useState<string | null>(null);
    const [rivalFloatingText, setRivalFloatingText] = useState<string | null>(null);

    // Battle logs
    const [logs, setLogs] = useState<BattleLogEntry[]>([
        {
            id: 'log-0',
            text: `Wild ${rival.username} appeared! What will ${user.username} do?`,
            type: 'info',
        },
    ]);

    const addLog = (text: string, type: BattleLogEntry['type']) => {
        setLogs((prev) => [...prev.slice(-4), { id: `log-${Date.now()}-${Math.random()}`, text, type }]);
    };

    // Handle Player ATTACK
    const handlePlayerAttack = () => {
        if (battleState !== 'PLAYER_TURN') return;
        setBattleState('ACTION_SELECTED');
        setIsPlayerDefending(false);

        chiptune.playAttack();
        setPlayerAnimation('attack');

        setTimeout(() => {
            // Calculate Damage scaled by strength, discipline, wellness, and willpower
            const wellnessBonus = (effective.total.str + effective.total.int + effective.total.end + effective.total.res + effective.total.dis + effective.total.wil) / 6;
            const { damage, isCrit } = calculateBattleDamage(
                effective.total.str,
                rival.attributes.res,
                false,
                isRivalDefending,
                0.05 + effective.total.dis * 0.015,
                user.level,
                effective.total.dis,
                effective.total.wil,
                wellnessBonus
            );

            setRivalHp((prev) => Math.max(0, prev - damage));
            setRivalAnimation('hit');
            chiptune.playHit();
            if (isCrit) chiptune.playCrit();

            setRivalFloatingText(isCrit ? `CRIT! -${damage} HP` : `-${damage} HP`);
            addLog(
                isCrit
                    ? `${user.username} landed a CRITICAL HIT for ${damage} damage!`
                    : `${user.username} struck ${rival.username} for ${damage} damage.`,
                isCrit ? 'crit' : 'player_atk'
            );

            setTimeout(() => {
                setPlayerAnimation('idle');
                setRivalAnimation('idle');
                setRivalFloatingText(null);

                // Check battle end
                if (rivalHp - damage <= 0) {
                    triggerVictory();
                } else {
                    startEnemyTurn();
                }
            }, 450);
        }, 250);
    };

    // Handle Player SPECIAL SKILL
    const handlePlayerSpecial = () => {
        if (battleState !== 'PLAYER_TURN') return;
        if (playerStamina < 20) {
            addLog('Not enough Stamina! Need 20 Stamina.', 'system');
            return;
        }

        setBattleState('ACTION_SELECTED');
        setPlayerStamina((prev) => Math.max(0, prev - 20));
        setIsPlayerDefending(false);

        chiptune.playCrit();
        setPlayerAnimation('attack');
        setShakeScreen(true);

        setTimeout(() => {
            const wellnessBonus = (effective.total.str + effective.total.int + effective.total.end + effective.total.res + effective.total.dis + effective.total.wil) / 6;
            const { damage, isCrit } = calculateBattleDamage(
                effective.total.int,
                rival.attributes.res,
                true,
                isRivalDefending,
                0.15 + effective.total.dis * 0.02,
                user.level,
                effective.total.dis,
                effective.total.wil,
                wellnessBonus
            );

            setRivalHp((prev) => Math.max(0, prev - damage));
            setRivalAnimation('hit');
            chiptune.playHit();

            setRivalFloatingText(isCrit ? `CRIT SPECIAL! -${damage} HP` : `SPECIAL! -${damage} HP`);
            addLog(
                `${user.username} unleashed a Focus Surge on ${rival.username} for ${damage} damage!`,
                'crit'
            );

            setTimeout(() => {
                setPlayerAnimation('idle');
                setRivalAnimation('idle');
                setRivalFloatingText(null);
                setShakeScreen(false);

                if (rivalHp - damage <= 0) {
                    triggerVictory();
                } else {
                    startEnemyTurn();
                }
            }, 450);
        }, 250);
    };

    // Handle Player DEFEND
    const handlePlayerDefend = () => {
        if (battleState !== 'PLAYER_TURN') return;
        setBattleState('ACTION_SELECTED');
        setIsPlayerDefending(true);

        chiptune.playCursor();
        setPlayerFloatingText('DEFENDING!');
        addLog(`${user.username} assumed a defensive posture. Damage will be reduced!`, 'info');

        setTimeout(() => {
            setPlayerFloatingText(null);
            startEnemyTurn();
        }, 350);
    };

    // Handle Player RECOVER
    const handlePlayerRecover = () => {
        if (battleState !== 'PLAYER_TURN') return;
        setBattleState('ACTION_SELECTED');

        chiptune.playHeal();
        const healAmount = Math.max(10, Math.floor(user.level * 3.5 + effective.total.wil * 1.8));
        const staminaRestore = 25;

        setPlayerHp((prev) => Math.min(user.maxHp, prev + healAmount));
        setPlayerStamina((prev) => Math.min(user.maxStamina, prev + staminaRestore));

        setPlayerFloatingText(`+${healAmount} HP`);
        addLog(
            `${user.username} took a mindful breath, recovering ${healAmount} HP & ${staminaRestore} Stamina!`,
            'heal'
        );

        setTimeout(() => {
            setPlayerFloatingText(null);
            startEnemyTurn();
        }, 350);
    };

    // Enemy Turn Loop
    const startEnemyTurn = () => {
        setBattleState('ENEMY_TURN');
        setIsRivalDefending(false);

        setTimeout(() => {
            // Enemy decision logic
            const willSpecial = Math.random() < 0.35;
            const isDefend = Math.random() < 0.15;

            if (isDefend) {
                setIsRivalDefending(true);
                chiptune.playCursor();
                setRivalFloatingText('GUARDING!');
                addLog(`${rival.username} guarded their stance!`, 'info');

                setTimeout(() => {
                    setRivalFloatingText(null);
                    setBattleState('PLAYER_TURN');
                }, 350);
                return;
            }

            setRivalAnimation('attack');
            chiptune.playAttack();

            setTimeout(() => {
                const rivalWellness = (rival.attributes.str + rival.attributes.int + rival.attributes.end + rival.attributes.res + rival.attributes.dis + rival.attributes.wil) / 6;
                const { damage, isCrit } = calculateBattleDamage(
                    rival.attributes.str,
                    effective.total.res,
                    willSpecial,
                    isPlayerDefending,
                    0.1,
                    rival.level,
                    rival.attributes.dis,
                    rival.attributes.wil,
                    rivalWellness
                );

                setPlayerHp((prev) => Math.max(0, prev - damage));
                setPlayerAnimation('hit');
                chiptune.playHit();
                if (damage > 15) setShakeScreen(true);

                setPlayerFloatingText(isCrit ? `CRIT! -${damage} HP` : `-${damage} HP`);
                addLog(
                    willSpecial
                        ? `${rival.username} used ${rival.specialSkillName} dealing ${damage} damage!`
                        : `${rival.username} attacked ${user.username} for ${damage} damage.`,
                    'enemy_atk'
                );

                setTimeout(() => {
                    setPlayerAnimation('idle');
                    setRivalAnimation('idle');
                    setPlayerFloatingText(null);
                    setShakeScreen(false);

                    if (playerHp - damage <= 0) {
                        triggerDefeat();
                    } else {
                        setBattleState('PLAYER_TURN');
                    }
                }, 450);
            }, 250);
        }, 450);
    };

    const triggerVictory = () => {
        setBattleState('VICTORY');
        setPlayerAnimation('victory');
        setRivalAnimation('defeat');
        chiptune.playVictory();
        addLog(`Victory! ${rival.username} was overcome by your discipline!`, 'crit');
    };

    const triggerDefeat = () => {
        setBattleState('DEFEAT');
        setPlayerAnimation('defeat');
        chiptune.playDefeat();
        addLog(`${user.username} collapsed from exhaustion. Rest and return stronger!`, 'system');
    };

    return (
        <div className={`space-y-4 select-none ${shakeScreen ? 'animate-pixel-shake' : ''}`}>
            {/* BATTLE ARENA STAGE (RETRO BATTLEFIELD VIEW) */}
            <div className="relative w-full bg-[#1e283d] border-4 border-[#120e1d] p-4 sm:p-6 shadow-[6px_6px_0px_#120e1d] min-h-[380px] flex flex-col justify-between overflow-hidden">
                {/* Background Retro Grid Lines / Horizon */}
                <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_bottom,#3b82f6_1px,transparent_1px),linear-gradient(to_right,#3b82f6_1px,transparent_1px)] bg-[size:24px_24px]" />

                {/* TOP ROW: Rival Character + Rival HP Card */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 z-10">
                    {/* Rival HP Card */}
                    <div className="w-full sm:w-64 bg-[#f5eedb] border-4 border-[#120e1d] p-2.5 shadow-[3px_3px_0px_#120e1d]">
                        <div className="flex items-center justify-between font-pixel text-xs text-[#181425] mb-1">
                            <span className="font-bold">{rival.username}</span>
                            <span className="text-[10px] text-[#2563eb]">LV. {rival.level}</span>
                        </div>
                        <StatBar label="HP" current={rivalHp} max={rival.maxHp} type="hp" />
                    </div>

                    {/* Rival Sprite Container with Floating Damage */}
                    <div className="relative flex flex-col items-center">
                        {rivalFloatingText && (
                            <div className="absolute -top-6 font-pixel text-sm text-[#ef4444] bg-white px-2 py-0.5 border-2 border-black animate-bounce shadow-[2px_2px_0px_#000] z-20">
                                {rivalFloatingText}
                            </div>
                        )}
                        <div className="w-28 h-28 sm:w-36 sm:h-36 bg-[#2d3a54] border-2 border-[#43557a] flex items-center justify-center p-2 shadow-[inset_2px_2px_0px_#000]">
                            <CharacterSprite id={rival.avatarId} size={96} animation={rivalAnimation} />
                        </div>
                    </div>
                </div>

                {/* BOTTOM ROW: Player Sprite + Player HP/Stamina Card */}
                <div className="flex flex-col-reverse sm:flex-row items-center sm:items-end justify-between gap-4 mt-6 z-10">
                    {/* Player Sprite Container with Floating Damage */}
                    <div className="relative flex flex-col items-center">
                        {playerFloatingText && (
                            <div className="absolute -top-6 font-pixel text-sm text-[#10b981] bg-white px-2 py-0.5 border-2 border-black animate-bounce shadow-[2px_2px_0px_#000] z-20">
                                {playerFloatingText}
                            </div>
                        )}
                        <div className="w-28 h-28 sm:w-36 sm:h-36 bg-[#2d3a54] border-2 border-[#43557a] flex items-center justify-center p-2 shadow-[inset_2px_2px_0px_#000]">
                            <CharacterSprite
                                id={user.avatarId}
                                size={96}
                                animation={playerAnimation}
                                flipped={true}
                            />
                        </div>
                    </div>

                    {/* Player HP & Stamina Card */}
                    <div className="w-full sm:w-72 bg-[#f5eedb] border-4 border-[#120e1d] p-3 shadow-[3px_3px_0px_#120e1d] space-y-2">
                        <div className="flex items-center justify-between font-pixel text-xs text-[#181425]">
                            <span className="font-bold">{user.username}</span>
                            <span className="text-[10px] text-[#2563eb]">LV. {user.level}</span>
                        </div>
                        <StatBar label="HP" current={playerHp} max={user.maxHp} type="hp" />
                        <StatBar
                            label="STAMINA"
                            current={playerStamina}
                            max={user.maxStamina}
                            type="stamina"
                        />
                    </div>
                </div>
            </div>

            {/* BATTLE COMMANDS & LOG PANEL */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Battle Log Box */}
                <div className="lg:col-span-7">
                    <RpgWindow variant="dark" title="BATTLE CHRONICLE">
                        <div className="h-28 overflow-y-auto space-y-1.5 font-silkscreen text-xs text-[#d1c5e8] bg-[#120e1d] p-2.5 border border-[#271f3b]">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className={`leading-relaxed ${log.type === 'crit'
                                            ? 'text-[#fec83e] font-bold'
                                            : log.type === 'player_atk'
                                                ? 'text-[#86efac]'
                                                : log.type === 'enemy_atk'
                                                    ? 'text-[#fca5a5]'
                                                    : log.type === 'heal'
                                                        ? 'text-[#93c5fd]'
                                                        : 'text-[#e2e8f0]'
                                        }`}
                                >
                                    ▶ {log.text}
                                </div>
                            ))}
                        </div>
                    </RpgWindow>
                </div>

                {/* Command Menu */}
                <div className="lg:col-span-5">
                    <RpgWindow
                        variant="parchment"
                        title={battleState === 'PLAYER_TURN' ? 'CHOOSE MOVE:' : 'RESOLVING TURN...'}
                    >
                        {battleState === 'VICTORY' ? (
                            <div className="text-center space-y-3 py-2">
                                <div className="font-pixel text-sm text-[#15803d]">
                                    VICTORY ACHIEVED!
                                </div>
                                <p className="font-silkscreen text-xs text-[#4b4131]">
                                    Victory Honors: +{rival.winRewardXp} XP earned!
                                </p>
                                <PixelButton
                                    variant="gold"
                                    size="md"
                                    className="w-full"
                                    onClick={() => onVictory(rival)}
                                >
                                    CLAIM VICTORY & RETURN ▶
                                </PixelButton>
                            </div>
                        ) : battleState === 'DEFEAT' ? (
                            <div className="text-center space-y-3 py-2">
                                <div className="font-pixel text-sm text-[#b91c1c]">
                                    TRAINER DEFEATED
                                </div>
                                <p className="font-silkscreen text-xs text-[#4b4131]">
                                    Focus on your real-world habits to build stamina and return stronger.
                                </p>
                                <PixelButton
                                    variant="red"
                                    size="md"
                                    className="w-full"
                                    onClick={onDefeat}
                                >
                                    RETREAT & RECOVER ▶
                                </PixelButton>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <PixelButton
                                    variant="parchment"
                                    size="sm"
                                    disabled={battleState !== 'PLAYER_TURN'}
                                    onClick={handlePlayerAttack}
                                >
                                    ATTACK
                                </PixelButton>

                                <PixelButton
                                    variant="blue"
                                    size="sm"
                                    disabled={battleState !== 'PLAYER_TURN' || playerStamina < 20}
                                    onClick={handlePlayerSpecial}
                                >
                                    SPECIAL (-20)
                                </PixelButton>

                                <PixelButton
                                    variant="parchment"
                                    size="sm"
                                    disabled={battleState !== 'PLAYER_TURN'}
                                    onClick={handlePlayerDefend}
                                >
                                    DEFEND
                                </PixelButton>

                                <PixelButton
                                    variant="green"
                                    size="sm"
                                    disabled={battleState !== 'PLAYER_TURN'}
                                    onClick={handlePlayerRecover}
                                >
                                    RECOVER
                                </PixelButton>

                                <PixelButton
                                    variant="dark"
                                    size="sm"
                                    disabled={battleState !== 'PLAYER_TURN'}
                                    onClick={onRun}
                                >
                                    RUN
                                </PixelButton>
                            </div>
                        )}
                    </RpgWindow>
                </div>
            </div>
        </div>
    );
};