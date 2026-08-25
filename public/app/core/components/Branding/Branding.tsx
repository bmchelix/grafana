import { css, cx } from '@emotion/css';
import { FC } from 'react';

import { colorManipulator } from '@grafana/data';
import { Icon, useTheme2 } from '@grafana/ui';
import g8LoginDarkSvg from 'img/g8_login_dark.svg';
import g8LoginLightSvg from 'img/g8_login_light.svg';
import grafanaIconSvg from 'img/grafana_icon.svg';

export interface BrandComponentProps {
  className?: string;
  children?: JSX.Element | JSX.Element[];
}

export const LoginLogo: FC<BrandComponentProps & { logo?: string }> = ({ className, logo }) => {
  return <img className={className} src={`${logo ? logo : grafanaIconSvg}`} alt="Grafana" />;
};

const LoginBackground: FC<BrandComponentProps> = ({ className, children }) => {
  const theme = useTheme2();

  const background = css({
    '&:before': {
      content: '""',
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      top: 0,
      background: `url(${theme.isDark ? g8LoginDarkSvg : g8LoginLightSvg})`,
      backgroundPosition: 'top center',
      backgroundSize: 'auto',
      backgroundRepeat: 'no-repeat',

      opacity: 0,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 3s ease-in-out',
      },

      [theme.breakpoints.up('md')]: {
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      },
    },
  });

  return <div className={cx(background, className)}>{children}</div>;
};

const MenuLogo: FC<BrandComponentProps> = ({ className }) => {
  // BMC code - next line
  return <Icon className={className} name="bmc-home" size="xl" />;
};

const LoginBoxBackground = () => {
  const theme = useTheme2();
  return css({
    background: colorManipulator.alpha(theme.colors.background.primary, 0.7),
    backgroundSize: 'cover',
  });
};

export class Branding {
  static LoginLogo = LoginLogo;
  static LoginBackground = LoginBackground;
  static MenuLogo = MenuLogo;
  static LoginBoxBackground = LoginBoxBackground;
  // BMC code - inline change
  static AppTitle = 'BMC Helix Dashboards';
  static LoginTitle = 'Welcome to BMC Helix Dashboards';
  // End
  static HideEdition = false;
  static GetLoginSubTitle = (): null | string => {
    return null;
  };
}
