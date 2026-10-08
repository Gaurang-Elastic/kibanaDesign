/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Namespace } from './namespace_data';

export type Proto11SetupStepId =
  | 'describe'
  | 'source'
  | 'indicators'
  | 'agent'
  | 'traces'
  | 'memory';

export interface Proto11SetupStep {
  id: Proto11SetupStepId;
  label: string;
  optional: boolean;
  done: boolean;
}

/** Memory stays on unless the index turns it off. */
export const proto11MemoryOn = (namespace: Namespace): boolean => namespace.memoryEnabled !== false;

const runInProgress = (status: string | undefined): boolean =>
  status === 'firstPass' || status === 'running';

/**
 * The first run has finished. A run that is still going does not count,
 * and a later run does not undo one that already finished.
 */
const indicatorsRunFinished = (namespace: Namespace): boolean =>
  namespace.automations.some(
    (automation) => automation.hasRun && !runInProgress(automation.runStatus)
  ) && !namespace.automations.some((automation) => runInProgress(automation.runStatus));

/** Steps in order. Memory is omitted when the index has Memory off. */
export const proto11SetupSteps = (namespace: Namespace): Proto11SetupStep[] => {
  const meta = namespace.proto11;
  const indicatorsDone = indicatorsRunFinished(namespace);
  const steps: Proto11SetupStep[] = [
    {
      id: 'describe',
      label: 'Describe it',
      optional: false,
      done: namespace.intent.trim().length > 0,
    },
    {
      id: 'source',
      label: 'Connect a source',
      optional: false,
      done: namespace.sources.length > 0,
    },
    {
      id: 'indicators',
      label: 'First Knowledge Indicators',
      optional: false,
      done: indicatorsDone,
    },
    {
      id: 'agent',
      label: 'Connect your agent',
      optional: false,
      done: (meta?.connectedAgents?.length ?? 0) > 0,
    },
    {
      id: 'traces',
      label: 'Add traces',
      optional: true,
      done: (namespace.traces?.length ?? 0) > 0,
    },
  ];
  if (proto11MemoryOn(namespace)) {
    steps.push({
      id: 'memory',
      label: 'First memory',
      optional: true,
      done: Boolean(meta?.firstMemoryReceived),
    });
  }
  return steps;
};

/**
 * The step that owns the ring. The coding-agent index opens on Connect your agent
 * while sources and the first run are still pending.
 */
export const proto11CurrentStepId = (namespace: Namespace): Proto11SetupStepId | undefined => {
  const steps = proto11SetupSteps(namespace);
  const open = (id: Proto11SetupStepId) => steps.some((step) => step.id === id && !step.done);
  if (
    namespace.proto11?.onboardingView === 'agent' &&
    !open('describe') &&
    open('source') &&
    open('indicators') &&
    open('agent')
  ) {
    return 'agent';
  }
  return steps.find((step) => !step.done)?.id;
};

/** Steps 1 to 4. Samples and the managed index are already set up. */
export const proto11RequiredSetupDone = (namespace: Namespace): boolean => {
  if (namespace.managed || namespace.proto11?.sample) return true;
  if (!namespace.userCreated && !namespace.proto11) return true;
  return proto11SetupSteps(namespace)
    .filter((step) => !step.optional)
    .every((step) => step.done);
};
