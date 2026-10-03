/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export type Proto11GoalId = 'indices' | 'multi' | 'docs' | 'entities' | 'gaps';

export type Proto11TemplateId = 'overview' | 'xsource' | 'digest' | 'profiles' | 'gaps';

export type Proto11SourceId =
  | 'nginx-access'
  | 'nginx-error'
  | 'cpu'
  | 'runbooks'
  | 'k8s'
  | 'enrollment'
  | 'tuition'
  | 'peers';

export type Proto11SampleScenario = 'web-ops' | 'higher-ed';

export interface ConnectedAgent {
  name: string;
  /** Relative time of the last retrieval. Undefined until one is recorded. */
  lastRetrieval?: string;
}

export type Proto11RunStatus = 'firstPass' | 'sampleReady' | 'running' | 'enabled' | 'needsAgent';

/** firstPass: building from a sample. sampleReady: waiting for Run on all data. */
export type Proto11Phase = 'firstPass' | 'sampleReady' | 'fullRun' | 'complete';

/** rerunning: re-running rejected KIs. fixed: success note showing. done: note closed. */
export type Proto11FixState = 'none' | 'rerunning' | 'fixed' | 'done';

export interface Proto11Meta {
  goal: Proto11GoalId;
  sample?: boolean;
  /** Which sample dataset. Undefined on older samples, which are web-ops. */
  scenario?: Proto11SampleScenario;
  connectedAgents?: ConnectedAgent[];
  /** Frozen at creation so editing Sources does not change a running pass. */
  sourceIds: Proto11SourceId[];
  /** Templates that run in the first pass. */
  runTemplates: Proto11TemplateId[];
  agent?: string;
  phase: Proto11Phase;
  tick: number;
  written: { sample: number; full: number; fixed: number };
  fix: Proto11FixState;
  fixTick: number;
  /** KI ids opened from the Knowledge Indicators tab. */
  lookedAt: string[];
  checkHidden: boolean;
}
