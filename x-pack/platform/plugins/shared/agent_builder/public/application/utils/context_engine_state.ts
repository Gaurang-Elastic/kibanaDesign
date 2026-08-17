/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export interface ContextEngineCreatedSkill {
  id: string;
  name: string;
  description: string;
  confidence: number;
  instructions: string[];
}

export const CONTEXT_ENGINE_CREATED_SKILLS: ContextEngineCreatedSkill[] = [
  {
    id: 'get_context',
    name: 'get_context',
    description: 'Returns relevant Knowledge Indicators for any query. Core skill used by all agents.',
    confidence: 97,
    instructions: [
      'Identify the user intent and required business domain before retrieval.',
      'Fetch the top relevant Knowledge Indicators using semantic + keyword matching.',
      'Return indicators with source index, confidence, and last-updated metadata.',
      'If confidence is low, include a clarification prompt instead of a hard answer.',
    ],
  },
  {
    id: 'resolve_metric',
    name: 'resolve_metric',
    description: 'Resolves metric names to canonical expressions with data sources.',
    confidence: 94,
    instructions: [
      'Map alias terms (for example ARR, MRR, NPS) to canonical metric definitions.',
      'Return expression logic, required fields, and source index constraints.',
      'Flag unresolved metric names and suggest closest known alternatives.',
      'Always include unit assumptions and time-grain defaults in the response.',
    ],
  },
  {
    id: 'explain_field',
    name: 'explain_field',
    description: 'Returns business definition, type, and values for a field across your indices.',
    confidence: 89,
    instructions: [
      'Normalize field lookup across index aliases and nested paths.',
      'Return field type, business meaning, sample values, and nullability notes.',
      'Include known joins or relationship hints to related fields.',
      'Highlight ambiguous definitions that require human review.',
    ],
  },
  {
    id: 'list_conventions',
    name: 'list_conventions',
    description: 'Lists naming and enum conventions used by your team.',
    confidence: 76,
    instructions: [
      'Group conventions by category: naming, enums, date formats, and IDs.',
      'Extract recurring patterns from analyzed indices and query history.',
      'Provide canonical examples and anti-pattern examples for each rule.',
      'Mark low-confidence conventions as provisional until confirmed by users.',
    ],
  },
];

const CONTEXT_ENGINE_PUBLISHED_KEY = 'agentBuilder.contextEngine.skillsPublished';

export const getContextEngineSkillsPublished = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(CONTEXT_ENGINE_PUBLISHED_KEY) === 'true';
};

export const setContextEngineSkillsPublished = (published: boolean): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CONTEXT_ENGINE_PUBLISHED_KEY, published ? 'true' : 'false');
};
