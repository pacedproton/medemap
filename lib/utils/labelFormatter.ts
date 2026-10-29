import { LabelDisplayMode } from '@/lib/features/settings/labelDisplaySlice';

/**
 * Formats indicator labels based on the display mode
 * @param mode - 'formatted' for human-readable labels, 'raw' for database column names
 * @param column - The column object containing value, label, and thresholds
 * @param tableName - Optional table name for formatted display
 * @returns Formatted label string
 */
export const formatIndicatorLabel = (
  mode: LabelDisplayMode,
  column: any,
  tableName?: string
): string => {
  if (mode === 'raw') {
    // Return the raw database column name
    return column.value || '';
  }

  // Return formatted label
  const indicator = column.thresholds?.indicator || column.label || column.value;
  return indicator;
};

/**
 * Formats the full title including table name and indicators
 * @param mode - 'formatted' for human-readable labels, 'raw' for database column names
 * @param tableName - The name of the table
 * @param columns - Array of column objects
 * @param getTableDisplayName - Function to get formatted table name
 * @returns Formatted title string
 */
export const formatChartTitle = (
  mode: LabelDisplayMode,
  tableName: string,
  columns: any[],
  getTableDisplayName?: (name: string) => string
): string => {
  if (mode === 'raw') {
    // For raw mode, show table name and raw column names
    const columnNames = columns.map(col => col.value).join(' | ');
    return columnNames;
  }

  // For formatted mode, use the existing logic
  const formattedTableName = getTableDisplayName ? getTableDisplayName(tableName) : tableName;
  const indicators = columns
    .map((column: any) => {
      const thresholds = column.thresholds || {};
      return thresholds.indicator || column.label;
    })
    .join(' | ');

  return `${formattedTableName} : ${indicators}`;
};