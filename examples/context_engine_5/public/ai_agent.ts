/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/** Same icon family as the Kibana top-nav AI Agent button. */
export const AI_AGENT_ICON = 'productAgent';

export const ELASTIC_AI_AGENT_ID = 'elastic-ai-agent';

export type ContextAgentSeedKind =
  | 'improvement-discuss'
  | 'improvement-watch'
  | 'automation-edit'
  | 'suggest-automations'
  | 'continue';

export interface ContextAgentSeed {
  kind: ContextAgentSeedKind;
  /** Attachment chip label, e.g. "Automation · salesforce opportunities descriptor". */
  contextChip: string;
  userMessage: string;
  /** Optional proposal shown with Apply/Discard in the mock reply overlay. */
  proposalText?: string;
  onApply?: () => void;
}

/** Minimal duck-typed start contract so the example plugin need not import agent-builder packages. */
export interface AgentBuilderStartLite {
  openChat: (options?: {
    newConversation?: boolean;
    agentId?: string;
    initialMessage?: string;
    autoSendInitialMessage?: boolean;
    attachments?: Array<{
      type: string;
      id?: string;
      label?: string;
      data?: { content?: string };
      description?: string;
      items?: Array<{
        type: string;
        data?: { content?: string };
        description?: string;
      }>;
    }>;
    onClose?: () => void;
  }) => { chatRef: { close: () => void } };
}

export interface AppPluginStartDependencies {
  agentBuilder?: AgentBuilderStartLite;
}

/**
 * Opens the real top-nav AI Agent sidebar (same panel the header button toggles),
 * seeded with an attachment chip and a prefilled user message.
 */
export function openContextAgentChat(
  agentBuilder: AgentBuilderStartLite | undefined,
  seed: ContextAgentSeed,
  onClose?: () => void
): void {
  if (!agentBuilder?.openChat) {
    // eslint-disable-next-line no-console
    console.warn('agentBuilder.openChat is unavailable; AI Agent sidebar was not opened.');
    return;
  }

  agentBuilder.openChat({
    newConversation: true,
    agentId: ELASTIC_AI_AGENT_ID,
    initialMessage: seed.userMessage,
    // Leave the message in the composer with the chip; the mock overlay shows the
    // seeded turn so the prototype does not depend on a live LLM round-trip.
    autoSendInitialMessage: false,
    attachments: [
      {
        type: 'group',
        id: `context-engine-${seed.kind}`,
        label: seed.contextChip,
        items: [
          {
            type: 'text',
            data: { content: seed.contextChip },
            description: seed.contextChip,
          },
        ],
      },
    ],
    onClose,
  });
}
