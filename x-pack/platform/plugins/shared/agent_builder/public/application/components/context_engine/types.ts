/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export type ContextEngineConcept = '1' | '2';

export type EmbedType =
  | 'index-picker'
  | 'progress'
  | 'skills'
  | 'ki-correction'
  | 'summary'
  | 'integration'
  | null;

export interface ScriptStep {
  role: 'agent' | 'user';
  text: string;
  embed: EmbedType;
  suggestions: string[];
  timing?: string;
}

export interface ContextEngineMessage extends ScriptStep {
  id: string;
}
