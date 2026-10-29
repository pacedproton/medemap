import React from "react";
import { Box, Typography } from "@mui/material";

interface LegendProps {
  selectedOptions: { [key: string]: any[] };
  perCountrySelections?: { [country: string]: string[] };
  style?: React.CSSProperties;
  colorPalette?: string;
  spectrumStart?: number;
  spectrumEnd?: number;
}

const Legend: React.FC<LegendProps> = ({
  selectedOptions,
  perCountrySelections = {},
  style,
  colorPalette = "default",
  spectrumStart = 120,
  spectrumEnd = 360,
}) => {
  const totalTables = Object.keys(selectedOptions).length;

  const getColorFromPalette = (tableIndex: number, totalTables: number) => {
    const t = tableIndex / (totalTables - 1 || 1);

    // Always use the selected palette, even for single indicators
    let hue: number;
    switch (colorPalette) {
      case "rainbow":
        return `hsl(${t * 300}, 70%, 50%)`; // 0 to 300 for better differentiation
      case "heat":
        return `hsl(${60 - t * 60}, 85%, ${45 + t * 25}%)`; // More saturated yellow to red
      case "cool":
        return `hsl(${180 + t * 60}, 70%, 50%)`; // Cyan to blue
      case "sunset":
        return `hsl(${30 + t * 30}, ${80 - t * 20}%, ${60 - t * 20}%)`; // Orange to purple
      case "forest":
        return `hsl(${120 + t * 60}, ${70 - t * 20}%, ${45 + t * 15}%)`; // Green to teal
      case "ocean":
        return `hsl(${200 + t * 40}, ${75 - t * 15}%, ${45 + t * 15}%)`; // Light blue to dark blue
      default:
        // Custom palette - dark yellow to blue through green
        hue = spectrumStart + t * (spectrumEnd - spectrumStart);
        return `hsl(${hue}, 85%, ${45 + t * 10}%)`; // Slightly darker and more saturated
    }
  };

  return (
    <Box
      bgcolor="rgba(255, 255, 255, 0.9)"
      p={2}
      borderRadius={2}
      style={{ ...style }}
    >
      <Typography variant="h6" gutterBottom>
        Legend
      </Typography>
      {/* Global selections */}
      {Object.entries(selectedOptions).map(([table, columns], tableIndex) =>
        columns.map((column) => {
          const color = getColorFromPalette(tableIndex, totalTables);

          return (
            <Box
              key={`global-${table}-${column.value}`}
              display="flex"
              alignItems="center"
              mb={1}
            >
              <Box
                width={30}
                height={20}
                mr={1}
                style={{
                  backgroundColor: color,
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  borderRadius: "4px",
                }}
              />
              <Typography variant="body2">{column.label}</Typography>
            </Box>
          );
        })
      )}
      
      {/* Country-specific selections (Simplified for string IDs) */}
      {Object.keys(perCountrySelections).length > 0 && Object.keys(selectedOptions).length === 0 && (
        <>
          {(() => {
            const totalCountrySelections = Object.values(perCountrySelections)
              .reduce((sum, selections) => sum + selections.length, 0);
            let globalIndex = 0;
            
            return Object.entries(perCountrySelections).map(([country, selections]) =>
              selections.map((selectionId) => {
                const color = getColorFromPalette(globalIndex, totalCountrySelections);
                const result = (
                  <Box
                    key={`country-${country}-${selectionId}`}
                    display="flex"
                    alignItems="center"
                    mb={1}
                  >
                    <Box
                      width={30}
                      height={20}
                      mr={1}
                      style={{
                        backgroundColor: color,
                        border: "1px solid rgba(0, 0, 0, 0.1)",
                        borderRadius: "4px",
                      }}
                    />
                    <Typography variant="body2">
                      {country}: {selectionId}
                    </Typography>
                  </Box>
                );
                globalIndex++;
                return result;
              })
            );
          })()}
        </>
      )}
    </Box>
  );
};

export default Legend;
