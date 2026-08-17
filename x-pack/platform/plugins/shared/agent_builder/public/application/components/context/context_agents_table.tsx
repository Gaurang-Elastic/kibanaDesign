/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import type { EuiBasicTableColumn } from '@elastic/eui';
import { EuiBadge, EuiBasicTable, EuiFlexGroup, EuiFlexItem, EuiLink, EuiText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { useNavigation } from '../../hooks/use_navigation';
import { appPaths } from '../../utils/app_paths';
import {
  AVAILABLE_AI_INDEXES,
  DEFAULT_AI_INDEXES,
  formatDefaultAiIndexLabel,
  resolveAiIndexName,
} from '../../utils/ai_indexes';

const ELASTIC_INDEX_ID = 'elastic';

type ContextMode = 'on' | 'off';
type IndexHealth = 'healthy' | 'issues';

interface AvailableIndex {
  id: string;
  name: string;
  health: IndexHealth;
  issueCount?: number;
}

interface AgentContextRow {
  id: string;
  name: string;
  kind: 'builtIn' | 'custom';
  /** Subline under the agent name. */
  kindLabel: string;
  mode: ContextMode;
  /** User-attached AI indices (defaults are always applied when Context is on). */
  selectedIndexIds: string[];
}

const AVAILABLE_INDEXES: AvailableIndex[] = [
  { id: ELASTIC_INDEX_ID, name: 'Elastic AI Index', health: 'healthy' },
  { id: 'sales-outreach', name: 'Sales outreach assistant', health: 'healthy' },
  { id: 'nightshift', name: 'Nightshift', health: 'issues', issueCount: 2 },
  { id: 'support-ticket-triage', name: 'Support ticket triage', health: 'healthy' },
];

const INITIAL_ROWS: AgentContextRow[] = [
  {
    id: 'elastic-ai-agent',
    name: 'Elastic AI Agent',
    kind: 'builtIn',
    kindLabel: 'Built-in · 1P',
    mode: 'on',
    selectedIndexIds: [ELASTIC_INDEX_ID],
  },
  {
    id: 'nightshift',
    name: 'Nightshift',
    kind: 'builtIn',
    kindLabel: 'Built-in · 1P',
    mode: 'on',
    selectedIndexIds: ['nightshift', ELASTIC_INDEX_ID],
  },
  {
    id: 'support-bot',
    name: 'Support bot',
    kind: 'custom',
    kindLabel: 'Custom · existing customer',
    mode: 'off',
    selectedIndexIds: [],
  },
];

const modeBadge = (mode: ContextMode) => {
  if (mode === 'on') {
    return (
      <EuiBadge color="success" data-test-subj="agentBuilderContextModeOn">
        {i18n.translate('xpack.agentBuilder.context.modeOn', { defaultMessage: 'On' })}
      </EuiBadge>
    );
  }
  return (
    <EuiBadge color="hollow" data-test-subj="agentBuilderContextModeOff">
      {i18n.translate('xpack.agentBuilder.context.modeOff', { defaultMessage: 'Off' })}
    </EuiBadge>
  );
};

const emptyCell = () => (
  <EuiText size="s" color="subdued">
    {i18n.translate('xpack.agentBuilder.context.emptyCell', { defaultMessage: 'None' })}
  </EuiText>
);

const indexesForIds = (ids: string[]) =>
  ids
    .map((id) => AVAILABLE_INDEXES.find((index) => index.id === id))
    .filter((index): index is AvailableIndex => Boolean(index));

const summarizeHealth = (indexes: AvailableIndex[]) => {
  const withIssues = indexes.filter((index) => index.health === 'issues');
  if (withIssues.length === 0) {
    return { kind: 'healthy' as const };
  }
  const issueCount = withIssues.reduce((sum, index) => sum + (index.issueCount ?? 1), 0);
  return { kind: 'issues' as const, issueCount };
};

const AiIndexesReadonly = ({ selectedIndexIds }: { selectedIndexIds: string[] }) => (
  <EuiFlexGroup gutterSize="s" wrap responsive={false} alignItems="center">
    {DEFAULT_AI_INDEXES.map((index) => (
      <EuiFlexItem grow={false} key={`default-${index.id}`}>
        <EuiBadge color="hollow" data-test-subj={`agentBuilderContextDefaultIndex-${index.id}`}>
          {formatDefaultAiIndexLabel(index.name)}
        </EuiBadge>
      </EuiFlexItem>
    ))}
    {selectedIndexIds.map((id) => (
      <EuiFlexItem grow={false} key={id}>
        <EuiBadge color="hollow" data-test-subj={`agentBuilderContextIndex-${id}`}>
          {resolveAiIndexName(id) ||
            AVAILABLE_AI_INDEXES.find((index) => index.id === id)?.name ||
            id}
        </EuiBadge>
      </EuiFlexItem>
    ))}
  </EuiFlexGroup>
);

export const AgentBuilderContextAgentsTable = () => {
  const { createAgentBuilderUrl } = useNavigation();
  const rows = INITIAL_ROWS;

  const columns: Array<EuiBasicTableColumn<AgentContextRow>> = useMemo(
    () => [
      {
        field: 'name',
        name: i18n.translate('xpack.agentBuilder.context.columnAgent', {
          defaultMessage: 'Agent',
        }),
        truncateText: true,
        width: '220px',
        render: (_name: string, row) => (
          <div>
            <EuiText size="s">
              <strong>{row.name}</strong>
            </EuiText>
            <EuiText size="xs" color="subdued">
              {row.kindLabel}
            </EuiText>
          </div>
        ),
      },
      {
        field: 'mode',
        name: i18n.translate('xpack.agentBuilder.context.columnContext', {
          defaultMessage: 'Context',
        }),
        width: '90px',
        render: (mode: ContextMode) => modeBadge(mode),
      },
      {
        field: 'selectedIndexIds',
        name: i18n.translate('xpack.agentBuilder.context.columnRetrievesFrom', {
          defaultMessage: 'Retrieves from',
        }),
        render: (_ids: string[], row) => {
          if (row.mode === 'off') {
            return (
              <EuiText size="s" color="subdued">
                {i18n.translate('xpack.agentBuilder.context.contextOffRetrieves', {
                  defaultMessage: 'Context off · agent does not use the Context Engine',
                })}
              </EuiText>
            );
          }
          return <AiIndexesReadonly selectedIndexIds={row.selectedIndexIds} />;
        },
      },
      {
        field: 'selectedIndexIds',
        name: i18n.translate('xpack.agentBuilder.context.columnHealth', {
          defaultMessage: 'Health',
        }),
        width: '110px',
        render: (_ids: string[], row: AgentContextRow) => {
          if (row.mode === 'off' || row.selectedIndexIds.length === 0) {
            return emptyCell();
          }
          const health = summarizeHealth(indexesForIds(row.selectedIndexIds));
          if (health.kind === 'healthy') {
            return (
              <EuiBadge color="success">
                {i18n.translate('xpack.agentBuilder.context.healthHealthy', {
                  defaultMessage: 'Healthy',
                })}
              </EuiBadge>
            );
          }
          const issueCount = health.issueCount ?? 0;
          return (
            <EuiBadge color="warning">
              {issueCount === 1
                ? i18n.translate('xpack.agentBuilder.context.healthIssueSingular', {
                    defaultMessage: '1 issue',
                  })
                : i18n.translate('xpack.agentBuilder.context.healthIssuesPlural', {
                    defaultMessage: '{count} issues',
                    values: { count: issueCount },
                  })}
            </EuiBadge>
          );
        },
      },
      {
        name: i18n.translate('xpack.agentBuilder.context.columnActions', {
          defaultMessage: 'Actions',
        }),
        width: '180px',
        render: (row: AgentContextRow) => (
          <EuiLink
            href={createAgentBuilderUrl(appPaths.agents.edit({ agentId: row.id }))}
            data-test-subj={`agentBuilderContextEditSettings-${row.id}`}
          >
            {i18n.translate('xpack.agentBuilder.context.editInAgentSettings', {
              defaultMessage: 'Edit in agent settings ›',
            })}
          </EuiLink>
        ),
      },
    ],
    [createAgentBuilderUrl]
  );

  return (
    <EuiBasicTable
      items={rows}
      columns={columns}
      tableCaption={i18n.translate('xpack.agentBuilder.context.tableCaption', {
        defaultMessage: 'Context status per agent',
      })}
      data-test-subj="agentBuilderContextAgentsTable"
    />
  );
};
