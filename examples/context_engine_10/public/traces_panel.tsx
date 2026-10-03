/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import {
  EuiAccordion,
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiButtonIcon,
  EuiComboBox,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiIcon,
  EuiLink,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTextArea,
  EuiTitle,
} from '@elastic/eui';
import type { EuiComboBoxOptionOption } from '@elastic/eui';

import type { IndexTrace, IndexTraceType } from './namespace_data';

export const TRACES_DOCS_HREF =
  'https://www.elastic.co/docs/solutions/observability/apm/get-started';

const AGENT_OPTIONS: EuiComboBoxOptionOption[] = [
  { label: 'Significant Events Judge' },
  { label: 'loyalty-support-agent' },
];
const TRACE_INDEX_OPTIONS: EuiComboBoxOptionOption[] = [{ label: 'traces-genai.otel-default' }];

type SelectorId = 'elastic_agents' | 'genai_libraries';

const SELECTOR_OPTIONS = [
  { id: 'elastic_agents' as const, label: 'Agents on Elastic' },
  { id: 'genai_libraries' as const, label: 'GenAI libraries' },
];

const TRACE_DESCRIPTION =
  'Traces this AI index learns from. Knowledge Indicators are tuned against the questions agents actually ask.';

const AGENT_HELPER = 'Agents registered in Agent Builder. Traces are matched on gen_ai.agent.id.';

const ESQL_MIN_HEIGHT = 152;

const traceTypeBadge = (type: IndexTraceType) => {
  if (type === 'elastic_agent') return 'Elastic agent';
  if (type === 'esql') return 'ES|QL';
  return 'Index';
};

const traceTypeIcon = (type: IndexTraceType) => {
  if (type === 'elastic_agent') return 'productAgent';
  if (type === 'esql') return 'visVega';
  return 'index';
};

const DisabledReason = ({ children }: { children: React.ReactNode }) => (
  <EuiText size="s" color="subdued" className="contextEnginePrototype__disabledReason">
    {children}
  </EuiText>
);

const TraceRow = ({ trace }: { trace: IndexTrace }) => (
  <div className="contextEnginePrototype__row">
    <EuiIcon type={traceTypeIcon(trace.type)} size="m" />
    <div className="contextEnginePrototype__rowMain">
      <EuiText size="s">
        <strong>{trace.value}</strong>
      </EuiText>
    </div>
    <EuiBadge color="hollow">{traceTypeBadge(trace.type)}</EuiBadge>
  </div>
);

export const AgentTracesPanel = ({
  traces,
  onChange,
  accordionId,
  variant = 'editor',
  actions,
}: {
  traces: IndexTrace[];
  onChange: (next: IndexTrace[]) => void;
  improvementsEnabled?: boolean;
  accordionId: string;
  variant?: 'editor' | 'view';
  actions?: React.ReactNode;
}) => {
  const attached = traces[0] ?? null;
  const [justAdded, setJustAdded] = useState(false);
  const [selector, setSelector] = useState<SelectorId>('elastic_agents');
  const [esqlDraft, setEsqlDraft] = useState('');

  const hasAgents = AGENT_OPTIONS.length > 0;
  const hasTraceIndexes = TRACE_INDEX_OPTIONS.length > 0;
  const nothingAvailable = !hasAgents && !hasTraceIndexes;
  const showEmpty =
    (selector === 'elastic_agents' && !hasAgents) ||
    (selector === 'genai_libraries' && !hasTraceIndexes) ||
    nothingAvailable;

  /** M3 stores at most one. The array shape can take a second entry later. */
  const attach = (next: IndexTrace) => {
    onChange([next]);
    setEsqlDraft('');
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 600);
  };

  const addAgent = (label: string) => {
    const value = label.trim();
    if (!value) return;
    attach({ value, type: 'elastic_agent' });
  };

  const addIndex = (label: string) => {
    const value = label.trim();
    if (!value) return;
    attach({ value, type: 'esql' });
  };

  const addEsql = () => {
    const value = esqlDraft.trim();
    if (!value) return;
    attach({ value, type: 'esql' });
  };

  return (
    <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__panel">
      <div className="contextEnginePrototype__panelHeader">
        <div className="contextEnginePrototype__panelHeaderText">
          <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
            <h2>Agent traces</h2>
          </EuiTitle>
          <EuiText size="s" color="subdued" className="contextEnginePrototype__panelDesc">
            <p>{TRACE_DESCRIPTION}</p>
          </EuiText>
        </div>
        {actions ? <div className="contextEnginePrototype__panelActions">{actions}</div> : null}
      </div>
      {variant === 'view' ? (
        attached ? (
          <>
            <EuiSpacer size="m" />
            <TraceRow trace={attached} />
          </>
        ) : null
      ) : (
        <>
          <EuiSpacer size="m" />
          <EuiButtonGroup
            legend="Agent traces selector"
            type="single"
            buttonSize="compressed"
            options={SELECTOR_OPTIONS}
            idSelected={selector}
            onChange={(id) => setSelector(id as SelectorId)}
          />
          <EuiSpacer size="m" />
          {selector === 'elastic_agents' ? (
            showEmpty ? (
              <EuiText size="s" color="subdued">
                <p>
                  No agent traces found.{' '}
                  <EuiLink href={TRACES_DOCS_HREF} target="_blank" external>
                    Set up trace collection
                  </EuiLink>
                </p>
              </EuiText>
            ) : (
              <EuiFormRow label="Agent" fullWidth helpText={AGENT_HELPER}>
                <EuiComboBox
                  fullWidth
                  placeholder="Select an agent"
                  options={AGENT_OPTIONS}
                  selectedOptions={[]}
                  singleSelection={{ asPlainText: true }}
                  onChange={(options) => {
                    const picked = options[0]?.label;
                    if (picked) addAgent(picked);
                  }}
                  onCreateOption={(value) => addAgent(value)}
                  isClearable={false}
                />
              </EuiFormRow>
            )
          ) : (
            <>
              {showEmpty ? (
                <EuiText size="s" color="subdued">
                  <p>
                    No agent traces found.{' '}
                    <EuiLink href={TRACES_DOCS_HREF} target="_blank" external>
                      Set up trace collection
                    </EuiLink>
                  </p>
                </EuiText>
              ) : (
                <EuiFormRow label="Trace index or data stream" fullWidth>
                  <EuiComboBox
                    fullWidth
                    placeholder="e.g. traces-genai.otel-default"
                    options={TRACE_INDEX_OPTIONS}
                    selectedOptions={[]}
                    singleSelection={{ asPlainText: true }}
                    onChange={(options) => {
                      const picked = options[0]?.label;
                      if (picked) addIndex(picked);
                    }}
                    onCreateOption={(value) => addIndex(value)}
                    isClearable={false}
                  />
                </EuiFormRow>
              )}
              <EuiSpacer size="m" />
              <EuiAccordion id={accordionId} buttonContent="Advanced: ES|QL" paddingSize="m">
                <EuiTextArea
                  fullWidth
                  rows={5}
                  resize="vertical"
                  style={{ minHeight: ESQL_MIN_HEIGHT }}
                  value={esqlDraft}
                  onChange={(event) => setEsqlDraft(event.target.value)}
                  placeholder="FROM traces-* | WHERE ..."
                  aria-label="ES|QL query"
                />
                <EuiSpacer size="m" />
                <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiButton size="s" isDisabled={!esqlDraft.trim()} onClick={addEsql}>
                      Add ES|QL
                    </EuiButton>
                  </EuiFlexItem>
                  {!esqlDraft.trim() ? (
                    <EuiFlexItem grow={false}>
                      <DisabledReason>Write a query to add it</DisabledReason>
                    </EuiFlexItem>
                  ) : null}
                </EuiFlexGroup>
              </EuiAccordion>
            </>
          )}
          {attached ? (
            <>
              <EuiSpacer size="m" />
              <div
                className={`contextEnginePrototype__sourceChip${
                  justAdded ? ' contextEnginePrototype__selectedSource--enter' : ''
                }`}
              >
                <EuiIcon type={traceTypeIcon(attached.type)} size="m" />
                <div
                  className={
                    attached.type === 'esql'
                      ? 'contextEnginePrototype__sourceChipName'
                      : 'contextEnginePrototype__selectedSourceMain'
                  }
                >
                  <EuiText size="s" className="contextEnginePrototype__selectedSourceName">
                    <strong>{attached.value}</strong>
                  </EuiText>
                </div>
                <EuiBadge color="hollow">{traceTypeBadge(attached.type)}</EuiBadge>
                <EuiButtonIcon
                  iconType="cross"
                  aria-label="Remove attached traces"
                  onClick={() => onChange([])}
                />
              </div>
            </>
          ) : null}
        </>
      )}
    </EuiPanel>
  );
};

export const TracesEditActions = ({
  onEdit,
}: {
  onEdit: () => void;
}) => (
  <EuiButtonEmpty size="s" iconType="pencil" onClick={onEdit}>
    Edit
  </EuiButtonEmpty>
);
