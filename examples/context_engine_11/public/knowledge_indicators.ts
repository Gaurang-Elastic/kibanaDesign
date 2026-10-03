/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export type KnowledgeType =
  | 'workflow'
  | 'index_metadata'
  | 'playbook'
  | 'policy'
  | 'faq'
  | 'glossary'
  | 'fact';

export const KNOWLEDGE_TYPE_ORDER: KnowledgeType[] = [
  'workflow',
  'index_metadata',
  'playbook',
  'policy',
  'faq',
  'glossary',
  'fact',
];

export interface KnowledgeVersion {
  version: number;
  summary: string;
  source: string;
  when: string;
}

export interface KnowledgeReference {
  uri: string;
  relation: string;
}

export interface KnowledgeGovernance {
  provenance: {
    created_by: {
      uri: string;
      metadata: { ingestion_method: string };
    };
  };
}

/** Build-shaped Knowledge Indicator document. */
export interface KnowledgeIndicator {
  id: string;
  '@timestamp': string;
  type: KnowledgeType;
  title: string;
  description?: string;
  content: string;
  updated_at: string;
  references: KnowledgeReference[];
  governance: KnowledgeGovernance;
}

export interface HydratedKnowledgeIndicator extends KnowledgeIndicator {
  source: string;
  value: string;
  tags: string[];
  currentVersion: number;
  versions: KnowledgeVersion[];
  extractedBy: string;
  confidence: number;
  evidenceCount: number;
  access: string;
}

const DOCUMENT_TIMESTAMP = '2026-09-24T19:54:05.265Z';

const CRAWLED_GOVERNANCE: KnowledgeGovernance = {
  provenance: {
    created_by: {
      uri: 'crawler://sml',
      metadata: { ingestion_method: 'crawled' },
    },
  },
};

const v1Only = (): KnowledgeVersion[] => [
  {
    version: 1,
    summary: 'Initial extraction',
    source: 'Extraction automation',
    when: '3 weeks ago',
  },
];

const v2Current = (): KnowledgeVersion[] => [
  {
    version: 2,
    summary: 'Re-extracted, answer-forward',
    source: 'Extraction automation',
    when: '3 days ago',
  },
  {
    version: 1,
    summary: 'Initial extraction',
    source: 'Extraction automation',
    when: '3 weeks ago',
  },
];

const hashFromId = (id: string) => {
  let total = 0;
  for (let i = 0; i < id.length; i += 1) total += id.charCodeAt(i);
  return total;
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const indicatorSourceLabel = (indicator: KnowledgeIndicator) => {
  const uri = indicator.references[0]?.uri ?? '';
  const rest = uri.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  if (!rest) return indicator.type.replace(/_/g, ' ');
  if (rest === 'zendesk') return 'Zendesk';
  if (rest === 'confluence') return 'Confluence';
  if (rest === 'dashboards') return 'Dashboards';
  if (rest === 'alerts') return 'Alerts';
  if (rest === 'slos') return 'SLOs';
  return rest;
};

/** Pretty-printed document in the build's field order. */
export const toIndicatorDocument = (indicator: KnowledgeIndicator) => {
  const document: Record<string, unknown> = {
    id: indicator.id,
    '@timestamp': indicator['@timestamp'],
    type: indicator.type,
    title: indicator.title,
  };
  if (indicator.description) document.description = indicator.description;
  document.content = indicator.content;
  document.updated_at = indicator.updated_at;
  document.references = indicator.references;
  document.governance = indicator.governance;
  return document;
};

const extraTagsFor = (type: KnowledgeType): string[] => {
  switch (type) {
    case 'playbook':
      return ['Macros'];
    case 'policy':
      return ['System'];
    case 'faq':
      return ['Macros'];
    case 'glossary':
      return ['Entities'];
    case 'workflow':
      return ['Workflows'];
    case 'index_metadata':
      return ['System'];
    case 'fact':
    default:
      return ['System', 'Entities'];
  }
};

const automationTitleFor = (
  indicator: KnowledgeIndicator,
  automations: Array<{ title: string }>
) => {
  const source = indicatorSourceLabel(indicator).toLowerCase();
  const match = automations.find((automation) =>
    automation.title.toLowerCase().includes(source === 'alerts' ? 'alert' : source)
  );
  if (match) return match.title;
  return automations[0]?.title || 'Extraction automation';
};

export const hydrateIndicator = (
  indicator: KnowledgeIndicator,
  automations: Array<{ title: string }> = []
): HydratedKnowledgeIndicator => {
  const hash = hashFromId(indicator.id);
  const versions = hash % 3 === 0 ? v1Only() : v2Current();
  const currentVersion = Math.max(...versions.map((item) => item.version));
  const source = indicatorSourceLabel(indicator);
  return {
    ...indicator,
    source,
    value: indicator.content,
    tags: extraTagsFor(indicator.type),
    currentVersion,
    versions,
    extractedBy: automationTitleFor(indicator, automations),
    confidence: 86 + (hash % 10),
    evidenceCount: 6 + (hash % 14),
    access: `Access: inherits from ${source}`,
  };
};

export interface KnowledgeStats {
  playbooks: number;
  policies: number;
  faqs: number;
  glossaries: number;
  facts: number;
  workflows: number;
  indexMetadata: number;
}

export const statsFromIndicators = (indicators: KnowledgeIndicator[]): KnowledgeStats => {
  const knowledge: KnowledgeStats = {
    playbooks: 0,
    policies: 0,
    faqs: 0,
    glossaries: 0,
    facts: 0,
    workflows: 0,
    indexMetadata: 0,
  };

  indicators.forEach((indicator) => {
    switch (indicator.type) {
      case 'playbook':
        knowledge.playbooks += 1;
        break;
      case 'policy':
        knowledge.policies += 1;
        break;
      case 'faq':
        knowledge.faqs += 1;
        break;
      case 'glossary':
        knowledge.glossaries += 1;
        break;
      case 'workflow':
        knowledge.workflows += 1;
        break;
      case 'index_metadata':
        knowledge.indexMetadata += 1;
        break;
      default:
        knowledge.facts += 1;
    }
  });

  return knowledge;
};

export const typeBadgeColor = (
  type: KnowledgeType
): 'success' | 'primary' | 'warning' | 'accent' | 'default' => {
  switch (type) {
    case 'fact':
      return 'success';
    case 'playbook':
    case 'workflow':
      return 'primary';
    case 'policy':
      return 'warning';
    case 'faq':
      return 'accent';
    case 'index_metadata':
    case 'glossary':
    default:
      return 'default';
  }
};

/** Title-case type for accordion sublabels. */
export const typeLabel = (type: KnowledgeType) => {
  if (type === 'faq') return 'FAQ';
  if (type === 'index_metadata') return 'Index metadata';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

/** Filter chips mirror the raw type, lowercase, underscores as spaces. */
export const typeFilterLabel = (type: KnowledgeType) => type.replace(/_/g, ' ');

const documentFrom = (
  id: string,
  type: KnowledgeType,
  title: string,
  description: string,
  content: string | string[],
  sourceSlug: string
): KnowledgeIndicator => ({
  id,
  '@timestamp': DOCUMENT_TIMESTAMP,
  type,
  title,
  description,
  content: Array.isArray(content) ? content.join('\n') : content,
  updated_at: DOCUMENT_TIMESTAMP,
  references: [{ uri: `source://${sourceSlug}`, relation: 'derived_from' }],
  governance: CRAWLED_GOVERNANCE,
});

export const workflowIndicatorFor = (
  title: string,
  destination: string,
  enabled: boolean,
  triggers: string
): KnowledgeIndicator => {
  const slug = slugify(title);
  return {
    id: `workflow:${slug}`,
    '@timestamp': DOCUMENT_TIMESTAMP,
    type: 'workflow',
    title,
    content: `${title}\nAutomation for the ${destination} AI index\nenabled: ${enabled}\ntriggers: ${triggers}`,
    updated_at: DOCUMENT_TIMESTAMP,
    references: [{ uri: `workflow://${slug}`, relation: 'derived_from' }],
    governance: CRAWLED_GOVERNANCE,
  };
};

/** support-triage: 7 KIs from one refund/SLA scenario plus index metadata. */
export const supportIndicators: KnowledgeIndicator[] = [
  documentFrom(
    'support-refund-playbook',
    'playbook',
    'Refund request playbook',
    'How agents walk a refund request from ticket intake to credit or denial.',
    [
      'Confirm the order date and the product category from the ticket.',
      'Apply the 30-day refund policy. Digital goods follow the shorter window.',
      'If the request is past the window, offer store credit only when the ticket cites a defect.',
      'Close with the macro that matches approved or denied.',
    ],
    'zendesk'
  ),
  documentFrom(
    'support-sla-playbook',
    'playbook',
    'SLA breach playbook',
    'What to do when a ticket is about to miss, or has missed, its response target.',
    [
      'Page the on-call lead if a P1 ticket has 15 minutes left on the clock.',
      'Leave a public update even when the fix is still in progress.',
      'After a breach, file the miss reason and the recovery note on the ticket.',
    ],
    'zendesk'
  ),
  documentFrom(
    'support-refund-policy',
    'policy',
    '30-day refund policy',
    'The written refund window and the exceptions that change it.',
    'Customers can request a full refund within 30 days of purchase. Digital downloads drop to 14 days. Defective hardware can be refunded after 30 days if a replacement is not available.',
    'confluence'
  ),
  documentFrom(
    'support-p1-sla',
    'policy',
    'P1 response SLA',
    'Response targets by severity for support tickets.',
    'P1 tickets must get a first public response in 15 minutes and a workaround or owner in 60 minutes. P2 first response is 2 hours. P3 first response is 8 business hours.',
    'confluence'
  ),
  documentFrom(
    'support-refund-denied-faq',
    'faq',
    'When is a refund denied?',
    'The denial reasons agents cite most often, grounded in closed tickets.',
    'Q: When is a refund denied?\nA: After the 30-day window, unless the item is defective and no replacement is in stock. Consumed digital goods and promotional licenses are never refunded.',
    'zendesk'
  ),
  documentFrom(
    'support-terms-glossary',
    'glossary',
    'Refund and SLA terms',
    'Canonical terms agents mix up when answering refund and SLA questions.',
    [
      'Refund window: calendar days from purchase, not from first use.',
      'Store credit: goodwill after the window, never a cash refund.',
      'SLA breach: first public response later than the severity target.',
    ],
    'confluence'
  ),
  documentFrom(
    'support-refund-window-fact',
    'fact',
    'Standard refund window is 30 days',
    'The default window agents should lead with before naming exceptions.',
    'The standard refund window is 30 calendar days from purchase.',
    'confluence'
  ),
  {
    id: 'logs-endpoint.alerts-*',
    '@timestamp': DOCUMENT_TIMESTAMP,
    type: 'index_metadata',
    title: 'Logs - Endpoint Security & Observability',
    description:
      'Endpoint security and observability alerts used when triaging issues that mention a host or process.',
    content:
      'Index pattern logs-endpoint.alerts-*. Key fields: host.name, process.name, file.path, event.action, user.name, and rule.name.',
    updated_at: DOCUMENT_TIMESTAMP,
    references: [{ uri: 'index://logs-endpoint.alerts-*', relation: 'derived_from' }],
    governance: CRAWLED_GOVERNANCE,
  },
];

/**
 * Elastic AI index: product-surface KIs plus a workflow KI for every demo automation.
 */
export const elasticProductIndicators: KnowledgeIndicator[] = [
  documentFrom(
    'elastic-dashboard-to-query',
    'fact',
    'Dashboards compile to queries',
    'Agents should cite the query behind a panel, not the panel title.',
    'Saved dashboards compile to ES|QL and aggregation queries. Cite the query when answering.',
    'dashboards'
  ),
  documentFrom(
    'elastic-open-slo-dashboard',
    'fact',
    'Open the SLO burn dashboard first',
    'The first surface to open when an SLO is burning error budget.',
    'Open the SLO burn dashboard before paging. It shows burn rate, linked alerts, and owners.',
    'slos'
  ),
  documentFrom(
    'elastic-alert-owner-map',
    'fact',
    'Alert severity maps to owners',
    'How alert severity chooses the first responder.',
    'P1 alerts page the service owner. P2 goes to the team Slack channel. P3 waits in the queue.',
    'alerts'
  ),
  documentFrom(
    'elastic-lens-filter-scope',
    'fact',
    'Lens filters are the investigation scope',
    'Reuse the saved Lens filters instead of rebuilding time and service scope.',
    'Copy the Lens filter chip set. It already scopes time, service, and environment.',
    'dashboards'
  ),
  documentFrom(
    'elastic-slo-breach-playbook',
    'playbook',
    'SLO breach playbook',
    'Steps when an SLO is burning faster than the remaining budget allows.',
    [
      'Open the SLO burn dashboard and confirm the window.',
      'Follow the linked alert to the failing dependency.',
      'Post the burn rate and owner in the service channel.',
    ],
    'slos'
  ),
  documentFrom(
    'elastic-alert-ack-playbook',
    'playbook',
    'Alert acknowledgement playbook',
    'How on-call acknowledges and routes a new alert.',
    [
      'Acknowledge in the alert flyout so duplicate pages stop.',
      'Open the first linked dashboard from the rule.',
      'If the service is unknown, assign to the platform queue.',
    ],
    'alerts'
  ),
  documentFrom(
    'elastic-dashboard-handoff-playbook',
    'playbook',
    'Dashboard handoff playbook',
    'How to leave a dashboard investigation so the next person can continue.',
    [
      'Pin the time range that shows the incident.',
      'Note which panel first showed the break.',
      'Link the dashboard URL on the case.',
    ],
    'dashboards'
  ),
  documentFrom(
    'elastic-new-rule-playbook',
    'playbook',
    'New alert rule playbook',
    'What to set before enabling a new rule so agents can route it later.',
    [
      'Set severity and the owning team before enable.',
      'Attach one dashboard the agent should open first.',
      'Add the service name in the rule tags.',
    ],
    'alerts'
  ),
  documentFrom(
    'elastic-error-budget-policy',
    'policy',
    'Error budget policy',
    'When a burning SLO becomes a page instead of a ticket.',
    'Page if remaining error budget drops below 20% in a 1-hour window. File a ticket if burn is elevated but budget remains above 20%.',
    'slos'
  ),
  documentFrom(
    'elastic-mute-policy',
    'policy',
    'Alert mute policy',
    'When muting an alert is allowed.',
    'Mute only after an owner is assigned and a public note explains the expected duration.',
    'alerts'
  ),
  documentFrom(
    'elastic-share-policy',
    'policy',
    'Dashboard share policy',
    'What can be shared outside the space.',
    'Share dashboard links inside the space. Do not export CSV from customer-data panels.',
    'dashboards'
  ),
  documentFrom(
    'elastic-which-dashboard-faq',
    'faq',
    'Which dashboard should I open for an SLO breach?',
    'The first dashboard agents should open when asked about an SLO miss.',
    'Q: Which dashboard should I open for an SLO breach?\nA: The SLO burn dashboard. It lists burn rate, linked alerts, and the service owner.',
    'slos'
  ),
  documentFrom(
    'elastic-ack-faq',
    'faq',
    'Do I acknowledge before investigating?',
    'Whether acknowledgement happens before the first dashboard is opened.',
    'Q: Do I acknowledge before investigating?\nA: Yes. Acknowledge first so the page loop stops, then open the linked dashboard.',
    'alerts'
  ),
  documentFrom(
    'elastic-panel-title-faq',
    'faq',
    'Should I cite the panel title?',
    'What to cite when an agent answers from a dashboard.',
    'Q: Should I cite the panel title?\nA: No. Cite the underlying query. Panel titles are labels, not evidence.',
    'dashboards'
  ),
  documentFrom(
    'elastic-filter-faq',
    'faq',
    'Can I drop the saved filters?',
    'Whether agents should rebuild scope from scratch.',
    'Q: Can I drop the saved filters?\nA: Not for the first pass. The Lens filters already encode time, service, and environment.',
    'dashboards'
  ),
  documentFrom(
    'elastic-slo-glossary',
    'glossary',
    'SLO terms',
    'Terms agents confuse when talking about burn and budget.',
    [
      'Error budget: remaining allowed failure in the window.',
      'Burn rate: how fast the budget is being spent.',
      'SLO window: rolling 30 days unless the SLO says otherwise.',
    ],
    'slos'
  ),
  documentFrom(
    'elastic-alert-glossary',
    'glossary',
    'Alert terms',
    'Severity and acknowledgement language used by routing.',
    [
      'Acknowledge: stop the page loop. It is not a resolution.',
      'P1: page the service owner immediately.',
      'Linked dashboard: the first surface the rule points at.',
    ],
    'alerts'
  ),
  documentFrom(
    'elastic-dashboard-glossary',
    'glossary',
    'Dashboard terms',
    'Words that separate a panel from the query behind it.',
    [
      'Panel: a labelled chart on a dashboard.',
      'Query: the ES|QL or aggregation the panel runs.',
      'Filter chip: saved scope for time, service, or environment.',
    ],
    'dashboards'
  ),
];

/** One workflow KI per demo automation, stored on the managed Elastic AI index. */
export const elasticWorkflowIndicators: KnowledgeIndicator[] = [
  workflowIndicatorFor('Extract product surface facts', 'Elastic', true, 'scheduled'),
  workflowIndicatorFor('Alert routing preferences', 'Elastic', true, 'scheduled'),
  workflowIndicatorFor('Extract refund and SLA policies', 'support-triage', true, 'scheduled'),
];

export const elasticIndicators: KnowledgeIndicator[] = [
  ...elasticProductIndicators,
  ...elasticWorkflowIndicators,
];
