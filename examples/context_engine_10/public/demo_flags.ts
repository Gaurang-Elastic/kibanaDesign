/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { BehaviorSubject } from 'rxjs';

export type CatalogDemoState = 'learning' | 'working';

/** Setup experience explorations. Off leaves the aligned prototype unchanged. */
export type SetupExploration = 'off' | 'stepped' | 'grouped' | 'coverage' | 'usage' | 'graph' | 'treemap';

/** Real advances a stage every 40 seconds. Fast finishes the five stages in 20 seconds. */
export type GenerationSpeed = 'real' | 'fast';

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
export const MEMORY_ENABLED = false;

/** "Next: create an automation" banner. Off; the ready callout stays until dismissed. */
export const NEXT_STEP_BANNER = false;

/** Three-page wizard stays a public-preview exploration. Default off. */
export const WIZARD_ENABLED = false;

/** Setup step rail. Default off; the build's next step is the self-closing callout. */
export const STEP_RAIL_ENABLED = false;

export interface DemoFlags {
  catalogState: CatalogDemoState;
  skillUnavailable: boolean;
  nextRunEmpty: boolean;
  sharedDestinationKis: boolean;
  feedbackLoopEnabled: boolean;
  feedbackLoopColdStart: boolean;
  feedbackLoopHealthy: boolean;
  setupExploration: SetupExploration;
  generationSpeed: GenerationSpeed;
}

export const demoFlags$ = new BehaviorSubject<DemoFlags>({
  catalogState: 'working',
  skillUnavailable: false,
  nextRunEmpty: false,
  sharedDestinationKis: false,
  feedbackLoopEnabled: FEEDBACK_LOOP_ENABLED,
  feedbackLoopColdStart: false,
  feedbackLoopHealthy: false,
  setupExploration: 'off',
  generationSpeed: 'fast',
});

const patch = (partial: Partial<DemoFlags>) => {
  demoFlags$.next({ ...demoFlags$.value, ...partial });
};

export const setDemoCatalogState = (catalogState: CatalogDemoState) => patch({ catalogState });
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
export const setDemoSetupExploration = (setupExploration: SetupExploration) =>
  patch({ setupExploration });
export const setDemoGenerationSpeed = (generationSpeed: GenerationSpeed) =>
  patch({ generationSpeed });
