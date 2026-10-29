import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';

const StyledDialog = styled(Dialog)({
  zIndex: 2000, // Ensure the modal is on top
});

import React from "react";
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

interface PreviewGlobeModalProps {
  isOpen: boolean;
  onEnable: () => void;
  onDisable: () => void;
}

const PreviewGlobeModal: React.FC<PreviewGlobeModalProps> = ({
  isOpen,
  onEnable,
  onDisable,
}) => {
  console.log('Modal isOpen:', isOpen);
  return (
    <StyledDialog open={isOpen} aria-labelledby="preview-globe-dialog-title">
      <DialogTitle id="preview-globe-dialog-title">
        Preview Globe View
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1">
          You are currently in preview mode. Would you like to enable the full
          globe view?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onEnable} color="primary">
          Enable
        </Button>
        <Button onClick={onDisable} color="secondary">
          No
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

export default PreviewGlobeModal;
