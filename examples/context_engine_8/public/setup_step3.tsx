/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiCallOut,
  EuiCheckbox,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTextArea,
  EuiTitle,
} from '@elastic/eui';
import { AI_AGENT_ICON } from './ai_agent';

export interface SetupStrategyCard {
  id: string;
  title: string;
  description: string;
  instruction: string;
}

export interface SetupSampleKiCard {
  key: string;
  type: string;
  content: string;
  from: string;
  question?: string;
}

/** Step 3 of AI index setup: strategies, generate, preview, test, full run. */

export type SetupStep3View =
  | 'suggesting'
  | 'select'
  | 'generating'
  | 'preview'
  | 'testError'
  | 'generateError'
  | 'runningFull';

export type GenerateWaitPhase = 'generate' | 'test';

export type SetupTryResult =
  | {
      kind: 'hit';
      answer: string;
      hitKey: string;
      hitType: string;
      hitFrom: string;
      hitTitle: string;
    }
  | { kind: 'miss' };

export const TryQuestionPanel = ({
  tryQuestion,
  onTryQuestionChange,
  onTryQuestion,
  tryResult,
  inputRef,
}: {
  tryQuestion: string;
  onTryQuestionChange: (value: string) => void;
  onTryQuestion: () => void;
  tryResult: SetupTryResult | null;
  inputRef?: React.Ref<HTMLInputElement>;
}) => (
  <>
    <EuiTitle size="xs">
      <h3>Try a question</h3>
    </EuiTitle>
    <EuiFlexGroup
      className="contextEnginePrototype__controlWithAction"
      gutterSize="s"
      responsive={false}
      alignItems="center"
    >
      <EuiFlexItem>
        <EuiFieldText
          inputRef={inputRef}
          fullWidth
          placeholder="Ask something this index should know..."
          value={tryQuestion}
          onChange={(event) => onTryQuestionChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onTryQuestion();
            }
          }}
          aria-label="Try a question"
        />
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiButton size="s" onClick={onTryQuestion} disabled={!tryQuestion.trim()}>
          Test
        </EuiButton>
      </EuiFlexItem>
    </EuiFlexGroup>
    {tryResult ? (
      <>
        <EuiSpacer size="s" />
        {tryResult.kind === 'hit' ? (
          <>
            <EuiText size="xs" color="subdued">
              Answered from this Knowledge Indicator
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">{tryResult.hitType}</EuiBadge>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">
                  From {tryResult.hitFrom}
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="xs" />
            <EuiText size="s">{tryResult.hitTitle}</EuiText>
          </>
        ) : (
          <>
            <EuiText size="s">No Knowledge Indicator covers this yet.</EuiText>
            <EuiSpacer size="xs" />
            <EuiText size="xs" color="subdued">
              Answers come only from this AI index, never a general-knowledge fallback.
            </EuiText>
          </>
        )}
      </>
    ) : (
      <EuiText size="xs" color="subdued">
        Answers come only from this AI index, never a general-knowledge fallback.
      </EuiText>
    )}
  </>
);

const KI_GROUP_ORDER = ['FAQ', 'Fact', 'Playbook', 'Policy', 'Glossary'];
const MAX_EXAMPLE_TYPES = 4;

const formatElapsed = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const SetupWaitPanel = ({
  headline,
  description,
  elapsedSeconds,
}: {
  headline: string;
  description: string;
  elapsedSeconds: number;
}) => (
  <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__setupCard">
    <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
      <EuiFlexItem grow={false}>
        <EuiLoadingSpinner size="m" />
      </EuiFlexItem>
      <EuiFlexItem>
        <EuiTitle size="s">
          <h2>{headline}</h2>
        </EuiTitle>
      </EuiFlexItem>
    </EuiFlexGroup>
    <EuiSpacer size="s" />
    <EuiText size="s" color="subdued">
      {description}
    </EuiText>
    <EuiSpacer size="s" />
    <EuiText size="xs" color="subdued" role="status" aria-live="polite">
      Elapsed {formatElapsed(elapsedSeconds)}. No precise progress is available yet.
    </EuiText>
    <EuiSpacer size="m" />
    <div
      className="contextEnginePrototype__indeterminateBar"
      role="progressbar"
      aria-valuetext="In progress"
      aria-label={headline}
    >
      <span className="contextEnginePrototype__indeterminateBarStripe" />
    </div>
  </EuiPanel>
);

const exampleCardsFromSamples = (samples: SetupSampleKiCard[]) => {
  const byType = new Map<string, SetupSampleKiCard[]>();
  samples.forEach((sample) => {
    const list = byType.get(sample.type) ?? [];
    list.push(sample);
    byType.set(sample.type, list);
  });
  const groups = [...byType.entries()].map(([type, items]) => ({
    type,
    example: items[0],
    count: items.length,
  }));
  groups.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const aOrder = KI_GROUP_ORDER.indexOf(a.type);
    const bOrder = KI_GROUP_ORDER.indexOf(b.type);
    return (aOrder === -1 ? 99 : aOrder) - (bOrder === -1 ? 99 : bOrder);
  });
  const selected = groups.slice(0, MAX_EXAMPLE_TYPES);
  selected.sort((a, b) => {
    const aOrder = KI_GROUP_ORDER.indexOf(a.type);
    const bOrder = KI_GROUP_ORDER.indexOf(b.type);
    return (aOrder === -1 ? 99 : aOrder) - (bOrder === -1 ? 99 : bOrder);
  });
  return {
    shown: selected,
    hiddenTypes: Math.max(0, groups.length - MAX_EXAMPLE_TYPES),
  };
};

export function SetupStep3({
  view,
  showInferenceGate,
  onSetupInference,
  sourceNames,
  strategies,
  selectedStrategyIds,
  onToggleStrategy,
  instructionOpenId,
  onToggleInstruction,
  onChangeInstruction,
  elapsedSeconds,
  generateWaitPhase,
  automationSummary,
  sampleKis,
  sampleTotal,
  onViewAllKis,
  tryQuestion,
  onTryQuestionChange,
  onTryQuestion,
  tryResult,
  onGenerate,
  onRetryGenerate,
  onSendErrorToAgent,
  onRunTestAgain,
  onRunFull,
}: {
  view: SetupStep3View;
  showInferenceGate: boolean;
  onSetupInference: () => void;
  sourceNames: string[];
  strategies: SetupStrategyCard[];
  selectedStrategyIds: string[];
  onToggleStrategy: (id: string) => void;
  instructionOpenId: string | null;
  onToggleInstruction: (id: string) => void;
  onChangeInstruction: (id: string, value: string) => void;
  elapsedSeconds: number;
  generateWaitPhase: GenerateWaitPhase;
  automationSummary: React.ReactNode;
  sampleKis: SetupSampleKiCard[];
  sampleTotal: number;
  onViewAllKis: () => void;
  tryQuestion: string;
  onTryQuestionChange: (value: string) => void;
  onTryQuestion: () => void;
  tryResult: SetupTryResult | null;
  onGenerate: () => void;
  onRetryGenerate: () => void;
  onSendErrorToAgent: () => void;
  onRunTestAgain: () => void;
  onRunFull: () => void;
}) {
  const { shown: typeExamples, hiddenTypes } = useMemo(
    () => exampleCardsFromSamples(sampleKis),
    [sampleKis]
  );
  const tryInputRef = useRef<HTMLInputElement | null>(null);
  const [pulseNonce, setPulseNonce] = useState(0);

  useEffect(() => {
    if (tryResult?.kind === 'hit') {
      setPulseNonce((nonce) => nonce + 1);
    }
  }, [tryResult]);

  const fillTryQuestion = (question: string) => {
    onTryQuestionChange(question);
    window.requestAnimationFrame(() => {
      tryInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      tryInputRef.current?.focus();
    });
  };

  if (showInferenceGate) {
    return (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__setupCard">
        <EuiTitle size="s">
          <h2>Automations</h2>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiCallOut
          color="primary"
          iconType="info"
          title="You'll need an LLM connection first."
        >
          <p>Suggesting strategies and generating an automation both call a model.</p>
          <EuiButton size="s" onClick={onSetupInference} data-test-subj="contextEngineSetupInference">
            Set up inference
          </EuiButton>
        </EuiCallOut>
      </EuiPanel>
    );
  }

  if (view === 'suggesting') {
    return (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__setupCard">
        <EuiTitle size="s">
          <h2>Automations</h2>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiLoadingSpinner size="m" />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText size="s" role="status" aria-live="polite">
              Reading your sources and suggesting strategies
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    );
  }

  if (view === 'generating') {
    const isTestPhase = generateWaitPhase === 'test';
    return (
      <SetupWaitPanel
        headline={
          isTestPhase ? 'Running a test on sample data' : 'Generating your automation'
        }
        description={
          isTestPhase
            ? 'Checking a sample of your sources. You can leave, we will keep going.'
            : 'This usually takes 15 to 20 minutes. You can leave this page, we will keep going.'
        }
        elapsedSeconds={elapsedSeconds}
      />
    );
  }

  if (view === 'runningFull') {
    return (
      <SetupWaitPanel
        headline="Running on all data"
        description="Running the automation across your sources. You can leave, we will keep going."
        elapsedSeconds={elapsedSeconds}
      />
    );
  }

  if (view === 'generateError' || view === 'testError') {
    const isTest = view === 'testError';
    return (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__setupCard">
        <div
          className="contextEnginePrototype__setupErrorBlock"
          onContextMenu={(event) => {
            event.preventDefault();
            onSendErrorToAgent();
          }}
        >
          <EuiCallOut color="danger" iconType="error" title="Error found in this automation.">
            <p>
              {isTest
                ? 'The run completed but saved empty values for every field.'
                : 'Generation stopped before an automation was produced. This can take 15 to 20 minutes and sometimes stalls.'}
            </p>
            <p>Right-click the error to send it to the AI Agent.</p>
            <EuiFlexGroup gutterSize="s" responsive={false} wrap>
              <EuiFlexItem grow={false}>
                <EuiButton size="s" iconType={AI_AGENT_ICON} onClick={onSendErrorToAgent}>
                  Send error to AI Agent
                </EuiButton>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty size="s" onClick={isTest ? onRunTestAgain : onRetryGenerate}>
                  {isTest ? 'Run test again' : 'Try generating again'}
                </EuiButtonEmpty>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiCallOut>
        </div>
      </EuiPanel>
    );
  }

  if (view === 'preview') {
    // No inline refine on this screen: a short prompt cannot reliably restructure
    // a generated automation, and promising that the sample reruns overstates what
    // the backend does. Edit automation → Refine with agent is the one edit path.
    return (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__setupCard">
        <EuiTitle size="s">
          <h2>Test run complete</h2>
        </EuiTitle>
        <EuiSpacer size="xs" />
        <EuiText size="s" color="subdued">
          From a sample of your data. Run on all data when these look right.
        </EuiText>
        <EuiSpacer size="m" />
        {automationSummary}
        <EuiSpacer size="l" />
        <EuiFlexGroup
          alignItems="center"
          justifyContent="flexEnd"
          gutterSize="s"
          responsive={false}
          wrap
          className="contextEnginePrototype__setupSampleOverlineRow"
        >
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              size="xs"
              flush="right"
              onClick={onViewAllKis}
              className="contextEnginePrototype__setupSampleViewAll"
            >
              View all {sampleTotal} in Knowledge Indicators ›
            </EuiButtonEmpty>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="s" />
        <div
          className={`contextEnginePrototype__setupTypeExampleGrid${
            typeExamples.length === 1
              ? ' contextEnginePrototype__setupTypeExampleGrid--single'
              : ''
          }`}
        >
          {typeExamples.map((group) => {
            const more = group.count - 1;
            const isHit =
              tryResult?.kind === 'hit' && tryResult.hitKey === group.example.key;
            return (
              <EuiPanel
                key={isHit ? `${group.example.key}-${pulseNonce}` : group.example.key}
                hasBorder
                paddingSize="s"
                className={`contextEnginePrototype__setupTypeExampleCard${
                  isHit ? ' contextEnginePrototype__setupTypeExampleCard--pulse' : ''
                }`}
              >
                <div className="contextEnginePrototype__setupTypeExampleBody">
                  <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
                    <EuiFlexItem grow={false}>
                      <EuiBadge color="hollow">{group.type}</EuiBadge>
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="xs" color="subdued">
                        From {group.example.from}
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                  <EuiSpacer size="xs" />
                  <EuiText size="s">{group.example.content}</EuiText>
                </div>
                <div className="contextEnginePrototype__setupTypeExampleFooter">
                  {more > 0 ? (
                    <EuiText size="xs" color="subdued">
                      +{more} more
                    </EuiText>
                  ) : (
                    <span className="contextEnginePrototype__setupTypeExampleMoreSpacer" />
                  )}
                  <EuiButtonEmpty
                    size="xs"
                    flush="left"
                    onClick={() =>
                      fillTryQuestion(
                        group.example.question ||
                          `What should I know about this ${group.type.toLowerCase()}?`
                      )
                    }
                  >
                    Try a question about this
                  </EuiButtonEmpty>
                </div>
              </EuiPanel>
            );
          })}
        </div>
        {hiddenTypes > 0 ? (
          <>
            <EuiSpacer size="s" />
            <EuiButtonEmpty size="xs" flush="left" onClick={onViewAllKis}>
              +{hiddenTypes} more types
            </EuiButtonEmpty>
          </>
        ) : null}

        <EuiSpacer size="l" />
        <TryQuestionPanel
          tryQuestion={tryQuestion}
          onTryQuestionChange={onTryQuestionChange}
          onTryQuestion={onTryQuestion}
          tryResult={tryResult}
          inputRef={tryInputRef}
        />

        <EuiSpacer size="l" />
        <EuiButton fill onClick={onRunFull}>
          Looks good, run on all data ›
        </EuiButton>
      </EuiPanel>
    );
  }

  return (
    <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__setupCard">
      <EuiTitle size="s">
        <h2>Automations</h2>
      </EuiTitle>
      <EuiSpacer size="xs" />
      <EuiText size="s">
        Each automation reads your sources on a schedule and produces Knowledge Indicators your
        agent can retrieve.
      </EuiText>
      <EuiSpacer size="s" />
      <EuiText size="s">
        Strategies are different ways to extract knowledge from what you connected. Pick the ones
        that match how your agent will be asked questions.
      </EuiText>
      <EuiSpacer size="s" />
      <EuiText size="s" color="subdued">
        {sourceNames.length > 0
          ? `Suggested from your sources (${sourceNames.join(', ')}) and what you said this index is for.`
          : 'Suggested from your sources and what you said this index is for.'}
      </EuiText>
      <EuiSpacer size="m" />
      <div className="contextEnginePrototype__strategyList">
        {strategies.map((strategy) => {
          const checked = selectedStrategyIds.includes(strategy.id);
          const instructionOpen = instructionOpenId === strategy.id;
          return (
            <EuiPanel
              key={strategy.id}
              hasBorder
              paddingSize="m"
              className={`contextEnginePrototype__strategyRow${
                checked ? ' contextEnginePrototype__strategyRow--selected' : ''
              }`}
              onClick={() => onToggleStrategy(strategy.id)}
            >
              <EuiFlexGroup alignItems="flexStart" gutterSize="s" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiCheckbox
                    id={`context-engine-8-strategy-${strategy.id}`}
                    className="contextEnginePrototype__selectCheckbox"
                    checked={checked}
                    onChange={() => onToggleStrategy(strategy.id)}
                    onClick={(event: React.MouseEvent) => event.stopPropagation()}
                    label=""
                  />
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFlexGroup
                    alignItems="center"
                    justifyContent="spaceBetween"
                    gutterSize="s"
                    responsive={false}
                  >
                    <EuiFlexItem>
                      <EuiText size="s">
                        <strong>{strategy.title}</strong>
                      </EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiButtonEmpty
                        size="xs"
                        flush="right"
                        iconType={instructionOpen ? 'arrowDown' : 'pencil'}
                        onClick={(event: React.MouseEvent) => {
                          event.stopPropagation();
                          onToggleInstruction(strategy.id);
                        }}
                      >
                        {instructionOpen ? 'Hide instruction' : 'Edit instruction'}
                      </EuiButtonEmpty>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                  <EuiText size="xs" color="subdued">
                    {strategy.description}
                  </EuiText>
                  {instructionOpen ? (
                    <>
                      <EuiSpacer size="s" />
                      <EuiTextArea
                        fullWidth
                        rows={3}
                        placeholder="Only extract from solved tickets in the last 90 days."
                        value={strategy.instruction}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => onChangeInstruction(strategy.id, event.target.value)}
                        aria-label={`Instruction for ${strategy.title}`}
                      />
                      <EuiText size="xs" color="subdued">
                        Plain-language instruction for the model. Not code.
                      </EuiText>
                    </>
                  ) : null}
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPanel>
          );
        })}
      </div>
      <EuiSpacer size="m" />
      <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false} wrap>
        <EuiFlexItem grow={false}>
          <EuiButton fill disabled={selectedStrategyIds.length === 0} onClick={onGenerate}>
            Generate automation
          </EuiButton>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiText size="xs" color="subdued">
            Runs on a small sample of your data so you can review the results before committing.
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
}
