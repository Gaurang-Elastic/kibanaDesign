/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { __IntlProvider as IntlProvider } from '@kbn/i18n-react';
import { AgentBuilderContextAgentsTable } from './context_agents_table';

jest.mock('../../hooks/use_navigation', () => ({
  useNavigation: () => ({
    createAgentBuilderUrl: (path: string) => path,
    navigateToAgentBuilderUrl: jest.fn(),
  }),
}));

const renderTable = () =>
  render(
    <IntlProvider locale="en">
      <AgentBuilderContextAgentsTable />
    </IntlProvider>
  );

describe('AgentBuilderContextAgentsTable', () => {
  it('renders read-only On/Off status without toggles or pickers', () => {
    renderTable();

    expect(screen.queryByText('Auto')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('agentBuilderContextModeOn')).toHaveLength(2);
    expect(screen.getAllByTestId('agentBuilderContextModeOff')).toHaveLength(1);

    expect(screen.queryByTestId('agentBuilderContextToggle-nightshift')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('agentBuilderContextIndexPicker-elastic-ai-agent')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('agentSettingsAiIndexesComboBox')).not.toBeInTheDocument();
  });

  it('links each row to agent settings for editing', () => {
    renderTable();

    expect(screen.getByTestId('agentBuilderContextEditSettings-elastic-ai-agent')).toHaveTextContent(
      'Edit in agent settings ›'
    );
    expect(screen.getByTestId('agentBuilderContextEditSettings-nightshift')).toBeInTheDocument();
    expect(screen.getByTestId('agentBuilderContextEditSettings-support-bot')).toBeInTheDocument();
  });

  it('shows AI indices as read-only labels including defaults', () => {
    renderTable();

    expect(
      screen.getAllByTestId('agentBuilderContextDefaultIndex-sig-events').length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('sig-events (default)').length).toBeGreaterThan(0);
  });
});
