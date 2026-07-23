import { css } from '@emotion/css';
import { FC } from 'react';

import { GrafanaTheme, PanelProps } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { stylesFactory, useTheme } from '@grafana/ui';
import { getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';
import bmcHelixDarkSvg from 'img/bmc_helix_dark.svg';
import bmcHelixLightSvg from 'img/bmc_helix_light.svg';

import { HelpCards } from './HelpCards';
import { Options } from './types';

export interface BMCWelcomeBannerProps extends PanelProps<Options> {}

export const BMCWelcomeBanner: FC<BMCWelcomeBannerProps> = ({ options }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const bmcHelixLogoForLightTheme = 'logo-helix';
  const bmcHelixLogoForDarkTheme = 'logo-helix logo-light';
  const bmcHelixLogo = theme.isDark ? bmcHelixLogoForDarkTheme : bmcHelixLogoForLightTheme;

  const defaultBMCHelixLogo = theme.isDark ? bmcHelixDarkSvg : bmcHelixLightSvg;

  const featureFlagged = getFeatureStatus('branding');
  return (
    <div className={styles.container}>
      <div className={styles.logoContainer}>
        <div
          id="bmcHelixLogoTitle"
          className={featureFlagged ? bmcHelixLogo : styles.logo}
          style={{
            width: '110px',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center right',
            ...(!featureFlagged ? { backgroundImage: `url(${defaultBMCHelixLogo})` } : {}),
          }}
          aria-labelledby="bmcHelixLogoTitle"
        >
          <title id="bmcHelixLogoTitle">
            <Trans i18nKey="bmc.panel.bmc-welcome.logo-title">BMC Helix Logo</Trans>
          </title>
        </div>
        <div className={styles.logoText}>
          <Trans i18nKey="bmc.welcome.dashboards"> Dashboards</Trans>
        </div>
      </div>
      <div className={styles.help}>
        <HelpCards options={options} />
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css({
      display: 'flex',
      backgroundSize: 'cover',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
      [`@media only screen and (max-width: ${theme.breakpoints.sm})`]: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        paddingBottom: theme.spacing.xs,
      },
    }),
    logoText: css({
      fontSize: '1.3125rem',
      lineHeight: '1.875rem',
      fontWeight: 200,
      padding: '0 10px',
      fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
    }),
    logoContainer: css({
      display: 'flex',
      flex: '0 0 auto',
      flexFlow: 'row',
      paddingRight: 15,
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.3125rem',
      lineHeight: '1.875rem',
      [`@media only screen and (max-width: ${theme.breakpoints.sm})`]: {
        margin: `${theme.spacing.xl} 0 0 0`,
      },
    }),
    logo: css({
      marginRight: 5,
      ':before': {
        content: "''",
        width: 'inherit',
        display: 'inline-block',
        verticalAlign: 'bottom',
      },
    }),
    help: css({
      display: 'flex',
      overflowX: 'auto',
      overflowY: 'hidden',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginTop: 10,
      [`@media only screen and (max-width: ${theme.breakpoints.sm})`]: {
        width: '100%',
      },
    }),
  };
});
