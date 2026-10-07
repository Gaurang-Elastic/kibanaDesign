/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useState } from 'react';
import { css } from '@emotion/react';
import {
  EuiBadge,
  EuiButtonEmpty,
  EuiContextMenu,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLink,
  EuiPanel,
  EuiPopover,
  EuiSpacer,
  EuiText,
  EuiTitle,
  useEuiTheme,
} from '@elastic/eui';

import { SAMPLE_DEMOS, sampleIndicator, type SampleDemo } from './proto11_data';
import type { KnowledgeIndicator } from './knowledge_indicators';
import { ComparisonBlock, KiPreviewRow } from './proto11_ki_preview';
import { KiDetailFlyout } from './proto11_ki_detail';
import type { Proto11SampleScenario } from './proto11_types';

/** Ask, first card, second card, third card, comparison. About four seconds with the slide-ins. */
const STAGE_DELAYS_MS = [0, 800, 1500, 2200, 3200];

/** Opens a sample AI index, on the Knowledge Indicators tab when asked. */
export type ExploreSample = (
  scenario: Proto11SampleScenario,
  tab?: 'overview' | 'knowledge'
) => void;

export const SAMPLE_QUESTION_LABEL = 'See a sample question answered';

export const SAMPLE_QUESTION_HIDE_LABEL = 'Hide';

export const OPEN_SAMPLE_ITEMS: ReadonlyArray<{
  scenario: Proto11SampleScenario;
  label: string;
}> = [
  { scenario: 'web-ops', label: 'Open the web operations sample' },
  { scenario: 'higher-ed', label: 'Open the higher education sample' },
];

const BAND_SAMPLE_LINKS: ReadonlyArray<{ scenario: Proto11SampleScenario; label: string }> = [
  { scenario: 'web-ops', label: 'Web operations' },
  { scenario: 'higher-ed', label: 'Higher education' },
];

/** Dropdown for the two sample AI indexes on the band. */
const ExploreSampleMenu = ({ onExploreSample }: { onExploreSample: ExploreSample }) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <EuiPopover
      button={
        <EuiButtonEmpty
          size="xs"
          color="text"
          flush="both"
          iconType="chevronSingleDown"
          iconSide="right"
          onClick={() => setOpen((isOpen) => !isOpen)}
          data-test-subj="proto11ExploreSample"
        >
          Explore sample AI index
        </EuiButtonEmpty>
      }
      aria-label="Explore sample AI index"
      isOpen={open}
      closePopover={close}
      panelPaddingSize="none"
      anchorPosition="downRight"
    >
      <EuiContextMenu
        size="s"
        initialPanelId={0}
        panels={[
          {
            id: 0,
            items: BAND_SAMPLE_LINKS.map(({ scenario, label }) => ({
              name: label,
              onClick: () => {
                close();
                onExploreSample(scenario);
              },
              'data-test-subj': `proto11Sample-${scenario}`,
            })),
          },
        ]}
      />
    </EuiPopover>
  );
};

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
  if (cards.length === 0) {
    return <div className="contextEnginePrototype__proto11DemoRun" aria-live="polite" />;
  }
  return (
    <div className="contextEnginePrototype__proto11DemoRun" aria-live="polite">
      <EuiFlexGroup gutterSize="xl" alignItems="flexStart">
        <EuiFlexItem>
          <div className="contextEnginePrototype__proto11Enter">
            <EuiTitle size="xs" data-test-subj="proto11SampleReturns">
              <h4>Context returns</h4>
            </EuiTitle>
            <EuiSpacer size="m" />
            <div className="contextEnginePrototype__proto11DemoRun">
              {cards.map((id) => {
                const found = sampleIndicator(id);
                if (!found) return null;
                const { indicator, sourceName } = found;
                return (
                  <KiPreviewRow
                    key={id}
                    indicator={indicator}
                    sourceName={sourceName}
                    onOpen={() => onOpenIndicator(id)}
                  />
                );
              })}
            </div>
          </div>
        </EuiFlexItem>
        <EuiFlexItem>
          {stage >= STAGE_DELAYS_MS.length ? (
            <div
              className="contextEnginePrototype__proto11Enter"
              data-test-subj="proto11SampleCompare"
            >
              <ComparisonBlock comparison={demo} sample />
            </div>
          ) : null}
        </EuiFlexItem>
      </EuiFlexGroup>
    </div>
  );
};

/** Footer band of the landing hero: the sample pipeline, with the live demo on request. */
export const Proto11SampleStrip = ({
  onExploreSample,
  discoverHref,
  onAskAboutIndicator,
  expanded,
  onExpandedChange,
}: {
  onExploreSample: ExploreSample;
  discoverHref: string;
  onAskAboutIndicator: (indicator: KnowledgeIndicator, message: string) => void;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
}) => {
  const { euiTheme } = useEuiTheme();
  const [demoIndex, setDemoIndex] = useState(0);
  const [stage, setStage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    setStage(0);
    const timers = STAGE_DELAYS_MS.map((delay, index) =>
      window.setTimeout(() => setStage(index + 1), delay)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [demoIndex, expanded]);

  const demo = SAMPLE_DEMOS[demoIndex];
  const open = openId ? sampleIndicator(openId) : undefined;

  return (
    <EuiPanel
      color="subdued"
      paddingSize="m"
      hasShadow={false}
      borderRadius="none"
      css={css`
        border-top: ${euiTheme.border.thin};
      `}
      data-test-subj="proto11SampleStrip"
    >
      <EuiFlexGroup gutterSize="m" alignItems="center" responsive={false} wrap>
        <EuiFlexItem>
          <EuiTitle
            size="xxs"
            className="contextEnginePrototype__proto11SampleBandTitle"
            data-test-subj="proto11SampleBandTitle"
          >
            <h3>Try it on sample data before you connect your own.</h3>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup
            gutterSize="s"
            alignItems="center"
            responsive={false}
            data-test-subj="proto11SampleBandActions"
          >
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued">
                <EuiLink
                  color="subdued"
                  onClick={() => onExpandedChange(!expanded)}
                  aria-expanded={expanded}
                  data-test-subj="proto11SampleStripToggle"
                >
                  {expanded ? SAMPLE_QUESTION_HIDE_LABEL : SAMPLE_QUESTION_LABEL}
                </EuiLink>
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued">
                <span aria-hidden="true">·</span>
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <ExploreSampleMenu onExploreSample={onExploreSample} />
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
      </EuiFlexGroup>
      {expanded ? (
        <>
          <EuiSpacer size="m" />
          <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued">
                Agent asks
              </EuiText>
            </EuiFlexItem>
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
          <EuiSpacer size="xl" />
          <DemoRun key={demoIndex} demo={demo} stage={stage} onOpenIndicator={setOpenId} />
        </>
      ) : null}
      {open ? (
        <KiDetailFlyout
          indicator={open.indicator}
          indicators={[]}
          sample
          discoverHref={discoverHref}
          resolveIndicator={(id) => sampleIndicator(id)?.indicator}
          onAskAgent={onAskAboutIndicator}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </EuiPanel>
  );
};
