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

export type Proto11SampleScenario = 'web-ops' | 'higher-ed' | 'large';

export interface ConnectedAgent {
  name: string;
  /** Relative time of the last retrieval. Undefined until one is recorded. */
  lastRetrieval?: string;
  /** Ships with a sample AI index rather than being connected by the user. */
  sample?: boolean;
  /** Quiet status on the Used by row, such as a coding agent that just connected. */
  connectedNote?: string;
}

/** Shown once, under the first-pass callout, until the user saves or dismisses it. */
export interface Proto11ConnectGuide {
  mode: 'agent' | 'outside';
  /** Set when an agent was attached at creation. */
  agentName?: string;
  /** Two sentences, specific to this index. */
  prompt: string;
}

export type Proto11RunStatus = 'firstPass' | 'sampleReady' | 'running' | 'enabled' | 'needsAgent';

/** firstPass: building from a sample. sampleReady: waiting for Run on all data. */
export type Proto11Phase = 'firstPass' | 'sampleReady' | 'fullRun' | 'complete';

/** rerunning: re-running rejected KIs. fixed: success note showing. done: note closed. */
export type Proto11FixState = 'none' | 'rerunning' | 'fixed' | 'done';

export interface Proto11ChatTurn {
  role: 'user' | 'agent';
  text: string;
}

/** confirm: the card asks. declined: Not now was chosen. rerun: the re-run was confirmed. */
export interface Proto11FixChat {
  card: 'confirm' | 'declined' | 'rerun';
  /** Turns after the agent's first message, which ends with the card. */
  turns: Proto11ChatTurn[];
}

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
  /** Automation whose card opened the fix. Absent until Fix is clicked. */
  fixAutomationId?: string;
  /** Produces count on that card when the re-run started, so the saved ones add to it. */
  fixProducesBase?: number;
  /** Lives on the meta so the run can post to it while the panel is closed. */
  fixChat?: Proto11FixChat;
  /** KI ids opened from the Knowledge Indicators tab. */
  lookedAt: string[];
  checkHidden: boolean;
  /** A later automation running its own sample pass on an index that already exists. */
  addon?: Proto11AddonRun;
  /** Present only until the user saves or dismisses the creation connect guide. */
  connectGuide?: Proto11ConnectGuide;
  /** The coding agent, or a later run, saved the first memory. */
  firstMemoryReceived?: boolean;
  /** First words shown for the memory step once one is saved. */
  firstMemoryLine?: string;
  /** The coding-agent prompt turned traces on. */
  tracesViaPrompt?: boolean;
  /** Title of the first Knowledge Indicator an agent retrieved. */
  firstRetrievalTitle?: string;
  /** Step the rail opens on for a shortcut, such as the coding-agent index. */
  onboardingView?: 'describe' | 'source' | 'indicators' | 'agent' | 'traces' | 'memory';
  /** The collapsed setup rail was hidden. */
  setupDismissed?: boolean;
  /** Set once steps 1 to 4 are done, so later runs stay on the Ready page. */
  setupFinished?: boolean;
}

/** Sample pass for an automation added to an existing AI index. */
export interface Proto11AddonRun {
  template: Proto11TemplateId;
  sourceIds: Proto11SourceId[];
  automationId: string;
  tick: number;
  written: number;
  phase: 'firstPass' | 'sampleReady';
}
