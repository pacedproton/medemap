'use client';

import React, { useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Link, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { ACCESS_KEY_HEADER_NAME, setAccessKey } from '../../lib/ai/accessKey';
import { ACCESS_CONTACT_EMAIL } from '../../lib/ai/contact';

interface AIAccessModalProps {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
  /** shown above the form, e.g. when a stored key was rejected */
  notice?: string;
}

// A ready-made mail to the contact address, so asking for a key is one click
const MAILTO = `mailto:${ACCESS_CONTACT_EMAIL}?subject=${encodeURIComponent('MeDeMAP AI assistant access key')}&body=${encodeURIComponent(
  'Name:\nOrganisation:\nWhat I would like to use the assistant for:\n'
)}`;

const AIAccessModal: React.FC<AIAccessModalProps> = ({ open, onClose, onUnlocked, notice }) => {
  const [tab, setTab] = useState<'key' | 'request'>('key');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const switchTab = (t: 'key' | 'request') => { setTab(t); setError(''); };

  const unlock = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!key.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/llm/access', { headers: { [ACCESS_KEY_HEADER_NAME]: key.trim() } });
      if (res.ok) {
        setAccessKey(key);
        setKey('');
        onUnlocked();
      } else if (res.status === 429) {
        setError('Too many wrong keys. Please try again later.');
      } else if (res.status === 503) {
        setError('The AI assistant is not available right now.');
      } else {
        setError('That key was not accepted.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="ai-access-title">
      <DialogTitle id="ai-access-title">AI research assistant</DialogTitle>
      <Tabs value={tab} onChange={(_, v) => switchTab(v)} variant="fullWidth">
        <Tab value="key" label="I have a key" />
        <Tab value="request" label="Request a key" />
      </Tabs>
      <DialogContent>
        {notice && <Alert severity="info" sx={{ mb: 2 }}>{notice}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {tab === 'key' && (
          <Box component="form" onSubmit={unlock} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              The assistant is available to researchers with an access key.
            </Typography>
            <TextField
              label="Access key" type="password" value={key} onChange={(e) => setKey(e.target.value)}
              fullWidth autoFocus autoComplete="off"
            />
          </Box>
        )}

        {tab === 'request' && (
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              To request an access key, send us a short email saying who you are and what you would like to
              use the assistant for:
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, fontWeight: 600, wordBreak: 'break-all' }}>
              {ACCESS_CONTACT_EMAIL}
            </Typography>
            <Link href={MAILTO}>Write an email</Link>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {tab === 'key' && (
          <Button variant="contained" onClick={() => unlock()} disabled={busy || !key.trim()}>
            {busy ? <CircularProgress size={20} /> : 'Unlock'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AIAccessModal;
