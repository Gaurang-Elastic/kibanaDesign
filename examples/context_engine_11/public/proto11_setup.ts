/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Namespace } from './namespace_data';

export type Proto11SetupStepId = 'source' | 'indicators' | 'agent' | 'traces' | 'memory';

export interface Proto11SetupStep {
  id: Proto11SetupStepId;
  label: string;
  optional: boolean;
  done: boolean;
}

/** Memory stays on unless the index turns it off. */
export const proto11MemoryOn = (namespace: Namespace): boolean => namespace.memoryEnabled !== false;

/** Steps in order. Memory is omitted when the index has Memory off. */
export const proto11SetupSteps = (namespace: Namespace): Proto11SetupStep[] => {
  const meta = namespace.proto11;
  const indicatorsDone = meta?.phase === 'fullRun' || meta?.phase === 'complete';
  const steps: Proto11SetupStep[] = [
    {
      id: 'source',
      label: 'Connect a source',
      optional: false,
      done: namespace.sources.length > 0,
    },
    {
      id: 'indicators',
      label: 'Check the first Knowledge Indicators',
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
      label: 'Send your first memory',
      optional: true,
      done: Boolean(meta?.firstMemoryReceived),
    });
  }
  return steps;
};

/** Steps 1 to 3. Samples are treated as already set up so the catalog badge stays off them. */
export const proto11RequiredSetupDone = (namespace: Namespace): boolean => {
  if (!namespace.proto11 || namespace.proto11.sample) return true;
  return proto11SetupSteps(namespace)
    .filter((step) => !step.optional)
    .every((step) => step.done);
};
