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
  EuiButtonEmpty,
  EuiCodeBlock,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiIcon,
  EuiLink,
  EuiPanel,
  EuiProgress,
  EuiSpacer,
  EuiText,
  EuiTitle,
  useGeneratedHtmlId,
} from '@elastic/eui';

import { toIndicatorDocument, typeLabel, type KnowledgeIndicator } from './knowledge_indicators';
import { SAMPLE_COUNTS, SAMPLE_DEMOS, sampleIndicator, type SampleDemo } from './proto11_data';

/** Ask, first card, second card, third card, comparison. About four seconds with the slide-ins. */
const STAGE_DELAYS_MS = [0, 800, 1500, 2200, 3200];

const PIPELINE: Array<{ icon: string; label: string; count?: number }> = [
  { icon: 'database', label: 'Sources', count: SAMPLE_COUNTS.sources },
  { icon: 'bolt', label: 'Automations', count: SAMPLE_COUNTS.automations },
  { icon: 'tableSparkles', label: 'Knowledge Indicators', count: SAMPLE_COUNTS.indicators },
  { icon: 'productAgent', label: 'Agent' },
];

const SampleKiFlyout = ({
  indicator,
  sourceName,
  onClose,
}: {
  indicator: KnowledgeIndicator;
  sourceName: string;
  onClose: () => void;
}) => {
  const titleId = useGeneratedHtmlId({ prefix: 'proto11SampleKi' });
  return (
    <EuiFlyout ownFocus size="m" onClose={onClose} aria-labelledby={titleId}>
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="s">
          <h2 id={titleId}>{indicator.title}</h2>
        </EuiTitle>
        <EuiSpacer size="s" />
        <EuiFlexGroup gutterSize="xs" responsive={false} wrap alignItems="center">
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">Sample</EuiBadge>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">{typeLabel(indicator.type)}</EuiBadge>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">{sourceName}</EuiBadge>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        <EuiCodeBlock language="json" fontSize="s" paddingSize="m" isCopyable>
          {JSON.stringify(toIndicatorDocument(indicator), null, 2)}
        </EuiCodeBlock>
      </EuiFlyoutBody>
      <EuiFlyoutFooter>
        <EuiButtonEmpty onClick={onClose}>Close</EuiButtonEmpty>
      </EuiFlyoutFooter>
    </EuiFlyout>
  );
};

const ComparisonRow = ({ label, tokens, max }: { label: string; tokens: number; max: number }) => (
  <div>
    <EuiText size="xs">
      <p>{label}</p>
    </EuiText>
    <EuiSpacer size="xs" />
    <EuiProgress value={tokens} max={max} size="s" color="subdued" aria-label={label} />
  </div>
);

const DemoRun = ({
  demo,
  stage,
  onOpenIndicator,
}: {
  demo: SampleDemo;
  stage: number;
  onOpenIndicator: (id: string) => void;
}) => {
  const cards = demo.kiIds.slice(0, Math.max(0, stage - 1));
  const max = Math.max(demo.withContext.tokens, demo.withoutContext.tokens);
  return (
    <div className="contextEnginePrototype__proto11DemoRun" aria-live="polite">
      <div className="contextEnginePrototype__proto11Enter">
        <EuiText size="xs">
          <strong>Agent asks</strong>
        </EuiText>
        <EuiText size="s" color="subdued">
          <p>
            <em>{demo.question}</em>
          </p>
        </EuiText>
      </div>
      {cards.length > 0 ? (
        <div className="contextEnginePrototype__proto11Enter">
          <EuiText size="xs">
            <strong>Context returns</strong>
          </EuiText>
        </div>
      ) : null}
      {cards.map((id) => {
        const found = sampleIndicator(id);
        if (!found) return null;
        const { indicator, sourceName } = found;
        return (
          <EuiPanel
            key={id}
            hasBorder
            paddingSize="s"
            className="contextEnginePrototype__proto11Enter"
            onClick={() => onOpenIndicator(id)}
            aria-label={`Open ${indicator.title}`}
            data-test-subj="proto11SampleKiCard"
          >
            <EuiText size="s" textAlign="left">
              <strong>{indicator.title}</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">{typeLabel(indicator.type)}</EuiBadge>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">
                  {sourceName}
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiPanel>
        );
      })}
      {stage >= STAGE_DELAYS_MS.length ? (
        <div className="contextEnginePrototype__proto11Enter" data-test-subj="proto11SampleCompare">
          <ComparisonRow
            label={demo.withContext.label}
            tokens={demo.withContext.tokens}
            max={max}
          />
          <EuiSpacer size="s" />
          <ComparisonRow
            label={demo.withoutContext.label}
            tokens={demo.withoutContext.tokens}
            max={max}
          />
          <EuiSpacer size="s" />
          <EuiText size="xs" color="subdued">
            <p>Sample run on sample data. Your numbers will differ.</p>
          </EuiText>
        </div>
      ) : null}
    </div>
  );
};

/** Right column of the Proto 11 landing: what Context produces, shown on the sample dataset. */
export const Proto11SamplePanel = ({
  docsHref,
  onExploreSample,
}: {
  docsHref: string;
  onExploreSample: () => void;
}) => {
  const [demoIndex, setDemoIndex] = useState<number | null>(null);
  const [stage, setStage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (demoIndex === null) return;
    setStage(0);
    const timers = STAGE_DELAYS_MS.map((delay, index) =>
      window.setTimeout(() => setStage(index + 1), delay)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [demoIndex]);

  const demo = demoIndex === null ? null : SAMPLE_DEMOS[demoIndex];
  const open = openId ? sampleIndicator(openId) : undefined;

  return (
    <EuiPanel color="subdued" paddingSize="l" data-test-subj="proto11SamplePanel">
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiTitle size="xs">
            <h2>See it work on sample data</h2>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">Sample</EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="l" />
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        {PIPELINE.map((node, index) => (
          <React.Fragment key={node.label}>
            {index > 0 ? (
              <EuiFlexItem grow={false}>
                <EuiIcon type="sortRight" color="subdued" aria-hidden={true} />
              </EuiFlexItem>
            ) : null}
            <EuiFlexItem>
              <EuiFlexGroup
                direction="column"
                alignItems="center"
                gutterSize="xs"
                responsive={false}
              >
                <EuiFlexItem grow={false}>
                  <EuiIcon type={node.icon} size="l" aria-hidden={true} />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiText size="xs" textAlign="center">
                    {node.label}
                  </EuiText>
                </EuiFlexItem>
                {node.count !== undefined ? (
                  <EuiFlexItem grow={false}>
                    <EuiBadge color="hollow">{node.count}</EuiBadge>
                  </EuiFlexItem>
                ) : null}
              </EuiFlexGroup>
            </EuiFlexItem>
          </React.Fragment>
        ))}
      </EuiFlexGroup>
      <EuiSpacer size="l" />
      <EuiFlexGroup gutterSize="s" responsive={false} wrap>
        {SAMPLE_DEMOS.map((item, index) => (
          <EuiFlexItem grow={false} key={item.question}>
            <EuiBadge
              color={demoIndex === index ? 'default' : 'hollow'}
              onClick={() => setDemoIndex(index)}
              onClickAriaLabel={`Ask ${item.question}`}
              data-test-subj="proto11SampleQuestion"
            >
              {item.question}
            </EuiBadge>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      {demo ? (
        <DemoRun key={demoIndex} demo={demo} stage={stage} onOpenIndicator={setOpenId} />
      ) : (
        <EuiText size="s" color="subdued">
          <p>Pick a question to see which Knowledge Indicators answer it.</p>
        </EuiText>
      )}
      <EuiSpacer size="l" />
      <EuiFlexGroup gutterSize="l" alignItems="center" responsive={false} wrap>
        <EuiFlexItem grow={false}>
          <EuiLink onClick={onExploreSample} data-test-subj="proto11TrySample">
            Explore the sample AI index
          </EuiLink>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiLink href={docsHref} target="_blank" external>
            How Knowledge Indicators are made
          </EuiLink>
        </EuiFlexItem>
      </EuiFlexGroup>
      {open ? (
        <SampleKiFlyout
          indicator={open.indicator}
          sourceName={open.sourceName}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </EuiPanel>
  );
};
