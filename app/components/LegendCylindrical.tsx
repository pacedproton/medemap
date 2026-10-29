import React from 'react';
import { Box, Typography } from '@mui/material';

interface Thresholds {
  low_threshold: number | null;
  medium_threshold: number | null;
  high_threshold: number | null;
}

interface ColumnOption {
  value: string;
  label: string;
  thresholds?: Thresholds;
}

interface LegendProps {
  selectedOptions: { [key: string]: any[] };
  columnOptions: { [key: string]: ColumnOption[] };
  style?: React.CSSProperties;
  className?: string;
}

const Legend: React.FC<LegendProps> = ({ selectedOptions, columnOptions, style, className }) => {
  console.log('Legend selectedOptions:', selectedOptions);
  console.log('Legend columnOptions:', columnOptions);

  return (
    <Box
      bgcolor="rgba(255, 255, 255, 0.8)"
      p={2}
      borderRadius={2}
      style={{ ...style, zIndex: 1000 }}
      className={className}
    >
      <Typography variant="h6" gutterBottom>Legend</Typography>
      {Object.entries(selectedOptions).map(([tableName, columns]) => (
        <Box key={tableName} mb={2}>
          <Typography variant="subtitle1">{tableName}</Typography>
          {columns.map((column: any) => {
            const columnOption = columnOptions[tableName].find(opt => opt.value === column.value);
            const thresholds = columnOption?.thresholds;
            return (
              <Box key={column.value} mt={1}>
                <Typography variant="body2">{column.label}</Typography>
                {thresholds ? (
                  <>
                    <Box display="flex" alignItems="center" mb={0.5}>
                      <Box width={20} height={20} bgcolor="blue" mr={1} />
                      <Typography variant="caption">{`> ${thresholds.high_threshold}`}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" mb={0.5}>
                      <Box width={20} height={20} bgcolor="green" mr={1} />
                      <Typography variant="caption">{`${thresholds.medium_threshold} - ${thresholds.high_threshold}`}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center">
                      <Box width={20} height={20} bgcolor="red" mr={1} />
                      <Typography variant="caption">{`< ${thresholds.medium_threshold}`}</Typography>
                    </Box>
                  </>
                ) : (
                  <Typography variant="caption">No threshold data available</Typography>
                )}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};

export default Legend;