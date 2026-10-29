/**
 * LLM Provider Selector Component
 *
 * Allows users to select and configure different LLM providers
 */

"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { llmService } from '@/lib/services/llm/LLMService';
import { LLMConfigManager } from '@/lib/services/llm/LLMConfigManager';
import { LLMConfig } from '@/lib/services/llm/types';

interface LLMProviderSelectorProps {
  open: boolean;
  onClose: () => void;
  onProviderChange?: (provider: string) => void;
}

const LLMProviderSelector: React.FC<LLMProviderSelectorProps> = ({
  open,
  onClose,
  onProviderChange
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('ollama');
  const [config, setConfig] = useState<Partial<LLMConfig>>({});
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [autoFallback, setAutoFallback] = useState(true);

  const providerDefaults = LLMConfigManager.getDefaultConfigs();

  useEffect(() => {
    if (open) {
      loadCurrentConfig();
      detectProviders();
    }
  }, [open]);

  const loadCurrentConfig = async () => {
    const currentConfig = LLMConfigManager.loadConfig();
    if (currentConfig) {
      setSelectedProvider(currentConfig.primary.provider);
      setConfig(currentConfig.primary);
      setAutoFallback(currentConfig.preferences.autoFallback);
    }
  };

  const detectProviders = async () => {
    setTesting(true);
    try {
      const results = await LLMConfigManager.detectAvailableProviders();
      const resultMap: Record<string, any> = {};
      results.forEach(result => {
        resultMap[result.provider] = result;
      });
      setTestResults(resultMap);
    } catch (error) {
      console.error('Failed to detect providers:', error);
    } finally {
      setTesting(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setConfig(providerDefaults[provider] || {});
  };

  const handleConfigChange = (field: string, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const testProvider = async () => {
    if (!config.provider) return;

    setTesting(true);
    try {
      const result = await llmService.testProvider(config as LLMConfig);
      setTestResults(prev => ({
        ...prev,
        [config.provider as string]: result
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [config.provider as string]: { success: false, error: (error as Error).message }
      }));
    } finally {
      setTesting(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      const newConfig = {
        primary: config as LLMConfig,
        fallbacks: autoFallback ? Object.values(providerDefaults)
          .filter(p => p.provider !== config.provider)
          .map(p => p as LLMConfig) : [],
        preferences: {
          autoFallback,
          cacheResponses: true,
          timeoutMs: 30000
        }
      };

      LLMConfigManager.saveConfig(newConfig);
      await llmService.initialize(newConfig.primary, newConfig.fallbacks);

      onProviderChange?.(config.provider || 'none');
      onClose();
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  };

  const getProviderIcon = (provider: string) => {
    const result = testResults[provider];
    if (!result) return null;

    return result.success || result.available ? (
      <CheckCircleIcon color="success" />
    ) : (
      <ErrorIcon color="error" />
    );
  };

  const getProviderStatus = (provider: string) => {
    const result = testResults[provider];
    if (!result) return 'Unknown';

    if (result.success || result.available) {
      return `Available${result.latency ? ` (${result.latency}ms)` : ''}`;
    } else {
      return result.error || 'Not available';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SettingsIcon sx={{ mr: 1 }} />
          Configure LLM Provider
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Select and configure your preferred Language Model provider for the AI assistant.
          </Typography>

          {/* Provider Status */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Available Providers</Typography>
              <Button
                size="small"
                onClick={detectProviders}
                disabled={testing}
                startIcon={testing ? <CircularProgress size={16} /> : undefined}
              >
                Refresh
              </Button>
            </Box>

            <List dense>
              {Object.entries(providerDefaults).map(([provider, defaults]) => (
                <ListItem key={provider}>
                  <ListItemButton
                    selected={selectedProvider === provider}
                    onClick={() => handleProviderChange(provider)}
                  >
                    <ListItemIcon>
                      {getProviderIcon(provider)}
                    </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="subtitle2">
                          {provider.toUpperCase()}
                        </Typography>
                        <Chip
                          size="small"
                          label={defaults.model}
                          sx={{ ml: 1 }}
                        />
                      </Box>
                    }
                    secondary={getProviderStatus(provider)}
                  />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Configuration */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Configuration</Typography>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
              <FormControl fullWidth>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={selectedProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  label="Provider"
                >
                  {Object.keys(providerDefaults).map(provider => (
                    <MenuItem key={provider} value={provider}>
                      {provider.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Model"
                value={config.model || ''}
                onChange={(e) => handleConfigChange('model', e.target.value)}
                fullWidth
              />

              <TextField
                label="Base URL"
                value={config.baseUrl || ''}
                onChange={(e) => handleConfigChange('baseUrl', e.target.value)}
                fullWidth
              />

              {(selectedProvider === 'openai' || selectedProvider === 'claude') && (
                <TextField
                  label="API Key"
                  type="password"
                  value={config.apiKey || ''}
                  onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                  fullWidth
                  helperText="Your API key will be stored locally"
                />
              )}

              <TextField
                label="Temperature"
                type="number"
                value={config.temperature || 0.1}
                onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                inputProps={{ min: 0, max: 2, step: 0.1 }}
                fullWidth
              />

              <TextField
                label="Max Tokens"
                type="number"
                value={config.maxTokens || 4000}
                onChange={(e) => handleConfigChange('maxTokens', parseInt(e.target.value))}
                fullWidth
              />
            </Box>

            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoFallback}
                    onChange={(e) => setAutoFallback(e.target.checked)}
                  />
                }
                label="Enable automatic fallback to other providers"
              />
            </Box>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                onClick={testProvider}
                disabled={testing || !config.provider}
                startIcon={testing ? <CircularProgress size={16} /> : undefined}
              >
                Test Connection
              </Button>
            </Box>

            {testResults[selectedProvider] && (
              <Alert
                severity={testResults[selectedProvider].success ? 'success' : 'error'}
                sx={{ mt: 2 }}
              >
                {testResults[selectedProvider].success
                  ? `Connection successful! (${testResults[selectedProvider].latency}ms)`
                  : `Connection failed: ${testResults[selectedProvider].error}`
                }
              </Alert>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={saveConfiguration}
          disabled={!config.provider}
        >
          Save Configuration
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LLMProviderSelector;