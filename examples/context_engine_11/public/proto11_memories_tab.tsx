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
  EuiAccordion,
  EuiBadge,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiCodeBlock,
  EuiConfirmModal,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLink,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';

import { backingIndexName, type Namespace } from './namespace_data';
import { sampleScenarioOf } from './proto11_data';

export type MemoryType = 'procedural' | 'semantic' | 'episodic';

export interface IndexMemory {
  id: string;
  type: MemoryType;
  text: string;
  agent: string;
  when: string;
  task: string;
  conversationId: string;
}

const MEMORY_TYPE_ORDER: readonly MemoryType[] = ['procedural', 'semantic', 'episodic'];

const MEMORY_TYPE_LABEL: Record<MemoryType, string> = {
  procedural: 'Procedural',
  semantic: 'Semantic',
  episodic: 'Episodic',
};

const MEMORY_TYPE_TOOLTIP: Record<MemoryType, string> = {
  procedural: 'How to do things the agent learned.',
  semantic: 'Durable facts.',
  episodic: 'What happened in a specific task.',
};

const EMPTY_MEMORIES = 'No memories yet. Connected agents save memories while they work.';

const WEB_OPS_AGENT = 'web-ops-assistant';

const WEB_OPS_MEMORIES: readonly IndexMemory[] = [
  {
    id: 'mem-001',
    type: 'procedural',
    text: 'When checkout 5xx stays above 2 percent for 5 minutes, check payments-gateway latency before scaling the edge.',
    agent: WEB_OPS_AGENT,
    when: '18 minutes ago',
    task: 'Checkout latency investigation',
    conversationId: 'conv-checkout-latency',
  },
  {
    id: 'mem-002',
    type: 'procedural',
    text: 'Exclude user_agent.name HealthChecker before computing an error rate. It adds about 12 percent to the totals.',
    agent: WEB_OPS_AGENT,
    when: '2 hours ago',
    task: 'Error rate excluding health checks',
    conversationId: 'conv-health-checks',
  },
  {
    id: 'mem-003',
    type: 'procedural',
    text: 'Join nginx access logs to host CPU on host.name, using 1 minute buckets.',
    agent: WEB_OPS_AGENT,
    when: 'yesterday',
    task: 'Join access logs to host CPU',
    conversationId: 'conv-join-cpu',
  },
  {
    id: 'mem-004',
    type: 'procedural',
    text: 'Treat system.cpu.total.norm.pct above 0.85 as a saturated host.',
    agent: WEB_OPS_AGENT,
    when: '2 days ago',
    task: 'Saturated hosts question',
    conversationId: 'conv-saturated-hosts',
  },
  {
    id: 'mem-005',
    type: 'semantic',
    text: 'checkout-api is owned by the payments SRE team and runs on edge-checkout-01 through edge-checkout-06.',
    agent: WEB_OPS_AGENT,
    when: '3 days ago',
    task: 'Who owns checkout-api',
    conversationId: 'conv-checkout-owner',
  },
  {
    id: 'mem-006',
    type: 'semantic',
    text: 'The normal 5xx rate for checkout-api is 0.3 percent to 0.6 percent.',
    agent: WEB_OPS_AGENT,
    when: '5 days ago',
    task: 'Normal 5xx rate for checkout',
    conversationId: 'conv-normal-5xx',
  },
  {
    id: 'mem-007',
    type: 'semantic',
    text: 'Group request paths on url.path. url.original includes query strings and splits one path into many rows.',
    agent: WEB_OPS_AGENT,
    when: 'last week',
    task: 'Which field to group by',
    conversationId: 'conv-url-path',
  },
  {
    id: 'mem-008',
    type: 'semantic',
    text: 'Runbook SRE-1142 covers elevated 5xx on checkout-api.',
    agent: WEB_OPS_AGENT,
    when: '8 days ago',
    task: 'Runbook for elevated 5xx',
    conversationId: 'conv-sre-1142',
  },
  {
    id: 'mem-009',
    type: 'episodic',
    text: 'In the 14:10 investigation, checkout latency came from payments-gateway. Edge CPU was not the cause.',
    agent: WEB_OPS_AGENT,
    when: '12 days ago',
    task: '14:10 checkout latency',
    conversationId: 'conv-1410-latency',
  },
  {
    id: 'mem-010',
    type: 'episodic',
    text: 'Yesterday the agent queried system.cpu.pct, which does not exist, and retried with system.cpu.total.norm.pct.',
    agent: WEB_OPS_AGENT,
    when: '2 weeks ago',
    task: 'Missing CPU field retry',
    conversationId: 'conv-cpu-retry',
  },
  {
    id: 'mem-011',
    type: 'episodic',
    text: 'During the certificate expiry page, the on-call followed the certificate expiry runbook and rotated the edge certificate.',
    agent: WEB_OPS_AGENT,
    when: '3 weeks ago',
    task: 'Certificate expiry page',
    conversationId: 'conv-cert-expiry',
  },
  {
    id: 'mem-012',
    type: 'episodic',
    text: 'The 09:40 deploy of checkout-api raised p95 latency to about 900 ms for 12 minutes.',
    agent: WEB_OPS_AGENT,
    when: '4 weeks ago',
    task: '09:40 checkout deploy',
    conversationId: 'conv-0940-deploy',
  },
];

const forgottenByIndex = new Map<string, Set<string>>();

/** Memories saved on this index. Only sample-web-ops has the mock set. */
export const memoriesForNamespace = (namespace: Namespace): readonly IndexMemory[] =>
  sampleScenarioOf(namespace) === 'web-ops' ? WEB_OPS_MEMORIES : [];

const memoryDocument = (memory: IndexMemory): string =>
  JSON.stringify(
    {
      memory_id: memory.id,
      type: memory.type,
      content: memory.text,
      agent: memory.agent,
      saved_at: memory.when,
      source: {
        kind: 'conversation',
        title: memory.task,
        conversation_id: memory.conversationId,
      },
    },
    null,
    2
  );

const MemoryRow = ({
  memory,
  agentBuilderHref,
  onForget,
  onPromote,
}: {
  memory: IndexMemory;
  agentBuilderHref: string;
  onForget: (memory: IndexMemory) => void;
  onPromote: (memory: IndexMemory) => void;
}) => (
  <EuiAccordion
    id={`memory-${memory.id}`}
    className="contextEnginePrototype__kiAccordion"
    arrowDisplay="left"
    buttonContent={
      <span className="contextEnginePrototype__memoryRow">
        <span className="contextEnginePrototype__memoryText">{memory.text}</span>
        <EuiBadge color="hollow">{MEMORY_TYPE_LABEL[memory.type]}</EuiBadge>
        <span className="contextEnginePrototype__memoryAgent">{memory.agent}</span>
        <span className="contextEnginePrototype__memoryWhen">{memory.when}</span>
      </span>
    }
    extraAction={
      <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            size="xs"
            color="danger"
            onClick={() => onForget(memory)}
            data-test-subj="proto11MemoryForget"
          >
            Forget
          </EuiButtonEmpty>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            size="xs"
            iconType="productAgent"
            onClick={() => onPromote(memory)}
            data-test-subj="proto11MemoryPromote"
          >
            Promote to Knowledge Indicator
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>
    }
    paddingSize="m"
    data-test-subj="proto11MemoryRow"
  >
    <EuiCodeBlock language="json" fontSize="s" paddingSize="s" isCopyable overflowHeight={220}>
      {memoryDocument(memory)}
    </EuiCodeBlock>
    <EuiSpacer size="m" />
    <EuiText size="s">
      <h3>Where it came from</h3>
      <p>
        Saved from{' '}
        <EuiLink href={agentBuilderHref} target="_blank">
          {memory.task}
        </EuiLink>
        .
      </p>
    </EuiText>
  </EuiAccordion>
);

export const Proto11MemoriesTab = ({
  namespace,
  discoverHref,
  agentBuilderHref,
  onPromote,
}: {
  namespace: Namespace;
  discoverHref: string;
  agentBuilderHref: string;
  onPromote: (memory: IndexMemory) => void;
}) => {
  const [forgotten, setForgotten] = useState<ReadonlySet<string>>(
    () => forgottenByIndex.get(namespace.name) ?? new Set()
  );
  const [typeFilter, setTypeFilter] = useState<MemoryType | 'all'>('all');
  const [pendingForget, setPendingForget] = useState<IndexMemory | null>(null);

  useEffect(() => {
    setForgotten(forgottenByIndex.get(namespace.name) ?? new Set());
    setTypeFilter('all');
    setPendingForget(null);
  }, [namespace.name]);

  const memories = memoriesForNamespace(namespace).filter((memory) => !forgotten.has(memory.id));
  const counts: Record<MemoryType, number> = {
    procedural: 0,
    semantic: 0,
    episodic: 0,
  };
  memories.forEach((memory) => {
    counts[memory.type] += 1;
  });
  const filtered =
    typeFilter === 'all' ? memories : memories.filter((memory) => memory.type === typeFilter);
  const groups = new Map<string, IndexMemory[]>();
  filtered.forEach((memory) => {
    const rows = groups.get(memory.agent) ?? [];
    rows.push(memory);
    groups.set(memory.agent, rows);
  });
  const noun = memories.length === 1 ? 'memory' : 'memories';

  const confirmForget = () => {
    if (!pendingForget) return;
    const next = new Set(forgotten);
    next.add(pendingForget.id);
    forgottenByIndex.set(namespace.name, next);
    setForgotten(next);
    setPendingForget(null);
  };

  return (
    <div className="contextEnginePrototype__panels" data-test-subj="proto11Memories">
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__panel">
        {memories.length === 0 ? (
          <EuiText size="s" color="subdued">
            <p>{EMPTY_MEMORIES}</p>
          </EuiText>
        ) : (
          <>
            <EuiText size="s">
              <p
                className="contextEnginePrototype__kiCountLine"
                data-test-subj="proto11MemoryCount"
              >
                {memories.length} {noun} in{' '}
                <EuiLink href={discoverHref} target="_blank">
                  {backingIndexName(namespace.name)}
                </EuiLink>
                {namespace.proto11?.sample ? (
                  <>
                    {' '}
                    <EuiBadge color="hollow">Sample</EuiBadge>
                  </>
                ) : null}
              </p>
            </EuiText>
            <EuiSpacer size="m" />
            <EuiButtonGroup
              legend="Filter by type"
              type="single"
              color="text"
              buttonSize="compressed"
              options={[
                { id: 'all', label: `All (${memories.length})` },
                ...MEMORY_TYPE_ORDER.map((type) => ({
                  id: type,
                  label: `${MEMORY_TYPE_LABEL[type]} (${counts[type]})`,
                  toolTipContent: MEMORY_TYPE_TOOLTIP[type],
                  'data-test-subj': `proto11MemoryType-${type}`,
                })),
              ]}
              idSelected={typeFilter}
              onChange={(id) => setTypeFilter(id as MemoryType | 'all')}
              data-test-subj="proto11MemoryTypeFilter"
            />
            <EuiSpacer size="m" />
            {filtered.length === 0 ? (
              <EuiText size="s" color="subdued">
                <p>No memories of this type.</p>
              </EuiText>
            ) : (
              [...groups.entries()].map(([agent, rows]) => (
                <div key={agent} data-test-subj="proto11MemoryGroup">
                  <EuiTitle size="xxs">
                    <h3>{agent}</h3>
                  </EuiTitle>
                  <EuiSpacer size="s" />
                  {rows.map((memory) => (
                    <MemoryRow
                      key={memory.id}
                      memory={memory}
                      agentBuilderHref={agentBuilderHref}
                      onForget={setPendingForget}
                      onPromote={onPromote}
                    />
                  ))}
                </div>
              ))
            )}
          </>
        )}
      </EuiPanel>
      {pendingForget ? (
        <EuiConfirmModal
          aria-labelledby="proto11ForgetMemoryTitle"
          titleProps={{ id: 'proto11ForgetMemoryTitle' }}
          title="Forget this memory?"
          onCancel={() => setPendingForget(null)}
          onConfirm={confirmForget}
          cancelButtonText="Cancel"
          confirmButtonText="Forget"
          buttonColor="danger"
          data-test-subj="proto11MemoryForgetConfirm"
        >
          <p>Connected agents will no longer recall it.</p>
        </EuiConfirmModal>
      ) : null}
    </div>
  );
};
