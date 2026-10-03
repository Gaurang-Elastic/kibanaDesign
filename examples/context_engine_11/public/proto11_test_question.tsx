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
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';

import type { Namespace } from './namespace_data';
import {
  indicatorSourceGroup,
  runTestQuestion,
  testQuestionExamples,
  type TestQuestionResult,
} from './proto11_data';
import { ComparisonBar, KiJsonFlyout, KiPreviewCard } from './proto11_ki_preview';

const ESTIMATE_NOTE =
  'Estimated from a dry run against this AI index. Measured numbers appear in Usage once your agent is connected.';
const SAMPLE_NOTE = 'Sample run on sample data.';

const formatCount = (value: number) => value.toLocaleString('en-US');

/** Scripted comparison of an agent answering with and without this AI index. */
export const Proto11TestQuestion = ({ namespace }: { namespace: Namespace }) => {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<TestQuestionResult | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const sample = Boolean(namespace.proto11?.sample);
  const hasText = question.trim().length > 0;
  const sourceNameOf = (indicatorId: string) => {
    const indicator = namespace.indicators.find((item) => item.id === indicatorId);
    return indicator
      ? indicatorSourceGroup(indicator, namespace.sources, namespace.proto11?.agent).name
      : '';
  };

  const run = () => {
    if (!hasText) return;
    setResult(runTestQuestion(namespace, question));
  };

  const openIndicator = result?.indicators.find((item) => item.id === openId);
  const hit = result !== null && result.indicators.length > 0;
  const maxSeconds = result
    ? Math.max(result.withContext.seconds, result.withoutContext.seconds)
    : 1;

  return (
    <EuiPanel
      hasBorder
      paddingSize="l"
      className="contextEnginePrototype__panel"
      data-test-subj="proto11TestQuestion"
    >
      <div className="contextEnginePrototype__panelHeader">
        <div className="contextEnginePrototype__panelHeaderText">
          <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
                <h2>Test a question</h2>
              </EuiTitle>
            </EuiFlexItem>
            {sample ? (
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">Sample</EuiBadge>
              </EuiFlexItem>
            ) : null}
          </EuiFlexGroup>
          <EuiText size="xs" color="subdued" className="contextEnginePrototype__panelDesc">
            <p>
              See which Knowledge Indicators answer it, and what the agent would do without them.
            </p>
          </EuiText>
        </div>
      </div>
      <EuiSpacer size="m" />
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem>
          <EuiFieldText
            fullWidth
            placeholder="Ask something your agent should answer well"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setResult(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') run();
            }}
            aria-label="Test a question"
            data-test-subj="proto11TestQuestionField"
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton
            fill={hasText}
            isDisabled={!hasText}
            onClick={run}
            data-test-subj="proto11TestQuestionRun"
          >
            Test
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
      <EuiFlexGroup gutterSize="s" responsive={false} wrap>
        {testQuestionExamples(namespace).map((example) => (
          <EuiFlexItem grow={false} key={example}>
            <EuiBadge
              color="hollow"
              onClick={() => {
                setQuestion(example);
                setResult(null);
              }}
              onClickAriaLabel={`Use the question ${example}`}
              data-test-subj="proto11TestQuestionExample"
            >
              {example}
            </EuiBadge>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
      {result ? (
        <>
          <EuiSpacer size="m" />
          <EuiPanel
            hasBorder
            paddingSize="m"
            className="contextEnginePrototype__proto11Enter"
            data-test-subj="proto11TestQuestionResult"
          >
            <EuiFlexGroup gutterSize="l">
              <EuiFlexItem>
                <EuiTitle size="xxs">
                  <h3>With Context</h3>
                </EuiTitle>
                <EuiSpacer size="s" />
                {hit ? (
                  <>
                    <div className="contextEnginePrototype__proto11DemoRun">
                      {result.indicators.map((indicator) => (
                        <KiPreviewCard
                          key={indicator.id}
                          indicator={indicator}
                          sourceName={sourceNameOf(indicator.id)}
                          onOpen={() => setOpenId(indicator.id)}
                        />
                      ))}
                    </div>
                    <EuiSpacer size="s" />
                    <EuiText size="s">
                      <p>
                        1 retrieval, about {formatCount(result.withContext.tokens)} tokens, about{' '}
                        {result.withContext.seconds} seconds.
                      </p>
                    </EuiText>
                  </>
                ) : (
                  <EuiText size="s" color="subdued">
                    <p>No Knowledge Indicator covers this yet.</p>
                  </EuiText>
                )}
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiTitle size="xxs">
                  <h3>Without Context</h3>
                </EuiTitle>
                <EuiSpacer size="s" />
                <EuiText size="s" color="subdued">
                  <ol>
                    {result.withoutContext.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </EuiText>
                <EuiSpacer size="s" />
                <EuiText size="s">
                  <p>
                    {result.withoutContext.steps.length} steps, about{' '}
                    {formatCount(result.withoutContext.tokens)} tokens, about{' '}
                    {result.withoutContext.seconds} seconds.
                  </p>
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="m" />
            {hit ? (
              <>
                <ComparisonBar
                  label={`With Context, about ${result.withContext.seconds} seconds`}
                  value={result.withContext.seconds}
                  max={maxSeconds}
                />
                <EuiSpacer size="s" />
                <ComparisonBar
                  label={`Without Context, about ${result.withoutContext.seconds} seconds`}
                  value={result.withoutContext.seconds}
                  max={maxSeconds}
                />
                <EuiSpacer size="s" />
              </>
            ) : null}
            <EuiText size="xs" color="subdued">
              <p>{sample ? SAMPLE_NOTE : ESTIMATE_NOTE}</p>
            </EuiText>
          </EuiPanel>
        </>
      ) : null}
      {openIndicator ? (
        <KiJsonFlyout
          indicator={openIndicator}
          sourceName={sourceNameOf(openIndicator.id)}
          sample={sample}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </EuiPanel>
  );
};
