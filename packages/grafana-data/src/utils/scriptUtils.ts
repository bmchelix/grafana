// BMC file
// Author - mahmedi

export { detectScript } from 'adereporting-node-sdk';
export type { Script } from 'adereporting-node-sdk';

export const isMultilingualPdfEnabled = (): boolean => {
  const urlParams = new URLSearchParams(window.location.search);
  const isMultilingualEnabled = urlParams.get('multilingualPdf');
  return isMultilingualEnabled === 'true';
};

export const isExportFooterEnabled = (): boolean => {
  const urlParams = new URLSearchParams(window.location.search);
  const isExportFooterEnabled = urlParams.get('tableFooterExport');
  return isExportFooterEnabled === 'true';
};
