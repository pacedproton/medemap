"use client";

import React, { useState, useCallback, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { GridApi, GridReadyEvent, GridOptions, ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchMedeMapData,
  selectMedeMapData,
} from "@/lib/features/medemap/medeMapSlice";
import { selectLabelDisplayMode } from "@/lib/features/settings/labelDisplaySlice";
import { formatIndicatorLabel } from "@/lib/utils/labelFormatter";
import { useTranslation } from "react-i18next";
import { useContextMenu } from "react-contexify";
import ContextMenu from "./ContextMenu";
import styles from "@/styles/TableView.module.css";
import { getTableOrder, getTableDisplayName } from "../lib/config";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const TableView = () => {
  const dispatch = useDispatch();
  const medeMapState = useSelector(selectMedeMapData);
  const labelDisplayMode = useSelector(selectLabelDisplayMode);
  const { show } = useContextMenu({ id: "context-menu" });
  const { t } = useTranslation();
  const [gridApiMap, setGridApiMap] = useState<{ [key: string]: GridApi }>({});
  const [activeTable, setActiveTable] = useState<string | null>(null);

  React.useEffect(() => {
    dispatch(fetchMedeMapData() as any);
  }, [dispatch]);

  const onGridReady = useCallback(
    (params: GridReadyEvent, tableName: string) => {
      setGridApiMap((prevState) => ({
        ...prevState,
        [tableName]: params.api,
      }));
      params.api.sizeColumnsToFit();
      // In ag-grid v35+, autoSizeAllColumns might be accessed differently
      if (params.api.autoSizeAllColumns) {
        params.api.autoSizeAllColumns();
      } else if ((params.api as any).columnApi?.autoSizeAllColumns) {
        (params.api as any).columnApi.autoSizeAllColumns();
      }
    },
    []
  );

  const handleContextMenu = (
    event: React.MouseEvent<HTMLDivElement>,
    tableName: string
  ) => {
    event.preventDefault();
    setActiveTable(tableName);
    show({ event });
  };

  const handleCopy = () => {
    if (activeTable && gridApiMap[activeTable]) {
      const gridApi = gridApiMap[activeTable];
      
      // Get only selected rows
      const selectedRows = gridApi.getSelectedRows();
      
      if (selectedRows.length === 0) {
        alert("No rows selected. Please select rows first by clicking on them.");
        return;
      }

      const csvContent = convertToCSV(selectedRows);

      // Check if clipboard API is available (requires HTTPS or localhost)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(csvContent)
          .then(() => {
            console.log(`${selectedRows.length} selected rows from ${activeTable} copied to clipboard`);
          })
          .catch((err) => {
            console.error("Failed to copy table data: ", err);
            alert("Copy failed. Please use Ctrl+C manually.");
          });
      } else {
        // Fallback for non-HTTPS contexts
        console.warn("Clipboard API not available. Using fallback.");
        const textArea = document.createElement("textarea");
        textArea.value = csvContent;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
          console.log(`${selectedRows.length} selected rows from ${activeTable} copied to clipboard (fallback)`);
        } catch (err) {
          console.error("Fallback copy failed: ", err);
          alert("Copy failed. Please select and copy manually.");
        }
        document.body.removeChild(textArea);
      }
    }
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return "";

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).join(","));
    return [headers, ...rows].join("\n");
  };

  const gridOptions: GridOptions = useMemo(
    () => ({
      theme: "legacy", // Use v32 CSS-based themes to work with ag-grid.css
    }),
    []
  );

  const tables = getTableOrder();

  const defaultColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
      filter: false,
      minWidth: 100,
    }),
    []
  );

  return (
    <div className={styles.tableContainer}>
      <h1 className={styles.tableTitle}>{t("Table View")}</h1>
      <p className={styles.exportNote}>
        {t(
          "Right-click anywhere on the table to copy its data as CSV to clipboard"
        )}
      </p>
      {tables.map((tableName) => {
        const tableData = medeMapState.data[tableName] || [];
        const columnDefs = [...(medeMapState.columnOptions[tableName] || [])]
          .sort((a, b) => {
            const columnOrder = medeMapState.columnOrder[tableName] || [];
            return columnOrder.indexOf(a.value) - columnOrder.indexOf(b.value);
          })
          .filter((col) => !col.value.startsWith("meta_"))
          .map((col) => ({
            field: col.value,
            headerName: formatIndicatorLabel(labelDisplayMode, col),
            valueFormatter: (params: any) => {
              if (params.value == null) return '';
              const numValue = Number(params.value);
              if (!isNaN(numValue)) {
                // If value is between 0 and 1, it's likely an index/ratio - preserve decimals
                if (numValue >= 0 && numValue <= 1) {
                  return numValue.toFixed(3);
                }
                // Otherwise display as whole number
                return Math.round(numValue).toString();
              }
              return params.value;
            },
          }));

        const filteredTableData = tableData.map((row: any) => {
          const filteredRow: Record<string, any> = {};
          Object.keys(row).forEach((key) => {
            if (!key.startsWith("meta_")) {
              filteredRow[key] = row[key];
            }
          });
          return filteredRow;
        });

        return (
          <div key={tableName} className={styles.agGridWrapper}>
            <div className={styles.tableHeader}>
              <h2 className={styles.tableTitle}>
                {t(getTableDisplayName(tableName))}
              </h2>
            </div>
            <div
              className={`ag-theme-alpine ${styles.fullWidthGrid}`}
              onContextMenu={(event) => handleContextMenu(event, tableName)}
            >
              <ContextMenu onCopy={handleCopy} onExportCsv={() => {
                if (activeTable && gridApiMap[activeTable]) {
                  const gridApi = gridApiMap[activeTable];
                  const rowData: any[] = [];
                  gridApi.forEachNodeAfterFilterAndSort((node) => {
                    if (node.data) {
                      rowData.push(node.data);
                    }
                  });
                  const csvContent = convertToCSV(rowData);
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `${activeTable}_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                }
              }} />
              <AgGridReact
                columnDefs={columnDefs}
                rowData={filteredTableData}
                onGridReady={(params) => onGridReady(params, tableName)}
                defaultColDef={defaultColDef}
                rowSelection={{
                  mode: "multiRow",
                  checkboxes: true,
                  headerCheckbox: true,
                }}
                gridOptions={gridOptions}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TableView;
