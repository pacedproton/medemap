import React, { useState, useEffect } from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import styles from '../styles/SplashScreen.module.css';

interface SplashScreenProps {
  onFinished: () => void;
}

const SplashScreen = ({ onFinished }: SplashScreenProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress === 100) {
          clearInterval(timer);
          setTimeout(() => onFinished(), 500); // Delay to show 100% briefly
          return 100;
        } 
        const diff = Math.random() * 10;
        return Math.min(oldProgress + diff, 100);
      });
    }, 50);

    return () => {
      clearInterval(timer);
    };
  }, [onFinished]);

  return (
    <Box className={styles.splashScreen}>
      <Typography variant="h2" className={styles.title}>
        MeDeMAP
      </Typography>
      <Typography variant="h5" className={styles.subtitle}>
        Mapping Media for Future Democracies
      </Typography>
      <Box mb={2}></Box>
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        className={styles.progressBar}
      />
    </Box>
  );
};

export default SplashScreen;