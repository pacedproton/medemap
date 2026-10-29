'use client';

import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Card, CardContent, List, ListItem, ListItemText } from '@mui/material';
import styles from './AboutProjectModal.module.css';
import Image from 'next/image';

interface AboutProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutProjectModal: React.FC<AboutProjectModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="about-project-dialog-title"
      maxWidth={false}
      fullWidth
      className={`${styles.styledDialog} ${styles.wideDialog}`}
    >
      <DialogTitle id="about-project-dialog-title" className={styles.styledDialogTitle}>
        Map of EU Political Information Environments

      </DialogTitle>
      <DialogContent dividers className={styles.dialogContent}>
        <iframe
          src="/static/About the Project_V2.0.pdf"
          width="100%"
          height="600px"
          style={{ border: 'none' }}
        />
      </DialogContent>
      <DialogActions className={styles.dialogActions}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AboutProjectModal;