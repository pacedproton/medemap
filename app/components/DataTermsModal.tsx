// app/components/DataTermsModal.tsx
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

interface DataTermsModalProps {
  className: string;
}

const DataTermsModal: React.FC<DataTermsModalProps> = ({ className }) => {
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
        Data Terms of Use
      </button>
      <StyledDialog
        open={isOpen}
        onClose={handleClose}
        aria-labelledby="data-terms-dialog-title"
      >
        <StyledDialogTitle id="data-terms-dialog-title">
          Data Terms of Use
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
          <Typography paragraph>
            The data available on this site is subject to the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0), which allows users to share and adapt the content for non-commercial purposes, provided proper attribution is given. This license ensures that users can freely use the data while respecting the terms outlined by the license.
          </Typography>
          <Typography paragraph>
            For proper attribution, researchers are required to cite the following paper in any publications or works that use the data obtained from this site:
          </Typography>
          <Typography paragraph style={{ marginLeft: '20px', fontStyle: 'italic' }}>
            Seethaler, J., Beaufort, M., Klimkiewicz, B., & Kompatsiaris, P. (2024). Quantitative data input for the map of EU political information environments (Version 2.0) [Data set]. MeDeMAP Deliverable 1.3, V2.0. DOI coming soon
          </Typography>
          <Typography paragraph>
            It is important to note that certain data corresponding to data sourced from other databases may be subject to different terms of use. Users are encouraged to refer to our Data annotations for detailed information on acknowledgments and specific terms of use related to external data sources integrated into this site.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </StyledDialog>
    </>
  );
};

export default DataTermsModal;