export type TemplateOptions = {
  brand: BrandingOptions;

  orientation: 'portrait' | 'landscape';
  theme: 'light' | 'dark';

  dashboardPath: string;
  hideDashboardPath?: boolean;

  margin: { top: number; left: number; right: number; bottom: number };
  table: TableOptions;
};

export type TableOptions = {
  panelTitle: string; // panel name
  tableScaling?: boolean;
  customWidth?: boolean;
  recordLimit?: number;
};

export type BrandingOptions = {
  timeRange: {
    from?: string;
    to: string;
  };
  generatedAt: string;
  companyLogo: string;
  reportName: string;
  reportDescription: string;
  footerText: string;
  footerURL: string;
};

export type ThemeOptions = {
  fillColor: string;
  textColor: string;
  lineColor: string;
  backGroundFillColor: string;
  tableHeaderFillColor: string;
  tableHeaderTextColor: string;
  headerTextColor: string;
  lineDrawColor: string;
  headerSectionColor: string;
  footerRowColor: string;
};

export type CreateFromCSVOptions = {
  csvContent: string;
};

export type CreateFromHTMLOptions = {
  selector: HTMLTableElement | undefined;
  theme?: 'striped' | 'grid' | 'plain';
  useCss?: boolean;
  firstColumnWidth?: number;
};

export type RuntimePDFOptions = {
  companyLogo: string;
  dashboardPath: string; // Default: document.title
  footerText: string;
  footerURL: string;
  orientation: 'landscape' | 'portrait';
  reportName: string;
  reportDescription: string;
  tableScaling?: boolean;
  customWidth?: boolean;
  recordLimit: number; // Default: 5000
  hideDashboardPath: boolean;
  generatedAt?: string;
  timeRange: {
    from?: string;
    to: string;
  };
};
