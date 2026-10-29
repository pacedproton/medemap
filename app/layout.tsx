import React from 'react';
import type { ReactNode } from 'react';
import { StoreProvider } from './StoreProvider';
import SessionProvider from './components/SessionProvider';
import './styles/globals.css';
import styles from './styles/layout.module.css';
import dynamic from 'next/dynamic';

const ClientLayout = dynamic(() => import('./ClientLayout'));

interface Props {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={styles.body} suppressHydrationWarning>
        <SessionProvider>
          <StoreProvider>
            <ClientLayout>{children}</ClientLayout>
          </StoreProvider>
        </SessionProvider>
      </body>
    </html>
  );
}