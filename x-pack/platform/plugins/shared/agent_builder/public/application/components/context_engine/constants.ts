/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ScriptStep } from './types';

export const CONTEXT_ENGINE_SETUP_PARAM = 'ce_setup';

export const SAMPLE_INDICES = [
  { id: 'sales_records', label: 'sales_records', docs: '1.2M', fields: 38, status: 'green' as const },
  {
    id: 'product_catalog',
    label: 'product_catalog',
    docs: '84K',
    fields: 22,
    status: 'green' as const,
  },
  {
    id: 'customer_profiles',
    label: 'customer_profiles',
    docs: '640K',
    fields: 31,
    status: 'green' as const,
  },
  {
    id: 'support_tickets',
    label: 'support_tickets',
    docs: '210K',
    fields: 18,
    status: 'yellow' as const,
  },
  { id: 'web_analytics', label: 'web_analytics', docs: '4.1M', fields: 44, status: 'green' as const },
];

export const SETUP_SCRIPT: ScriptStep[] = [
  {
    role: 'agent',
    text: "Hi Gaurang. I'm the Context Engine setup agent. I'll guide you through building a governed knowledge layer for your Elasticsearch data. First, which indices should I analyze? I've scanned your cluster and found these candidates:",
    embed: 'index-picker',
    suggestions: ['Analyze all listed indices', 'Only sales and product data', 'Tell me more first'],
    timing: '3s',
  },
  { role: 'user', text: 'Analyze all listed indices', embed: null, suggestions: [] },
  {
    role: 'agent',
    text: "Got it, analyzing all 5 indices. I'm sampling up to 10,000 records per index to extract field definitions, naming conventions, computed metrics, and query patterns. This typically takes 2 to 3 minutes:",
    embed: 'progress',
    suggestions: [],
    timing: '4s',
  },
  {
    role: 'agent',
    text: 'Analysis complete. I extracted 247 Knowledge Indicators across your indices. Based on the patterns found, here are the skills I can publish for your agents:',
    embed: 'skills',
    suggestions: ['Publish all 4 skills', 'Review skills individually', 'Adjust confidence threshold'],
    timing: '2s',
  },
  { role: 'user', text: 'Publish all 4 skills', embed: null, suggestions: [] },
  {
    role: 'agent',
    text: 'Before I finalize, I flagged one field that needs your input. In sales_records, the field arr is ambiguous:',
    embed: 'ki-correction',
    suggestions: ['Confirm: Annual Recurring Revenue', 'It means something else', 'Skip this field'],
    timing: '3s',
  },
  { role: 'user', text: 'Confirm: Annual Recurring Revenue', embed: null, suggestions: [] },
  {
    role: 'agent',
    text: 'Updated. The Context Engine is now live with your confirmed definitions. Here is a summary of what has been published:',
    embed: 'summary',
    suggestions: ['Connect to Claude via MCP', 'Test in Kibana now', 'View all Knowledge Indicators'],
    timing: '2s',
  },
  { role: 'user', text: 'Connect to Claude via MCP', embed: null, suggestions: [] },
  {
    role: 'agent',
    text: 'The Context Engine publishes a standard Skill interface used by Kibana agents, Claude, Cursor, and any OpenAI-compatible platform. Same API, no privileged shortcuts for any platform. To add the Context Engine to Claude, paste this into your claude_desktop_config.json:',
    embed: 'integration',
    suggestions: ['Show OpenAI tool spec', 'View Kibana agent config', 'Done, set up monitoring'],
    timing: '3s',
  },
  { role: 'user', text: 'Done, set up monitoring', embed: null, suggestions: [] },
  {
    role: 'agent',
    text: 'Monitoring is active. Tracking hit rates, Knowledge Indicator usage, and token savings in real time. Check the Context Engine overview tab for the live dashboard. You are set. The Context Engine is live and distributing knowledge to all connected agents.',
    embed: null,
    suggestions: ['Open monitoring dashboard', 'Add more indices later', 'Invite team members'],
    timing: '2s',
  },
];
