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
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiCard,
  EuiDescriptionList,
  EuiFlexGrid,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiLink,
  EuiPanel,
  EuiSelect,
  EuiSpacer,
  EuiText,
  EuiTextArea,
  EuiTitle,
} from '@elastic/eui';

import {
  ELASTIC_AGENT_OPTIONS,
  EXAMPLE_DESCRIPTION,
  GENAI_TRACE_OPTIONS,
  GOALS,
  TEMPLATES,
  becauseMentions,
  goalById,
  proposeFromDescription,
  sourceName,
  type CreateFromGoalOptions,
  type GoalDef,
  type Proto11Proposal,
} from './proto11_data';
import type { Proto11GoalId } from './proto11_types';

const DESCRIBE_MIN_LENGTH = 10;

type TraceSelector = 'elastic_agents' | 'genai_libraries';

const TRACE_SELECTOR_OPTIONS = [
  { id: 'elastic_agents' as const, label: 'Agents on Elastic' },
  { id: 'genai_libraries' as const, label: 'GenAI libraries' },
];

export const Proto11Landing = ({
  managedInset,
  catalog,
  onCreateFromGoal,
  onCreateEmpty,
  onTrySample,
}: {
  managedInset: React.ReactNode;
  catalog: React.ReactNode;
  onCreateFromGoal: (options: Omit<CreateFromGoalOptions, 'takenNames'>) => void;
  onCreateEmpty: () => void;
  onTrySample: () => void;
}) => {
  const [describeText, setDescribeText] = useState('');
  const [proposal, setProposal] = useState<Proto11Proposal | null>(null);
  const [highlighted, setHighlighted] = useState<Proto11GoalId | null>(null);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [traceSelector, setTraceSelector] = useState<TraceSelector>('elastic_agents');
  const [traceValue, setTraceValue] = useState(ELASTIC_AGENT_OPTIONS[0]);

  const describeLength = describeText.trim().length;

  const createGaps = () => {
    onCreateFromGoal({
      goalId: 'gaps',
      trace: {
        value: traceValue,
        type: traceSelector === 'elastic_agents' ? 'elastic_agent' : 'index',
      },
    });
  };

  const renderGoalCard = (goal: GoalDef) => {
    const footerLine = (
      <EuiText size="xs" color="subdued">
        <p>{goal.footer}</p>
      </EuiText>
    );
    const common = {
      textAlign: 'left' as const,
      paddingSize: 'm' as const,
      titleElement: 'h4' as const,
      titleSize: 'xs' as const,
      icon: <EuiIcon type={goal.icon} size="l" aria-hidden={true} />,
      title: goal.title,
      description: goal.description,
      ...(highlighted === goal.id ? { display: 'primary' as const } : { hasBorder: true }),
    };

    if (goal.id === 'gaps' && gapsOpen) {
      const options =
        traceSelector === 'elastic_agents' ? ELASTIC_AGENT_OPTIONS : GENAI_TRACE_OPTIONS;
      return (
        <EuiCard
          {...common}
          data-test-subj="proto11GoalCard-gaps"
          footer={
            <>
              {footerLine}
              <EuiSpacer size="s" />
              <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiButton size="s" onClick={createGaps} data-test-subj="proto11GapsCreate">
                    Create
                  </EuiButton>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButtonEmpty size="s" onClick={() => setGapsOpen(false)}>
                    Cancel
                  </EuiButtonEmpty>
                </EuiFlexItem>
              </EuiFlexGroup>
            </>
          }
        >
          <EuiSpacer size="s" />
          <EuiButtonGroup
            legend="Agent traces source"
            type="single"
            buttonSize="compressed"
            options={TRACE_SELECTOR_OPTIONS}
            idSelected={traceSelector}
            onChange={(id) => {
              const next = id as TraceSelector;
              setTraceSelector(next);
              setTraceValue(
                next === 'elastic_agents' ? ELASTIC_AGENT_OPTIONS[0] : GENAI_TRACE_OPTIONS[0]
              );
            }}
          />
          <EuiSpacer size="s" />
          <EuiSelect
            compressed
            fullWidth
            options={options.map((value) => ({ value, text: value }))}
            value={traceValue}
            onChange={(event) => setTraceValue(event.target.value)}
            aria-label={traceSelector === 'elastic_agents' ? 'Agent' : 'Trace index or data stream'}
          />
        </EuiCard>
      );
    }

    return (
      <EuiCard
        {...common}
        data-test-subj={`proto11GoalCard-${goal.id}`}
        footer={footerLine}
        onClick={() => {
          if (goal.id === 'gaps') {
            setGapsOpen(true);
            return;
          }
          onCreateFromGoal({ goalId: goal.id });
        }}
      />
    );
  };

  const describeTile = (
    <EuiCard
      textAlign="left"
      paddingSize="m"
      titleElement="h4"
      titleSize="xs"
      hasBorder
      icon={<EuiIcon type="pencil" size="l" aria-hidden={true} />}
      title="Describe what your agent does"
      data-test-subj="proto11DescribeTile"
      footer={
        <EuiFlexGroup gutterSize="m" alignItems="center" responsive={false} wrap>
          <EuiFlexItem grow={false}>
            <EuiButton
              size="s"
              fill={describeLength > 0}
              isDisabled={describeLength < DESCRIBE_MIN_LENGTH}
              onClick={() => setProposal(proposeFromDescription(describeText))}
              data-test-subj="proto11CreateFromDescription"
            >
              Create from description
            </EuiButton>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiLink onClick={() => setDescribeText(EXAMPLE_DESCRIPTION)}>Use an example</EuiLink>
          </EuiFlexItem>
        </EuiFlexGroup>
      }
    >
      <EuiSpacer size="s" />
      <EuiTextArea
        fullWidth
        compressed
        rows={3}
        resize="vertical"
        placeholder="What it helps with, which data it uses, where it goes wrong."
        value={describeText}
        onChange={(event) => setDescribeText(event.target.value)}
        aria-label="Describe what your agent does"
      />
    </EuiCard>
  );

  const renderProposal = (current: Proto11Proposal) => {
    const goal = goalById(current.goal);
    const template = TEMPLATES[goal.template];
    const listItems = [
      {
        title: 'Goal',
        description: (
          <>
            <EuiText size="s">
              <strong>{goal.title}</strong>
            </EuiText>
            <EuiText size="s" color="subdued">
              <em>
                {current.goalWords.length > 0
                  ? becauseMentions(current.goalWords)
                  : 'because nothing more specific was mentioned'}
              </em>
            </EuiText>
          </>
        ),
      },
      {
        title: 'Sources',
        description: (
          <>
            <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
              {current.sourceIds.map((id) => (
                <EuiFlexItem grow={false} key={id}>
                  <EuiBadge color="hollow">{sourceName(id)}</EuiBadge>
                </EuiFlexItem>
              ))}
            </EuiFlexGroup>
            <EuiText size="s" color="subdued">
              <em>
                {current.sourceWords.length > 0
                  ? becauseMentions(current.sourceWords)
                  : 'because no source was named, these are the defaults for this goal'}
              </em>
            </EuiText>
          </>
        ),
      },
      {
        title: 'Automation',
        description: (
          <>
            <EuiText size="s">
              <strong>{template.title}</strong>
            </EuiText>
            <EuiText size="s" color="subdued">
              {template.description}
            </EuiText>
            <EuiText size="s" color="subdued">
              <em>because it is the automation for {goal.title}</em>
            </EuiText>
          </>
        ),
      },
      ...(current.struggleWords.length > 0
        ? [
            {
              title: 'Automation',
              description: (
                <>
                  <EuiText size="s">
                    <strong>{TEMPLATES.gaps.title}</strong>
                  </EuiText>
                  <EuiText size="s" color="subdued">
                    {TEMPLATES.gaps.description}
                  </EuiText>
                  <EuiText size="s" color="subdued">
                    <em>{becauseMentions(current.struggleWords)}</em>. It needs an agent attached
                    before it runs.
                  </EuiText>
                </>
              ),
            },
          ]
        : []),
    ];
    return (
      <EuiPanel hasBorder paddingSize="l" data-test-subj="proto11Proposal">
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiIcon type="productAgent" size="m" aria-hidden={true} />
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiText size="s">
              <strong>Elastic AI Agent</strong>
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="s" />
        <EuiTitle size="xs">
          <h4>Here is what I would set up</h4>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiDescriptionList type="column" compressed columnWidths={[1, 4]} listItems={listItems} />
        <EuiSpacer size="l" />
        <EuiFlexGroup gutterSize="l" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiButton
              fill
              onClick={() =>
                onCreateFromGoal({
                  goalId: current.goal,
                  sourceIds: current.sourceIds,
                  intent: describeText,
                  struggleWords: current.struggleWords,
                })
              }
              data-test-subj="proto11CreateAndRun"
            >
              Create and run
            </EuiButton>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiLink
              onClick={() => {
                setHighlighted(current.goal);
                setProposal(null);
              }}
            >
              Change
            </EuiLink>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiLink onClick={() => setProposal(null)}>Back</EuiLink>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    );
  };

  return (
    <div className="contextEnginePrototype__proto11Landing" data-test-subj="proto11Landing">
      <EuiPanel hasBorder paddingSize="l">
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
        <EuiTitle size="xs">
          <h3>What should your agent get better at?</h3>
        </EuiTitle>
        <EuiSpacer size="m" />
        {proposal ? (
          renderProposal(proposal)
        ) : (
          <EuiFlexGrid columns={3} gutterSize="m">
            {GOALS.map((goal) => (
              <EuiFlexItem key={goal.id}>{renderGoalCard(goal)}</EuiFlexItem>
            ))}
            <EuiFlexItem>{describeTile}</EuiFlexItem>
          </EuiFlexGrid>
        )}
        <EuiSpacer size="m" />
        <EuiText size="s" color="subdued">
          <p>
            About a minute to first results, from a sample of your data. Everything can be changed
            afterwards.
          </p>
        </EuiText>
        <EuiSpacer size="s" />
        <EuiFlexGroup gutterSize="l" alignItems="center" responsive={false} wrap>
          <EuiFlexItem grow={false}>
            <EuiLink onClick={onCreateEmpty} data-test-subj="proto11CreateEmpty">
              Create an empty AI index instead
            </EuiLink>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiLink onClick={onTrySample} data-test-subj="proto11TrySample">
              Try with sample data
            </EuiLink>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
      {managedInset}
      {catalog}
    </div>
  );
};
