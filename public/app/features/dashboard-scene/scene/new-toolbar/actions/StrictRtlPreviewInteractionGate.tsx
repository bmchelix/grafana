import { useCallback, useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { ConfirmModal } from '@grafana/ui';

import {
  STRICT_RTL_EXEMPT_ATTR,
  exitStrictRtlPreview,
  isStrictEditorRtlPreviewActive,
} from './ForceRtlPreviewToggle';

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="option"]',
  '[role="combobox"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * BMC Change: Strict RTL preview interaction gate.
 *
 * When the editor/admin has enabled forceRTL preview, this component intercepts all
 * pointer and keyboard activation events (capture phase) on interactive controls.
 * If the target is not inside an exempt subtree (the RTL toggle itself or this modal),
 * it blocks the event and shows a confirm modal offering to exit RTL preview.
 */
export function StrictRtlPreviewInteractionGate() {
  const [showModal, setShowModal] = useState(false);

  const handleCapture = useCallback(
    (event: PointerEvent | MouseEvent | KeyboardEvent) => {
      if (!isStrictEditorRtlPreviewActive()) {
        return;
      }

      if (showModal) {
        return;
      }

      if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const interactive = target.closest(INTERACTIVE_SELECTOR);
      if (!interactive) {
        return;
      }

      if (interactive.closest(`[${STRICT_RTL_EXEMPT_ATTR}]`)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setShowModal(true);
    },
    [showModal]
  );

  useEffect(() => {
    if (!isStrictEditorRtlPreviewActive()) {
      return;
    }

    const opts: AddEventListenerOptions = { capture: true };

    document.addEventListener('pointerdown', handleCapture, opts);
    document.addEventListener('mousedown', handleCapture, opts);
    document.addEventListener('click', handleCapture, opts);
    document.addEventListener('keydown', handleCapture, opts);

    return () => {
      document.removeEventListener('pointerdown', handleCapture, opts);
      document.removeEventListener('mousedown', handleCapture, opts);
      document.removeEventListener('click', handleCapture, opts);
      document.removeEventListener('keydown', handleCapture, opts);
    };
  }, [handleCapture]);

  if (!showModal) {
    return null;
  }

  return (
    <ConfirmModal
      isOpen
      icon="exclamation-triangle"
      title={t('dashboard.strict-rtl-preview.modal-title', 'Strict RTL view mode')}
      body={t(
        'dashboard.strict-rtl-preview.modal-body',
        'You are in strict RTL layout preview. All actions are disabled. To interact with the dashboard, turn off RTL preview first. The page will reload.'
      )}
      confirmText={t('dashboard.strict-rtl-preview.modal-confirm', 'Turn off RTL preview')}
      dismissText={t('dashboard.strict-rtl-preview.modal-cancel', 'Stay in RTL preview')}
      onConfirm={exitStrictRtlPreview}
      onDismiss={() => setShowModal(false)}      
    />
  );
}
