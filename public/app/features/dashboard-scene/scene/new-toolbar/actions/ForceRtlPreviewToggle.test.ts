import { contextSrv } from 'app/core/services/context_srv';

import { isForceRtlQueryActive, isStrictEditorRtlPreviewActive } from './ForceRtlPreviewToggle';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { language: '' },
    isEditor: false,
  },
}));

function setLanguage(lang: string) {
  (contextSrv as any).user = { language: lang };
}

function setIsEditor(val: boolean) {
  (contextSrv as any).isEditor = val;
}

function setUrlSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  setUrlSearch('');
  setLanguage('');
  setIsEditor(false);
});

describe('isForceRtlQueryActive', () => {
  it('returns false when no query param', () => {
    setUrlSearch('');
    expect(isForceRtlQueryActive()).toBe(false);
  });

  it('returns true when forceRTL=true in URL', () => {
    setUrlSearch('?forceRTL=true');
    expect(isForceRtlQueryActive()).toBe(true);
  });

  it('returns false when forceRTL=false in URL', () => {
    setUrlSearch('?forceRTL=false');
    expect(isForceRtlQueryActive()).toBe(false);
  });
});

describe('isStrictEditorRtlPreviewActive', () => {
  it('returns false when forceRTL is off', () => {
    setUrlSearch('');
    setLanguage('ar');
    setIsEditor(true);
    expect(isStrictEditorRtlPreviewActive()).toBe(false);
  });

  it('returns false when language is not RTL', () => {
    setUrlSearch('?forceRTL=true');
    setLanguage('en');
    setIsEditor(true);
    expect(isStrictEditorRtlPreviewActive()).toBe(false);
  });

  it('returns false when user is not editor', () => {
    setUrlSearch('?forceRTL=true');
    setLanguage('ar');
    setIsEditor(false);
    expect(isStrictEditorRtlPreviewActive()).toBe(false);
  });

  it('returns true when forceRTL + Arabic + Editor', () => {
    setUrlSearch('?forceRTL=true');
    setLanguage('ar');
    setIsEditor(true);
    expect(isStrictEditorRtlPreviewActive()).toBe(true);
  });

  it('returns true when forceRTL + Hebrew + Editor', () => {
    setUrlSearch('?forceRTL=true');
    setLanguage('he');
    setIsEditor(true);
    expect(isStrictEditorRtlPreviewActive()).toBe(true);
  });

  it('returns true for Arabic with region suffix', () => {
    setUrlSearch('?forceRTL=true');
    setLanguage('ar-SA');
    setIsEditor(true);
    expect(isStrictEditorRtlPreviewActive()).toBe(true);
  });
});
