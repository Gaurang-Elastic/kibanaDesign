/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

const normalize = (value?: string | null): string => value?.trim().toLowerCase() ?? '';

export const isContextEngineAgent = ({
  agentId,
  agentName,
  search,
}: {
  agentId?: string | null;
  agentName?: string | null;
  search?: string | null;
}): boolean => {
  const isContextEngineSetupRoute =
    search != null && new URLSearchParams(search).get('ce_setup') === '1';

  if (isContextEngineSetupRoute) {
    return true;
  }

  const id = normalize(agentId);
  const name = normalize(agentName);
  const compound = `${id} ${name}`;

  return (
    compound.includes('context engine') ||
    compound.includes('context-engine') ||
    compound.includes('contextengine')
  );
};
