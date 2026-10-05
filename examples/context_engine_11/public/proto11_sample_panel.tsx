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
  EuiButton,
  EuiContextMenu,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiLink,
  EuiPanel,
  EuiPopover,
  EuiSpacer,
  EuiText,
  useEuiTheme,
} from '@elastic/eui';

import {
  SAMPLE_COUNTS,
  SAMPLE_DEMOS,
  SAMPLE_INDEX_NAME,
  TEMPLATES,
  WEB_OPS_SOURCES,
  sampleIndicator,
  type SampleDemo,
} from './proto11_data';
import type { KnowledgeIndicator } from './knowledge_indicators';
import { ComparisonBlock, KiPreviewRow } from './proto11_ki_preview';
import { KiDetailFlyout } from './proto11_ki_detail';
import type { Proto11SampleScenario } from './proto11_types';

/** Ask, first card, second card, third card, comparison. About four seconds with the slide-ins. */
const STAGE_DELAYS_MS = [0, 800, 1500, 2200, 3200];

type PipelineId = 'sources' | 'automations' | 'indicators' | 'agent';

const PIPELINE: Array<{ id: PipelineId; icon: string; label: string; count?: number }> = [
  { id: 'sources', icon: 'database', label: 'Sources', count: SAMPLE_COUNTS.sources },
  { id: 'automations', icon: 'bolt', label: 'Automations', count: SAMPLE_COUNTS.automations },
  {
    id: 'indicators',
    icon: 'tableSparkles',
    label: 'Knowledge Indicators',
    count: SAMPLE_COUNTS.indicators,
  },
  { id: 'agent', icon: 'productAgent', label: 'Agent' },
];

const SAMPLE_AGENT_NAME = 'web-ops-assistant';

/** Opens a sample AI index, on the Knowledge Indicators tab when asked. */
export type ExploreSample = (
  scenario: Proto11SampleScenario,
  tab?: 'overview' | 'knowledge'
) => void;

const PipelinePopoverBody = ({ id }: { id: PipelineId }) => {
  if (id === 'sources') {
    return (
      <EuiFlexGroup direction="column" gutterSize="s" responsive={false}>
        {WEB_OPS_SOURCES.map((source) => (
          <EuiFlexItem key={source.id}>
            <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
              <EuiFlexItem>
                <EuiText size="xs">{source.name}</EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">{source.kind}</EuiBadge>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    );
  }
  if (id === 'automations') {
    return (
      <EuiFlexGroup direction="column" gutterSize="s" responsive={false}>
        {[TEMPLATES.overview.title, TEMPLATES.digest.title].map((title) => (
          <EuiFlexItem key={title}>
            <EuiText size="xs">{title}</EuiText>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    );
  }
  return (
    <EuiText size="xs">
      <p>{SAMPLE_AGENT_NAME}, sample agent, no retrievals recorded</p>
    </EuiText>
  );
};

export const SAMPLE_MENU: ReadonlyArray<{ scenario: Proto11SampleScenario; label: string }> = [
  { scenario: 'web-ops', label: 'Web operations' },
  { scenario: 'higher-ed', label: 'Higher education' },
];

/** Secondary button that opens the sample dataset menu. */
export const SampleMenuButton = ({
  onExploreSample,
}: {
  onExploreSample: (scenario: Proto11SampleScenario) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <EuiPopover
      button={
        <EuiButton
          size="s"
          color="text"
          iconType="chevronSingleDown"
          iconSide="right"
          onClick={() => setOpen((isOpen) => !isOpen)}
          data-test-subj="proto11TrySample"
        >
          Explore a sample AI index
        </EuiButton>
      }
      aria-label="Sample AI indices"
      isOpen={open}
      closePopover={() => setOpen(false)}
      panelPaddingSize="none"
      anchorPosition="downLeft"
    >
      <EuiContextMenu
        initialPanelId={0}
        panels={[
          {
            id: 0,
            items: SAMPLE_MENU.map(({ scenario, label }) => ({
              name: label,
              onClick: () => {
                setOpen(false);
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
  const { euiTheme } = useEuiTheme();
  const cards = demo.kiIds.slice(0, Math.max(0, stage - 1));
  // Puts the headline text on the same line as the first Knowledge Indicator row's title.
  const compareCss = css`
    padding-top: calc(${euiTheme.size.xs} + ${euiTheme.size.xxs});
  `;
  return (
    <div className="contextEnginePrototype__proto11DemoRun" aria-live="polite">
      {cards.length > 0 ? (
        <div className="contextEnginePrototype__proto11Enter">
          <EuiText size="xs">
            <strong>Context returns</strong>
          </EuiText>
        </div>
      ) : null}
      {cards.length > 0 ? (
        <EuiFlexGroup gutterSize="xl" alignItems="flexStart">
          <EuiFlexItem>
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
          </EuiFlexItem>
          <EuiFlexItem>
            {stage >= STAGE_DELAYS_MS.length ? (
              <div
                className="contextEnginePrototype__proto11Enter"
                data-test-subj="proto11SampleCompare"
                css={compareCss}
              >
                <ComparisonBlock
                  comparison={demo}
                  note="Sample run on sample data. Your numbers will differ."
                />
              </div>
            ) : null}
          </EuiFlexItem>
        </EuiFlexGroup>
      ) : null}
    </div>
  );
};

/** Footer band of the landing hero: the sample pipeline, with the live demo on request. */
export const Proto11SampleStrip = ({
  onExploreSample,
  discoverHref,
  onAskAboutIndicator,
}: {
  onExploreSample: ExploreSample;
  discoverHref: string;
  onAskAboutIndicator: (indicator: KnowledgeIndicator, message: string) => void;
}) => {
  const { euiTheme } = useEuiTheme();
  const [expanded, setExpanded] = useState(false);
  const [openPopover, setOpenPopover] = useState<PipelineId | 'sample' | null>(null);
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
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
        <EuiFlexItem grow={false}>
          <EuiPopover
            button={
              <EuiBadge
                color="hollow"
                onClick={() => setOpenPopover(openPopover === 'sample' ? null : 'sample')}
                onClickAriaLabel="Show where the sample comes from"
                data-test-subj="proto11SamplePipeline-sample"
              >
                Sample
              </EuiBadge>
            }
            aria-label="Sample source"
            isOpen={openPopover === 'sample'}
            closePopover={() => setOpenPopover(null)}
            panelPaddingSize="s"
            anchorPosition="downLeft"
          >
            <EuiText
              size="xs"
              data-test-subj="proto11SampleProvenance"
              css={css`
                max-width: calc(${euiTheme.size.base} * 20);
              `}
            >
              <p>
                From the sample AI index{' '}
                <EuiLink
                  onClick={() => {
                    setOpenPopover(null);
                    onExploreSample('web-ops');
                  }}
                  data-test-subj="proto11SampleIndexLink"
                >
                  {SAMPLE_INDEX_NAME}
                </EuiLink>
                , used by the sample agent {SAMPLE_AGENT_NAME}.
              </p>
            </EuiText>
          </EuiPopover>
        </EuiFlexItem>
        {PIPELINE.map((node, index) => (
          <React.Fragment key={node.label}>
            {index > 0 ? (
              <EuiFlexItem grow={false}>
                <EuiIcon type="sortRight" color="subdued" aria-hidden={true} />
              </EuiFlexItem>
            ) : null}
            <EuiFlexItem grow={false}>
              <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiIcon type={node.icon} size="m" aria-hidden={true} />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  {node.id === 'agent' ? (
                    <EuiPopover
                      button={
                        <EuiLink
                          color="text"
                          onClick={() => setOpenPopover(openPopover === 'agent' ? null : 'agent')}
                          aria-label="Show the sample agent"
                          data-test-subj="proto11SamplePipeline-agent"
                        >
                          <EuiText size="xs">{node.label}</EuiText>
                        </EuiLink>
                      }
                      aria-label="Sample agent"
                      isOpen={openPopover === 'agent'}
                      closePopover={() => setOpenPopover(null)}
                      panelPaddingSize="s"
                      anchorPosition="downCenter"
                    >
                      <PipelinePopoverBody id="agent" />
                    </EuiPopover>
                  ) : (
                    <EuiText size="xs">{node.label}</EuiText>
                  )}
                </EuiFlexItem>
                {node.count !== undefined ? (
                  <EuiFlexItem grow={false}>
                    {node.id === 'indicators' ? (
                      <EuiBadge
                        color="hollow"
                        onClick={() => onExploreSample('web-ops', 'knowledge')}
                        onClickAriaLabel={`Open the Knowledge Indicators of ${SAMPLE_INDEX_NAME}`}
                        data-test-subj="proto11SamplePipeline-indicators"
                      >
                        {node.count}
                      </EuiBadge>
                    ) : (
                      <EuiPopover
                        button={
                          <EuiBadge
                            color="hollow"
                            onClick={() => setOpenPopover(openPopover === node.id ? null : node.id)}
                            onClickAriaLabel={`Show the sample ${node.label.toLowerCase()}`}
                            data-test-subj={`proto11SamplePipeline-${node.id}`}
                          >
                            {node.count}
                          </EuiBadge>
                        }
                        aria-label={`Sample ${node.label.toLowerCase()}`}
                        isOpen={openPopover === node.id}
                        closePopover={() => setOpenPopover(null)}
                        panelPaddingSize="s"
                        anchorPosition="downCenter"
                      >
                        <PipelinePopoverBody id={node.id} />
                      </EuiPopover>
                    )}
                  </EuiFlexItem>
                ) : null}
              </EuiFlexGroup>
            </EuiFlexItem>
          </React.Fragment>
        ))}
        <EuiFlexItem />
        <EuiFlexItem grow={false}>
          <EuiLink
            onClick={() => setExpanded((isExpanded) => !isExpanded)}
            aria-expanded={expanded}
            data-test-subj="proto11SampleStripToggle"
          >
            {expanded ? 'Hide' : 'See a sample question answered'}
          </EuiLink>
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
          <EuiSpacer size="m" />
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
