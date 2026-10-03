/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export type SignalInternalType = 'esql_error' | 'esql_zero_results' | 'coverage_gap';

export type ImprovementChangeOperation =
  | 'creates'
  | 'edits'
  | 'deletes'
  | 'disables'
  | 'mutes';

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

export const isDestructiveChange = (change: ImprovementChange) => change.destructive;

export const improvementChangeLabel = (change: ImprovementChange) => {
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
    change.objectType === 'knowledge'
      ? change.count && change.count !== 1
        ? 'Knowledge Indicators'
        : 'Knowledge Indicator'
      : change.objectType === 'automation'
        ? 'automation'
        : change.objectType === 'workflow'
          ? 'workflow'
          : 'source';
  if (change.objectType === 'knowledge' && change.count) {
    return `${verb} ${change.count} ${objectWord}`;
  }
  if (change.name) {
    return `${verb} ${objectWord} · ${change.name}`;
  }
  return `${verb} ${objectWord}`;
};

const SIGNAL_WHAT: Record<SignalInternalType, string[]> = {
  esql_error: [
    'Unknown column `case_id`',
    'Unknown column `priority_code`',
    'Verification_exception: invalid ES|QL syntax near `|`',
  ],
  esql_zero_results: [
    'ES|QL returned 0 rows for the refund window query',
    'ES|QL returned 0 rows for the SLA lookup',
    'No matching docs for the escalation matrix query',
  ],
  coverage_gap: [
    'Agent re-read index mappings after retrieval missed the entity',
    'Agent listed indices again to find an owner field',
    'Agent fell back to scanning source metadata mid-turn',
  ],
};

export const signalsForNamespace = (namespaceName: string, sources: string[]): IndexSignal[] => {
  const primary = sources[0] || 'the index';
  const rows: IndexSignal[] = [];
  const types: SignalInternalType[] = ['esql_error', 'esql_zero_results', 'coverage_gap'];
  const lastSeen = ['today', 'today', 'yesterday', '2 days ago'];
  const traces = ['trc-8f2a91c0', 'trc-1b77e204', 'trc-55c0aa18', 'trc-8f2a91c0'];
  types.forEach((type, typeIndex) => {
    const phrases = SIGNAL_WHAT[type];
    phrases.forEach((whatHappened, phraseIndex) => {
      rows.push({
        id: `${namespaceName}-sig-${type}-${phraseIndex}`,
        type,
        label: SIGNAL_TYPE_META[type].label,
        whatHappened: whatHappened.replace('the index', primary),
        occurrences: 4 + typeIndex * 5 + phraseIndex * 3,
        lastSeen: lastSeen[(typeIndex + phraseIndex) % lastSeen.length],
        traceId: traces[(typeIndex + phraseIndex) % traces.length],
      });
    });
  });
  return rows;
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

const namedSourceInFix = (fix: string): string | null => {
  const cadence = fix.match(/increase refresh cadence on the (.+?) automation/i);
  if (cadence) return cadence[1].trim();
  const broaden = fix.match(/broaden the (.+?) automation/i);
  if (broaden) return broaden[1].trim();
  const addAuto = fix.match(/add an automation on (.+?)(?:\s+extracting|\.|$)/i);
  if (addAuto) return addAuto[1].trim();
  const deleteSource = fix.match(/delete(?:s)? (?:the )?source(?:\s+·\s*|\s+)(.+)/i);
  if (deleteSource) return deleteSource[1].trim().replace(/\.$/, '');
  const disable = fix.match(/disable(?:s)? (?:the )?(.+?) workflow/i);
  if (disable) return disable[1].trim();
  const fromMatch = fix.match(/(?:from|on)\s+([^.,]+?)(?:\s+keyed|\s+with|\.|$)/i);
  if (fromMatch) return fromMatch[1].trim();
  return null;
};

/** Source named in a proposed fix, for outcome copy and chips. */
export const sourceNamedInFix = (fix: string): string => namedSourceInFix(fix) ?? 'this source';

/** Derive change chips from the proposed fix text, never from an id hash. */
export const changesFromProposedFix = (
  proposedFix: string,
  createsAutomation: boolean
): ImprovementChange[] => {
  const fix = proposedFix.trim();
  const source = namedSourceInFix(fix);

  if (/increase refresh cadence on the .+ automation/i.test(fix) && source) {
    return [{ operation: 'edits', objectType: 'automation', name: source, destructive: false }];
  }
  if (/broaden the .+ automation/i.test(fix) && source) {
    return [{ operation: 'edits', objectType: 'automation', name: source, destructive: false }];
  }
  if (/add an automation on /i.test(fix) && source) {
    return [
      {
        operation: 'creates',
        objectType: 'automation',
        name: `Extract from ${source}`,
        destructive: false,
      },
      {
        operation: 'creates',
        objectType: 'knowledge',
        name: 'Knowledge Indicators',
        count: 3,
        destructive: false,
      },
    ];
  }
  if (/delete(?:s)? (?:the )?source/i.test(fix) && source) {
    return [{ operation: 'deletes', objectType: 'source', name: source, destructive: true }];
  }
  if (/disable(?:s)? .+\s+workflow/i.test(fix) && source) {
    return [{ operation: 'disables', objectType: 'workflow', name: source, destructive: true }];
  }
  if (/mute(?:s)? /i.test(fix)) {
    return [
      {
        operation: 'mutes',
        objectType: 'knowledge',
        name: source ?? fix.replace(/^mute(?:s)?\s+/i, '').replace(/\.$/, ''),
        destructive: true,
      },
    ];
  }

  const isGlossary = /glossary/i.test(fix);
  const isPlaybook = /playbook/i.test(fix);
  const knowledgeName = !source
    ? 'Knowledge Indicators'
    : isGlossary
      ? `${source} glossary`
      : isPlaybook
        ? `${source} playbook`
        : `${source} facts`;
  const knowledgeChange: ImprovementChange =
    isGlossary || isPlaybook
      ? { operation: 'creates', objectType: 'knowledge', name: knowledgeName, destructive: false }
      : {
          operation: 'creates',
          objectType: 'knowledge',
          name: knowledgeName,
          count: 3,
          destructive: false,
        };

  if (createsAutomation && source) {
    return [
      {
        operation: 'creates',
        objectType: 'automation',
        name: `Extract from ${source}`,
        destructive: false,
      },
      knowledgeChange,
    ];
  }
  return [knowledgeChange];
};

export const signalIdsForImprovement = (id: string, signals: IndexSignal[]): string[] => {
  if (signals.length === 0) return [];
  const start = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % signals.length;
  const count = 1 + (id.length % 3);
  return Array.from({ length: count }, (_, index) => signals[(start + index) % signals.length].id);
};

/** Demo indices that already have proposed improvements. Nightshift stays on signals until Analyse. */
export const namespaceStartsUnanalysed = (namespaceName: string, userCreated?: boolean) =>
  namespaceName === 'Nightshift' || Boolean(userCreated);

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

export const withImprovementActions = <
  T extends { id: string; createsAutomation: boolean; proposedFix: string }
>(
  items: T[],
  args: { signals: IndexSignal[] }
): Array<T & { changes: ImprovementChange[]; signalIds: string[] }> =>
  items.map((item) => ({
    ...item,
    changes: changesFromProposedFix(item.proposedFix, item.createsAutomation),
    signalIds: signalIdsForImprovement(item.id, args.signals),
  }));
