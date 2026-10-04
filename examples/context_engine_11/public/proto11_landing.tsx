/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useRef, useState } from 'react';
import { css } from '@emotion/react';
import {
  EuiBadge,
  EuiButton,
  EuiButtonGroup,
  EuiButtonIcon,
  EuiCheckbox,
  EuiComboBox,
  EuiDescriptionList,
  EuiFieldText,
  EuiFilterButton,
  EuiFilterGroup,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiIcon,
  EuiLink,
  EuiPanel,
  EuiPopover,
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

import {
  ELASTIC_AGENT_OPTIONS,
  EXAMPLE_QUESTIONS,
  GENAI_TRACE_OPTIONS,
  TEMPLATES,
  WEB_OPS_SOURCES,
  goalById,
  namespaceSourceFor,
  proposeFromComposer,
  traceQuestionsFor,
  type ComposerInput,
  type CreateFromGoalOptions,
  type Proto11Proposal,
} from './proto11_data';
import { Proto11SampleStrip, SampleMenuButton } from './proto11_sample_panel';
import type { Proto11SampleScenario, Proto11SourceId } from './proto11_types';
import { TraceRow } from './traces_panel';

type TraceSelector = 'elastic_agents' | 'genai_libraries';
type DataTab = 'elasticsearch' | 'connectors';
type ComposerAgent = NonNullable<ComposerInput['agent']>;

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

const ProposalSourceChip = ({ id, found }: { id: Proto11SourceId; found: boolean }) => {
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
      {found ? <EuiBadge color="hollow">found</EuiBadge> : null}
    </div>
  );
};

const BecauseLine = ({ children }: { children: React.ReactNode }) => (
  <EuiText size="s" color="subdued">
    <p>
      <em>{children}</em>
    </p>
  </EuiText>
);

const ProposalCard = ({
  proposal,
  onChange,
  onCreate,
}: {
  proposal: Proto11Proposal;
  onChange: () => void;
  onCreate: (name: string) => void;
}) => {
  const [name, setName] = useState(proposal.name);
  const template = TEMPLATES[goalById(proposal.goal).template];
  const listItems = [
    {
      title: 'Name',
      description: (
        <EuiFieldText
          compressed
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="AI index name"
          data-test-subj="proto11ProposalName"
        />
      ),
    },
    {
      title: 'Automation',
      description: (
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
          <BecauseLine>{proposal.automationBecause}</BecauseLine>
        </>
      ),
    },
    {
      title: 'Sources',
      description: (
        <>
          <div className="contextEnginePrototype__selectedSources">
            {proposal.sourceIds.map((id) => (
              <ProposalSourceChip key={id} id={id} found={proposal.foundIds.includes(id)} />
            ))}
          </div>
          <EuiSpacer size="xs" />
          <BecauseLine>{proposal.sourcesBecause}</BecauseLine>
        </>
      ),
    },
    ...(proposal.trace
      ? [{ title: 'Agent traces', description: <TraceRow trace={proposal.trace} /> }]
      : []),
  ];
  return (
    <EuiPanel
      hasBorder
      paddingSize="l"
      className="contextEnginePrototype__proto11Enter"
      data-test-subj="proto11Proposal"
    >
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
        <EuiFlexItem grow={false}>
          <EuiIcon type="productAgent" size="m" aria-hidden={true} />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiTitle size="xs">
            <h3>Here is what I would set up</h3>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="s" color="subdued">
            Elastic AI Agent
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="l" />
      <EuiDescriptionList type="column" columnWidths={[1, 4]} listItems={listItems} />
      <EuiSpacer size="l" />
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiLink onClick={onChange} data-test-subj="proto11ProposalChange">
            Change
          </EuiLink>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton fill onClick={() => onCreate(name)} data-test-subj="proto11CreateAndRun">
            Create and run
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
  const options = selector === 'elastic_agents' ? ELASTIC_AGENT_OPTIONS : GENAI_TRACE_OPTIONS;
  const selected = agent && options.includes(agent.name) ? agent.name : '';
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
        <EuiSelect
          key={selector}
          compressed
          fullWidth
          hasNoInitialSelection
          value={selected}
          options={options.map((value) => ({ value, text: value }))}
          onChange={(event) => {
            setOpen(false);
            onChange({
              name: event.target.value,
              traceType: selector === 'elastic_agents' ? 'elastic_agent' : 'index',
            });
          }}
          aria-label={selector === 'elastic_agents' ? 'Agent' : 'Trace index or data stream'}
          data-test-subj="proto11AttachAgentSelect"
        />
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
  onCreateFromGoal,
}: {
  compact: boolean;
  takenNames: string[];
  onCreateFromGoal: (options: Omit<CreateFromGoalOptions, 'takenNames'>) => void;
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
  const canPropose = hasText || agent !== null || pickedIds.length > 0;
  const traceQuestions = agent ? traceQuestionsFor(agent.name) : [];
  const showChips = !compact || focused || hasText;

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
  const railCss = css`
    align-items: center;
    display: flex;
    gap: ${euiTheme.size.s};
    padding: ${euiTheme.size.s};
  `;

  const field = (
    <EuiTextArea
      fullWidth
      resize="none"
      inputRef={(element) => {
        fieldRef.current = element;
      }}
      rows={compact && !focused && !hasText ? 1 : rowsFor(text, 2, 5)}
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

  const proposeButton = (
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

  const suggestions =
    traceQuestions.length > 0
      ? traceQuestions.map((item) => ({
          question: item.question,
          label: (
            <>
              {item.question} <EuiTextColor color="subdued">{item.badge}</EuiTextColor>
            </>
          ),
        }))
      : EXAMPLE_QUESTIONS.map((question) => ({ question, label: question }));

  const chips = (
    <EuiFlexGroup gutterSize="s" responsive={false} wrap data-test-subj="proto11Suggestions">
      {suggestions.map(({ question, label }) => (
        <EuiFlexItem grow={false} key={question}>
          <EuiBadge
            color="hollow"
            onClick={() => applyQuestion(question)}
            onClickAriaLabel={`Use the question ${question}`}
            data-test-subj="proto11ComposerExample"
          >
            {label}
          </EuiBadge>
        </EuiFlexItem>
      ))}
    </EuiFlexGroup>
  );

  const below = proposal ? (
    <>
      <EuiSpacer size="m" />
      <ProposalCard
        key={`${proposal.path}-${proposal.name}-${proposal.sourceIds.join(',')}`}
        proposal={proposal}
        onChange={() => setProposal(null)}
        onCreate={(name) =>
          onCreateFromGoal({
            goalId: proposal.goal,
            name,
            sourceIds: proposal.sourceIds,
            ...(proposal.trace ? { trace: proposal.trace } : {}),
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
      <EuiPanel hasBorder paddingSize="none" css={boxCss} data-test-subj="proto11ComposerBox">
        {compact ? (
          <div
            className="contextEnginePrototype__proto11ComposerRow"
            css={css`
              padding: ${euiTheme.size.s};
              gap: ${euiTheme.size.s};
            `}
          >
            <div className="contextEnginePrototype__proto11ComposerRowScopes">{scopes}</div>
            <div className="contextEnginePrototype__proto11ComposerRowField">{field}</div>
            <div className="contextEnginePrototype__proto11ComposerRowAction">{proposeButton}</div>
          </div>
        ) : (
          <>
            <div
              css={css`
                ${railCss}
                border-bottom: ${euiTheme.border.thin};
              `}
            >
              {scopes}
            </div>
            {field}
            <div
              css={css`
                ${railCss}
                border-top: ${euiTheme.border.thin};
                justify-content: space-between;
              `}
            >
              <EuiText size="xs" color="subdued">
                <p>You will see a proposal before anything is created.</p>
              </EuiText>
              {proposeButton}
            </div>
          </>
        )}
      </EuiPanel>
      {below}
    </div>
  );
};

/** Proto 11 On landing. Hero with the composer when there are no AI indices, a compact bar otherwise. */
export const Proto11Landing = ({
  variant,
  heroArt,
  indexGrid,
  takenNames,
  onCreateFromGoal,
  onCreateEmpty,
  onExploreSample,
}: {
  variant: 'hero' | 'compact';
  heroArt: React.ReactNode;
  indexGrid: React.ReactNode;
  takenNames: string[];
  onCreateFromGoal: (options: Omit<CreateFromGoalOptions, 'takenNames'>) => void;
  onCreateEmpty: () => void;
  onExploreSample: (scenario: Proto11SampleScenario) => void;
}) => {
  if (variant === 'compact') {
    return (
      <div className="contextEnginePrototype__proto11Landing" data-test-subj="proto11Landing">
        <Composer compact takenNames={takenNames} onCreateFromGoal={onCreateFromGoal} />
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
                onCreateFromGoal={onCreateFromGoal}
              />
              <EuiSpacer size="m" />
              <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
                <EuiFlexItem grow={false}>
                  <SampleMenuButton onExploreSample={onExploreSample} />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButton size="s" onClick={onCreateEmpty} data-test-subj="proto11CreateEmpty">
                    Create an empty AI index
                  </EuiButton>
                </EuiFlexItem>
              </EuiFlexGroup>
              <EuiSpacer size="xs" />
              <EuiText size="xs" color="subdued">
                <p>
                  About a minute to first results, from a sample of your data. Everything can be
                  changed afterwards.
                </p>
              </EuiText>
            </div>
            <div className="contextEnginePrototype__proto11HeroArt">{heroArt}</div>
          </div>
        </EuiPanel>
        <Proto11SampleStrip />
      </EuiPanel>
      <EuiSpacer size="xl" />
      {indexGrid}
    </div>
  );
};
