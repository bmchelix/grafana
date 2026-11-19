import {
  detectScriptFromItems,
  loadAndRegisterFont as sdkLoadAndRegisterFont,
  loadAndRegisterBarcode as sdkLoadAndRegisterBarcode,
  FontContentLoader,
  Script,
} from 'adereporting-node-sdk';
import jsPDF from 'jspdf';

import { isMultilingualPdfEnabled } from '@grafana/data/internal';

/** True when the signed-in user's UI language is Arabic (e.g. ar, ar-AR). Used to load Arabic PDF fonts without `multilingualPdf` URL. */
/** Primary language for PDF date strings from Accept-Language (first tag). */
export function resolvePdfLocaleForPdf(locale?: string): string {
  if (locale) {
    return locale.split('-')[0];
  }
  return 'en';
}

const contentLoader: FontContentLoader = (fileName) => {
  const baseName = fileName.replace('.ttf', '');
  return import(/* webpackChunkName: "fonts/[request]" */ `./fontsBase64/${baseName}`).then((module) => module.default);
};

export const loadAndRegisterFont = (doc: jsPDF, detectedScript: Script): Promise<string | null> =>
  sdkLoadAndRegisterFont(doc, detectedScript, contentLoader);

export const loadAndRegisterBarcode = (doc: jsPDF): Promise<void> => sdkLoadAndRegisterBarcode(doc, contentLoader);

export const getMultilingualFont = async (
  doc: jsPDF,
  contentItems: string[],
  scriptFromCSV: Script | null = null,
  isArabicPDF?: boolean
): Promise<string | null> => {
  if (!(isMultilingualPdfEnabled() || isArabicPDF)) {
    return null;
  }

  let detectedScript = scriptFromCSV;
  if (!detectedScript || detectedScript === 'latin') {
    detectedScript = detectScriptFromItems(contentItems);
  }
  if ((!detectedScript || detectedScript === 'latin') && isArabicPDF) {
    detectedScript = 'arabic';
  }

  if (detectedScript && detectedScript !== 'latin') {
    return await loadAndRegisterFont(doc, detectedScript);
  }

  return null;
};
