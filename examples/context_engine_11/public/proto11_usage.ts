/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Namespace } from './namespace_data';
import { sampleScenarioOf } from './proto11_data';

/** Flat program goal for the hit-rate chart. The series is expected to climb toward it. */
export const HIT_RATE_GOAL = 0.8;

export type UsagePeriod = '24h' | '7d' | '30d';

export const USAGE_PERIODS: ReadonlyArray<{ value: UsagePeriod; label: string }> = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export const DEFAULT_USAGE_PERIOD: UsagePeriod = '30d';

const PERIOD_DAYS: Record<UsagePeriod, number> = { '24h': 1, '7d': 7, '30d': 30 };

export interface UsageDay {
  /** 0 is today. */
  daysAgo: number;
  questions: number;
  /** Questions where at least one Knowledge Indicator was retrieved. */
  hits: number;
  retrievals: number;
  /** Estimated tokens saved versus a without-Context dry run. */
  tokensSaved: number;
  /** Average seconds to answer. Absent when the figure is not modelled. */
  avgSeconds?: number;
}

export interface UsageTop {
  id: string;
  retrievals: number;
  lastRetrieved: string;
}

export interface UsageMiss {
  question: string;
  count: number;
  lastSeen: string;
  daysAgo: number;
}

export interface UsageSeries {
  days: UsageDay[];
  top: UsageTop[];
  misses: UsageMiss[];
}

export interface UsageStats {
  hitRate: number | null;
  retrievals: number | null;
  tokensSaved: number | null;
  avgSeconds: number | null;
}

const webOpsDays = (): UsageDay[] =>
  Array.from({ length: 30 }, (_, index) => {
    const t = index / 29;
    const hitRate = 0.4 + 0.3 * t;
    const questions = 14 + (index % 3);
    const hits = Math.round(questions * hitRate);
    return {
      daysAgo: 29 - index,
      questions,
      hits,
      retrievals: hits,
      tokensSaved: Math.round(questions * (110 + 20 * t)),
      avgSeconds: 11 - 3 * t,
    };
  });

/** 30 days, hit rate about 40% to about 70%, a few hundred retrievals, tokens in the tens of thousands. */
const WEB_OPS_USAGE: UsageSeries = {
  days: webOpsDays(),
  top: [
    { id: 'ki-010', retrievals: 86, lastRetrieved: '18 minutes ago' },
    { id: 'ki-001', retrievals: 64, lastRetrieved: '2 hours ago' },
    { id: 'ki-020', retrievals: 41, lastRetrieved: 'yesterday' },
  ],
  misses: [
    {
      question: 'Which deployment owns the checkout latency?',
      count: 6,
      lastSeen: '3 hours ago',
      daysAgo: 0,
    },
    {
      question: 'What is the error budget for the payments SLO?',
      count: 4,
      lastSeen: 'yesterday',
      daysAgo: 1,
    },
  ],
};

const higherEdDays = (): UsageDay[] =>
  Array.from({ length: 7 }, (_, index) => {
    const t = index / 6;
    const hitRate = 0.48 + 0.24 * t;
    const questions = 5;
    const hits = Math.round(questions * hitRate);
    return {
      daysAgo: 6 - index,
      questions,
      hits,
      retrievals: hits,
      // 7,800 without Context minus 2,100 with Context, the higher-ed test figures.
      tokensSaved: hits * 5700,
      avgSeconds: 15,
    };
  });

/** Seven days. Average time stays at 15 seconds, the with-Context figure from the higher-ed session. */
const HIGHER_ED_USAGE: UsageSeries = {
  days: higherEdDays(),
  top: [
    { id: 'he-001', retrievals: 9, lastRetrieved: '2 hours ago' },
    { id: 'he-004', retrievals: 7, lastRetrieved: '5 hours ago' },
    { id: 'he-002', retrievals: 5, lastRetrieved: 'yesterday' },
  ],
  misses: [
    {
      question: 'Which students are likely to stop out this term?',
      count: 3,
      lastSeen: 'yesterday',
      daysAgo: 1,
    },
    {
      question: 'How much aid did the 2022 cohort receive?',
      count: 2,
      lastSeen: '4 days ago',
      daysAgo: 4,
    },
  ],
};

const FIRST_DAY: UsageDay = {
  daysAgo: 0,
  questions: 4,
  hits: 2,
  retrievals: 3,
  tokensSaved: 2400,
  avgSeconds: 12,
};

/** Usage for an AI index, or null when no agent has retrieved from it yet. */
export const usageForNamespace = (namespace: Namespace): UsageSeries | null => {
  const scenario = sampleScenarioOf(namespace);
  if (scenario === 'web-ops') return WEB_OPS_USAGE;
  if (scenario === 'higher-ed') return HIGHER_ED_USAGE;
  const retrieved = (namespace.proto11?.connectedAgents ?? []).some((agent) =>
    Boolean(agent.lastRetrieval)
  );
  if (!retrieved) return null;
  return {
    days: [FIRST_DAY],
    top: namespace.indicators.slice(0, 3).map((indicator, index) => ({
      id: indicator.id,
      retrievals: index === 0 ? 2 : 1,
      lastRetrieved: 'just now',
    })),
    misses: [
      {
        question: 'What changed in the last deploy?',
        count: 2,
        lastSeen: '1 hour ago',
        daysAgo: 0,
      },
    ],
  };
};

/** True when the Usage tab should be shown. */
export const usageTabVisible = (namespace: Namespace): boolean =>
  usageForNamespace(namespace) !== null;

/**
 * Retrievals in the default period, for indicators part B measured.
 * Null when this index has no usage. Indicators that were not measured are absent, not zero.
 */
export const indicatorRetrievals = (namespace: Namespace): Map<string, number> | null => {
  const usage = usageForNamespace(namespace);
  if (!usage) return null;
  const span = usage.days.length;
  const counts = new Map<string, number>();
  usage.top.forEach((item) => {
    const scaled = scaleRetrievals(item.retrievals, DEFAULT_USAGE_PERIOD, span);
    if (scaled !== null) counts.set(item.id, scaled);
  });
  return counts;
};

/** Days that fall inside the selected period. */
export const filterUsageDays = (days: readonly UsageDay[], period: UsagePeriod): UsageDay[] =>
  days.filter((day) => day.daysAgo < PERIOD_DAYS[period]);

/** Aggregates a period. Unmodelled figures stay null so the UI can read "No data". */
export const summarizeUsage = (days: readonly UsageDay[]): UsageStats => {
  if (days.length === 0) {
    return { hitRate: null, retrievals: null, tokensSaved: null, avgSeconds: null };
  }
  const questions = days.reduce((sum, day) => sum + day.questions, 0);
  const hits = days.reduce((sum, day) => sum + day.hits, 0);
  const timed = days.filter(
    (day): day is UsageDay & { avgSeconds: number } => day.avgSeconds !== undefined
  );
  const weight = timed.reduce((sum, day) => sum + day.questions, 0);
  return {
    hitRate: questions === 0 ? null : hits / questions,
    retrievals: days.reduce((sum, day) => sum + day.retrievals, 0),
    tokensSaved: days.reduce((sum, day) => sum + day.tokensSaved, 0),
    avgSeconds:
      weight === 0
        ? null
        : timed.reduce((sum, day) => sum + day.avgSeconds * day.questions, 0) / weight,
  };
};

/** Scales a full-series retrieval count down to the selected period. Zero stays unmodelled. */
export const scaleRetrievals = (
  total: number,
  period: UsagePeriod,
  spanDays: number
): number | null => {
  const window = Math.min(PERIOD_DAYS[period], spanDays);
  const scaled = Math.round((total * window) / Math.max(spanDays, 1));
  return scaled > 0 ? scaled : null;
};

export const formatHitRate = (value: number | null): string =>
  value === null ? 'No data' : `${Math.round(value * 100)}%`;

export const formatCount = (value: number | null): string =>
  value === null ? 'No data' : value.toLocaleString('en-US');

export const formatSeconds = (value: number | null): string =>
  value === null ? 'No data' : `${Math.round(value)}s`;

/** Noon on the day, so the chart axis labels stay stable through the day. */
export const usageDayStamp = (daysAgo: number): number => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.getTime();
};
