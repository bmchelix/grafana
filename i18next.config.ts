import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en-US'], // Only en-US  is updated - Crowdin will PR with other languages
  extract: {
    // BMC code: grafana-bmc.json is manually maintained — exclude from extraction so it doesn't get emptied
    // also exclude grafana-with-descriptions.json
    ignore: ['public/lib/monaco/**/*', 'public/app/extensions/**/*', 'public/app/plugins/datasource/**/*', 'public/locales/**/grafana-bmc.json', 'public/locales/**/grafana-with-descriptions.json'],
    input: ['public/**/*.{tsx,ts}', 'packages/grafana-ui/**/*.{tsx,ts}', 'packages/grafana-data/**/*.{tsx,ts}'],
    output: 'public/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'grafana',
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
    // BMC: preserve dynamic keys (dashboard/folder titles, notifications) — i18next-cli uses glob patterns, not regex
    preservePatterns: ['bmc.notification*'],
  },
});
