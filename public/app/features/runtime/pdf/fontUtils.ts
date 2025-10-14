import jsPDF from 'jspdf';

import { detectScript, isMultilingualPdfEnabled } from '@grafana/data/src/utils/scriptUtils';

import { FontOptions, Script } from './types';

// Font-specific methods for lazy loading
const fontLoaders = {
  loadFont: (fontPath: string) =>
    import(/* webpackChunkName: "fonts/[request]" */ `./fontsBase64/${fontPath}`).then((module) => module.default),
};

// Helper function to create font entries with lazy loading
const createFontEntry = (
  fontName: string,
  fileName: string,
  fontPath: string,
  fontStyle: 'normal' | 'bold' | 'italic'
): FontOptions => ({
  fontName,
  fileName,
  getFileContent: () => fontLoaders.loadFont(fontPath),
  fontStyle,
});

// Fonts map with font entries
export const fontsMap: Record<string, FontOptions | undefined> = {
  latin: undefined,
  latinEx: undefined,
  barcode: createFontEntry('c39hrp24dhtt', 'c39hrp24dhtt.ttf', 'c39hrp24dhtt', 'normal'),
  greek: createFontEntry('NotoSans', 'NotoSans-Regular.ttf', 'NotoSans-Regular', 'normal'),
  greekBold: createFontEntry('NotoSans', 'NotoSans-Bold.ttf', 'NotoSans-Bold', 'bold'),
  cyrillic: createFontEntry('NotoSans', 'NotoSans-Regular.ttf', 'NotoSans-Regular', 'normal'),
  cyrillicBold: createFontEntry('NotoSans', 'NotoSans-Bold.ttf', 'NotoSans-Bold', 'bold'),
  thai: createFontEntry('NotoSansThai', 'NotoSansThai-Regular.ttf', 'NotoSansThai-Regular', 'normal'),
  thaiBold: createFontEntry('NotoSansThai', 'NotoSansThai-Bold.ttf', 'NotoSansThai-Bold', 'bold'),
  arabic: createFontEntry('NotoSansArabic', 'NotoSansArabic-Regular.ttf', 'NotoSansArabic-Regular', 'normal'),
  arabicBold: createFontEntry('NotoSansArabic', 'NotoSansArabic-Bold.ttf', 'NotoSansArabic-Bold', 'bold'),
  hebrew: createFontEntry('NotoSansHebrew', 'NotoSansHebrew-Regular.ttf', 'NotoSansHebrew-Regular', 'normal'),
  hebrewBold: createFontEntry('NotoSansHebrew', 'NotoSansHebrew-Bold.ttf', 'NotoSansHebrew-Bold', 'bold'),
  chinese: createFontEntry('NotoSansSC', 'NotoSansSC-Regular.ttf', 'NotoSansSC-Regular', 'normal'),
  chineseBold: createFontEntry('NotoSansSC', 'NotoSansSC-Bold.ttf', 'NotoSansSC-Bold', 'bold'),
  japanese: createFontEntry('NotoSansJP', 'NotoSansJP-Regular.ttf', 'NotoSansJP-Regular', 'normal'),
  japaneseBold: createFontEntry('NotoSansJP', 'NotoSansJP-Bold.ttf', 'NotoSansJP-Bold', 'bold'),
  korean: createFontEntry('NotoSansKR', 'NotoSansKR-Regular.ttf', 'NotoSansKR-Regular', 'normal'),
  koreanBold: createFontEntry('NotoSansKR', 'NotoSansKR-Bold.ttf', 'NotoSansKR-Bold', 'bold'),
};

// Detect script for items
export const detectScriptForItems = (items: string[]): Script | null => {
  for (const item of items) {
    if (item) {
      const detectedScript = detectScript(item); // Use shared utility
      if (detectedScript) {
        return detectedScript; // Return the first detected non-Latin script
      }
    }
  }
  return null;
};

// Get font for a detected script
export const getFontForScript = (detectedScript: Script): FontOptions | null => {
  return fontsMap[detectedScript] || null;
};

export const registerFont = (font: FontOptions, doc: jsPDF) => {
  doc.addFileToVFS(font.fileName, font.fileContent!);
  doc.addFont(font.fileName, font.fontName, font.fontStyle);
};

export const loadAndRegisterFont = async (doc: jsPDF, detectedScript: Script): Promise<string | null> => {
  const font = getFontForScript(detectedScript);
  if (font) {
    const fileContent = await font.getFileContent();
    registerFont({ ...font, fileContent }, doc);
    const boldFont = getFontForScript(`${detectedScript}Bold` as Script);
    if (boldFont) {
      const fileContent = await boldFont.getFileContent();
      registerFont({ ...boldFont, fileContent }, doc);
    }
    return font.fontName;
  }
  return null;
};

export const getMultilingualFont = async (
  doc: jsPDF,
  contentItems: string[],
  scriptFromCSV: Script | null = null
): Promise<string | null> => {
  if (!isMultilingualPdfEnabled()) {
    return null;
  }

  let detectedScript = scriptFromCSV;
  if (!detectedScript || detectedScript === 'latin') {
    detectedScript = detectScriptForItems(contentItems);
  }

  if (detectedScript && detectedScript !== 'latin') {
    return await loadAndRegisterFont(doc, detectedScript);
  }

  return null;
};
