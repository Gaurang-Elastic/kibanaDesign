/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';

/**
 * Default AI indices registered in baseConfig. Always attached; not persisted as a
 * per-agent override and not removable in the Agent Edit UI.
 */
export const DEFAULT_AI_INDEXES: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'sig-events', name: 'sig-events' },
];

export const DEFAULT_AI_INDEX_ID_SET: ReadonlySet<string> = new Set(
  DEFAULT_AI_INDEXES.map((index) => index.id)
);

export type AiIndexLifecycleStatus = 'ready' | 'needsSetup' | 'settingUp';

export interface AvailableAiIndex {
  id: string;
  name: string;
  status: AiIndexLifecycleStatus;
  /** Knowledge item count when ready; omitted when unknown. */
  knowledgeItemCount?: number;
  /** When true, option meta notes the index is registered by another solution/agent. */
  readOnly?: boolean;
  readOnlySource?: string;
}

/**
 * Catalog of AI indices an agent can attach beyond the defaults.
 * Prototype/mock catalog until Context Engine index listing is wired.
 */
export const AVAILABLE_AI_INDEXES: ReadonlyArray<AvailableAiIndex> = [
  { id: 'elastic', name: 'Elastic AI Index', status: 'ready', knowledgeItemCount: 24 },
  { id: 'sales-outreach', name: 'Sales outreach assistant', status: 'ready', knowledgeItemCount: 18 },
  {
    id: 'nightshift',
    name: 'Nightshift',
    status: 'ready',
    knowledgeItemCount: 8,
    readOnly: true,
    readOnlySource: 'Nightshift',
  },
  { id: 'support-ticket-triage', name: 'Support ticket triage', status: 'needsSetup' },
  { id: 'draft-playbooks', name: 'Draft playbooks', status: 'settingUp' },
];

/** Sentinel value for the ComboBox create-new footer option. */
export const CREATE_AI_INDEX_OPTION_VALUE = '__create_ai_index__';

export const formatDefaultAiIndexLabel = (name: string): string => `${name} (default)`;

export const isDefaultAiIndexId = (id: string): boolean => DEFAULT_AI_INDEX_ID_SET.has(id);

/** Strip defaults/create sentinel and dedupe so only unique user-added ids are persisted. */
export const sanitizePersistedAiIndexIds = (ids: string[] | undefined): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids ?? []) {
    if (isDefaultAiIndexId(id) || id === CREATE_AI_INDEX_OPTION_VALUE) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
};

export const resolveAiIndex = (id: string): AvailableAiIndex | undefined =>
  AVAILABLE_AI_INDEXES.find((index) => index.id === id);

export const resolveAiIndexName = (id: string): string => {
  const fromDefault = DEFAULT_AI_INDEXES.find((index) => index.id === id);
  if (fromDefault) return fromDefault.name;
  const fromAvailable = resolveAiIndex(id);
  if (fromAvailable) return fromAvailable.name;
  return id;
};

export const isAiIndexReady = (index: AvailableAiIndex | undefined): boolean =>
  index?.status === 'ready';

export const formatAiIndexStatusMeta = (index: AvailableAiIndex): string => {
  const parts: string[] = [];

  if (index.status === 'ready') {
    parts.push(
      index.knowledgeItemCount != null
        ? i18n.translate('xpack.agentBuilder.aiIndices.statusReadyWithCount', {
            defaultMessage: 'Ready · {count} KIs',
            values: { count: index.knowledgeItemCount },
          })
        : i18n.translate('xpack.agentBuilder.aiIndices.statusReady', {
            defaultMessage: 'Ready',
          })
    );
  } else if (index.status === 'needsSetup') {
    parts.push(
      i18n.translate('xpack.agentBuilder.aiIndices.statusNeedsSetup', {
        defaultMessage: 'Needs setup · no knowledge yet',
      })
    );
  } else {
    parts.push(
      i18n.translate('xpack.agentBuilder.aiIndices.statusSettingUp', {
        defaultMessage: '⟳ Setting up',
      })
    );
  }

  if (index.readOnly) {
    parts.push(
      i18n.translate('xpack.agentBuilder.aiIndices.statusReadOnly', {
        defaultMessage: 'Read-only · registered by {source}',
        values: { source: index.readOnlySource ?? index.name },
      })
    );
  }

  return parts.join(' · ');
};

export const nonReadySelectedIndexTooltip = i18n.translate(
  'xpack.agentBuilder.aiIndices.nonReadyChipTooltip',
  {
    defaultMessage:
      'This index has no knowledge yet; the agent will retrieve nothing until setup completes.',
  }
);
