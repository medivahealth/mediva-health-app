/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import VoiceAgent from './components/VoiceAgent';
import { motion, AnimatePresence } from 'motion/react';

function readVoiceEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search);
  return p.get('embed') === '1' || p.get('autostart') === '1';
}

export default function App() {
  const voiceEmbed = useMemo(() => readVoiceEmbed(), []);
  const [isAgentOpen, setIsAgentOpen] = useState(voiceEmbed);

  return (
    <div className="flex min-h-[100dvh] min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4 py-8 supports-[padding:max(0px)]:pb-[max(1.5rem,env(safe-area-inset-bottom))] supports-[padding:max(0px)]:pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:py-10">
      <AnimatePresence mode="wait">
        {!isAgentOpen ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full max-w-[20rem] flex-col items-center space-y-10 sm:max-w-xs sm:space-y-16"
          >
            {/* Title Section */}
            <div className="space-y-3 text-center sm:space-y-4">
              <h1 className="text-5xl font-light tracking-tighter text-white sm:text-6xl">Mediva</h1>
              <p className="text-base font-light tracking-wide text-zinc-500 sm:text-lg">
                Your Personal AI Doctor
              </p>
            </div>

            {/* Talk Button */}
            <button
              type="button"
              onClick={() => setIsAgentOpen(true)}
              className="min-h-[52px] w-full rounded-xl bg-white py-4 text-lg font-bold uppercase tracking-[0.2em] text-black transition-all active:scale-[0.98] sm:py-5 sm:text-xl sm:hover:bg-zinc-200"
            >
              Talk
            </button>
          </motion.div>
        ) : (
          <VoiceAgent
            embed={voiceEmbed}
            onClose={() => setIsAgentOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
