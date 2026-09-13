import React, { useState } from 'react';
import { DuelChallenge, User } from '../../types';
import { PixelButton } from '../rpg/PixelButton';
import { CharacterSprite } from '../rpg/CharacterSprite';
import { chiptune } from '../../services/audio';

interface DuelChallengeModalProps {
  challenges: DuelChallenge[];
  currentUser: User;
  onAccept: (challenge: DuelChallenge) => Promise<void>;
  onDecline: (challenge: DuelChallenge) => Promise<void>;
  onClose: () => void;
}

export const DuelChallengeModal: React.FC<DuelChallengeModalProps> = ({
  challenges,
  currentUser,
  onAccept,
  onDecline,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!challenges || challenges.length === 0) {
    return null;
  }

  const activeIndex = Math.min(currentIndex, challenges.length - 1);
  const chal = challenges[activeIndex];

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMsg(null);
    chiptune.playLevelUp();
    try {
      await onAccept(chal);
    } catch (err: any) {
      console.error('Failed to accept challenge:', err);
      setErrorMsg(err?.message || 'Failed to start battle. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMsg(null);
    chiptune.playCursor();
    try {
      await onDecline(chal);
      setIsProcessing(false);
      if (challenges.length <= 1) {
        onClose();
      } else if (activeIndex >= challenges.length - 1) {
        setCurrentIndex(Math.max(0, activeIndex - 1));
      }
    } catch (err: any) {
      console.error('Failed to decline challenge:', err);
      setErrorMsg('Failed to decline. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="duel-challenge-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 overflow-y-auto backdrop-blur-xs select-none"
    >
      <div
        id="duel-challenge-modal"
        className="w-full max-w-lg bg-[#f5eedb] border-4 border-[#120e1d] shadow-[8px_8px_0px_#120e1d] p-4 sm:p-6 my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b-4 border-[#120e1d] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#dc2626] animate-ping shrink-0" />
            <span className="font-pixel text-[11px] sm:text-xs bg-[#dc2626] text-white px-2 py-0.5 border border-[#7f1d1d] tracking-wider">
              REAL-TIME ARENA
            </span>
            <h2 className="font-pixel text-sm sm:text-base text-[#120e1d]">
              DUEL CHALLENGE!
            </h2>
          </div>

          <button
            onClick={() => {
              chiptune.playCursor();
              onClose();
            }}
            className="font-pixel text-xs text-[#78716c] hover:text-[#120e1d] p-1 border border-transparent hover:border-[#120e1d]"
            title="Decide later"
          >
            ✕ MINIMIZE
          </button>
        </div>

        {/* MULTI-CHALLENGE NAVIGATOR */}
        {challenges.length > 1 && (
          <div className="flex items-center justify-between bg-[#e5dbc5] border-2 border-[#120e1d] px-3 py-1.5 mb-3">
            <span className="font-pixel text-[10px] text-[#443825]">
              CHALLENGE {activeIndex + 1} OF {challenges.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={activeIndex === 0 || isProcessing}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="font-pixel text-[10px] px-2 py-0.5 bg-[#f5eedb] border border-[#120e1d] disabled:opacity-40"
              >
                ◀ PREV
              </button>
              <button
                disabled={activeIndex === challenges.length - 1 || isProcessing}
                onClick={() => setCurrentIndex((prev) => Math.min(challenges.length - 1, prev + 1))}
                className="font-pixel text-[10px] px-2 py-0.5 bg-[#f5eedb] border border-[#120e1d] disabled:opacity-40"
              >
                NEXT ▶
              </button>
            </div>
          </div>
        )}

        {/* ERROR DISPLAY */}
        {errorMsg && (
          <div className="bg-[#fee2e2] border-2 border-[#dc2626] p-2.5 mb-3 font-silkscreen text-xs text-[#991b1b]">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* CHALLENGER DOSSIER CARD */}
        <div className="bg-[#ede3ce] border-4 border-[#120e1d] p-3.5 sm:p-4 mb-4 shadow-[3px_3px_0px_#120e1d]">
          <div className="flex items-start sm:items-center gap-4">
            {/* Sprite Avatar */}
            <div className="w-18 h-18 sm:w-20 sm:h-20 bg-[#181425] border-2 border-[#120e1d] p-1 shrink-0 flex items-center justify-center shadow-[inset_2px_2px_0px_#000] relative">
              <CharacterSprite id={chal.challengerAvatarId} level={chal.challengerLevel} size={56} />
              <span className="absolute -bottom-2.5 font-pixel text-[9px] bg-[#201933] text-[#fec83e] px-1.5 border border-[#120e1d]">
                LV.{chal.challengerLevel}
              </span>
            </div>

            {/* Name & Vitals */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-pixel text-sm sm:text-base text-[#181425] font-bold">
                  {chal.challengerName}
                </h3>
                <span className="font-silkscreen text-[11px] text-[#6b5c46]">
                  ({chal.challengerTitle || 'Real Player'})
                </span>
              </div>

              {/* Stats pill badges */}
              <div className="flex flex-wrap items-center gap-2 mt-2 font-pixel text-[10px]">
                <span className="bg-[#fee2e2] text-[#991b1b] border border-[#f87171] px-2 py-0.5">
                  HP: {chal.challengerStats?.maxHp || 40}
                </span>
                <span className="bg-[#e0e7ff] text-[#3730a3] border border-[#818cf8] px-2 py-0.5">
                  STA: {chal.challengerStats?.maxStamina || 45}
                </span>
                <span className="bg-[#fef3c7] text-[#92400e] border border-[#fcd34d] px-2 py-0.5">
                  STR: {chal.challengerStats?.attributes?.str ?? 10}
                </span>
                <span className="bg-[#dcfce7] text-[#166534] border border-[#86efac] px-2 py-0.5">
                  INT: {chal.challengerStats?.attributes?.int ?? 10}
                </span>
              </div>
            </div>
          </div>

          {/* Invitation Speech Bubble */}
          <div className="mt-3.5 bg-[#fdfbf7] border-2 border-[#cbb994] p-2.5 font-silkscreen text-xs text-[#453823] leading-relaxed italic">
            &ldquo;I challenge you to an honor duel of real-world discipline and strength! Will you face me in the arena?&rdquo;
          </div>
        </div>

        {/* PRIMARY ACTION BUTTONS: ACCEPT OR DECLINE */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* ACCEPT BUTTON */}
            <PixelButton
              variant="green"
              size="lg"
              className="w-full justify-center text-xs sm:text-sm py-3 shadow-[3px_3px_0px_#000]"
              onClick={handleAccept}
              disabled={isProcessing}
            >
              {isProcessing ? '⚔ COMMENCING...' : '⚔ ACCEPT & FIGHT NOW'}
            </PixelButton>

            {/* DECLINE BUTTON */}
            <PixelButton
              variant="dark"
              size="lg"
              className="w-full justify-center text-xs sm:text-sm py-3 shadow-[3px_3px_0px_#000]"
              onClick={handleDecline}
              disabled={isProcessing}
            >
              ✕ DECLINE DUEL
            </PixelButton>
          </div>

          {/* DECIDE LATER MINIMIZE LINK */}
          <div className="text-center pt-2">
            <button
              onClick={() => {
                chiptune.playCursor();
                onClose();
              }}
              className="font-silkscreen text-[11px] text-[#78716c] hover:text-[#120e1d] underline hover:no-underline"
            >
              Decide later (keep in top banner)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
