import React from 'react';
import { Box, Typography } from '@mui/material';

interface Thresholds {
  indicator: string;
  medium_low_threshold: number;
  high_medium_threshold: number;
}

const LegendSingleIndicator = ({ thresholds }: { thresholds: Thresholds }) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: '10px',
        zIndex: 1000,
      }}
    >
      <Typography variant="h6">{thresholds.indicator}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
        <Box
          sx={{
            width: '20px',
            height: '20px',
            backgroundColor: 'green',
            marginRight: '10px',
          }}
        />
        <Typography>Above {thresholds.high_medium_threshold}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
        <Box
          sx={{
            width: '20px',
            height: '20px',
            backgroundColor: 'orange',
            marginRight: '10px',
          }}
        />
        <Typography>
          Between {thresholds.medium_low_threshold} and {thresholds.high_medium_threshold}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            width: '20px',
            height: '20px',
            backgroundColor: 'red',
            marginRight: '10px',
          }}
        />
        <Typography>Below {thresholds.medium_low_threshold}</Typography>
      </Box>
    </Box>
  );
};

export default LegendSingleIndicator;