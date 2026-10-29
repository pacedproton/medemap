'use client';

import React, { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../lib/hooks';
import { selectMedeMapData, fetchMedeMapData } from '../../lib/features/medemap/medeMapSlice';
import { selectLabelDisplayMode } from '../../lib/features/settings/labelDisplaySlice';
import { formatIndicatorLabel } from '../../lib/utils/labelFormatter';
import { Box, Typography, Paper } from '@mui/material';
import dynamic from 'next/dynamic';
import styles from './PCAView.module.css';
import { log, logVerbose } from '../../lib/clientlogging';
import { Matrix, EigenvalueDecomposition } from 'ml-matrix';
import { useTranslation } from 'react-i18next';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }) as any;

// --- Kernel Density Estimation Functions ---
function kernelDensityEstimator(kernel: any, data: any[]) {
        return function (x: number) {
                return (
                        (1 / data.length) *
                        data.reduce(function (sum: number, xi: number) {
                                return sum + kernel(x - xi);
                        }, 0)
                );
        };
}

function epanechnikovKernel(bandwidth: number) {
        return function (u: number) {
                u = u / bandwidth;
                if (Math.abs(u) <= 1) {
                        return (0.75 * (1 - u * u)) / bandwidth;
                } else {
                        return 0;
                }
        };
}

interface PCAData {
        labels: string[];
        pcaScores: number[][];
        explainedVariance: number[];
        loadings: number[][];
        eigenvalues: number[];
        spectralDensity: { x: number[]; y: number[] };
}

const PCAView: React.FC = () => {
        const { t } = useTranslation();
        const medeMapState = useAppSelector(selectMedeMapData);
        const labelDisplayMode = useAppSelector(selectLabelDisplayMode);
        const [pcaData, setPCAData] = useState<PCAData | null>(null);
        const [isLoading, setIsLoading] = useState(true);
        const dispatch = useAppDispatch();

        useEffect(() => {
                log('Rendering PCA View');
                logVerbose('pca', 'MedeMapState in PCA View:', medeMapState);

                if (Object.keys(medeMapState.data).length === 0) {
                        dispatch(fetchMedeMapData());
                } else {
                        processData();
                }
        }, [medeMapState, dispatch, labelDisplayMode]);

        const processData = () => {
                setIsLoading(true);
                log('Processing data for PCA');
                const { data, columnOptions } = medeMapState;

                if (Object.keys(data).length === 0) {
                        log('No data available for PCA. Skipping processing.', 'warn');
                        setIsLoading(false);
                        return;
                }

                const allIndicators: { [key: string]: number[] } = {};
                const labels: string[] = [];

                Object.entries(data).forEach(([tableName, tableData]) => {
                        if (Array.isArray(tableData) && tableData.length > 0) {
                                const columns = Object.keys(tableData[0]).filter(
                                        key => !['country', 'year'].includes(key) && !key.startsWith('meta_') && key !== 'no' && key !== 'accession'
                                );

                                columns.forEach(column => {
                                        const columnOption = columnOptions[tableName].find((opt: any) => opt.value === column);
                                        const indicatorName = formatIndicatorLabel(
                                                labelDisplayMode,
                                                columnOption || { value: column },
                                                tableName
                                        );
                                        labels.push(indicatorName);
                                        allIndicators[indicatorName] = tableData
                                                .map(item => parseFloat(item[column]) || 0)
                                                .filter(value => !isNaN(value));
                                });
                        }
                });

                // Ensure all indicator arrays are of the same length
                const minLength = Math.min(...Object.values(allIndicators).map(arr => arr.length));
                Object.keys(allIndicators).forEach(key => {
                        allIndicators[key] = allIndicators[key].slice(0, minLength);
                });

                // Helper function to calculate standard deviation
                const standardDeviation = (arr: number[]) => {
                        const n = arr.length;
                        const mean = arr.reduce((a, b) => a + b, 0) / n;
                        const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
                        return Math.sqrt(variance);
                };

                // Remove features with zero variance
                const featureNames = Object.keys(allIndicators);
                const validFeatures: string[] = [];
                const validDataArrays: number[][] = [];

                featureNames.forEach(featureName => {
                        const featureData = allIndicators[featureName];
                        const stdDev = standardDeviation(featureData);
                        if (stdDev > 0) {
                                validFeatures.push(featureName);
                                validDataArrays.push(featureData);
                        } else {
                                console.warn(`Feature ${featureName} has zero variance and will be excluded.`);
                        }
                });

                if (validFeatures.length === 0) {
                        console.error('All features have zero variance. Cannot perform PCA.');
                        setIsLoading(false);
                        return;
                }

                const dataMatrix = new Matrix(validDataArrays);

                // Transpose the matrix so that samples are rows and features are columns
                const dataMatrixTransposed = dataMatrix.transpose();

                // Standardize the data (subtract mean and divide by standard deviation)
                const mean = dataMatrixTransposed.mean('column');
                const std = dataMatrixTransposed.standardDeviation('column', { unbiased: true });

                const stdArray = std.map(s => (s === 0 ? 1 : s));

                // Subtract mean and divide by std for each column
                dataMatrixTransposed.subRowVector(mean).divRowVector(stdArray);

                // --- Affine Spectral Analysis with Eigenvalues ---

                // Compute the covariance matrix
                const covarianceMatrix = dataMatrixTransposed
                        .transpose()
                        .mmul(dataMatrixTransposed)
                        .div(dataMatrixTransposed.rows - 1);

                // Perform eigenvalue decomposition
                const eigen = new EigenvalueDecomposition(covarianceMatrix);
                const eigenvalues = eigen.realEigenvalues;
                const eigenvectors = eigen.eigenvectorMatrix.to2DArray();

                // Sort eigenvalues and eigenvectors in descending order
                const sortedIndices = eigenvalues
                        .map((value, index) => ({ value, index }))
                        .sort((a, b) => b.value - a.value)
                        .map(item => item.index);

                const sortedEigenvalues = sortedIndices.map(index => eigenvalues[index]);
                const sortedEigenvectors = sortedIndices.map(index => eigenvectors.map(row => row[index]));

                // Compute explained variance ratios
                const totalEigenvalue = sortedEigenvalues.reduce((sum, val) => sum + val, 0);
                const explainedVariance = sortedEigenvalues.map(val => val / totalEigenvalue);

                // Compute PCA scores using eigenvectors
                const pcaScoresMatrix = dataMatrixTransposed.mmul(new Matrix(sortedEigenvectors));
                const pcaScores = pcaScoresMatrix.to2DArray();

                // Compute loadings (correlations between original variables and principal components)
                const loadingsMatrix = new Matrix(sortedEigenvectors).transpose();
                const loadings = loadingsMatrix.to2DArray();

                // --- Compute Spectral Density ---
                // Define the range for eigenvalues
                const minEigenvalue = Math.min(...sortedEigenvalues);
                const maxEigenvalue = Math.max(...sortedEigenvalues);
                const eigenvalueRange = maxEigenvalue - minEigenvalue;

                // Create points where we estimate the density
                const numPoints = 100;
                const xValues = Array.from({ length: numPoints }, (_, i) => minEigenvalue + (eigenvalueRange * i) / (numPoints - 1));

                // Estimate the density using KDE
                const bandwidth = (maxEigenvalue - minEigenvalue) / 10; // Adjust bandwidth based on the range
                const kdeEstimator = kernelDensityEstimator(epanechnikovKernel(bandwidth), sortedEigenvalues);
                const densityValues = xValues.map(kdeEstimator);

                // Set the spectral density data
                const spectralDensity = { x: xValues, y: densityValues };

                // Debug logs
                console.log('Eigenvalues:', sortedEigenvalues);
                console.log('Explained Variance Ratios:', explainedVariance);
                console.log('Spectral Density:', spectralDensity);

                setPCAData({
                        labels: validFeatures,
                        pcaScores,
                        explainedVariance,
                        loadings,
                        eigenvalues: sortedEigenvalues,
                        spectralDensity,
                });
                setTimeout(() => setIsLoading(false), 100);
        };

        return (
                <Box className={styles.container}>
                        <Typography variant="h6" gutterBottom>
                                {t('Principal Component Analysis with Spectral Density')}
                        </Typography>

                        {isLoading && (
                                <Box className={styles.loadingContainer}>
                                        <Typography>{t('Loading data, please wait...')}</Typography>
                                </Box>
                        )}

                        {!isLoading && !pcaData && (
                                <Typography>{t('No data to display. Please select some indicators.')}</Typography>
                        )}

                        {!isLoading && pcaData && (
                                <>
                                        {/* PCA Scatter Plot */}
                                        <Paper
                                                elevation={3}
                                                className={styles.chartContainer}
                                                sx={{ opacity: 1, transition: 'opacity 0.5s ease-in' }}
                                        >
                                                <Plot
                                                        data={[
                                                                {
                                                                        x: pcaData.pcaScores.map(score => score[0]),
                                                                        y: pcaData.pcaScores.map(score => score[1]),
                                                                        mode: 'markers',
                                                                        type: 'scatter',
                                                                        text: pcaData.labels,
                                                                        marker: { size: 10 },
                                                                        name: t('Data Points'),
                                                                        showlegend: true,
                                                                },
                                                        ]}
                                                        layout={{
                                                                title: t('PCA: First Two Principal Components'),
                                                                xaxis: { title: t('PC1') },
                                                                yaxis: { title: t('PC2') },
                                                                legend: { orientation: 'h', x: 0, y: -0.1 },
                                                        }}
                                                        config={{
                                                                displayModeBar: true,
                                                                scrollZoom: false,
                                                                displaylogo: false,
                                                                responsive: true,
                                                        }}
                                                        className={styles.plotLarge}
                                                />
                                        </Paper>

                                        {/* Explained Variance Ratio Plot */}
                                        <Paper
                                                elevation={3}
                                                className={styles.chartContainer}
                                                sx={{ opacity: 1, transition: 'opacity 0.5s ease-in', marginTop: 4 }}
                                        >
                                                <Plot
                                                        data={[
                                                                {
                                                                        x: pcaData.explainedVariance.map((_, index) => `${t('PC')}${index + 1}`),
                                                                        y: pcaData.explainedVariance,
                                                                        type: 'bar',
                                                                        name: t('Explained Variance'),
                                                                        showlegend: true,
                                                                },
                                                        ] as any}
                                                        layout={{
                                                                title: t('Explained Variance Ratio'),
                                                                xaxis: { title: t('Principal Component') },
                                                                yaxis: { title: t('Explained Variance Ratio') },
                                                                legend: { orientation: 'h', x: 0, y: -0.1 },
                                                        }}
                                                        config={{
                                                                displayModeBar: true,
                                                                scrollZoom: false,
                                                                displaylogo: false,
                                                                responsive: true,
                                                        }}
                                                        className={styles.plotSmall}
                                                />
                                        </Paper>

                                        {/* Spectral Density Plot */}
                                        <Paper
                                                elevation={3}
                                                className={styles.chartContainer}
                                                sx={{ opacity: 1, transition: 'opacity 0.5s ease-in', marginTop: 4 }}
                                        >
                                                <Typography variant="h6" gutterBottom>
                                                        {t('Spectral Density of Eigenvalues')}
                                                </Typography>
                                                <Plot
                                                        data={[
                                                                {
                                                                        x: pcaData.spectralDensity.x,
                                                                        y: pcaData.spectralDensity.y,
                                                                        type: 'scatter',
                                                                        mode: 'lines',
                                                                        fill: 'tozeroy',
                                                                        name: t('Spectral Density'),
                                                                },
                                                        ] as any}
                                                        layout={{
                                                                title: t('Spectral Density of Eigenvalues'),
                                                                xaxis: { title: t('Eigenvalue') },
                                                                yaxis: { title: t('Density') },
                                                                legend: { orientation: 'h', x: 0, y: -0.1 },
                                                        }}
                                                        config={{
                                                                displayModeBar: true,
                                                                scrollZoom: false,
                                                                displaylogo: false,
                                                                responsive: true,
                                                        }}
                                                        className={styles.plotMedium}
                                                />
                                        </Paper>

                                        {/* Loadings Plot */}
                                        <Paper
                                                elevation={3}
                                                className={styles.chartContainer}
                                                sx={{ opacity: 1, transition: 'opacity 0.5s ease-in', marginTop: 4 }}
                                        >
                                                <Typography variant="h6" gutterBottom>
                                                        {t('Component Loadings')}
                                                </Typography>
                                                <Plot
                                                        data={pcaData.loadings.slice(0, 2).map((pcLoadings, pcIndex) => ({
                                                                x: pcaData.labels,
                                                                y: pcLoadings,
                                                                type: 'bar',
                                                                name: `${t('PC')}${pcIndex + 1}`,
                                                        })) as any}
                                                        layout={{
                                                                barmode: 'group',
                                                                title: t('Loadings of First Two Principal Components'),
                                                                xaxis: {
                                                                        title: t('Indicators'),
                                                                        tickangle: -45,
                                                                        automargin: true,
                                                                },
                                                                yaxis: { title: t('Loadings') },
                                                                legend: {
                                                                        orientation: 'h',
                                                                        y: 1.1,
                                                                        x: 0.5,
                                                                        xanchor: 'center',
                                                                        yanchor: 'bottom',
                                                                },
                                                                margin: { l: 150, r: 50, t: 150, b: 200 },
                                                        }}
                                                        config={{
                                                                displayModeBar: true,
                                                                scrollZoom: false,
                                                                displaylogo: false,
                                                                responsive: true,
                                                        }}
                                                        className={styles.plotExtraLarge}
                                                />
                                        </Paper>
                                </>
                        )}
                </Box>
        );
};

export default PCAView;