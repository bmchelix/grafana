import { useEffect } from 'react';

import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import {
  AdvancedHttpSettings,
  Auth,
  AuthMethod,
  ConfigSection,
  ConnectionSettings,
  convertLegacyAuthProps,
  DataSourceDescription,
} from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Alert, SecureSocksProxySettings, Divider, Stack } from '@grafana/ui';

import { HCGUrlDropdown } from '../../hcg/HCGUrlDropdown';  //bmc code change
import { ElasticsearchOptions } from '../types';

import { DataLinks } from './DataLinks';
import { ElasticDetails } from './ElasticDetails';
import { LogsConfig } from './LogsConfig';
import { coerceOptions, isValidOptions } from './utils';

export type Props = DataSourcePluginOptionsEditorProps<ElasticsearchOptions>;

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  // bmc code : starts
  const isGrafanaAdmin = config.bootData.user.isGrafanaAdmin;
  const isExternalDSUrlDropdownEnabled = config.isExternalDSUrlDropdownEnabled === true;
  if (!isGrafanaAdmin) {
    options.url = '********';
  }
  // bmc code : ends
  useEffect(() => {
    if (!isValidOptions(options)) {
      onOptionsChange(coerceOptions(options));
    }
  }, [onOptionsChange, options]);

  // BMC HCG: Handler for URL selection from dropdown
  const handleUrlChange = (url: string) => {
    onOptionsChange({
      ...options,
      url: url,
    });
  };
//end
  const authProps = convertLegacyAuthProps({
    config: options,
    onChange: onOptionsChange,
  });
  if (config.sigV4AuthEnabled) {
    authProps.customMethods = [
      {
        id: 'custom-sigv4',
        label: 'SigV4 auth',
        description: 'AWS Signature Version 4 authentication',
        component: <SIGV4ConnectionConfig inExperimentalAuthComponent={true} {...props} />,
      },
    ];
    authProps.selectedMethod = options.jsonData.sigV4Auth ? 'custom-sigv4' : authProps.selectedMethod;
  }

  return (
    <>
      {options.access === 'direct' && (
        <Alert title="Error" severity="error">
          Browser access mode in the Elasticsearch datasource is no longer available. Switch to server access mode.
        </Alert>
      )}
      <DataSourceDescription
        dataSourceName="Elasticsearch"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/elasticsearch"
        hasRequiredFields={false}
      />
      <Divider spacing={4} />
         {/* bmc code change */}
      {isExternalDSUrlDropdownEnabled ? (
        <HCGUrlDropdown
          resourceType="elasticsearch"
          value={options.url}
          onChange={handleUrlChange}
          disabled={!isGrafanaAdmin}
        />
      ) : (
        <ConnectionSettings
          urlPlaceholder="http://localhost:9200"
          config={{ ...options, readOnly: !isGrafanaAdmin }}
          onChange={onOptionsChange}
          urlLabel="Server URL"
        />
      )}
       {/* end */}
      <Divider spacing={4} />
      <Auth
        {...authProps}
        onAuthMethodSelect={(method) => {
          onOptionsChange({
            ...options,
            basicAuth: method === AuthMethod.BasicAuth,
            withCredentials: method === AuthMethod.CrossSiteCredentials,
            jsonData: {
              ...options.jsonData,
              sigV4Auth: method === 'custom-sigv4',
              oauthPassThru: method === AuthMethod.OAuthForward,
            },
          });
        }}
      />
      <Divider spacing={4} />
      <ConfigSection
        title="Additional settings"
        description="Additional settings are optional settings that can be configured for more control over your data source."
        isCollapsible={true}
        isInitiallyOpen
      >
        <Stack gap={5} direction="column">
          <AdvancedHttpSettings config={options} onChange={onOptionsChange} />
          {config.secureSocksDSProxyEnabled && (
            <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
          )}
          <ElasticDetails value={options} onChange={onOptionsChange} />
          <LogsConfig
            value={options.jsonData}
            onChange={(newValue) =>
              onOptionsChange({
                ...options,
                jsonData: newValue,
              })
            }
          />
          <DataLinks
            value={options.jsonData.dataLinks}
            onChange={(newValue) => {
              onOptionsChange({
                ...options,
                jsonData: {
                  ...options.jsonData,
                  dataLinks: newValue,
                },
              });
            }}
          />
        </Stack>
      </ConfigSection>
    </>
  );
};
