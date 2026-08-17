/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  CREATE_AI_INDEX_OPTION_VALUE,
  formatAiIndexStatusMeta,
  formatDefaultAiIndexLabel,
  isAiIndexReady,
  isDefaultAiIndexId,
  resolveAiIndex,
  sanitizePersistedAiIndexIds,
} from './ai_indexes';

describe('ai_indexes helpers', () => {
  it('labels defaults with (default)', () => {
    expect(formatDefaultAiIndexLabel('sig-events')).toBe('sig-events (default)');
  });

  it('identifies default index ids', () => {
    expect(isDefaultAiIndexId('sig-events')).toBe(true);
    expect(isDefaultAiIndexId('elastic')).toBe(false);
  });

  it('strips default ids and create sentinel from persisted selections', () => {
    expect(
      sanitizePersistedAiIndexIds([
        'sig-events',
        'elastic',
        'nightshift',
        CREATE_AI_INDEX_OPTION_VALUE,
      ])
    ).toEqual(['elastic', 'nightshift']);
  });

  it('dedupes persisted selections', () => {
    expect(sanitizePersistedAiIndexIds(['elastic', 'elastic', 'sales-outreach'])).toEqual([
      'elastic',
      'sales-outreach',
    ]);
  });

  it('formats lifecycle meta lines', () => {
    expect(formatAiIndexStatusMeta(resolveAiIndex('elastic')!)).toContain('Ready');
    expect(formatAiIndexStatusMeta(resolveAiIndex('elastic')!)).toContain('24 KIs');
    expect(formatAiIndexStatusMeta(resolveAiIndex('support-ticket-triage')!)).toContain(
      'Needs setup'
    );
    expect(formatAiIndexStatusMeta(resolveAiIndex('nightshift')!)).toContain('Read-only');
  });

  it('detects ready vs non-ready indices', () => {
    expect(isAiIndexReady(resolveAiIndex('elastic'))).toBe(true);
    expect(isAiIndexReady(resolveAiIndex('support-ticket-triage'))).toBe(false);
  });
});
