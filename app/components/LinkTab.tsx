// app/components/LinkTab.tsx

import React from 'react';
import { Tab, TabProps } from '@mui/material';
import NextLink, { LinkProps } from 'next/link';

type LinkTabProps = TabProps & LinkProps;

const LinkTab = React.forwardRef<HTMLAnchorElement, LinkTabProps>((props, ref) => {
  const { href, ...tabProps } = props;

  return (
    <Tab
      component={NextLink}
      href={href}
      ref={ref}
      {...tabProps}
    />
  );
});

LinkTab.displayName = 'LinkTab';

export default LinkTab;