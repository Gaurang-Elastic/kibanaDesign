/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export type SignalInternalType = 'esql_error' | 'esql_zero_results' | 'coverage_gap';

export type ImprovementChangeOperation = 'creates' | 'edits' | 'deletes' | 'disables' | 'mutes';

export type ImprovementChangeObject = 'automation' | 'workflow' | 'knowledge' | 'source';

export interface ImprovementChange {
  operation: ImprovementChangeOperation;
  objectType: ImprovementChangeObject;
  name: string;
  count?: number;
  destructive: boolean;
}

export interface IndexSignal {
  id: string;
  type: SignalInternalType;
  label: string;
  whatHappened: string;
  occurrences: number;
  lastSeen: string;
  traceId: string;
  /** False when the signal arrived after the last analysis run. */
  analyzed?: boolean;
}

export const SIGNAL_TYPE_META: Record<
  SignalInternalType,
  { label: string; strip: string; internal: SignalInternalType }
> = {
  esql_error: { label: 'Query error', strip: 'Query errors', internal: 'esql_error' },
  esql_zero_results: {
    label: 'Empty results',
    strip: 'Empty results',
    internal: 'esql_zero_results',
  },
  coverage_gap: { label: 'Coverage gap', strip: 'Coverage gaps', internal: 'coverage_gap' },
};

export const SIGNAL_TYPE_ORDER: SignalInternalType[] = [
  'esql_error',
  'esql_zero_results',
  'coverage_gap',
];

export const isDestructiveChange = (change: ImprovementChange) => change.destructive;

export const improvementChangeLabel = (change: ImprovementChange) => {
  if (change.objectType === 'knowledge') {
    const count = change.count && change.count > 0 ? change.count : 1;
    return count === 1 ? 'Produces 1 Knowledge Indicator' : `Produces ${count} Knowledge Indicators`;
  }
  const verb =
    change.operation === 'creates'
      ? 'Creates'
      : change.operation === 'edits'
        ? 'Edits'
        : change.operation === 'deletes'
          ? 'Deletes'
          : change.operation === 'disables'
            ? 'Disables'
            : 'Mutes';
  const objectWord =
    change.objectType === 'automation'
      ? 'automation'
      : change.objectType === 'workflow'
        ? 'workflow'
        : 'source';
  return change.name ? `${verb} ${objectWord} · ${change.name}` : `${verb} ${objectWord}`;
};

export const signalCountsByType = (signals: IndexSignal[]) => {
  const counts: Record<SignalInternalType, number> = {
    esql_error: 0,
    esql_zero_results: 0,
    coverage_gap: 0,
  };
  signals.forEach((signal) => {
    counts[signal.type] += signal.occurrences;
  });
  return counts;
};

export const signalDistinctByType = (signals: IndexSignal[]) => {
  const counts: Record<SignalInternalType, number> = {
    esql_error: 0,
    esql_zero_results: 0,
    coverage_gap: 0,
  };
  signals.forEach((signal) => {
    counts[signal.type] += 1;
  });
  return counts;
};

export const totalSignalOccurrences = (signals: IndexSignal[]) =>
  signals.reduce((sum, signal) => sum + signal.occurrences, 0);

export const signalsByIds = (signals: IndexSignal[], ids: string[]) =>
  ids
    .map((id) => signals.find((signal) => signal.id === id))
    .filter((signal): signal is IndexSignal => Boolean(signal));

export const occurrencesForSignalIds = (signals: IndexSignal[], ids: string[]) =>
  signalsByIds(signals, ids).reduce((sum, signal) => sum + signal.occurrences, 0);

export const formatSignalSourceLine = (signals: IndexSignal[]) => {
  if (signals.length === 0) return 'From: signals on this index';
  const listed = signals
    .map(
      (signal) =>
        `${SIGNAL_TYPE_META[signal.type].label} · ${signal.whatHappened} (${signal.occurrences} occurrence${
          signal.occurrences === 1 ? '' : 's'
        })`
    )
    .join('; ');
  return `From: ${listed}`;
};

export const sourceNamedInFix = (fix: string): string => {
  const cadence = fix.match(/increase refresh cadence on the (.+?) automation/i);
  if (cadence) return cadence[1].trim();
  const broaden = fix.match(/broaden the (.+?) automation/i);
  if (broaden) return broaden[1].trim();
  const addAuto = fix.match(/add an automation on (.+?)(?:\s+extracting|\.|$)/i);
  if (addAuto) return addAuto[1].trim();
  const fromMatch = fix.match(/(?:from|on)\s+([^.,]+?)(?:\s+keyed|\s+with|\.|$)/i);
  if (fromMatch) return fromMatch[1].trim();
  return 'this source';
};

export type AgentChangeOp = 'create' | 'edit' | 'remove';
export type AgentChangeObject = 'knowledge' | 'automations' | 'sources';
export type AgentChangePermissions = Record<AgentChangeObject, Record<AgentChangeOp, boolean>>;

export const DEFAULT_AGENT_CHANGE_PERMISSIONS: AgentChangePermissions = {
  knowledge: { create: true, edit: true, remove: false },
  automations: { create: false, edit: false, remove: false },
  sources: { create: false, edit: false, remove: false },
};

export const AGENT_CHANGE_OBJECT_LABELS: Record<AgentChangeObject, string> = {
  knowledge: 'Knowledge Indicators',
  automations: 'Automations',
  sources: 'Sources',
};

export const AGENT_CHANGE_OPS: AgentChangeOp[] = ['create', 'edit', 'remove'];
