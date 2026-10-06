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
  Axis,
  Chart,
  DARK_THEME,
  LIGHT_THEME,
  LineSeries,
  Position,
  ScaleType,
  Settings,
} from '@elastic/charts';
import {
  EuiBadge,
  EuiBasicTable,
  EuiFlexGrid,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLink,
  EuiPanel,
  EuiSpacer,
  EuiSuperSelect,
  EuiStat,
  EuiText,
  EuiTitle,
  useEuiTheme,
} from '@elastic/eui';
import type { EuiBasicTableColumn } from '@elastic/eui';

import {
  indicatorSourceLabel,
  typeLabel,
  type KnowledgeIndicator,
  type KnowledgeType,
} from './knowledge_indicators';
import type { Namespace } from './namespace_data';
import { KiDetailFlyout } from './proto11_ki_detail';
import { KNOWLEDGE_BLUE } from './proto11_ki_colors';
import {
  DEFAULT_USAGE_PERIOD,
  HIT_RATE_GOAL,
  USAGE_PERIODS,
  filterUsageDays,
  formatCount,
  formatHitRate,
  formatSeconds,
  scaleRetrievals,
  summarizeUsage,
  usageDayStamp,
  usageForNamespace,
  type UsagePeriod,
  type UsageStats,
} from './proto11_usage';

const NO_MATCH_EMPTY = 'No unmatched questions in this period.';
const TOP_EMPTY = 'No Knowledge Indicators were retrieved in this period.';
const PLACEHOLDER =
  'Usage appears here once an agent is connected and has retrieved from this index.';
const TARGET_LINE = 'Target: hit rate rises over 30 days without manual changes.';
const MEASURED_LINE = 'Measured from agent traces for connected agents. Estimates are marked.';

const STATS: ReadonlyArray<{
  key: keyof UsageStats;
  label: string;
  description: string;
  format: (value: number | null) => string;
  estimated?: boolean;
}> = [
  {
    key: 'hitRate',
    label: 'KI hit rate',
    description: 'Share of agent questions where at least one Knowledge Indicator was retrieved.',
    format: formatHitRate,
  },
  {
    key: 'retrievals',
    label: 'Retrievals',
    description: 'Knowledge Indicators retrieved in this period.',
    format: formatCount,
  },
  {
    key: 'tokensSaved',
    label: 'Tokens saved',
    description: 'Estimated, versus a without-Context dry run.',
    format: formatCount,
    estimated: true,
  },
  {
    key: 'avgSeconds',
    label: 'Avg time to answer',
    description: 'Average time for a connected agent to answer.',
    format: formatSeconds,
  },
];

const UsageStatsRow = ({ stats }: { stats: UsageStats }) => (
  <EuiFlexGrid columns={4} gutterSize="m" data-test-subj="contextEngineUsageStats">
    {STATS.map((stat) => {
      const value = stat.format(stats[stat.key]);
      return (
        <EuiFlexItem key={stat.key}>
          <EuiPanel hasBorder paddingSize="m" data-test-subj={`contextEngineUsageStat-${stat.key}`}>
            <EuiStat
              title={value}
              description={stat.label}
              titleSize="m"
              textAlign="left"
              titleColor={value === 'No data' ? 'subdued' : 'default'}
            />
            <EuiSpacer size="s" />
            <EuiText size="xs" color="subdued">
              <p>{stat.description}</p>
            </EuiText>
          </EuiPanel>
        </EuiFlexItem>
      );
    })}
  </EuiFlexGrid>
);

const SummaryFigures = ({ stats }: { stats: UsageStats }) => (
  <EuiFlexGroup gutterSize="l" data-test-subj="contextEngineUsageSummaryFigures">
    {STATS.map((stat) => {
      const value = stat.format(stats[stat.key]);
      return (
        <EuiFlexItem key={stat.key}>
          <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiText size="m">
                <strong>{value}</strong>
              </EuiText>
            </EuiFlexItem>
            {stat.estimated && value !== 'No data' ? (
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">Estimated</EuiBadge>
              </EuiFlexItem>
            ) : null}
          </EuiFlexGroup>
          <EuiText size="xs" color="subdued">
            <p>{stat.label}</p>
          </EuiText>
        </EuiFlexItem>
      );
    })}
  </EuiFlexGroup>
);

/** Compact Overview figures, or the placeholder while Usage is hidden. */
export const Proto11UsageSummary = ({
  namespace,
  onViewUsage,
}: {
  namespace: Namespace;
  onViewUsage: () => void;
}) => {
  const series = usageForNamespace(namespace);
  const stats = series ? summarizeUsage(filterUsageDays(series.days, DEFAULT_USAGE_PERIOD)) : null;
  return (
    <EuiPanel
      hasBorder
      paddingSize="l"
      className="contextEnginePrototype__panel"
      data-test-subj="contextEngineUsageSummary"
    >
      <div className="contextEnginePrototype__panelHeader">
        <div className="contextEnginePrototype__panelHeaderText">
          <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
                <h2>Summary</h2>
              </EuiTitle>
            </EuiFlexItem>
            {namespace.proto11?.sample ? (
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">Sample</EuiBadge>
              </EuiFlexItem>
            ) : null}
          </EuiFlexGroup>
        </div>
        {series ? (
          <div className="contextEnginePrototype__panelActions">
            <EuiLink onClick={onViewUsage} data-test-subj="contextEngineViewUsage">
              View usage
            </EuiLink>
          </div>
        ) : null}
      </div>
      <EuiSpacer size="m" />
      {stats ? (
        <SummaryFigures stats={stats} />
      ) : (
        <EuiText size="s" color="subdued" data-test-subj="contextEngineUsagePlaceholder">
          <p>{PLACEHOLDER}</p>
        </EuiText>
      )}
    </EuiPanel>
  );
};

interface TopRow {
  id: string;
  title: string;
  type: KnowledgeType;
  source: string;
  retrievals: string;
  lastRetrieved: string;
}

interface MissRow {
  question: string;
  count: number;
  lastSeen: string;
}

/** Usage tab: period stats, hit-rate chart, retrieved Knowledge Indicators, and unmatched questions. */
export const Proto11UsageTab = ({
  namespace,
  onProposeFix,
  discoverHref,
  onAskAboutIndicator,
  onDeleteIndicator,
}: {
  namespace: Namespace;
  onProposeFix: (question: string) => void;
  discoverHref: string;
  onAskAboutIndicator: (indicator: KnowledgeIndicator, message: string) => void;
  onDeleteIndicator: (indicator: KnowledgeIndicator) => void;
}) => {
  const { euiTheme, colorMode } = useEuiTheme();
  const [period, setPeriod] = useState<UsagePeriod>(DEFAULT_USAGE_PERIOD);
  const [openId, setOpenId] = useState<string | null>(null);
  const series = usageForNamespace(namespace);
  if (!series) return null;

  const days = filterUsageDays(series.days, period);
  const stats = summarizeUsage(days);
  const hitColor = KNOWLEDGE_BLUE;
  const targetColor = euiTheme.colors.mediumShade;
  const hitPoints = days
    .filter((day) => day.questions > 0)
    .map((day) => ({ x: usageDayStamp(day.daysAgo), y: day.hits / day.questions }));
  const targetPoints = hitPoints.map((point) => ({ x: point.x, y: HIT_RATE_GOAL }));
  const topRows: TopRow[] = series.top.flatMap((item) => {
    const indicator = namespace.indicators.find((candidate) => candidate.id === item.id);
    const retrievals = scaleRetrievals(item.retrievals, period, series.days.length);
    if (!indicator || retrievals === null) return [];
    return [
      {
        id: indicator.id,
        title: indicator.title,
        type: indicator.type,
        source: indicatorSourceLabel(indicator),
        retrievals: formatCount(retrievals),
        lastRetrieved: item.lastRetrieved,
      },
    ];
  });
  const periodDays = period === '24h' ? 1 : period === '7d' ? 7 : 30;
  const missRows: MissRow[] = series.misses
    .filter((miss) => miss.daysAgo < periodDays)
    .map((miss) => ({ question: miss.question, count: miss.count, lastSeen: miss.lastSeen }));
  const openIndicator = namespace.indicators.find((indicator) => indicator.id === openId) ?? null;

  const topColumns: Array<EuiBasicTableColumn<TopRow>> = [
    { field: 'title', name: 'Title' },
    {
      field: 'type',
      name: 'Type',
      render: (type: TopRow['type']) => <EuiBadge color="hollow">{typeLabel(type)}</EuiBadge>,
    },
    { field: 'source', name: 'Source' },
    { field: 'retrievals', name: 'Retrievals', align: 'right' },
    { field: 'lastRetrieved', name: 'Last retrieved' },
  ];
  const missColumns: Array<EuiBasicTableColumn<MissRow>> = [
    { field: 'question', name: 'Question' },
    { field: 'count', name: 'Count', align: 'right' },
    { field: 'lastSeen', name: 'Last seen' },
    {
      name: '',
      render: (row: MissRow) => (
        <EuiLink
          onClick={() => onProposeFix(row.question)}
          data-test-subj="contextEngineProposeFix"
        >
          Propose a fix
        </EuiLink>
      ),
    },
  ];

  return (
    <div className="contextEnginePrototype__panels" data-test-subj="contextEngineUsage">
      <EuiFlexGroup
        className="contextEnginePrototype__usagePeriod"
        justifyContent="flexEnd"
        gutterSize="none"
        responsive={false}
      >
        <EuiFlexItem grow={false}>
          <EuiSuperSelect<UsagePeriod>
            compressed
            fullWidth={false}
            className="contextEnginePrototype__usagePeriodSelect"
            aria-label="Time period"
            data-test-subj="contextEngineUsagePeriod"
            options={USAGE_PERIODS.map((item) => ({
              value: item.value,
              inputDisplay: item.label,
            }))}
            valueOfSelected={period}
            onChange={setPeriod}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
      <UsageStatsRow stats={stats} />
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__panel">
        <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
          <h2>Hit rate over time</h2>
        </EuiTitle>
        <EuiSpacer size="m" />
        {hitPoints.length === 0 ? (
          <EuiText size="s" color="subdued">
            <p>No data</p>
          </EuiText>
        ) : (
          <div
            className="contextEnginePrototype__usageChart"
            data-test-subj="contextEngineUsageChart"
          >
            <Chart>
              <Settings
                baseTheme={colorMode === 'DARK' ? DARK_THEME : LIGHT_THEME}
                showLegend
                legendPosition={Position.Bottom}
                locale="en"
              />
              <Axis
                id="usage-time"
                position={Position.Bottom}
                tickFormat={(value) =>
                  new Date(Number(value)).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
              />
              <Axis
                id="usage-rate"
                position={Position.Left}
                domain={{ min: 0, max: 1 }}
                ticks={5}
                tickFormat={(value) => `${Math.round(Number(value) * 100)}%`}
              />
              <LineSeries
                id="hit-rate"
                name="KI hit rate"
                data={hitPoints}
                xAccessor="x"
                yAccessors={['y']}
                xScaleType={ScaleType.Time}
                yScaleType={ScaleType.Linear}
                color={hitColor}
              />
              <LineSeries
                id="target"
                name="Target"
                data={targetPoints}
                xAccessor="x"
                yAccessors={['y']}
                xScaleType={ScaleType.Time}
                yScaleType={ScaleType.Linear}
                color={targetColor}
              />
            </Chart>
          </div>
        )}
        <EuiSpacer size="s" />
        <EuiText size="xs" color="subdued">
          <p>{TARGET_LINE}</p>
        </EuiText>
      </EuiPanel>
      <EuiPanel
        hasBorder
        paddingSize="l"
        className="contextEnginePrototype__panel"
        data-test-subj="contextEngineUsageTop"
      >
        <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
          <h2>Most retrieved Knowledge Indicators</h2>
        </EuiTitle>
        <EuiSpacer size="m" />
        {topRows.length === 0 ? (
          <EuiText size="s" color="subdued">
            <p>{TOP_EMPTY}</p>
          </EuiText>
        ) : (
          <EuiBasicTable
            tableCaption="Most retrieved Knowledge Indicators"
            items={topRows}
            columns={topColumns}
            rowHeader="title"
            tableLayout="auto"
            rowProps={(row) => ({
              onClick: () => setOpenId(row.id),
              className: 'contextEnginePrototype__usageRow',
              'data-test-subj': 'contextEngineUsageTopRow',
            })}
          />
        )}
      </EuiPanel>
      <EuiPanel
        hasBorder
        paddingSize="l"
        className="contextEnginePrototype__panel"
        data-test-subj="contextEngineUsageMisses"
      >
        <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
          <h2>Questions with no match</h2>
        </EuiTitle>
        <EuiSpacer size="m" />
        {missRows.length === 0 ? (
          <EuiText size="s" color="subdued">
            <p>{NO_MATCH_EMPTY}</p>
          </EuiText>
        ) : (
          <EuiBasicTable
            tableCaption="Questions with no match"
            items={missRows}
            columns={missColumns}
            rowHeader="question"
            tableLayout="auto"
          />
        )}
      </EuiPanel>
      <EuiText size="xs" color="subdued" data-test-subj="contextEngineUsageMeasured">
        <p>{MEASURED_LINE}</p>
      </EuiText>
      {openIndicator ? (
        <KiDetailFlyout
          indicator={openIndicator}
          indicators={namespace.indicators}
          sample={Boolean(namespace.proto11?.sample)}
          discoverHref={discoverHref}
          automations={namespace.automations}
          sources={namespace.sources}
          agent={namespace.proto11?.agent}
          onAskAgent={onAskAboutIndicator}
          onDelete={(item) => {
            onDeleteIndicator(item);
            setOpenId(null);
          }}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
};
