// BMC File
// Co Authored by : kchidrawar, ymulthan
import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { DEFAULT_LANGUAGE, t, Trans } from '@grafana/i18n';
import { Button, Field, Input, Select, useStyles2 } from '@grafana/ui';

import { getLocalizationSrv } from '../dashboard/services/LocalizationSrv';

import { LanguageCode, LanguageOptions } from './types';

const FolderLocaleSettings = ({ resourceUID, folderName }: { resourceUID: string; folderName: string }) => {
  const styles = useStyles2(getStyles);
  const [language, setLanguage] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [value, setValue] = useState<string>();
  const [loading, setLoading] = useState<boolean>(true);

  const onSave = async () => {
    if (!value) {
      return;
    }
    setLoading(true);
    try {
      await getLocalizationSrv().SaveLocalesJsonByLang(resourceUID, language, { name: value });
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (value: LanguageCode) => {
    setLanguage(value);
  };

  const handleValueChange = (value: string) => {
    setValue(value);
  };

  const getLocalizedValue = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLocalizationSrv().GetLocalesJsonByLangAndUID(resourceUID, language);
      setValue(result.name ?? '');
    } catch (error) {
      console.error('Failed to fetch localized value:', error);
    } finally {
      setLoading(false);
    }
  }, [resourceUID, language]);

  useEffect(() => {
    getLocalizedValue();
  }, [getLocalizedValue]);

  return (
    <div className={styles.form}>
      <div className={styles.header}>
        <Select
          className={styles.select}
          options={LanguageOptions()}
          onChange={(e) => handleLanguageChange(e.value as LanguageCode)}
          value={language}
          width={25}
        />
      </div>
      {/* eslint-disable-next-line no-restricted-syntax */}
      <Field label={t('bmc.manage-locales.folders.folder-title', 'Folder title')}>
        <Input
          type="text"
          onChange={(e) => handleValueChange(e.currentTarget.value)}
          value={value}
          placeholder={folderName}
          loading={loading}
        />
      </Field>
      <Button onClick={() => onSave()} variant="primary" disabled={loading}>
        <Trans i18nKey="bmc.common.save">Save</Trans>
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  form: css({
    position: 'relative',
    paddingTop: 70,
    textAlign: 'left',
  }),
  header: css({
    display: 'flex',
    position: 'absolute',
    top: 10,
    right: 10,
    justifyContent: 'space-between',
    alignItems: 'right',
    width: '100%',
  }),
  select: css({
    height: 30,
    marginLeft: 10,
    padding: 6,
    border: '1px solid #ccc',
    borderRadius: theme.shape.radius.default,
    fontSize: 14,
    fontWeight: 'bold',
  }),
});

export default FolderLocaleSettings;
