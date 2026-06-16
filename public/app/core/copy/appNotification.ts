import { ReactElement, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { getMessageFromError } from 'app/core/utils/errors';
import { dispatch as storeDispatch } from 'app/store/store';
import { AppNotification, AppNotificationSeverity } from 'app/types/appNotifications';
import { useDispatch } from 'app/types/store';

import { notifyApp } from '../actions';

const defaultSuccessNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Success,
  icon: 'check',
};

const defaultWarningNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Warning,
  icon: 'exclamation-triangle',
};

const defaultErrorNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Error,
  icon: 'exclamation-triangle',
};

// BMC code
// const defaultInfoNotification = {
//   title: '',
//   text: '',
//   severity: AppNotificationSeverity.Info,
//   icon: 'exclamation-triangle',
// };
// Ends
export const createSuccessNotification = (title: string, text = '', traceId?: string): AppNotification => ({
  ...defaultSuccessNotification,
  title,
  text,
  id: uuidv4(),
  timestamp: Date.now(),
  showing: true,
});

export const createErrorNotification = (
  title: string,
  text: string | Error = '',
  traceId?: string,
  component?: ReactElement
): AppNotification => {
  return {
    ...defaultErrorNotification,
    text: getMessageFromError(text),
    title,
    id: uuidv4(),
    traceId,
    component,
    timestamp: Date.now(),
    showing: true,
  };
};

export const createWarningNotification = (title: string, text = '', traceId?: string): AppNotification => ({
  ...defaultWarningNotification,
  title,
  text,
  traceId,
  id: uuidv4(),
  timestamp: Date.now(),
  showing: true,
});

// BMC Code: Change, added parameter component
export const createInfoNotification = (
  title: string,
  text = '',
  traceId?: string,
  component?: ReactElement
): AppNotification => ({
  severity: AppNotificationSeverity.Info,
  icon: 'info-circle',
  title,
  text,
  id: uuidv4(),
  timestamp: Date.now(),
  showing: true,
  traceId,
  component,
});

/** Hook for showing toast notifications with varying severity (success, warning, error, info).
 * @example
 * const notifyApp = useAppNotification();
 * notifyApp.success('Success!', 'Some additional text');
 * notifyApp.warning('Warning!');
 * notifyApp.error('Error!');
 * notifyApp.info('Info text');
 */
export function useAppNotification() {
  const dispatch = useDispatch();
  return useMemo(
    () => ({
      [AppNotificationSeverity.Success]: (title: string, text = '') => {
        dispatch(notifyApp(createNotification(title, text, AppNotificationSeverity.Success)));
      },
      [AppNotificationSeverity.Warning]: (title: string, text = '', traceId?: string) => {
        dispatch(notifyApp(createNotification(title, text, AppNotificationSeverity.Warning, traceId)));
      },
      // BMC code - added bhdcode
      [AppNotificationSeverity.Error]: (title: string, text = '', bhdcode?: string, traceId?: string) => {
        dispatch(notifyApp(createNotification(title, text, AppNotificationSeverity.Error, traceId)));
        if (bhdcode) {
          console.error(`[BHDCode: ${bhdcode}] - ${title}. ${text}`);
        }
      },
      [AppNotificationSeverity.Info]: (title: string, text = '') => {
        dispatch(notifyApp(createNotification(title, text, AppNotificationSeverity.Info)));
      },
    }),
    [dispatch]
  );
}

function createNotification(
  title: string,
  text = '',
  severity: AppNotificationSeverity = AppNotificationSeverity.Success,
  traceId?: string
) {
  const map = {
    [AppNotificationSeverity.Success]: (title: string, text = '') => {
      return createSuccessNotification(title, text);
    },
    [AppNotificationSeverity.Warning]: (title: string, text = '', traceId?: string) => {
      return createWarningNotification(title, text, traceId);
    },
    [AppNotificationSeverity.Error]: (title: string, text = '', traceId?: string) => {
      return createErrorNotification(title, text, traceId);
    },
    [AppNotificationSeverity.Info]: (title: string, text = '') => {
      return createInfoNotification(title, text);
    },
  };
  return map[severity](title, text, traceId);
}

export function sendAppNotification(
  title: string,
  text = '',
  severity: AppNotificationSeverity = AppNotificationSeverity.Success
) {
  storeDispatch(notifyApp(createNotification(title, text, severity)));
}
