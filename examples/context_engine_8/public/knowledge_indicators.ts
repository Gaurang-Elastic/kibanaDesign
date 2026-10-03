/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export interface KnowledgeVersion {
  version: number;
  summary: string;
  source: string;
  when: string;
}

export interface KnowledgeIndicator {
  id: string;
  title: string;
  category: string;
  type: 'FACT' | 'PLAYBOOK' | 'POLICY' | 'FAQ' | 'GLOSSARY';
  tags: string[];
  description: string;
  currentVersion: number;
  versions: KnowledgeVersion[];
  /** Type-specific content: fact/FAQ/policy text, or playbook steps / glossary terms */
  value?: string | string[];
  extractedBy?: string;
  usedBy?: string;
  confidence?: number;
  evidenceCount?: number;
  access?: string;
}

export interface KnowledgeValueBlock {
  heading: string;
  text?: string;
  items?: string[];
}

const v1Only = (when = '4 weeks ago'): KnowledgeVersion[] => [
  {
    version: 1,
    summary: 'Initial extraction',
    source: 'Extraction automation',
    when,
  },
];

const v2Current = (when = '4 days ago'): KnowledgeVersion[] => [
  {
    version: 2,
    summary: 'Re-extracted, answer-forward',
    source: 'Extraction automation',
    when,
  },
  {
    version: 1,
    summary: 'Initial extraction',
    source: 'Extraction automation',
    when: '3 weeks ago',
  },
];

const sourceSlug = (source: string) =>
  source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const hashConfidence = (id: string, base = 88) => {
  let total = 0;
  for (let i = 0; i < id.length; i += 1) total += id.charCodeAt(i);
  return base + (total % 10);
};

const hashEvidence = (id: string, base = 4) => {
  let total = 0;
  for (let i = 0; i < id.length; i += 1) total += id.charCodeAt(i);
  return base + (total % 12);
};

const withDefaults = (
  indicator: KnowledgeIndicator,
  namespaceAgent = 'Context agent'
): KnowledgeIndicator => {
  const source = indicator.category;
  return {
    ...indicator,
    extractedBy:
      indicator.extractedBy || `Extract Knowledge Indicators from ${source}`,
    usedBy: indicator.usedBy || namespaceAgent,
    confidence: indicator.confidence ?? hashConfidence(indicator.id),
    evidenceCount: indicator.evidenceCount ?? hashEvidence(indicator.id),
    access: indicator.access || `Access: inherits from ${source}`,
    value: indicator.value ?? defaultValueFor(indicator),
  };
};

const defaultValueFor = (indicator: KnowledgeIndicator): string | string[] => {
  const source = indicator.category;
  switch (indicator.type) {
    case 'PLAYBOOK':
      return [
        `Confirm the signal originated in ${source} and capture the fingerprint.`,
        'Match against known resolution patterns in this namespace.',
        'Apply the highest-confidence remediation, then verify the signal clears.',
        'Leave a handoff note if the issue remains open past the next shift.',
      ];
    case 'GLOSSARY':
      return [
        `${source} entity: canonical name used in retrieval`,
        'Alias map: common near-twin spellings agents confuse',
        'Disambiguator: field or tag that separates lookalikes',
      ];
    case 'POLICY':
      return `Escalate from ${source} when severity is high, the same fingerprint repeats within 30 minutes, or the owning queue has not acknowledged within the SLA window.`;
    case 'FAQ':
      return `Q: What should agents check first in ${source}?\nA: Retrieve the canonical fact for the entity, then the matching playbook step before improvising.`;
    case 'FACT':
    default:
      return indicator.description.split('.')[0] + '.';
  }
};

const sourceBundle = (
  source: string,
  options: {
    policyVersion?: number;
    prefixTitles?: boolean;
    usedBy?: string;
  } = {}
): KnowledgeIndicator[] => {
  const slug = sourceSlug(source);
  const prefix = options.prefixTitles !== false;
  const label = (kind: string) => (prefix ? `${source} ${kind}` : kind);
  const policyVersion = options.policyVersion ?? 2;
  const usedBy = options.usedBy || 'Context agent';

  return [
    withDefaults(
      {
        id: `${slug}-playbook`,
        title: label('resolution playbook'),
        category: source,
        type: 'PLAYBOOK',
        tags: [source, 'playbook', 'bottom-up'],
        description: `Step-by-step resolution guidance distilled from ${source}, ordered so agents can act without re-reading the full source corpus.`,
        currentVersion: 1,
        versions: v1Only('3 weeks ago'),
        value: [
          `Triage the incoming ${source} signal and confirm scope.`,
          'Pull the matching Knowledge Indicator for the entity or exception.',
          'Execute the remediation steps in order; stop if verification fails.',
          'Record outcome so the next extraction pass can reinforce this playbook.',
        ],
        extractedBy: `Extract Knowledge Indicators from ${source}`,
        usedBy,
        confidence: 91,
        evidenceCount: 8,
      },
      usedBy
    ),
    withDefaults(
      {
        id: `${slug}-policy`,
        title: label('escalation policy'),
        category: source,
        type: 'POLICY',
        tags: [source, 'policy', 'escalation'],
        description: `When and how to escalate issues surfaced from ${source}, including severity cues and owning queues.`,
        currentVersion: policyVersion,
        versions: policyVersion > 1 ? v2Current('1 week ago') : v1Only('2 weeks ago'),
        value: `Escalate ${source} issues when severity is high, three related events land in one hour, or the primary owner has not acknowledged within the SLA.`,
        extractedBy: `Index metadata & schema descriptor`,
        usedBy,
        confidence: 89,
        evidenceCount: 6,
      },
      usedBy
    ),
    withDefaults(
      {
        id: `${slug}-faq`,
        title: label('FAQ digest'),
        category: source,
        type: 'FAQ',
        tags: [source, 'faq', 'digest'],
        description: `The most frequently asked questions surfaced from ${source}, each paired with a canonical, grounded answer and the source document it was drawn from.`,
        currentVersion: 1,
        versions: v1Only('4 weeks ago'),
        value: `Q: How do I resolve the top issue from ${source}?\nA: Use the resolution playbook for this source; cite the linked evidence docs before closing.`,
        extractedBy: `Extract Knowledge Indicators from ${source}`,
        usedBy,
        confidence: 86,
        evidenceCount: 12,
      },
      usedBy
    ),
    withDefaults(
      {
        id: `${slug}-glossary`,
        title: label('entity glossary'),
        category: source,
        type: 'GLOSSARY',
        tags: [source, 'glossary', 'entities'],
        description: `Canonical entity names, aliases, and disambiguators extracted from ${source} so agents can resolve near-twin references correctly.`,
        currentVersion: 1,
        versions: v1Only('5 weeks ago'),
        value: [
          `${source}: primary corpus / stream name`,
          'fingerprint: stable id for clustering near-duplicate events',
          'owner queue: team responsible for escalation',
        ],
        extractedBy: `Extract Knowledge Indicators from ${source}`,
        usedBy,
        confidence: 93,
        evidenceCount: 9,
      },
      usedBy
    ),
  ];
};

export const elasticIndicators: KnowledgeIndicator[] = [
  withDefaults(
    {
      id: 'elastic-extract-queries',
      title: 'Extract visualisations & dashboards into queries',
      category: 'Dashboards',
      type: 'FACT',
      tags: ['Dashboards', 'system', 'queries', 'eager-load'],
      description:
        'Converts saved dashboards and visualisations into the underlying ES|QL and aggregation queries agents can cite. Answer-forward: the fix now leads the description so retrieval surfaces it first.',
      currentVersion: 2,
      versions: v2Current('4 days ago'),
      value:
        'Saved dashboards compile to ES|QL + aggregation queries; agents should cite the query, not the panel title.',
      extractedBy: 'Extract Knowledge Indicators from Visualisations',
      usedBy: 'Elastic managed agents',
      confidence: 95,
      evidenceCount: 14,
    },
    'Elastic managed agents'
  ),
  ...sourceBundle('Dashboards', { usedBy: 'Elastic managed agents' }),
  withDefaults(
    {
      id: 'elastic-alert-slo-inventory',
      title: 'Alert & SLO inventory',
      category: 'Alerts',
      type: 'FACT',
      tags: ['Alerts', 'SLOs', 'inventory'],
      description:
        'A compact inventory of alert rules and SLOs with ownership, severity, and the dashboards agents should open first when investigating.',
      currentVersion: 1,
      versions: v1Only('2 weeks ago'),
      value:
        'Each alert/SLO row includes owner, severity, and the first dashboard to open during investigation.',
      extractedBy: 'Extract Knowledge Indicators from Alerts',
      usedBy: 'Elastic managed agents',
      confidence: 92,
      evidenceCount: 7,
    },
    'Elastic managed agents'
  ),
  ...sourceBundle('Alerts', { usedBy: 'Elastic managed agents' }),
  ...sourceBundle('Visualisations', { usedBy: 'Elastic managed agents' }),
];

export const nightshiftIndicators: KnowledgeIndicator[] = [
  withDefaults(
    {
      id: 'nightshift-signal-indexer',
      title: 'Signal indexer (eager load)',
      category: 'All streams',
      type: 'FACT',
      tags: ['All streams', 'Streams', 'Eager-load', 'Cron + webhook'],
      description:
        'Maps live stream signal types to L2 Knowledge Indicators and eagerly refreshes them on cron and webhook triggers so overnight agents always retrieve current signatures.',
      currentVersion: 2,
      versions: v2Current('4 days ago'),
      value:
        'Stream signal types map 1:1 to L2 Knowledge Indicators and refresh on cron + webhook so overnight retrieval always sees current signatures.',
      extractedBy: 'Extract Knowledge Indicators from Root logs Stream',
      usedBy: 'Nightshift agent',
      confidence: 94,
      evidenceCount: 11,
      access: 'Access: inherits from Root logs Stream',
    },
    'Nightshift agent'
  ),
  withDefaults(
    {
      id: 'nightshift-consolidator',
      title: 'KI consolidator & organizer',
      category: 'All streams',
      type: 'FACT',
      tags: ['All streams', 'Consolidation', 'Dedupe'],
      description:
        'Merges near-duplicate overnight facts, prefers answer-forward titles, and keeps a single canonical KI per exception signature.',
      currentVersion: 1,
      versions: v1Only('2 weeks ago'),
      value:
        'Near-duplicate overnight facts collapse to one canonical KI per exception fingerprint; answer-forward titles win ties.',
      extractedBy: 'KI consolidator automation',
      usedBy: 'Nightshift agent',
      confidence: 90,
      evidenceCount: 5,
      access: 'Access: inherits from Root logs Stream',
    },
    'Nightshift agent'
  ),
  withDefaults(
    {
      id: 'nightshift-gap-detection',
      title: 'Monitoring & gap detection',
      category: 'Agent traces',
      type: 'FACT',
      tags: ['Agent traces', 'Gaps', 'Monitoring'],
      description:
        'Flags failing nightshift traces that share a topic with existing KIs but still miss the distinguishing criterion agents need.',
      currentVersion: 2,
      versions: v2Current('5 days ago'),
      value:
        'Failing traces that share a KI topic but miss a distinguishing criterion are flagged as KI-addressable gaps.',
      extractedBy: 'Monitoring & gap detection',
      usedBy: 'Nightshift agent',
      confidence: 88,
      evidenceCount: 14,
      access: 'Access: inherits from Agent traces',
    },
    'Nightshift agent'
  ),
  ...sourceBundle('Root logs Stream', { usedBy: 'Nightshift agent' }),
  ...sourceBundle('Service error signals', { usedBy: 'Nightshift agent' }),
];

export const supportIndicators: KnowledgeIndicator[] = [
  withDefaults(
    {
      id: 'support-extract-zendesk',
      title: 'Extract ticket entities & macros',
      category: 'Zendesk tickets',
      type: 'FACT',
      tags: ['Zendesk tickets', 'system', 'macros', 'entities'],
      description:
        'Pulls product entities, macros, and resolution phrases from Zendesk tickets into answer-forward Knowledge Indicators for triage agents.',
      currentVersion: 2,
      versions: v2Current('3 days ago'),
      value:
        'Zendesk tickets yield product entities, macros, and resolution phrases as answer-forward Knowledge Indicators.',
      extractedBy: 'Extract Knowledge Indicators from Zendesk tickets',
      usedBy: 'support-ticket-triage',
      confidence: 93,
      evidenceCount: 18,
    },
    'support-ticket-triage'
  ),
  ...sourceBundle('Zendesk tickets', { usedBy: 'support-ticket-triage' }),
  withDefaults(
    {
      id: 'support-confluence-macros',
      title: 'Account-recovery macro index',
      category: 'Confluence space',
      type: 'FACT',
      tags: ['Confluence space', 'macros', 'identity'],
      description:
        'Indexes account-recovery macros and trigger phrases from Confluence so agents can link password-reset tickets to the right playbook.',
      currentVersion: 1,
      versions: v1Only('1 week ago'),
      value:
        'Account-recovery macros and trigger phrases are indexed so password-reset tickets link to the correct playbook.',
      extractedBy: 'Index account-recovery macros',
      usedBy: 'support-ticket-triage',
      confidence: 91,
      evidenceCount: 6,
    },
    'support-ticket-triage'
  ),
  ...sourceBundle('Confluence space', { usedBy: 'support-ticket-triage' }),
];

export const salesIndicators: KnowledgeIndicator[] = [
  withDefaults(
    {
      id: 'sales-extract-opportunities',
      title: 'Extract opportunity & account facts',
      category: 'Salesforce',
      type: 'FACT',
      tags: ['Salesforce', 'system', 'opportunities', 'accounts'],
      description:
        'Surfaces stage-aware account facts and closed-won patterns from Salesforce so outreach agents lead with the right proof points.',
      currentVersion: 2,
      versions: v2Current('6 days ago'),
      value:
        'Stage-aware account facts and closed-won patterns from Salesforce are the first proof points outreach agents should cite.',
      extractedBy: 'Extract Knowledge Indicators from Salesforce',
      usedBy: 'sales-outreach',
      confidence: 90,
      evidenceCount: 10,
    },
    'sales-outreach'
  ),
  ...sourceBundle('Salesforce', { usedBy: 'sales-outreach' }),
  withDefaults(
    {
      id: 'sales-sequence-patterns',
      title: 'Outreach sequence win patterns',
      category: 'Gmail',
      type: 'FACT',
      tags: ['Gmail', 'sequences', 'tone'],
      description:
        'First-touch and follow-up patterns from Gmail sequences that outperform generic templates, including objection-handling openers.',
      currentVersion: 1,
      versions: v1Only('2 weeks ago'),
      value:
        'Winning first-touch and follow-up openers from Gmail sequences outperform generic templates on objection handling.',
      extractedBy: 'Extract Knowledge Indicators from Gmail',
      usedBy: 'sales-outreach',
      confidence: 87,
      evidenceCount: 9,
    },
    'sales-outreach'
  ),
  ...sourceBundle('Gmail', { usedBy: 'sales-outreach' }),
];

export const statsFromIndicators = (indicators: KnowledgeIndicator[]) => {
  const knowledge = {
    playbooks: 0,
    policies: 0,
    faqs: 0,
    glossaries: 0,
    facts: 0,
  };

  indicators.forEach((indicator) => {
    switch (indicator.type) {
      case 'PLAYBOOK':
        knowledge.playbooks += 1;
        break;
      case 'POLICY':
        knowledge.policies += 1;
        break;
      case 'FAQ':
        knowledge.faqs += 1;
        break;
      case 'GLOSSARY':
        knowledge.glossaries += 1;
        break;
      default:
        knowledge.facts += 1;
    }
  });

  return knowledge;
};

export const indicatorsForNamespace = (name: string, sources: string[]): KnowledgeIndicator[] => {
  switch (name) {
    case 'Elastic':
      return elasticIndicators;
    case 'Nightshift':
      return nightshiftIndicators;
    case 'support-ticket-triage':
      return supportIndicators;
    case 'sales-outreach':
    case 'Sales outreach agent':
      return salesIndicators;
    default:
      if (sources.length === 0) return [];
      return [
        withDefaults({
          id: 'new-namespace-seed',
          title: `Extract Knowledge Indicators from ${sources[0]}`,
          category: sources[0],
          type: 'FACT',
          tags: [sources[0], 'system', 'new'],
          description: `Seed Knowledge Indicators generated from ${sources.join(
            ', '
          )}. Run automations to expand playbooks, policies, FAQs, and glossaries.`,
          currentVersion: 1,
          versions: v1Only('just now'),
          value: `Seed facts from ${sources.join(', ')} are ready for agents once extraction automations run.`,
          extractedBy: `Extract Knowledge Indicators from ${sources[0]}`,
          usedBy: name,
          confidence: 80,
          evidenceCount: sources.length,
        }),
        ...sources.flatMap((source) => sourceBundle(source, { usedBy: name })),
      ];
  }
};

export const typeBadgeColor = (
  type: KnowledgeIndicator['type']
): 'success' | 'primary' | 'warning' | 'accent' | 'default' => {
  switch (type) {
    case 'FACT':
      return 'success';
    case 'PLAYBOOK':
      return 'primary';
    case 'POLICY':
      return 'warning';
    case 'FAQ':
      return 'accent';
    case 'GLOSSARY':
      return 'default';
    default:
      return 'success';
  }
};

/** Operational tags shown as muted chips (excludes the semantic type itself). */
export const operationalTagsFor = (indicator: KnowledgeIndicator): string[] =>
  indicator.tags.filter((tag) => {
    const normalized = tag.trim().toLowerCase();
    return (
      normalized !== indicator.type.toLowerCase() &&
      normalized !== 'fact' &&
      normalized !== 'playbook' &&
      normalized !== 'policy' &&
      normalized !== 'faq' &&
      normalized !== 'glossary'
    );
  });

export const valueBlockFor = (indicator: KnowledgeIndicator): KnowledgeValueBlock => {
  const value = indicator.value ?? defaultValueFor(indicator);
  if (Array.isArray(value)) {
    return {
      heading:
        indicator.type === 'PLAYBOOK'
          ? 'Steps'
          : indicator.type === 'GLOSSARY'
          ? 'Terms'
          : 'Value',
      items: value,
    };
  }
  return {
    heading:
      indicator.type === 'FAQ' ? 'Q & A' : indicator.type === 'POLICY' ? 'Policy' : 'Value',
    text: value,
  };
};

export const hasVersionHistory = (indicator: KnowledgeIndicator) =>
  indicator.versions.length > 1;
