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
  EuiContextMenuItem,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiLink,
  EuiPanel,
  EuiPopover,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';

import { SAMPLE_COUNTS, SAMPLE_DEMOS, sampleIndicator, type SampleDemo } from './proto11_data';
import { ComparisonBar, KiJsonFlyout, KiPreviewCard } from './proto11_ki_preview';
import type { Proto11SampleScenario } from './proto11_types';

/** Ask, first card, second card, third card, comparison. About four seconds with the slide-ins. */
const STAGE_DELAYS_MS = [0, 800, 1500, 2200, 3200];

const PIPELINE: Array<{ icon: string; label: string; count?: number }> = [
  { icon: 'database', label: 'Sources', count: SAMPLE_COUNTS.sources },
  { icon: 'bolt', label: 'Automations', count: SAMPLE_COUNTS.automations },
  { icon: 'tableSparkles', label: 'Knowledge Indicators', count: SAMPLE_COUNTS.indicators },
  { icon: 'productAgent', label: 'Agent' },
];

const SAMPLE_MENU: Array<{ scenario: Proto11SampleScenario; label: string }> = [
  { scenario: 'web-ops', label: 'Web operations' },
  { scenario: 'higher-ed', label: 'Higher education' },
];

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
          <KiPreviewCard
            key={id}
            indicator={indicator}
            sourceName={sourceName}
            onOpen={() => onOpenIndicator(id)}
          />
        );
      })}
      {stage >= STAGE_DELAYS_MS.length ? (
        <div className="contextEnginePrototype__proto11Enter" data-test-subj="proto11SampleCompare">
          <ComparisonBar label={demo.withContext.label} value={demo.withContext.tokens} max={max} />
          <EuiSpacer size="s" />
          <ComparisonBar
            label={demo.withoutContext.label}
            value={demo.withoutContext.tokens}
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
  onExploreSample: (scenario: Proto11SampleScenario) => void;
}) => {
  const [demoIndex, setDemoIndex] = useState<number | null>(null);
  const [stage, setStage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exploreOpen, setExploreOpen] = useState(false);

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
          <EuiPopover
            button={
              <EuiLink
                onClick={() => setExploreOpen((isOpen) => !isOpen)}
                data-test-subj="proto11TrySample"
              >
                Explore the sample AI index{' '}
                <EuiIcon type="chevronSingleDown" size="s" aria-hidden={true} />
              </EuiLink>
            }
            aria-label="Sample AI indices"
            isOpen={exploreOpen}
            closePopover={() => setExploreOpen(false)}
            panelPaddingSize="none"
            anchorPosition="downLeft"
          >
            <div>
              {SAMPLE_MENU.map(({ scenario, label }) => (
                <EuiContextMenuItem
                  key={scenario}
                  onClick={() => {
                    setExploreOpen(false);
                    onExploreSample(scenario);
                  }}
                  data-test-subj={`proto11Sample-${scenario}`}
                >
                  {label}
                </EuiContextMenuItem>
              ))}
            </div>
          </EuiPopover>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiLink href={docsHref} target="_blank" external>
            How Knowledge Indicators are made
          </EuiLink>
        </EuiFlexItem>
      </EuiFlexGroup>
      {open ? (
        <KiJsonFlyout
          indicator={open.indicator}
          sourceName={open.sourceName}
          sample
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </EuiPanel>
  );
};
