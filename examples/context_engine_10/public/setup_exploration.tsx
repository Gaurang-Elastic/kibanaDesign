/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiCode,
  EuiFlyout,
  EuiIcon,
  EuiLink,
  EuiLoadingSpinner,
  EuiPanel,
  EuiSpacer,
  EuiSteps,
  EuiText,
  EuiTitle,
} from '@elastic/eui';

import type { GenerationSpeed, SetupExploration } from './demo_flags';
import type { Automation, AutomationStep } from './namespace_data';

export const EXPLORATION_OPTIONS: Array<{ id: SetupExploration; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'stepped', label: 'Stepped setup (public preview idea)' },
  { id: 'grouped', label: 'Grouped by source' },
  { id: 'coverage', label: 'Coverage map' },
  { id: 'usage', label: 'Usage' },
  { id: 'graph', label: 'Graph view (test of the Sep 25 critique)' },
  { id: 'treemap', label: 'Topic treemap' },
];

export const explorationLabel = (id: SetupExploration) =>
  EXPLORATION_OPTIONS.find((option) => option.id === id)?.label ?? 'Off';

const STAGE_TITLES = [
  'Reading your sources',
  'Sampling documents',
  'Choosing an extraction strategy',
  'Writing the workflow',
  'Validating the workflow',
];

export const stageTitle = (index: number, sourceName: string) =>
  index === 1 ? `Sampling documents from ${sourceName}` : STAGE_TITLES[index];

/** Real mode: 40 seconds a stage (about 3 minutes). Fast mode: 4 seconds a stage (20 seconds total). */
export const stageDelayMs = (speed: GenerationSpeed) => (speed === 'fast' ? 4000 : 40000);

export const factIntervalMs = (speed: GenerationSpeed) => (speed === 'fast' ? 4000 : 30000);

export const TEACHING_FACTS = [
  {
    title: 'What a Knowledge Indicator is',
    body: 'A Knowledge Indicator is one fact an agent can retrieve. An automation writes it from your sources.',
  },
  {
    title: 'Automations run from Workflows',
    body: 'The workflow this creates runs from the Workflows page. Open it there to run or edit it.',
  },
  {
    title: 'How the description is used',
    body: 'The index description shapes the workflow the agent writes, and helps agents decide when this index is relevant.',
  },
  {
    title: 'Traces improve suggestions',
    body: 'Linked traces show how agents already use this index, so the next suggestion can match real questions.',
  },
  {
    title: 'Where Knowledge Indicators appear',
    body: 'Finished indicators show on the Knowledge Indicators tab for this index.',
  },
  {
    title: 'One ES|QL call',
    body: 'Agents retrieve Knowledge Indicators with one ES|QL call, instead of scanning raw source data each time.',
  },
];

const DOCS_HREF = 'https://www.elastic.co/docs';

const renderStep = (step: AutomationStep) => (
  <li key={step.name}>
    <EuiCode>{step.name}</EuiCode> {step.explanation}
    {step.children && step.children.length > 0 ? (
      <ul>
        {step.children.map((child) => (
          <li key={child.name}>
            <EuiCode>{child.name}</EuiCode> {child.explanation}
          </li>
        ))}
      </ul>
    ) : null}
  </li>
);

export const GeneratingMessage = ({
  sourceName,
  stage,
  cancelled,
  factIndex,
  draft,
  onCancel,
  onView,
}: {
  sourceName: string;
  stage: number;
  cancelled: boolean;
  factIndex: number;
  draft: Automation | null;
  onCancel: () => void;
  onView: () => void;
}) => {
  const done = !cancelled && stage >= STAGE_TITLES.length;
  const fact = TEACHING_FACTS[factIndex % TEACHING_FACTS.length];
  const steps = STAGE_TITLES.map((_, index) => {
    const status = cancelled
      ? index < stage
        ? 'complete'
        : 'incomplete'
      : done || index < stage
        ? 'complete'
        : index === stage
          ? 'loading'
          : 'incomplete';
    return {
      title: stageTitle(index, sourceName),
      status: status as 'complete' | 'incomplete' | 'loading',
    };
  });

  return (
    <div data-test-subj="contextEngineGeneratingCard">
      <div className="contextEnginePrototype__generatingHeading">
        {done ? (
          <EuiIcon type="checkInCircleFilled" color="success" size="m" />
        ) : cancelled ? (
          <EuiIcon type="cross" color="subdued" size="m" />
        ) : (
          <EuiLoadingSpinner size="m" />
        )}
        <EuiTitle size="xs">
          <h3>
            {done ? 'Automation created' : cancelled ? 'Generation cancelled' : 'Creating your automation'}
          </h3>
        </EuiTitle>
      </div>
      <EuiSpacer size="m" />
      <EuiSteps steps={steps} titleSize="xs" />
      {!done && !cancelled ? (
        <>
          <EuiSpacer size="s" />
          <EuiText size="xs" color="subdued">
            <p>Usually 3 to 6 minutes. You can leave this page; we will notify you when it is done.</p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiButtonEmpty size="s" onClick={onCancel} data-test-subj="contextEngineGenerationCancel">
            Cancel
          </EuiButtonEmpty>
          <EuiSpacer size="m" />
          <EuiPanel
            key={fact.title}
            color="subdued"
            paddingSize="m"
            hasBorder={false}
            hasShadow={false}
            className="contextEnginePrototype__teachingFact"
          >
            <EuiTitle size="xxs">
              <h4>{fact.title}</h4>
            </EuiTitle>
            <EuiSpacer size="xs" />
            <EuiText size="s" color="subdued">
              <p>{fact.body}</p>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiLink href={DOCS_HREF} target="_blank" external>
              Learn more
            </EuiLink>
          </EuiPanel>
        </>
      ) : null}
      {done && draft ? (
        <>
          <EuiSpacer size="m" />
          <EuiPanel hasBorder paddingSize="m">
            <EuiTitle size="xs">
              <h3>What it does</h3>
            </EuiTitle>
            <EuiSpacer size="s" />
            <EuiText size="s">
              <p>{draft.description}</p>
            </EuiText>
            <EuiSpacer size="s" />
            <EuiText size="s">
              <ol className="contextEnginePrototype__whatItDoes">{draft.steps.map(renderStep)}</ol>
            </EuiText>
            <EuiSpacer size="m" />
            <EuiTitle size="xs">
              <h3>Key properties</h3>
            </EuiTitle>
            <EuiSpacer size="s" />
            <EuiText size="s">
              <ul>
                {draft.properties.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </EuiText>
          </EuiPanel>
          <EuiSpacer size="m" />
          <EuiButton fill size="s" onClick={onView} data-test-subj="contextEngineViewAutomation">
            View automation
          </EuiButton>
        </>
      ) : null}
    </div>
  );
};

const RailCard = ({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) => (
  <EuiPanel paddingSize="s" hasBorder hasShadow={false} className="contextEnginePrototype__takeoverCard">
    <div className="contextEnginePrototype__takeoverCardHead">
      <EuiText size="xs">
        <strong>{title}</strong>
      </EuiText>
      <EuiButtonEmpty size="xs" onClick={onEdit}>
        Edit
      </EuiButtonEmpty>
    </div>
    {children}
  </EuiPanel>
);

export const TakeoverFlyout = ({
  indexName,
  description,
  sourceNames,
  tracesLabel,
  onClose,
  onEdit,
  children,
}: {
  indexName: string;
  description: string;
  sourceNames: string[];
  tracesLabel: string;
  onClose: () => void;
  onEdit: (target: 'description' | 'sources' | 'traces') => void;
  children: React.ReactNode;
}) => (
  <EuiFlyout
    ownFocus
    onClose={onClose}
    size="100%"
    aria-labelledby="context-agent-takeover-title"
    className="contextEnginePrototype__takeoverFlyout"
  >
    <div className="contextEnginePrototype__takeover">
      <div className="contextEnginePrototype__takeoverTop">
        <EuiButtonEmpty
          iconType="arrowLeft"
          iconSide="left"
          onClick={onClose}
          data-test-subj="contextEngineTakeoverBack"
        >
          {`Back to ${indexName}`}
        </EuiButtonEmpty>
        <EuiTitle size="xs" className="contextEnginePrototype__takeoverTitle">
          <h2 id="context-agent-takeover-title">Create automation with the AI Agent</h2>
        </EuiTitle>
        <EuiButtonEmpty onClick={onClose} data-test-subj="contextEngineTakeoverClose">
          Close
        </EuiButtonEmpty>
      </div>
      <div className="contextEnginePrototype__takeoverMain">
        <aside className="contextEnginePrototype__takeoverRail">
          <EuiTitle size="xs">
            <h3>{`Setting up ${indexName}`}</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <RailCard title="Description" onEdit={() => onEdit('description')}>
            <EuiText size="xs" color="subdued">
              <p>{description || 'No description yet.'}</p>
            </EuiText>
          </RailCard>
          <RailCard title="Sources" onEdit={() => onEdit('sources')}>
            {sourceNames.length > 0 ? (
              <div className="contextEnginePrototype__takeoverChips">
                {sourceNames.map((name) => (
                  <EuiBadge key={name} color="hollow">
                    {name}
                  </EuiBadge>
                ))}
              </div>
            ) : (
              <EuiText size="xs" color="subdued">
                <p>None</p>
              </EuiText>
            )}
          </RailCard>
          <RailCard title="Traces" onEdit={() => onEdit('traces')}>
            <EuiBadge color="hollow">{tracesLabel}</EuiBadge>
          </RailCard>
        </aside>
        <div className="contextEnginePrototype__takeoverChat">
          <div className="contextEnginePrototype__takeoverChatInner">{children}</div>
        </div>
      </div>
    </div>
  </EuiFlyout>
);
