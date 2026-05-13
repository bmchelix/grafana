import { FC } from 'react';

import { Trans } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';

export interface Props {
  canEdit?: boolean;
}

export const ListActions: FC<Props> = ({ canEdit }) => {
  const actionUrl = (type: string) => {
    return `calculated-fields/${type}`;
  };

  return (
    <Stack direction="row" gap={2} alignItems="center">
      {canEdit && (
        <LinkButton href={actionUrl('new')} onClick={() => {}}>
          <Trans i18nKey="bmc.calc-fields.new-field">New Calculated Field</Trans>
        </LinkButton>
      )}
    </Stack>
  );
};
