// bmc change: urldropdown for extaernal datsources (for kaazing)
import React, { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { ConfigSection } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Alert, Field, Select, Stack } from '@grafana/ui';

import { HCGServiceConfig, ResourceType, buildServiceUrl, fetchHCGServices } from './hcgService';

interface Props {
  resourceType: ResourceType;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  label?: string;
  showSection?: boolean;
  sectionTitle?: string;
}

export const HCGUrlDropdown: React.FC<Props> = ({
  resourceType,
  value,
  onChange,
  disabled = false,
  label = 'URL',
  showSection = true,
  sectionTitle = 'Connection',
}) => {
  const [services, setServices] = useState<HCGServiceConfig[]>([]);
  const [namespace, setNamespace] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);
  const isSuperAdmin = config.bootData.user.isGrafanaAdmin;
  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      setError(null);
      setServices([]);
      setNamespace(null);
      return;
    }

    const loadServices = async () => {
      setLoading(true);
      setError(null);

      try {
        // fetchHCGServices calls the backend proxy 
        const result = await fetchHCGServices(resourceType);
        if (result.error) {
          setError(result.error);
          setIsConfigured(result.isConfigured);
        }
        setServices(result.services);
        setNamespace(result.namespace);
      } catch (err: unknown) {
        console.error('Failed to load HCG services:', err);
        setError(err instanceof Error ? err.message : 'Failed to load on-premise resources');
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, [isSuperAdmin, resourceType]);

  // Build dropdown options with URLs
  // URL format: https://<serviceName>.svc.cluster.local:<servicePort>
  const options: Array<SelectableValue<string>> = services.map((service) => {
    const url = buildServiceUrl(service, namespace, resourceType);
    return {
      label: url,
      value: url,
      description: service.serviceDescription || service.resourceInfo || undefined,
    };
  });

  if (value && !options.some((opt) => opt.value === value)) {
    options.unshift({ label: value, value, description: 'Currently configured URL' });
  }

  // Find the currently selected option based on saved value
  const selectedOption = value ? options.find((opt) => opt.value === value) || { label: value, value: value } : null;

  const handleChange = (selected: SelectableValue<string>) => {
    if (selected?.value) {
      onChange(selected.value);
    }
  };

  const dropdownContent = (
    <Stack direction="column" gap={2}>
      {error && (
        <Alert
          title={isConfigured ? 'HCG Connection Error' : 'HCG Not Configured'}
          severity={isConfigured ? 'error' : 'warning'}
        >
          {error}
        </Alert>
      )}
      <Field
        label={label}
        description={isSuperAdmin ? 'Choose configuration url' : 'Current configured URL'}
        disabled={disabled}
      >
        <Select
          options={options}
          value={selectedOption}
          onChange={handleChange}
          placeholder="Select connection URL..."
          isDisabled={disabled}
          isClearable={false}
          width={60}
          noOptionsMessage="No on-premise resources available"
          isLoading={loading}
        />
      </Field>
    </Stack>
  );

  if (!showSection) {
    return dropdownContent;
  }

  return <ConfigSection title={sectionTitle}>{dropdownContent}</ConfigSection>;
};
