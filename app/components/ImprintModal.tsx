// app/components/ImprintModal.tsx
'use client';

import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Typography, styled } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialogContent-root': {
    padding: theme.spacing(3),
  },
  '& .MuiDialogActions-root': {
    padding: theme.spacing(1),
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  margin: 0,
  padding: theme.spacing(2),
}));

interface ImprintModalProps {
  className: string;
}

const ImprintModal: React.FC<ImprintModalProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <>
      <button
        className={className}
        onClick={handleOpen}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'inherit', textDecoration: 'underline' }}
      >
        Imprint
      </button>
      <StyledDialog
        open={isOpen}
        onClose={handleClose}
        aria-labelledby="imprint-dialog-title"
      >
        <StyledDialogTitle id="imprint-dialog-title">
          Imprint
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </StyledDialogTitle>
        <DialogContent dividers>
          <Typography gutterBottom>
            © Copyright OEAW https://www.oeaw.ac.at/en/oeaw/imprint
          </Typography>
          <Typography gutterBottom>
            All content and services on this website are provided by:
          </Typography>
          <Typography gutterBottom>
            Österreichische Akademie der Wissenschaften
          </Typography>
          <Typography gutterBottom>
            Juristische Person öffentlichen Rechts (BGBl 569/1921 idF BGBl I 130/2003)
          </Typography>
          <Typography gutterBottom>
            Dr. Ignaz Seipel-Platz 2, 1010 Wien, Österreich
          </Typography>
          <Typography gutterBottom>
            E-Mail: cmc@oeaw.ac.at
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </StyledDialog>
    </>
  );
};

export default ImprintModal;