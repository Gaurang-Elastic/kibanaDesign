/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SETUP_SCRIPT } from '../constants';
import type { ContextEngineMessage } from '../types';

const createMessageId = (index: number): string => `ce-msg-${Date.now()}-${index}`;

export const useContextEngineSetup = () => {
  const [messages, setMessages] = useState<ContextEngineMessage[]>([]);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const clearActiveTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const playNextAgentStep = useCallback((fromIndex: number) => {
    const runAgentStep = (index: number) => {
      const step = SETUP_SCRIPT[index];
      if (!step || step.role !== 'agent') {
        return;
      }

      setIsTyping(true);
      timeoutRef.current = window.setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, { ...step, id: createMessageId(index) }]);

        const next = index + 1;
        setScriptIndex(next);

        if (SETUP_SCRIPT[next]?.role === 'agent') {
          timeoutRef.current = window.setTimeout(() => runAgentStep(next), 600);
        }
      }, 1100 + Math.random() * 500);
    };

    runAgentStep(fromIndex);
  }, []);

  const sendUserMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(scriptIndex),
          role: 'user',
          text: trimmed,
          embed: null,
          suggestions: [],
        },
      ]);

      let next = scriptIndex;
      if (SETUP_SCRIPT[next]?.role === 'user') {
        next += 1;
      }

      setScriptIndex(next);
      timeoutRef.current = window.setTimeout(() => {
        playNextAgentStep(next);
      }, 300);
    },
    [playNextAgentStep, scriptIndex]
  );

  const start = useCallback(() => {
    if (hasStarted) {
      return;
    }
    setHasStarted(true);
    playNextAgentStep(0);
  }, [hasStarted, playNextAgentStep]);

  const reset = useCallback(() => {
    clearActiveTimeout();
    setHasStarted(false);
    setIsTyping(false);
    setScriptIndex(0);
    setMessages([]);
  }, [clearActiveTimeout]);

  useEffect(() => {
    return () => {
      clearActiveTimeout();
    };
  }, [clearActiveTimeout]);

  return { hasStarted, messages, isTyping, sendUserMessage, start, reset };
};
