/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useRef, useState } from 'react';
import { css } from '@emotion/react';
import {
  EuiAvatar,
  EuiBadge,
  EuiButton,
  EuiButtonGroup,
  EuiButtonIcon,
  EuiCheckbox,
  EuiCode,
  EuiComboBox,
  EuiDescriptionList,
  EuiFieldText,
  EuiFilterButton,
  EuiFilterGroup,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiHorizontalRule,
  EuiIcon,
  EuiIconTip,
  EuiLink,
  EuiListGroup,
  EuiListGroupItem,
  EuiPanel,
  EuiPopover,
  EuiRadio,
  EuiSelect,
  EuiSpacer,
  EuiTab,
  EuiTabs,
  EuiText,
  EuiTextArea,
  EuiTextColor,
  EuiTitle,
  EuiToolTip,
  useEuiTheme,
} from '@elastic/eui';

import { MEMORY_HELPER, SHOW_MEMORY_TOGGLE } from './demo_flags';
import {
  GENAI_TRACE_OPTIONS,
  PROBLEM_CHIPS,
  TEMPLATES,
  WEB_OPS_SOURCES,
  findReuseTarget,
  goalById,
  namespaceSourceFor,
  pickerAgents,
  proposeFromComposer,
  proposeFromIndex,
  tracesSuggestionFor,
  type ReuseMatch,
  type ComposerInput,
  type PickerAgent,
  type CreateFromGoalOptions,
  type Proto11Proposal,
} from './proto11_data';
import { Proto11SampleStrip, type ExploreSample } from './proto11_sample_panel';
import type { Proto11SourceId } from './proto11_types';
import type { KnowledgeIndicator } from './knowledge_indicators';
import type { Namespace } from './namespace_data';
import { TraceRow } from './traces_panel';
import { TABLE_SPARKLES_TYPE } from './register_table_sparkles';
import heroArtLight from './assets/context-ai-index-light-animated.svg';
import heroArtDark from './assets/context-ai-index-dark-animated.svg';

type TraceSelector = 'elastic_agents' | 'genai_libraries';
type DataTab = 'elasticsearch' | 'connectors';
type ComposerAgent = NonNullable<ComposerInput['agent']>;
export type AskAgentAboutProposal = (proposal: Proto11Proposal, name: string) => void;

const TRACE_SELECTOR_OPTIONS = [
  { id: 'elastic_agents' as const, label: 'Agents on Elastic' },
  { id: 'genai_libraries' as const, label: 'GenAI libraries' },
];

const INDEX_SOURCES = WEB_OPS_SOURCES.filter((source) => source.kind === 'Index');
const CONNECTOR_SOURCES = WEB_OPS_SOURCES.filter((source) => source.kind === 'Connector');

const COMPOSER_PLACEHOLDER =
  'Ask a question your agent gets wrong, or describe what it should know.';

/** Rough wrap estimate so the field grows with its text, between min and max rows. */
const rowsFor = (text: string, min: number, max: number) => {
  const lines = text
    .split('\n')
    .reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 90)), 0);
  return Math.min(max, Math.max(min, lines));
};

const AttachmentChip = ({
  icon,
  name,
  typeLabel,
  onRemove,
}: {
  icon: string;
  name: string;
  typeLabel?: string;
  onRemove: () => void;
}) => (
  <div className="contextEnginePrototype__sourceChip">
    <EuiIcon type={icon} size="m" aria-hidden={true} />
    <div className="contextEnginePrototype__selectedSourceMain">
      <EuiText size="s" className="contextEnginePrototype__selectedSourceName">
        {name}
      </EuiText>
    </div>
    {typeLabel ? <EuiBadge color="hollow">{typeLabel}</EuiBadge> : null}
    <EuiToolTip content={`Remove ${name}`} disableScreenReaderOutput>
      <EuiButtonIcon iconType="cross" aria-label={`Remove ${name}`} onClick={onRemove} />
    </EuiToolTip>
  </div>
);

const ProposalSourceChip = ({
  id,
  found,
  onThisIndex,
  fromTraces,
}: {
  id: Proto11SourceId;
  found: boolean;
  onThisIndex?: boolean;
  fromTraces?: boolean;
}) => {
  const source = namespaceSourceFor(id);
  return (
    <div className="contextEnginePrototype__sourceChip">
      <EuiIcon type={source.icon} size="m" aria-hidden={true} />
      <div className="contextEnginePrototype__selectedSourceMain">
        <EuiText size="s" className="contextEnginePrototype__selectedSourceName">
          {source.name}
        </EuiText>
      </div>
      <EuiBadge color="hollow">{source.typeLabel}</EuiBadge>
      {fromTraces ? (
        <EuiBadge color="hollow" data-test-subj="proto11FromTraces">
          from traces
        </EuiBadge>
      ) : null}
      {onThisIndex ? <EuiBadge color="hollow">on this index</EuiBadge> : null}
      {found ? <EuiBadge color="hollow">found</EuiBadge> : null}
    </div>
  );
};

const BecauseLine = ({ children }: { children: string }) => {
  const sentence = children.startsWith('because')
    ? `Because${children.slice('because'.length)}`
    : children;
  return (
    <EuiText size="s" color="subdued">
      <p>{sentence}</p>
    </EuiText>
  );
};

const joinNames = (names: string[]) => {
  if (names.length <= 1) return names[0] ?? 'these sources';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/** What the template writes, as a clause after "about {sources}:". */
const producesPhrase = (description: string) => {
  const trimmed = description.replace(/\.$/, '');
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
};

const ProposalSourcePicker = ({
  pickedIds,
  onAdd,
}: {
  pickedIds: Proto11SourceId[];
  onAdd: (id: Proto11SourceId) => void;
}) => (
  <EuiComboBox
    fullWidth
    compressed
    placeholder="Pick the data your agent searches"
    aria-label="Pick the data your agent searches"
    options={[...INDEX_SOURCES, ...CONNECTOR_SOURCES]
      .filter((source) => !pickedIds.includes(source.id))
      .map((source) => ({ label: source.name, value: source.id }))}
    selectedOptions={[]}
    singleSelection={{ asPlainText: true }}
    onChange={(options) => {
      const picked = options[0]?.value;
      if (picked) onAdd(picked);
    }}
    isClearable={false}
    data-test-subj="proto11ProposalSourcePicker"
  />
);

const ProposalCard = ({
  proposal,
  reuse,
  namespaces,
  onChange,
  onCreate,
  onAddTo,
  onRerun,
  onAskAgent,
  onAddSource,
}: {
  proposal: Proto11Proposal;
  reuse?: ReuseMatch;
  namespaces: Namespace[];
  onChange: () => void;
  onCreate: (name: string) => void;
  onAddTo: (targetName: string) => void;
  onRerun: (targetName: string) => void;
  onAskAgent: (name: string) => void;
  onAddSource: (id: Proto11SourceId) => void;
}) => {
  const { euiTheme } = useEuiTheme();
  const [name, setName] = useState(proposal.name);
  const [mode, setMode] = useState<'add' | 'create'>(reuse ? 'add' : 'create');
  const adding = Boolean(reuse) && mode === 'add';
  const templateId = goalById(proposal.goal).template;
  const template = TEMPLATES[templateId];
  const target = adding && reuse ? namespaces.find((item) => item.name === reuse.name) : undefined;
  const alreadyThere = Boolean(
    target?.automations.some((automation) => automation.templateId === templateId)
  );
  const writesAbout = proposal.sourceIds.length
    ? joinNames(proposal.sourceIds.map((id) => namespaceSourceFor(id).name))
    : '';
  const writesLine = writesAbout
    ? `Writes Knowledge Indicators about ${writesAbout}: ${producesPhrase(
        template.description
      )}. First pass runs on a sample, about a minute.`
    : `Writes Knowledge Indicators: ${producesPhrase(
        template.description
      )}. First pass runs on a sample, about a minute.`;
  const sourceIds = adding
    ? proposal.sourceIds.filter((id) => !reuse?.coveredIds.includes(id))
    : proposal.sourceIds;
  const needsSource = Boolean(proposal.trace) && (proposal.traceSourceIds?.length ?? 0) === 0;
  const canRun = alreadyThere || !needsSource || proposal.sourceIds.length > 0;
  const sourceChip = (id: Proto11SourceId, onThisIndex?: boolean) => (
    <ProposalSourceChip
      key={id}
      id={id}
      found={proposal.foundIds.includes(id)}
      onThisIndex={onThisIndex}
      fromTraces={proposal.traceSourceIds?.includes(id)}
    />
  );
  const nameField = (
    <EuiFieldText
      compressed
      value={name}
      onChange={(event) => setName(event.target.value)}
      aria-label="AI index name"
      data-test-subj="proto11ProposalName"
    />
  );
  const listItems = [
    reuse
      ? {
          title: 'AI index',
          description: (
            <div data-test-subj="proto11ProposalTarget">
              <EuiRadio
                id="proto11ProposalTargetAdd"
                name="proto11ProposalTarget"
                label={`Add to ${reuse.name}`}
                checked={mode === 'add'}
                onChange={() => setMode('add')}
                data-test-subj="proto11ProposalTargetAdd"
              />
              <EuiText
                size="s"
                color="subdued"
                css={css`
                  padding-inline-start: calc(${euiTheme.size.base} + ${euiTheme.size.s});
                `}
              >
                <p>
                  {reuse.because
                    ? `${reuse.because.charAt(0).toUpperCase()}${reuse.because.slice(1)}.`
                    : null}
                </p>
                <p>The automation and its Knowledge Indicators are added to this index.</p>
              </EuiText>
              <EuiSpacer size="s" />
              <EuiRadio
                id="proto11ProposalTargetCreate"
                name="proto11ProposalTarget"
                label="Create a new AI index"
                checked={mode === 'create'}
                onChange={() => setMode('create')}
                data-test-subj="proto11ProposalTargetCreate"
              />
              {mode === 'create' ? (
                <>
                  <EuiSpacer size="xs" />
                  {nameField}
                </>
              ) : null}
            </div>
          ),
        }
      : {
          title: 'Name',
          description: nameField,
        },
    {
      title: 'Automation',
      description:
        alreadyThere && target ? (
          <EuiText size="s">
            <p data-test-subj="proto11ProposalDuplicate">
              {`${template.title} is already on ${target.name}`}
            </p>
          </EuiText>
        ) : (
          <>
            <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiIcon type="bolt" size="m" aria-hidden={true} />
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="s">
                  <strong>{template.title}</strong>
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiText size="s" color="subdued">
              <p data-test-subj="proto11ProposalWrites">{writesLine}</p>
            </EuiText>
            <BecauseLine>{proposal.automationBecause}</BecauseLine>
          </>
        ),
    },
    {
      title: 'Sources',
      description: needsSource ? (
        <>
          {proposal.sourceIds.length > 0 ? (
            <>
              <div className="contextEnginePrototype__selectedSources">
                {proposal.sourceIds.map((id) =>
                  sourceChip(id, adding && reuse?.coveredIds.includes(id))
                )}
              </div>
              <EuiSpacer size="s" />
            </>
          ) : null}
          <ProposalSourcePicker pickedIds={proposal.sourceIds} onAdd={onAddSource} />
          {proposal.sourceIds.length > 0 ? (
            <>
              <EuiSpacer size="xs" />
              <BecauseLine>{proposal.sourcesBecause}</BecauseLine>
            </>
          ) : null}
        </>
      ) : sourceIds.length === 0 && reuse ? (
        <>
          <div
            className="contextEnginePrototype__selectedSources"
            data-test-subj="proto11ProposalExistingSources"
          >
            {proposal.sourceIds.map((id) => sourceChip(id, true))}
          </div>
          <EuiSpacer size="xs" />
          <EuiText size="xs" color="subdued">
            <p data-test-subj="proto11ProposalReads">
              {`Reads the sources already on ${reuse.name}.`}
            </p>
          </EuiText>
        </>
      ) : (
        <>
          <div className="contextEnginePrototype__selectedSources">
            {sourceIds.map((id) => sourceChip(id))}
          </div>
          <EuiSpacer size="xs" />
          <BecauseLine>{proposal.sourcesBecause}</BecauseLine>
        </>
      ),
    },
    ...(proposal.trace
      ? [
          {
            title: 'Agent traces',
            description: <TraceRow trace={proposal.trace} badgePlacement="inline" />,
          },
        ]
      : []),
    ...(SHOW_MEMORY_TOGGLE
      ? [
          {
            title: 'Memory',
            description: (
              <div data-test-subj="proto11ProposalMemory">
                <EuiText size="s">
                  <p>On</p>
                </EuiText>
                <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiText size="s" color="subdued">
                      <p>Agents can save and recall task memory.</p>
                    </EuiText>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiIconTip content={MEMORY_HELPER} aria-label={MEMORY_HELPER} position="top" />
                  </EuiFlexItem>
                </EuiFlexGroup>
              </div>
            ),
          },
        ]
      : []),
  ];
  return (
    <EuiPanel
      hasBorder={false}
      color="subdued"
      paddingSize="l"
      className="contextEnginePrototype__proto11Enter"
      data-test-subj="proto11Proposal"
    >
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
        <EuiFlexItem grow={false}>
          <EuiIcon type={TABLE_SPARKLES_TYPE} size="m" aria-hidden={true} />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiTitle size="xs">
            <h3 data-test-subj="proto11ProposalHeading">
              {adding && reuse ? (
                <>
                  Proposed automation for <EuiCode>{reuse.name}</EuiCode>
                </>
              ) : (
                'Proposed AI index'
              )}
            </h3>
          </EuiTitle>
        </EuiFlexItem>
        {adding && reuse ? (
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">AI index</EuiBadge>
          </EuiFlexItem>
        ) : null}
      </EuiFlexGroup>
      <EuiSpacer size="l" />
      <EuiDescriptionList type="column" columnWidths={[1, 4]} listItems={listItems} />
      <EuiSpacer size="l" />
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup gutterSize="l" alignItems="center" responsive={false} wrap>
            <EuiFlexItem grow={false}>
              <EuiLink
                color="text"
                onClick={() => onAskAgent(name)}
                data-test-subj="proto11ProposalAskAgent"
              >
                <EuiIcon
                  type="productAgent"
                  size="s"
                  aria-hidden={true}
                  css={css`
                    margin-right: ${euiTheme.size.xs};
                    vertical-align: text-bottom;
                  `}
                />
                Ask Elastic AI Agent to adjust this
              </EuiLink>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiLink onClick={onChange} data-test-subj="proto11ProposalChange">
                Change
              </EuiLink>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton
            fill
            isDisabled={!canRun}
            onClick={() => {
              if (alreadyThere && reuse) onRerun(reuse.name);
              else if (adding && reuse) onAddTo(reuse.name);
              else onCreate(name);
            }}
            data-test-subj="proto11CreateAndRun"
          >
            {alreadyThere ? 'Run it again' : adding ? 'Add and run' : 'Create and run'}
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
};

const ScopeLabel = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <span className="contextEnginePrototype__proto11ScopeLabel">
    <EuiIcon type={icon} size="s" aria-hidden={true} />
    <span className="contextEnginePrototype__proto11ScopeText">{children}</span>
  </span>
);

/** Agent Builder style avatar: Elastic logo for managed agents, initials for custom ones. */
const PickerAgentAvatar = ({ agent: { name, managed } }: { agent: PickerAgent }) => {
  const { euiTheme } = useEuiTheme();
  const ringCss = css`
    border: ${euiTheme.border.width.thin} solid ${euiTheme.colors.borderBaseSubdued};
    border-radius: 50%;
  `;
  if (!managed) {
    return <EuiAvatar size="s" type="user" name={name} css={ringCss} aria-hidden={true} />;
  }
  return (
    <span
      aria-hidden="true"
      css={[
        ringCss,
        css`
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          inline-size: ${euiTheme.size.l};
          block-size: ${euiTheme.size.l};
        `,
      ]}
    >
      <EuiIcon type="logoElastic" size="m" aria-hidden={true} />
    </span>
  );
};

const PickerAgentList = ({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (name: string) => void;
}) => {
  const { euiTheme } = useEuiTheme();
  const { traced, untraced } = pickerAgents();
  const renderItems = (agents: PickerAgent[]) =>
    agents.map((agent) => (
      <EuiListGroupItem
        key={agent.name}
        icon={<PickerAgentAvatar agent={agent} />}
        isActive={agent.name === selected}
        onClick={() => onSelect(agent.name)}
        data-test-subj="proto11AgentPickerItem"
        label={
          <>
            {agent.name}
            {agent.traceSummary ? (
              <EuiTextColor color="subdued">{`, ${agent.traceSummary}`}</EuiTextColor>
            ) : null}
          </>
        }
      />
    ));
  return (
    <div data-test-subj="proto11AgentPicker">
      <EuiListGroup maxWidth={false}>{renderItems(traced)}</EuiListGroup>
      {untraced.length > 0 ? (
        <>
          <EuiHorizontalRule margin="xs" />
          <EuiText
            size="xs"
            color="subdued"
            css={css`
              padding: ${euiTheme.size.xs} ${euiTheme.size.s};
            `}
          >
            No traces yet
          </EuiText>
          <EuiListGroup maxWidth={false}>{renderItems(untraced)}</EuiListGroup>
        </>
      ) : null}
    </div>
  );
};

const AgentScope = ({
  agent,
  onChange,
}: {
  agent: ComposerAgent | null;
  onChange: (agent: ComposerAgent | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [selector, setSelector] = useState<TraceSelector>(
    agent?.traceType === 'index' ? 'genai_libraries' : 'elastic_agents'
  );
  const selected =
    agent && agent.traceType === (selector === 'elastic_agents' ? 'elastic_agent' : 'index')
      ? agent.name
      : '';
  return (
    <EuiPopover
      button={
        <EuiFilterButton
          iconType="chevronSingleDown"
          iconSide="right"
          hasActiveFilters={agent !== null}
          isSelected={open}
          onClick={() => setOpen((isOpen) => !isOpen)}
          data-test-subj="proto11ScopeAgent"
        >
          <ScopeLabel icon="productAgent">{agent ? `Agent: ${agent.name}` : 'Agent'}</ScopeLabel>
        </EuiFilterButton>
      }
      aria-label="Agent"
      isOpen={open}
      closePopover={() => setOpen(false)}
      panelPaddingSize="m"
      anchorPosition="downLeft"
    >
      <div className="contextEnginePrototype__proto11AttachPopover">
        <EuiButtonGroup
          legend="Agent traces source"
          type="single"
          buttonSize="compressed"
          isFullWidth
          options={TRACE_SELECTOR_OPTIONS}
          idSelected={selector}
          onChange={(id) => setSelector(id as TraceSelector)}
        />
        <EuiSpacer size="s" />
        {selector === 'elastic_agents' ? (
          <PickerAgentList
            selected={selected}
            onSelect={(name) => {
              setOpen(false);
              onChange({ name, traceType: 'elastic_agent' });
            }}
          />
        ) : (
          <EuiSelect
            key={selector}
            compressed
            fullWidth
            hasNoInitialSelection
            value={selected}
            options={GENAI_TRACE_OPTIONS.map((value) => ({ value, text: value }))}
            onChange={(event) => {
              setOpen(false);
              onChange({ name: event.target.value, traceType: 'index' });
            }}
            aria-label="Trace index or data stream"
            data-test-subj="proto11AttachAgentSelect"
          />
        )}
        {agent ? (
          <>
            <EuiSpacer size="s" />
            <EuiText size="s">
              <EuiLink
                onClick={() => {
                  setOpen(false);
                  onChange(null);
                }}
                data-test-subj="proto11ScopeAgentClear"
              >
                Clear
              </EuiLink>
            </EuiText>
          </>
        ) : null}
      </div>
    </EuiPopover>
  );
};

const DataScope = ({
  pickedIds,
  onToggle,
}: {
  pickedIds: Proto11SourceId[];
  onToggle: (id: Proto11SourceId, checked: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DataTab>('elasticsearch');
  const count = pickedIds.length;
  return (
    <EuiPopover
      button={
        <EuiFilterButton
          iconType="chevronSingleDown"
          iconSide="right"
          hasActiveFilters={count > 0}
          isSelected={open}
          onClick={() => setOpen((isOpen) => !isOpen)}
          data-test-subj="proto11ScopeData"
        >
          <ScopeLabel icon="database">
            {count > 0 ? `Data: ${count} ${count === 1 ? 'source' : 'sources'}` : 'Data'}
          </ScopeLabel>
        </EuiFilterButton>
      }
      aria-label="Data"
      isOpen={open}
      closePopover={() => setOpen(false)}
      panelPaddingSize="m"
      anchorPosition="downLeft"
    >
      <div className="contextEnginePrototype__proto11AttachPopover">
        <EuiTabs size="s">
          <EuiTab
            isSelected={tab === 'elasticsearch'}
            onClick={() => setTab('elasticsearch')}
            data-test-subj="proto11AttachDataTab-elasticsearch"
          >
            <span className="contextEnginePrototype__sourceTab">
              <EuiIcon type="database" size="s" aria-hidden={true} />
              Elasticsearch data
            </span>
          </EuiTab>
          <EuiTab
            isSelected={tab === 'connectors'}
            onClick={() => setTab('connectors')}
            data-test-subj="proto11AttachDataTab-connectors"
          >
            <span className="contextEnginePrototype__sourceTab">
              <EuiIcon type="plugs" size="s" aria-hidden={true} />
              Connectors
            </span>
          </EuiTab>
        </EuiTabs>
        <EuiSpacer size="m" />
        {tab === 'elasticsearch' ? (
          <EuiFormRow label="Index, data stream or alias" fullWidth>
            <EuiComboBox
              fullWidth
              compressed
              placeholder="e.g. logs-nginx"
              options={INDEX_SOURCES.filter((source) => !pickedIds.includes(source.id)).map(
                (source) => ({ label: source.name, value: source.id })
              )}
              selectedOptions={[]}
              singleSelection={{ asPlainText: true }}
              onChange={(options) => {
                const picked = options[0]?.value;
                if (picked) onToggle(picked, true);
              }}
              isClearable={false}
              data-test-subj="proto11DataCombo"
            />
          </EuiFormRow>
        ) : (
          <div className="contextEnginePrototype__connectorList">
            {CONNECTOR_SOURCES.map((source) => {
              const { icon } = namespaceSourceFor(source.id);
              return (
                <div key={source.id} className="contextEnginePrototype__connectorRow">
                  <EuiCheckbox
                    id={`context-engine-11-attach-connector-${source.id}`}
                    checked={pickedIds.includes(source.id)}
                    onChange={(event) => onToggle(source.id, event.target.checked)}
                    label={
                      <span className="contextEnginePrototype__connectorLabel">
                        <EuiIcon type={icon} size="m" aria-hidden={true} />
                        <span>{source.name}</span>
                      </span>
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
        {count > 0 ? (
          <>
            <EuiSpacer size="m" />
            <EuiText size="xs">
              <strong>Selected</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <div
              className="contextEnginePrototype__proto11Attachments"
              data-test-subj="proto11Attachments"
            >
              {pickedIds.map((id) => {
                const source = namespaceSourceFor(id);
                return (
                  <AttachmentChip
                    key={id}
                    icon={source.icon}
                    name={source.name}
                    typeLabel={source.typeLabel}
                    onRemove={() => onToggle(id, false)}
                  />
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </EuiPopover>
  );
};

const Composer = ({
  compact,
  takenNames,
  namespaces,
  forcedTarget,
  onCreateFromGoal,
  onAddToIndex,
  onRerun,
  onAskAgent,
  onProposalChange,
}: {
  compact: boolean;
  takenNames: string[];
  namespaces: Namespace[];
  /** When set, the proposal targets this AI index instead of searching for one. */
  forcedTarget?: string;
  onCreateFromGoal: (options: Omit<CreateFromGoalOptions, 'takenNames'>) => void;
  onAddToIndex: (targetName: string, proposal: Proto11Proposal) => void;
  onRerun: (targetName: string, proposal: Proto11Proposal) => void;
  onAskAgent: AskAgentAboutProposal;
  onProposalChange?: (showing: boolean) => void;
}) => {
  const [text, setText] = useState('');
  const [agent, setAgent] = useState<ComposerAgent | null>(null);
  const [pickedIds, setPickedIds] = useState<Proto11SourceId[]>([]);
  const [proposal, setProposal] = useState<Proto11Proposal | null>(null);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const { euiTheme } = useEuiTheme();

  const hasText = text.trim().length > 0;
  const showingProposal = proposal !== null;
  const attached = agent !== null || pickedIds.length > 0;
  const canPropose = !showingProposal && attached && hasText;
  const showChips = !compact || focused || hasText;

  useEffect(() => {
    onProposalChange?.(showingProposal);
  }, [onProposalChange, showingProposal]);

  const togglePicked = (id: Proto11SourceId, checked: boolean) =>
    setPickedIds((current) =>
      checked
        ? [...current.filter((item) => item !== id), id]
        : current.filter((item) => item !== id)
    );

  const propose = () => {
    if (!canPropose) return;
    setProposal(
      proposeFromComposer({
        text,
        ...(agent ? { agent } : {}),
        sourceIds: pickedIds,
        takenNames,
      })
    );
  };

  const applyQuestion = (question: string) => {
    setText(question);
    window.requestAnimationFrame(() => {
      const element = fieldRef.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(question.length, question.length);
    });
  };

  const boxCss = css`
    &:focus-within {
      outline: ${euiTheme.border.width.thick} solid ${euiTheme.colors.primary};
      outline-offset: -${euiTheme.border.width.thin};
    }
  `;
  const fieldCss = css`
    --euiFormControlStateHoverColor: transparent;
    background-color: transparent;
    box-shadow: none;
    padding: ${compact ? euiTheme.size.s : euiTheme.size.m};

    &:focus {
      box-shadow: none;
      outline: none;
    }
  `;

  const field = (
    <EuiTextArea
      fullWidth
      resize="none"
      inputRef={(element) => {
        fieldRef.current = element;
      }}
      rows={hasText ? rowsFor(text, 1, 5) : 1}
      placeholder={COMPOSER_PLACEHOLDER}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          propose();
        }
      }}
      aria-label="Ask a question your agent gets wrong, or describe what it should know"
      css={fieldCss}
      data-test-subj="proto11ComposerField"
    />
  );

  const scopes = (
    <EuiFilterGroup>
      <AgentScope agent={agent} onChange={setAgent} />
      <DataScope pickedIds={pickedIds} onToggle={togglePicked} />
    </EuiFilterGroup>
  );

  const proposeControl = (
    <EuiButton
      size="s"
      fill={proposal === null}
      isDisabled={!canPropose}
      onClick={propose}
      data-test-subj="proto11Propose"
    >
      Propose
    </EuiButton>
  );
  const proposeButton = attached ? (
    proposeControl
  ) : (
    <EuiToolTip content="Attach an agent or data first." position="top">
      <span tabIndex={0} className="contextEnginePrototype__proto11TipAnchor">
        {proposeControl}
      </span>
    </EuiToolTip>
  );

  const chips = (
    <EuiFlexGroup gutterSize="s" responsive={false} wrap data-test-subj="proto11Suggestions">
      {PROBLEM_CHIPS.map((chip) => {
        const badge = (
          <EuiBadge
            color="hollow"
            isDisabled={!attached}
            onClick={() => applyQuestion(chip.sentence)}
            onClickAriaLabel={`Use the question ${chip.sentence}`}
            data-test-subj="proto11ComposerExample"
          >
            {chip.sentence}
          </EuiBadge>
        );
        return (
          <EuiFlexItem grow={false} key={chip.sentence}>
            {attached ? (
              badge
            ) : (
              <EuiToolTip content="Attach an agent or data first." position="top">
                <span tabIndex={0} className="contextEnginePrototype__proto11TipAnchor">
                  {badge}
                </span>
              </EuiToolTip>
            )}
          </EuiFlexItem>
        );
      })}
    </EuiFlexGroup>
  );

  const below = proposal ? (
    <>
      <EuiSpacer size="m" />
      <ProposalCard
        key={`${proposal.path}-${proposal.name}-${proposal.trace?.value ?? ''}`}
        proposal={proposal}
        namespaces={namespaces}
        reuse={findReuseTarget(proposal, namespaces, forcedTarget)}
        onChange={() => setProposal(null)}
        onAskAgent={(name) => onAskAgent(proposal, name)}
        onRerun={(targetName) => onRerun(targetName, proposal)}
        onAddSource={(id) =>
          setProposal((current) => {
            if (!current || current.sourceIds.includes(id)) return current;
            const sourceIds = [...current.sourceIds, id];
            return {
              ...current,
              sourceIds,
              sourcesBecause:
                sourceIds.length === 1 ? 'because you picked it' : 'because you picked them',
            };
          })
        }
        onAddTo={(targetName) => onAddToIndex(targetName, proposal)}
        onCreate={(name) =>
          onCreateFromGoal({
            goalId: proposal.goal,
            name,
            sourceIds: proposal.sourceIds,
            ...(proposal.trace ? { trace: proposal.trace } : {}),
            connectFrom: {
              path: proposal.path,
              ...(proposal.question ? { question: proposal.question } : {}),
              ...(proposal.trace ? { agentName: proposal.trace.value } : {}),
            },
          })
        }
      />
    </>
  ) : showChips ? (
    <>
      <EuiSpacer size="s" />
      {chips}
    </>
  ) : null;

  return (
    <div
      ref={wrapperRef}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !wrapperRef.current?.contains(next)) setFocused(false);
      }}
      data-test-subj="proto11Composer"
    >
      {compact ? (
        <div
          className="contextEnginePrototype__proto11ComposerRow"
          css={css`
            gap: ${euiTheme.size.s};
          `}
        >
          <div className="contextEnginePrototype__proto11ComposerRowScopes">{scopes}</div>
          <EuiPanel
            hasBorder
            paddingSize="none"
            className="contextEnginePrototype__proto11ComposerRowBox"
            css={boxCss}
            data-test-subj="proto11ComposerBox"
          >
            <div
              className="contextEnginePrototype__proto11ComposerRow"
              css={css`
                padding-right: ${euiTheme.size.xs};
                gap: ${euiTheme.size.s};
              `}
            >
              <div className="contextEnginePrototype__proto11ComposerRowField">{field}</div>
              <div className="contextEnginePrototype__proto11ComposerRowAction">
                {proposeButton}
              </div>
            </div>
          </EuiPanel>
        </div>
      ) : (
        <>
          {scopes}
          <EuiSpacer size="s" />
          <EuiPanel hasBorder paddingSize="none" css={boxCss} data-test-subj="proto11ComposerBox">
            <div
              className="contextEnginePrototype__proto11ComposerRow contextEnginePrototype__proto11ComposerRow--single"
              css={css`
                gap: ${euiTheme.size.s};
                padding-right: ${euiTheme.size.m};
              `}
            >
              <div className="contextEnginePrototype__proto11ComposerRowField">{field}</div>
              {showingProposal ? null : (
                <div className="contextEnginePrototype__proto11ComposerRowAction">
                  {proposeButton}
                </div>
              )}
            </div>
          </EuiPanel>
        </>
      )}
      {below}
    </div>
  );
};

/** The landing composer, also opened from an index to propose an automation for it. */
export const Proto11Composer = Composer;

/** Proposal inside the Automations panel. Built from the description and sources. */
export const Proto11IndexProposal = ({
  namespace,
  onCreateAndRun,
  onRerun,
  onCancel,
}: {
  namespace: Namespace;
  onCreateAndRun: (proposal: Proto11Proposal) => void;
  onRerun: (proposal: Proto11Proposal) => void;
  onCancel: () => void;
}) => {
  const proposal = proposeFromIndex(namespace);
  const templateId = goalById(proposal.goal).template;
  const template = TEMPLATES[templateId];
  const suggestion = tracesSuggestionFor(namespace);
  const alreadyThere = namespace.automations.some(
    (automation) => automation.templateId === templateId
  );
  return (
    <div className="contextEnginePrototype__proto11Enter" data-test-subj="proto11IndexProposal">
      <EuiTitle size="xxs">
        <h3>Proposed automation</h3>
      </EuiTitle>
      <EuiSpacer size="m" />
      <EuiDescriptionList
        type="column"
        columnWidths={[1, 4]}
        listItems={[
          {
            title: 'Automation',
            description: alreadyThere ? (
              <EuiText size="s">
                <p data-test-subj="proto11ProposalDuplicate">
                  {`${template.title} is already on ${namespace.name}`}
                </p>
              </EuiText>
            ) : (
              <>
                <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiIcon type="bolt" size="m" aria-hidden={true} />
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiText size="s">
                      <strong>{template.title}</strong>
                    </EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiText size="s" color="subdued">
                  <p>{template.description}</p>
                </EuiText>
                <div data-test-subj="proto11IndexProposalBecause">
                  <BecauseLine>{proposal.automationBecause}</BecauseLine>
                </div>
              </>
            ),
          },
          {
            title: 'Sources',
            description: (
              <EuiText size="s" data-test-subj="proto11IndexProposalSources">
                <p>Uses the sources on this index</p>
              </EuiText>
            ),
          },
        ]}
      />
      {suggestion ? (
        <>
          <EuiSpacer size="s" />
          <EuiText size="xs" color="subdued">
            <p data-test-subj="proto11TracesSuggestion">{suggestion}</p>
          </EuiText>
        </>
      ) : null}
      <EuiSpacer size="l" />
      <EuiFlexGroup justifyContent="flexEnd" alignItems="center" gutterSize="m" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiLink onClick={onCancel} data-test-subj="proto11IndexProposalCancel">
            Cancel
          </EuiLink>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton
            fill
            onClick={() => (alreadyThere ? onRerun(proposal) : onCreateAndRun(proposal))}
            data-test-subj="proto11IndexProposalRun"
          >
            {alreadyThere ? 'Run it again' : 'Add and run'}
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>
    </div>
  );
};

/** Animated hero illustration. Plays its entrance once per mount, unless reduced motion is on. */
export const Proto11HeroArt = () => {
  const { colorMode } = useEuiTheme();
  return (
    <img
      src={colorMode === 'DARK' ? heroArtDark : heroArtLight}
      alt=""
      width={320}
      data-test-subj="proto11HeroArt"
    />
  );
};

/** Proto 11 On landing. Hero with the composer when there are no AI indices, a compact bar otherwise. */
export const Proto11Landing = ({
  variant,
  heroArt,
  indexGrid,
  takenNames,
  namespaces,
  onCreateFromGoal,
  onAddToIndex,
  onRerun,
  onCreateEmpty,
  onExploreSample,
  onAskAgent,
  discoverHref,
  onAskAboutIndicator,
  sampleDemoOpen,
  onSampleDemoOpenChange,
}: {
  variant: 'hero' | 'compact';
  heroArt: React.ReactNode;
  indexGrid: React.ReactNode;
  takenNames: string[];
  namespaces: Namespace[];
  onCreateFromGoal: (options: Omit<CreateFromGoalOptions, 'takenNames'>) => void;
  onAddToIndex: (targetName: string, proposal: Proto11Proposal) => void;
  onRerun: (targetName: string, proposal: Proto11Proposal) => void;
  onCreateEmpty: () => void;
  onExploreSample: ExploreSample;
  onAskAgent: AskAgentAboutProposal;
  discoverHref: string;
  onAskAboutIndicator: (indicator: KnowledgeIndicator, message: string) => void;
  sampleDemoOpen: boolean;
  onSampleDemoOpenChange: (next: boolean) => void;
}) => {
  const [proposalShowing, setProposalShowing] = useState(false);
  if (variant === 'compact') {
    return (
      <div className="contextEnginePrototype__proto11Landing" data-test-subj="proto11Landing">
        <Composer
          compact
          takenNames={takenNames}
          namespaces={namespaces}
          onCreateFromGoal={onCreateFromGoal}
          onAddToIndex={onAddToIndex}
          onRerun={onRerun}
          onAskAgent={onAskAgent}
        />
        <EuiSpacer size="xl" />
        {indexGrid}
      </div>
    );
  }

  return (
    <div className="contextEnginePrototype__proto11Landing" data-test-subj="proto11Landing">
      <EuiPanel
        hasBorder
        paddingSize="none"
        css={css`
          overflow: hidden;
        `}
        data-test-subj="proto11Hero"
      >
        <EuiPanel color="transparent" paddingSize="xl" hasShadow={false} borderRadius="none">
          <div className="contextEnginePrototype__proto11Hero">
            <div className="contextEnginePrototype__proto11HeroContent">
              <EuiTitle size="l">
                <h2>Get started with Context</h2>
              </EuiTitle>
              <EuiSpacer size="s" />
              <EuiText size="s" color="subdued">
                <p>
                  Context turns your data into Knowledge Indicators, short facts your agents
                  retrieve when they answer.
                </p>
              </EuiText>
              <EuiSpacer size="l" />
              <Composer
                compact={false}
                takenNames={takenNames}
                namespaces={namespaces}
                onCreateFromGoal={onCreateFromGoal}
                onAddToIndex={onAddToIndex}
                onRerun={onRerun}
                onAskAgent={onAskAgent}
                onProposalChange={setProposalShowing}
              />
              {proposalShowing ? null : (
                <>
                  <EuiSpacer size="m" />
                  <EuiText size="s" data-test-subj="proto11HeroActions">
                    <EuiLink
                      color="subdued"
                      onClick={onCreateEmpty}
                      data-test-subj="proto11CreateEmpty"
                    >
                      Create an empty AI index instead
                    </EuiLink>
                  </EuiText>
                </>
              )}
            </div>
            <div className="contextEnginePrototype__proto11HeroArt">{heroArt}</div>
          </div>
        </EuiPanel>
        <Proto11SampleStrip
          expanded={sampleDemoOpen}
          onExpandedChange={onSampleDemoOpenChange}
          onExploreSample={onExploreSample}
          discoverHref={discoverHref}
          onAskAboutIndicator={onAskAboutIndicator}
        />
      </EuiPanel>
      <EuiSpacer size="xl" />
      {indexGrid}
    </div>
  );
};
