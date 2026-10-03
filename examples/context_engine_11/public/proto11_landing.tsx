/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useState } from 'react';
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
  EuiSelect,
  EuiSpacer,
  EuiText,
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
  proposeFromAgent,
  proposeFromData,
  proposeFromQuestion,
  traceQuestionsFor,
  type CreateFromGoalOptions,
  type Proto11Path,
  type Proto11Proposal,
} from './proto11_data';
import { Proto11SamplePanel } from './proto11_sample_panel';
import type { Proto11SampleScenario, Proto11SourceId } from './proto11_types';
import { TRACES_DOCS_HREF, TraceRow } from './traces_panel';

type TraceSelector = 'elastic_agents' | 'genai_libraries';

const TRACE_SELECTOR_OPTIONS = [
  { id: 'elastic_agents' as const, label: 'Agents on Elastic' },
  { id: 'genai_libraries' as const, label: 'GenAI libraries' },
];

const STACK_QUERY = '(max-width: 1099px)';

const useStackedColumns = () => {
  const [stacked, setStacked] = useState(() => window.matchMedia(STACK_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(STACK_QUERY);
    const update = () => setStacked(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return stacked;
};

const INDEX_SOURCES = WEB_OPS_SOURCES.filter((source) => source.kind === 'Index');
const CONNECTOR_SOURCES = WEB_OPS_SOURCES.filter((source) => source.kind === 'Connector');

const Tile = ({
  icon,
  title,
  line,
  action,
  testSubj,
  children,
}: {
  icon: string;
  title: string;
  line: string;
  action: React.ReactNode;
  testSubj: string;
  children: React.ReactNode;
}) => (
  <EuiPanel hasBorder paddingSize="l" data-test-subj={testSubj}>
    <EuiFlexGroup gutterSize="m" alignItems="flexStart" responsive={false}>
      <EuiFlexItem grow={false}>
        <EuiIcon type={icon} size="l" aria-hidden={true} />
      </EuiFlexItem>
      <EuiFlexItem>
        <EuiTitle size="xs">
          <h4>{title}</h4>
        </EuiTitle>
        <EuiSpacer size="xs" />
        <EuiText size="s" color="subdued">
          <p>{line}</p>
        </EuiText>
        <EuiSpacer size="m" />
        {children}
        <EuiSpacer size="m" />
        <EuiFlexGroup justifyContent="flexEnd" responsive={false}>
          <EuiFlexItem grow={false}>{action}</EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexItem>
    </EuiFlexGroup>
  </EuiPanel>
);

const SourceChip = ({
  id,
  found,
  onRemove,
}: {
  id: Proto11SourceId;
  found?: boolean;
  onRemove?: () => void;
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
      {found ? <EuiBadge color="hollow">found</EuiBadge> : null}
      {onRemove ? (
        <EuiToolTip content={`Remove ${source.name}`} disableScreenReaderOutput>
          <EuiButtonIcon iconType="cross" aria-label={`Remove ${source.name}`} onClick={onRemove} />
        </EuiToolTip>
      ) : null}
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

/** Proto 11 On, no user indices yet: three ways in on the left, the sample run on the right. */
export const Proto11Landing = ({
  managedInset,
  catalog,
  takenNames,
  docsHref,
  onCreateFromGoal,
  onCreateEmpty,
  onExploreSample,
}: {
  managedInset: React.ReactNode;
  catalog: React.ReactNode;
  takenNames: string[];
  docsHref: string;
  onCreateFromGoal: (options: Omit<CreateFromGoalOptions, 'takenNames'>) => void;
  onCreateEmpty: () => void;
  onExploreSample: (scenario: Proto11SampleScenario) => void;
}) => {
  const stacked = useStackedColumns();

  const [traceSelector, setTraceSelector] = useState<TraceSelector>('elastic_agents');
  const [agent, setAgent] = useState(ELASTIC_AGENT_OPTIONS[0]);
  const [agentTouched, setAgentTouched] = useState(false);
  const [pickedIds, setPickedIds] = useState<Proto11SourceId[]>([]);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [editOrder, setEditOrder] = useState<Proto11Path[]>([]);
  const [proposal, setProposal] = useState<Proto11Proposal | null>(null);
  const [proposalName, setProposalName] = useState('');

  const markEdited = (path: Proto11Path) =>
    setEditOrder((order) => [...order.filter((item) => item !== path), path]);

  const traceQuestions = traceQuestionsFor(agent);
  const hasInput: Record<Proto11Path, boolean> = {
    agent: agentTouched && traceQuestions.length > 0,
    data: pickedIds.length > 0,
    question: question.trim().length > 0,
  };
  const filledPath = [...editOrder].reverse().find((path) => hasInput[path]);

  const openProposal = (next: Proto11Proposal) => {
    setProposal(next);
    setProposalName(next.name);
  };

  const togglePicked = (id: Proto11SourceId, checked: boolean) => {
    setPickedIds((current) =>
      checked
        ? [...current.filter((item) => item !== id), id]
        : current.filter((item) => item !== id)
    );
    markEdited('data');
  };

  const agentOptions =
    traceSelector === 'elastic_agents' ? ELASTIC_AGENT_OPTIONS : GENAI_TRACE_OPTIONS;

  const agentTile = (
    <Tile
      icon="timeline"
      title="Start from your agent"
      line="Context reads what your agent has been asked and where it failed, then proposes what to build."
      testSubj="proto11AgentTile"
      action={
        <EuiButton
          size="s"
          fill={filledPath === 'agent'}
          onClick={() =>
            openProposal(
              proposeFromAgent(
                agent,
                traceSelector === 'elastic_agents' ? 'elastic_agent' : 'index',
                takenNames
              )
            )
          }
          data-test-subj="proto11ProposeFromTraces"
        >
          Propose from traces
        </EuiButton>
      }
    >
      <EuiButtonGroup
        legend="Agent traces source"
        type="single"
        buttonSize="compressed"
        options={TRACE_SELECTOR_OPTIONS}
        idSelected={traceSelector}
        onChange={(id) => {
          const next = id as TraceSelector;
          setTraceSelector(next);
          setAgent(next === 'elastic_agents' ? ELASTIC_AGENT_OPTIONS[0] : GENAI_TRACE_OPTIONS[0]);
          setAgentTouched(true);
          markEdited('agent');
        }}
      />
      <EuiSpacer size="s" />
      <EuiSelect
        compressed
        fullWidth
        options={agentOptions.map((value) => ({ value, text: value }))}
        value={agent}
        onChange={(event) => {
          setAgent(event.target.value);
          setAgentTouched(true);
          markEdited('agent');
        }}
        aria-label={traceSelector === 'elastic_agents' ? 'Agent' : 'Trace index or data stream'}
      />
      <EuiSpacer size="m" />
      {traceQuestions.length > 0 ? (
        <EuiFlexGroup direction="column" gutterSize="s" data-test-subj="proto11TracePreview">
          {traceQuestions.map((item) => (
            <EuiFlexItem key={item.question}>
              <EuiFlexGroup
                gutterSize="s"
                alignItems="center"
                justifyContent="spaceBetween"
                responsive={false}
              >
                <EuiFlexItem>
                  <EuiText size="s">{item.question}</EuiText>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiBadge color="hollow">{item.badge}</EuiBadge>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      ) : (
        <EuiText size="s" color="subdued">
          <p>
            No agent traces yet. Connect tracing to use this.{' '}
            <EuiLink href={TRACES_DOCS_HREF} target="_blank" external>
              Read the docs
            </EuiLink>
          </p>
        </EuiText>
      )}
    </Tile>
  );

  const dataTile = (
    <Tile
      icon="database"
      title="Start from your data"
      line="Pick the indices or connectors your agent should know. Context inspects them and proposes what to build."
      testSubj="proto11DataTile"
      action={
        <EuiButton
          size="s"
          fill={filledPath === 'data'}
          isDisabled={pickedIds.length === 0}
          onClick={() => openProposal(proposeFromData(pickedIds, takenNames))}
          data-test-subj="proto11ProposeFromData"
        >
          Propose from data
        </EuiButton>
      }
    >
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
            if (picked) togglePicked(picked, true);
          }}
          isClearable={false}
          data-test-subj="proto11DataCombo"
        />
      </EuiFormRow>
      <EuiSpacer size="s" />
      <EuiLink
        onClick={() => setConnectorsOpen((open) => !open)}
        data-test-subj="proto11Connectors"
      >
        {connectorsOpen ? 'Hide connectors' : 'Connectors'}
      </EuiLink>
      {connectorsOpen ? (
        <>
          <EuiSpacer size="s" />
          <div className="contextEnginePrototype__connectorList">
            {CONNECTOR_SOURCES.map((source) => {
              const { icon } = namespaceSourceFor(source.id);
              return (
                <div key={source.id} className="contextEnginePrototype__connectorRow">
                  <EuiCheckbox
                    id={`context-engine-11-landing-connector-${source.id}`}
                    checked={pickedIds.includes(source.id)}
                    onChange={(event) => togglePicked(source.id, event.target.checked)}
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
        </>
      ) : null}
      {pickedIds.length > 0 ? (
        <>
          <EuiSpacer size="m" />
          <div className="contextEnginePrototype__selectedSources">
            {pickedIds.map((id) => (
              <SourceChip key={id} id={id} onRemove={() => togglePicked(id, false)} />
            ))}
          </div>
          <EuiSpacer size="s" />
          <EuiText size="s" color="subdued">
            <p>I will read the mapping and a sample of about 500 documents from each.</p>
          </EuiText>
        </>
      ) : null}
    </Tile>
  );

  const questionTile = (
    <Tile
      icon="question"
      title="Start from a question"
      line="Type a question your agent should answer well. Context finds the sources that can answer it."
      testSubj="proto11QuestionTile"
      action={
        <EuiButton
          size="s"
          fill={filledPath === 'question'}
          isDisabled={question.trim().length === 0}
          onClick={() => openProposal(proposeFromQuestion(question, takenNames))}
          data-test-subj="proto11FindSources"
        >
          Find sources
        </EuiButton>
      }
    >
      <EuiFieldText
        fullWidth
        compressed
        placeholder="Why is checkout-api returning 5xx this morning?"
        value={question}
        onChange={(event) => {
          setQuestion(event.target.value);
          markEdited('question');
        }}
        aria-label="A question your agent should answer well"
        data-test-subj="proto11QuestionField"
      />
      <EuiSpacer size="s" />
      <EuiFlexGroup gutterSize="s" responsive={false} wrap>
        {EXAMPLE_QUESTIONS.map((example) => (
          <EuiFlexItem grow={false} key={example}>
            <EuiBadge
              color="hollow"
              onClick={() => {
                setQuestion(example);
                markEdited('question');
              }}
              onClickAriaLabel={`Use the question ${example}`}
              data-test-subj="proto11QuestionExample"
            >
              {example}
            </EuiBadge>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    </Tile>
  );

  const renderProposal = (current: Proto11Proposal) => {
    const template = TEMPLATES[goalById(current.goal).template];
    const listItems = [
      {
        title: 'Name',
        description: (
          <EuiFieldText
            compressed
            value={proposalName}
            onChange={(event) => setProposalName(event.target.value)}
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
            <BecauseLine>{current.automationBecause}</BecauseLine>
          </>
        ),
      },
      {
        title: 'Sources',
        description: (
          <>
            <div className="contextEnginePrototype__selectedSources">
              {current.sourceIds.map((id) => (
                <SourceChip key={id} id={id} found={current.foundIds.includes(id)} />
              ))}
            </div>
            <EuiSpacer size="xs" />
            <BecauseLine>{current.sourcesBecause}</BecauseLine>
          </>
        ),
      },
      ...(current.trace
        ? [{ title: 'Agent traces', description: <TraceRow trace={current.trace} /> }]
        : []),
    ];
    return (
      <EuiPanel hasBorder paddingSize="l" data-test-subj="proto11Proposal">
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
            <EuiLink onClick={() => setProposal(null)} data-test-subj="proto11ProposalChange">
              Change
            </EuiLink>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              fill
              onClick={() =>
                onCreateFromGoal({
                  goalId: current.goal,
                  name: proposalName,
                  sourceIds: current.sourceIds,
                  ...(current.trace ? { trace: current.trace } : {}),
                })
              }
              data-test-subj="proto11CreateAndRun"
            >
              Create and run
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    );
  };

  const leftColumn = proposal ? (
    renderProposal(proposal)
  ) : (
    <>
      <EuiTitle size="s">
        <h2>Get started with Context</h2>
      </EuiTitle>
      <EuiSpacer size="xs" />
      <EuiText size="s" color="subdued">
        <p>
          Context turns your data into Knowledge Indicators, short facts your agents retrieve when
          they answer.
        </p>
      </EuiText>
      <EuiSpacer size="l" />
      <EuiTitle size="xxs">
        <h3>Start from what you have</h3>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiFlexGroup direction="column" gutterSize="m">
        <EuiFlexItem>{agentTile}</EuiFlexItem>
        <EuiFlexItem>{dataTile}</EuiFlexItem>
        <EuiFlexItem>{questionTile}</EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      <EuiText size="s" color="subdued">
        <p>
          About a minute to first results, from a sample of your data. Everything can be changed
          afterwards.
        </p>
      </EuiText>
      <EuiSpacer size="s" />
      <EuiLink onClick={onCreateEmpty} data-test-subj="proto11CreateEmpty">
        Create an empty AI index instead
      </EuiLink>
    </>
  );

  return (
    <div className="contextEnginePrototype__proto11Landing" data-test-subj="proto11Landing">
      <EuiFlexGroup
        direction={stacked ? 'column' : 'row'}
        gutterSize="xl"
        alignItems={stacked ? 'stretch' : 'flexStart'}
        responsive={false}
      >
        <EuiFlexItem grow={7}>{leftColumn}</EuiFlexItem>
        <EuiFlexItem grow={5}>
          <Proto11SamplePanel docsHref={docsHref} onExploreSample={onExploreSample} />
        </EuiFlexItem>
      </EuiFlexGroup>
      {managedInset}
      {catalog}
    </div>
  );
};
