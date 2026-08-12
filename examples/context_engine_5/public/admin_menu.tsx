/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import {
  EuiContextMenu,
  EuiContextMenuItem,
  EuiHeaderSectionItemButton,
  EuiIcon,
  EuiPopover,
} from '@elastic/eui';

import { DemoControlsMenuSection } from './demo_controls';

/**
 * Prototype "admin" header menu. Hosts Demo controls (and any other prototype
 * admin items). This is the only demo-related header chrome.
 */
export const AdminMenuNavControl = ({
  editProfileUrl,
  logoutUrl,
}: {
  editProfileUrl: string;
  logoutUrl: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const closePopover = () => setIsOpen(false);

  const button = (
    <EuiHeaderSectionItemButton
      aria-expanded={isOpen}
      aria-haspopup="true"
      aria-label="admin"
      onClick={() => setIsOpen((value) => !value)}
      data-test-subj="contextEngineAdminMenuButton"
    >
      admin
      <EuiIcon type="arrowDown" size="s" style={{ marginLeft: 4 }} />
    </EuiHeaderSectionItemButton>
  );

  return (
    <EuiPopover
      ownFocus
      button={button}
      isOpen={isOpen}
      anchorPosition="downRight"
      repositionOnScroll
      closePopover={closePopover}
      panelPaddingSize="none"
      buffer={0}
    >
      <EuiContextMenu
        initialPanelId={0}
        panels={[
          {
            id: 0,
            title: 'admin',
            content: (
              <>
                <EuiContextMenuItem icon="user" href={editProfileUrl} onClick={closePopover}>
                  Edit profile
                </EuiContextMenuItem>
                <EuiContextMenuItem icon="logOut" href={logoutUrl} onClick={closePopover}>
                  Log out
                </EuiContextMenuItem>
                <DemoControlsMenuSection closePopover={closePopover} />
              </>
            ),
          },
        ]}
        data-test-subj="contextEngineAdminMenu"
      />
    </EuiPopover>
  );
};
