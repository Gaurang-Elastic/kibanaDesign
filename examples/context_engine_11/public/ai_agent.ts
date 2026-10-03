/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License, v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ReactElement } from 'react';

/** Minimal duck-typed start contract so this example need not import agent-builder packages. */
export interface AgentBuilderStartLite {
  openChat: (options?: {
    newConversation?: boolean;
    initialMessage?: string;
    autoSendInitialMessage?: boolean;
    attachments?: Array<{
      type: string;
      id?: string;
      label?: string;
      items?: Array<{
        type: string;
        data?: { content?: string };
        description?: string;
      }>;
    }>;
  }) => void;
}

/** Optional start contracts. Create with AI Agent opens the real AI Agent sidebar. */
export interface AppPluginStartDependencies {
  agentBuilder?: AgentBuilderStartLite;
  triggersActionsUi?: {
    getAddConnectorFlyout: (props: {
      onClose: () => void;
      onConnectorCreated?: (connector: unknown) => void;
      featureId?: string;
    }) => ReactElement;
  };
}
