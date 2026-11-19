// public/app/features/ds-elevation/ElevatedAccessPage.tsx

import { Page } from 'app/core/components/Page/Page';

import DSElevationSettings from './DSElevationSettings';

export default function ElevatedAccessPage() {
  return (
    <Page navId="ds-elevate-request">
      <Page.Contents>
        <DSElevationSettings />
      </Page.Contents>
    </Page>
  );
}
