import React from 'react';
import type { ReactNode } from 'react';
import '../styles/globals.css';
import styles from '../styles/layout.module.css';

interface Props {
  readonly children: ReactNode;
}

export default function LoginLayout({ children }: Props) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={styles.body} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
