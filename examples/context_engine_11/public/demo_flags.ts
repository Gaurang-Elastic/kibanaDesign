/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { BehaviorSubject } from 'rxjs';

/** Empty is Proto 11 only: no AI indices besides the managed one. Off treats it as Learning. */
export type CatalogDemoState = 'empty' | 'learning' | 'working';

/**
 * Forward-looking feedback loop (Signals + Improvements).
 * Set false to hide the tab for October demos.
 */
export const FEEDBACK_LOOP_ENABLED = false;

/** Overview retrieval stats row. Hidden until the numbers are ready to show. */
export const OVERVIEW_STATS_ENABLED = false;

/** Overview "Try a question" panel. Hidden until that demo is ready again. */
export const TRY_QUESTION_ENABLED = false;

/** This proto is the Context Engine. Memory is only meaningful when this is on. */
export const CONTEXT_ENGINE_ENABLED = true;

/** M3 memory switch. Hide the toggle entirely when off. */
export const MEMORY_ENABLED = true;

/** The memory switch needs both the M3 flag and the Context Engine. */
export const SHOW_MEMORY_TOGGLE = MEMORY_ENABLED && CONTEXT_ENGINE_ENABLED;

export const MEMORY_SWITCH_LABEL = 'Let agents store task memory in this AI index';
export const MEMORY_HELPER =
  'Agents using this index can save what they learn during a task and recall it later. Memories are visible to anyone with access to the index.';

/** "Next: create an automation" banner. Off; the ready callout stays until dismissed. */
export const NEXT_STEP_BANNER = false;

/** Three-page wizard stays a public-preview exploration. Default off. */
export const WIZARD_ENABLED = false;

/** Setup step rail. Default off; the build's next step is the self-closing callout. */
export const STEP_RAIL_ENABLED = false;

/** Usage tab and the Overview Summary card. On in this proto, shown only as On + Usage. */
export const USAGE_ENABLED = true;

/** Storage key for the Proto 11 switcher. Off when nothing is stored. */
export const PROTO11_SETUP = 'contextEngineExample11.PROTO11_SETUP';

/** Off renders v2.4. On is Proto 11. Memory and Usage are separate explorations. */
export type Proto11Mode = 'off' | 'on' | 'memory' | 'usage';

const loadProto11Mode = (): Proto11Mode => {
  if (typeof window === 'undefined') return 'off';
  try {
    const stored = window.localStorage.getItem(PROTO11_SETUP);
    if (stored === 'on' || stored === 'memory') return stored;
    if (stored === 'usage' && USAGE_ENABLED) return stored;
    return 'off';
  } catch {
    return 'off';
  }
};

const initialProto11Mode = loadProto11Mode();

export interface DemoFlags {
  catalogState: CatalogDemoState;
  /** Proto 11 opinionated setup. Off renders v2.4 unchanged. */
  proto11Setup: boolean;
  /** On + Memory. Shows the Memories tab where the memory switch is on. */
  proto11Memory: boolean;
  /** On + Usage. Shows the Usage tab and the Overview Summary card. */
  proto11Usage: boolean;
  skillUnavailable: boolean;
  nextRunEmpty: boolean;
  sharedDestinationKis: boolean;
  feedbackLoopEnabled: boolean;
  feedbackLoopColdStart: boolean;
  feedbackLoopHealthy: boolean;
}

export const demoFlags$ = new BehaviorSubject<DemoFlags>({
  catalogState: 'working',
  proto11Setup: initialProto11Mode !== 'off',
  proto11Memory: initialProto11Mode === 'memory',
  proto11Usage: initialProto11Mode === 'usage',
  skillUnavailable: false,
  nextRunEmpty: false,
  sharedDestinationKis: false,
  feedbackLoopEnabled: FEEDBACK_LOOP_ENABLED,
  feedbackLoopColdStart: false,
  feedbackLoopHealthy: false,
});

const patch = (partial: Partial<DemoFlags>) => {
  demoFlags$.next({ ...demoFlags$.value, ...partial });
};

export const setDemoCatalogState = (catalogState: CatalogDemoState) => patch({ catalogState });
export const setDemoProto11Mode = (mode: Proto11Mode) => {
  try {
    window.localStorage.setItem(PROTO11_SETUP, mode);
  } catch {
    // Private mode. The switcher still works for this mount.
  }
  patch({
    proto11Setup: mode !== 'off',
    proto11Memory: mode === 'memory',
    proto11Usage: mode === 'usage',
  });
};
export const setDemoProto11Setup = (proto11Setup: boolean) => {
  setDemoProto11Mode(proto11Setup ? 'on' : 'off');
};
export const setDemoSkillUnavailable = (skillUnavailable: boolean) => patch({ skillUnavailable });
export const setDemoNextRunEmpty = (nextRunEmpty: boolean) => patch({ nextRunEmpty });
export const setDemoSharedDestinationKis = (sharedDestinationKis: boolean) =>
  patch({ sharedDestinationKis });
export const setDemoFeedbackLoopEnabled = (feedbackLoopEnabled: boolean) =>
  patch({ feedbackLoopEnabled });
export const setDemoFeedbackLoopColdStart = (feedbackLoopColdStart: boolean) =>
  patch({ feedbackLoopColdStart });
export const setDemoFeedbackLoopHealthy = (feedbackLoopHealthy: boolean) =>
  patch({ feedbackLoopHealthy });
