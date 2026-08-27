import { css } from '@emotion/css';
import { FC } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '@grafana/ui';

import { Card } from '../types';

interface Props {
  card: Card;
}

export const HelpCard: FC<Props> = ({ card }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const cardWidth = card.iconWidth ? card.iconWidth : 24;
  const cardHeight = card.iconHeight ? card.iconHeight : 24;

  return (
    <div className={styles.card}>
      <a
        className={styles.linkClass}
        href={card.href}
        target="_blank"
        rel="noreferrer"
        //BMC Accessibility Change: Added aria-label
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        aria-label={`${card.heading}: ${card.info}`}
        //BMC Accessibility Change: End
      >
        <div className={styles.cardContent}>
          <div className={styles.cardIconContainer}>
            <img src={card.icon} width={cardWidth} height={cardHeight} alt="" />
          </div>
          <div className={styles.heading}>{card.heading}</div>
          <div className={styles.info}>{card.info}</div>
        </div>
      </a>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const hoverColor = theme.isDark ? theme.palette.gray25 : theme.palette.gray95;

  return {
    card: css({
      width: '269px',
      minWidth: '269px',
      maxHeight: '200px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      '&:hover': {
        backgroundColor: hoverColor,
        opacity: 0.9,
      },
      [`@media only screen and (max-width: ${theme.breakpoints.sm})`]: {
        width: '100%',
        minWidth: '110px',
        height: '70px',
      },
    }),
    cardContent: css({
      padding: '16px 16px',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      [`@media only screen and (max-width: ${theme.breakpoints.sm})`]: {
        padding: '12px 10px',
      },
    }),
    cardIconContainer: css({
      height: '30px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    heading: css({
      fontSize: '13px',
      fontWeight: 500,
      letterSpacing: 0,
      lineHeight: '18px',
      textTransform: 'uppercase',
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      [`@media only screen and (max-width: ${theme.breakpoints.sm})`]: {
        marginBottom: 0,
      },
    }),
    info: css({
      lineHeight: '18px',
      fontSize: '13px',
      color: theme.palette.gray60,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      width: '100%',
      display: '-webkit-box !important',
      WebkitLineClamp: 5,
      WebkitBoxOrient: 'vertical',
      whiteSpace: 'normal',
      [`@media only screen and (max-width: ${theme.breakpoints.sm})`]: {
        display: 'none',
      },
    }),
    linkClass: css({
      display: 'flex',
      width: '100%',
    }),
  };
});
