// app/components/AboutOverlay.textSecondary

import React from 'react';
import { Modal, Box, Card, CardContent, Typography, Fade } from '@mui/material';
import styles from '../styles/layout.module.css';

interface AboutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutOverlay = ({ isOpen, onClose }: AboutOverlayProps) => {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      aria-labelledby="about-modal-title"
      aria-describedby="about-modal-description"
      closeAfterTransition
      BackdropProps={{
        timeout: 500,
      }}
    >
      <Fade in={isOpen}>
        <Box className={styles.aboutModal}>
          <Card className={styles.aboutCard}>
            <CardContent>
              <Typography
                variant="h4"
                component="h2"
                gutterBottom
                id="about-modal-title"
                className={styles.aboutTitle}
              >
                About MeDeMAP Navigator
              </Typography>
              <Typography
                variant="body1"
                paragraph
                id="about-modal-description"
                className={styles.aboutDescription}
              >
                M  MeDeMAP Navigator | Mapping Media Metrics | for Future Democracies
              </Typography>
              <Typography
                variant="body2"
                color="textSecondary"
                className={styles.aboutDescription}
              >
                © {new Date().getFullYear()} OeAW. All rights reserved.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Fade>
    </Modal>
  );
};

export default AboutOverlay;