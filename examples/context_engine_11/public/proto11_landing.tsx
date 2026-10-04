/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useRef, useState } from 'react';
import {
  EuiBadge,
  EuiButton,
  EuiButtonGroup,
  EuiButtonIcon,
  EuiCheckbox,
  EuiComboBox,
  EuiDescriptionList,
  EuiFieldText,
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
  EuiTitle,
  EuiToolTip,
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
import { Proto11SampleStrip, SampleMenuLink } from './proto11_sample_panel';
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

const HERO_PLACEHOLDER =
  'Tell Context what your agent should get better at. Ask a question it gets wrong, or attach an agent or data.';
const COMPACT_PLACEHOLDER = 'New AI index: tell Context what your agent should get better at.';

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

const AttachAgentButton = ({ onAttach }: { onAttach: (agent: ComposerAgent) => void }) => {
  const [open, setOpen] = useState(false);
  const [selector, setSelector] = useState<TraceSelector>('elastic_agents');
  const options = selector === 'elastic_agents' ? ELASTIC_AGENT_OPTIONS : GENAI_TRACE_OPTIONS;
  return (
    <EuiPopover
      button={
        <EuiButton
          size="s"
          iconType="productAgent"
          onClick={() => setOpen((isOpen) => !isOpen)}
          data-test-subj="proto11AttachAgent"
        >
          Attach agent
        </EuiButton>
      }
      aria-label="Attach agent"
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
          options={options.map((value) => ({ value, text: value }))}
          onChange={(event) => {
            setOpen(false);
            onAttach({
              name: event.target.value,
              traceType: selector === 'elastic_agents' ? 'elastic_agent' : 'index',
            });
          }}
          aria-label={selector === 'elastic_agents' ? 'Agent' : 'Trace index or data stream'}
          data-test-subj="proto11AttachAgentSelect"
        />
      </div>
    </EuiPopover>
  );
};

const AttachDataButton = ({
  pickedIds,
  onToggle,
}: {
  pickedIds: Proto11SourceId[];
  onToggle: (id: Proto11SourceId, checked: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DataTab>('elasticsearch');
  return (
    <EuiPopover
      button={
        <EuiButton
          size="s"
          iconType="database"
          onClick={() => setOpen((isOpen) => !isOpen)}
          data-test-subj="proto11AttachData"
        >
          Attach data
        </EuiButton>
      }
      aria-label="Attach data"
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

  const hasText = text.trim().length > 0;
  const canPropose = hasText || agent !== null || pickedIds.length > 0;
  const traceQuestions = agent ? traceQuestionsFor(agent.name) : [];
  const expanded = !compact || focused || hasText || agent !== null || pickedIds.length > 0;

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

  const field = (
    <EuiTextArea
      fullWidth
      resize="none"
      rows={compact && !expanded ? 1 : rowsFor(text, 2, 5)}
      placeholder={compact ? COMPACT_PLACEHOLDER : HERO_PLACEHOLDER}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          propose();
        }
      }}
      aria-label="What your agent should get better at"
      data-test-subj="proto11ComposerField"
    />
  );

  const attachButtons = (
    <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
      <EuiFlexItem grow={false}>
        <AttachAgentButton onAttach={setAgent} />
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <AttachDataButton pickedIds={pickedIds} onToggle={togglePicked} />
      </EuiFlexItem>
    </EuiFlexGroup>
  );

  const proposeButton = (
    <EuiButton
      size="s"
      fill={canPropose && proposal === null}
      isDisabled={!canPropose}
      onClick={propose}
      data-test-subj="proto11Propose"
    >
      Propose
    </EuiButton>
  );

  const attachments =
    agent || pickedIds.length > 0 ? (
      <div
        className="contextEnginePrototype__proto11Attachments"
        data-test-subj="proto11Attachments"
      >
        {agent ? (
          <AttachmentChip icon="productAgent" name={agent.name} onRemove={() => setAgent(null)} />
        ) : null}
        {pickedIds.map((id) => {
          const source = namespaceSourceFor(id);
          return (
            <AttachmentChip
              key={id}
              icon={source.icon}
              name={source.name}
              typeLabel={source.typeLabel}
              onRemove={() => togglePicked(id, false)}
            />
          );
        })}
      </div>
    ) : null;

  const chips =
    traceQuestions.length > 0 ? (
      <EuiFlexGroup direction="column" gutterSize="xs" data-test-subj="proto11TracePreview">
        {traceQuestions.map((item) => (
          <EuiFlexItem key={item.question} grow={false}>
            <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiText size="s">
                  <EuiLink
                    color="text"
                    onClick={() => setText(item.question)}
                    data-test-subj="proto11ComposerExample"
                  >
                    {item.question}
                  </EuiLink>
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">{item.badge}</EuiBadge>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    ) : (
      <EuiFlexGroup gutterSize="s" responsive={false} wrap>
        {EXAMPLE_QUESTIONS.map((example) => (
          <EuiFlexItem grow={false} key={example}>
            <EuiBadge
              color="hollow"
              onClick={() => setText(example)}
              onClickAriaLabel={`Use the question ${example}`}
              data-test-subj="proto11ComposerExample"
            >
              {example}
            </EuiBadge>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    );

  const below = proposal ? (
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
  ) : expanded ? (
    chips
  ) : null;

  return (
    <div
      ref={wrapperRef}
      className="contextEnginePrototype__proto11Composer"
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !wrapperRef.current?.contains(next)) setFocused(false);
      }}
      data-test-subj="proto11Composer"
    >
      {attachments}
      {compact ? (
        <EuiFlexGroup gutterSize="s" alignItems="flexStart" responsive={false} wrap>
          <EuiFlexItem className="contextEnginePrototype__proto11ComposerField">
            {field}
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
              <EuiFlexItem grow={false}>{attachButtons}</EuiFlexItem>
              <EuiFlexItem grow={false}>{proposeButton}</EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
        </EuiFlexGroup>
      ) : (
        <>
          {field}
          <EuiFlexGroup gutterSize="s" alignItems="center" justifyContent="spaceBetween">
            <EuiFlexItem grow={false}>{attachButtons}</EuiFlexItem>
            <EuiFlexItem grow={false}>{proposeButton}</EuiFlexItem>
          </EuiFlexGroup>
        </>
      )}
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
        <EuiPanel hasBorder paddingSize="m" data-test-subj="proto11ComposerBar">
          <Composer compact takenNames={takenNames} onCreateFromGoal={onCreateFromGoal} />
        </EuiPanel>
        {indexGrid}
      </div>
    );
  }

  return (
    <div className="contextEnginePrototype__proto11Landing" data-test-subj="proto11Landing">
      <EuiPanel hasBorder paddingSize="xl" data-test-subj="proto11Hero">
        <div className="contextEnginePrototype__proto11Hero">
          <div className="contextEnginePrototype__proto11HeroContent">
            <EuiTitle size="m">
              <h2>Get started with Context</h2>
            </EuiTitle>
            <EuiSpacer size="xs" />
            <EuiText size="s" color="subdued">
              <p>
                Context turns your data into Knowledge Indicators, short facts your agents retrieve
                when they answer.
              </p>
            </EuiText>
            <EuiSpacer size="l" />
            <Composer compact={false} takenNames={takenNames} onCreateFromGoal={onCreateFromGoal} />
            <EuiSpacer size="m" />
            <EuiText size="s" color="subdued">
              <p>
                About a minute to first results, from a sample of your data. Everything can be
                changed afterwards.
              </p>
            </EuiText>
            <EuiSpacer size="s" />
            <EuiFlexGroup gutterSize="l" alignItems="center" responsive={false} wrap>
              <EuiFlexItem grow={false}>
                <SampleMenuLink onExploreSample={onExploreSample} />
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiLink onClick={onCreateEmpty} data-test-subj="proto11CreateEmpty">
                  Create an empty AI index instead
                </EuiLink>
              </EuiFlexItem>
            </EuiFlexGroup>
          </div>
          <div className="contextEnginePrototype__proto11HeroArt">{heroArt}</div>
        </div>
      </EuiPanel>
      <Proto11SampleStrip />
      {indexGrid}
    </div>
  );
};
