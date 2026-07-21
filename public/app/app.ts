import 'core-js';
import 'regenerator-runtime/runtime';
import 'symbol-observable';

import '@formatjs/intl-durationformat/polyfill';
import 'file-saver';
import 'jquery';
import 'whatwg-fetch'; // fetch polyfill needed for PhantomJs rendering

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Store } from 'redux';

import {
  locationUtil,
  monacoLanguageRegistry,
  setLocale,
  setTimeZoneResolver,
  setWeekStart,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  standardTransformersRegistry,
} from '@grafana/data';
import { DEFAULT_LANGUAGE } from '@grafana/i18n';
import { initializeI18n, loadNamespacedResources } from '@grafana/i18n/internal';
import {
  locationService,
  setAppEvents,
  setBackendSrv,
  setChromeHeaderHeightHook,
  setCorrelationsService,
  setCurrentUser,
  setDataSourceSrv,
  setEmbeddedDashboard,
  setFolderPicker,
  setHelpNavItemHook,
  setLocationSrv,
  setMegaMenuOpenHook,
  setPluginComponentHook,
  setPluginComponentsHook,
  setPluginFunctionsHook,
  setPluginImportUtils,
  setPluginLinksHook,
  setQueryRunnerFactory,
  setReturnToPreviousHook,
  setRunRequest,
} from '@grafana/runtime';
import {
  setGetObservablePluginComponents,
  setGetObservablePluginLinks,
  setPanelDataErrorView,
  setPanelRenderer,
  setPluginPage
} from '@grafana/runtime/internal';
import { loadResources as loadScenesResources, sceneUtils } from '@grafana/scenes';
import config, { updateConfig } from 'app/core/config';
import { isGrafanaAdmin } from 'app/features/plugins/admin/permissions';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import getDefaultMonacoLanguages from '../lib/monaco-languages';

import { AppWrapper } from './AppWrapper';
import appEvents from './core/app_events';
import { AppChromeService } from './core/components/AppChrome/AppChromeService';
import { useChromeHeaderHeight } from './core/components/AppChrome/TopBar/useChromeHeaderHeight';
import { useHelpNode } from './core/components/AppChrome/TopBar/useHelpNode';
import { LazyFolderPicker } from './core/components/NestedFolderPicker/LazyFolderPicker';
import { getAllOptionEditors, getAllStandardFieldConfigs } from './core/components/OptionsUI/registry';
import { PluginPage } from './core/components/Page/PluginPage';
import {
  GrafanaContextType,
  useMegaMenuOpenInternal,
  useReturnToPreviousInternal,
} from './core/context/GrafanaContext';
import { initializeCrashDetection } from './core/crash';
import { GRAFANA_NAMESPACE, NAMESPACES } from './core/internationalization/constants';
import { loadTranslations } from './core/internationalization/loadTranslations';
import { postInitTasks, preInitTasks } from './core/lifecycle-hooks';
import { setMonacoEnv } from './core/monacoEnv';
import { interceptLinkClicks } from './core/navigation/patch/interceptLinkClicks';
import { CorrelationsService } from './core/services/CorrelationsService';
import { NewFrontendAssetsChecker } from './core/services/NewFrontendAssetsChecker';
import { backendSrv } from './core/services/backend_srv';
import { contextSrv, RedirectToUrlKey } from './core/services/context_srv';
import { initEchoSrv } from './core/services/echo/init';
import { getGainsightData } from './core/services/ims_srv';
import { KeybindingSrv } from './core/services/keybindingSrv';
import { startMeasure, stopMeasure } from './core/utils/metrics';
import { initAlerting } from './features/alerting/unified/initAlerting';
import { initAuthConfig } from './features/auth-config';
import { EmbeddedDashboardLazy } from './features/dashboard-scene/embedding/EmbeddedDashboardLazy';
import { DashboardLevelTimeMacro } from './features/dashboard-scene/scene/DashboardLevelTimeMacro';
import { getTimeSrv } from './features/dashboard/services/TimeSrv';
import { getFeatureStatus, loadFeatures, loadGrafanaFeatures } from './features/dashboard/services/featureFlagSrv';
import { updateConfigurableLinks, updateGainSightUserPreferences } from './features/dashboard/state/reducers';
import { initGrafanaLive } from './features/live';
import { customConfigSrv, CustomConfiguration } from './features/org/state/configuration';
import { PanelDataErrorView } from './features/panel/components/PanelDataErrorView';
import { PanelRenderer } from './features/panel/components/PanelRenderer';
import { DatasourceSrv } from './features/plugins/datasource_srv';
import {
  getObservablePluginComponents,
  getObservablePluginLinks,
} from './features/plugins/extensions/getPluginExtensions';
import { usePluginComponent } from './features/plugins/extensions/usePluginComponent';
import { usePluginComponents } from './features/plugins/extensions/usePluginComponents';
import { usePluginFunctions } from './features/plugins/extensions/usePluginFunctions';
import { usePluginLinks } from './features/plugins/extensions/usePluginLinks';
import { getAppPluginsToAwait, getAppPluginsToPreload } from './features/plugins/extensions/utils';
import { importPanelPlugin, syncGetPanelPlugin } from './features/plugins/importPanelPlugin';
import { initSystemJSHooks } from './features/plugins/loader/systemjsHooks';
import { preloadPlugins } from './features/plugins/pluginPreloader';
import { QueryRunner } from './features/query/state/QueryRunner';
import { runRequest } from './features/query/state/runRequest';
import { initWindowRuntime } from './features/runtime/init';
import { cleanupOldExpandedFolders } from './features/search/utils';
import { variableAdapters } from './features/variables/adapters';
import { createAdHocVariableAdapter } from './features/variables/adhoc/adapter';
import { createConstantVariableAdapter } from './features/variables/constant/adapter';
import { createCustomVariableAdapter } from './features/variables/custom/adapter';
import { createDataSourceVariableAdapter } from './features/variables/datasource/adapter';
import { createDatePickerVariableAdapter } from './features/variables/datepicker/adapter';
import { getVariablesUrlParams } from './features/variables/getAllVariableValuesForUrl';
import { createIntervalVariableAdapter } from './features/variables/interval/adapter';
import { createOptimizeVariableAdapter } from './features/variables/optimize/adapter';
import { setVariableQueryRunner, VariableQueryRunner } from './features/variables/query/VariableQueryRunner';
import { createQueryVariableAdapter } from './features/variables/query/adapter';
import { createSystemVariableAdapter } from './features/variables/system/adapter';
import { createTextBoxVariableAdapter } from './features/variables/textbox/adapter';
import { configureStore } from './store/configureStore';
import { TenantFeatureDTO } from './types/features';
import { StoreState } from './types/store';

// import symlinked extensions
const extensionsIndex = require.context('.', true, /extensions\/index.ts/);
const extensionsExports = extensionsIndex.keys().map((key) => {
  return extensionsIndex(key);
});

export class GrafanaApp {
  context!: GrafanaContextType;

  async init() {
    try {
      await preInitTasks();

      // Let iframe container know grafana has started loading
      window.parent.postMessage('GrafanaAppInit', '*');

      initSystemJSHooks();

      // BMC code: Disable OpenFeature OFREP (Remote Evaluation Protocol) API introduced in Grafana 12.x
      // Currently the OpenFeature API requires a signed in user. This means feature flags cannot be used
      // on the login page.
      // if (contextSrv.user.isSignedIn) {
      //   try {
      //     await initOpenFeature();
      //   } catch (err) {
      //     console.error('Failed to initialize OpenFeature provider', err);
      //   }
      // }
      // BMC code: end

      // BMC Change: setBackendSrv must be called before initializeI18n because loadTranslations
      // calls getBackendSrv() via LocalizationSrv during i18next backend init
      setBackendSrv(backendSrv);

      const regionalFormat = config.featureToggles.localeFormatPreference
        ? config.regionalFormat
        : contextSrv.user.language;

      const initI18nPromise = initializeI18n(
        {
          language: contextSrv.user.language,
          ns: NAMESPACES,
          module: loadTranslations,
        },
        regionalFormat
      );

      // This is a placeholder so we can put a 'comment' in the message json files.
      // Starts with an underscore so it's sorted to the top of the file. Even though it is in a comment the following line is still extracted
      // t('_comment', 'The code is the source of truth for English phrases. They should be updated in the components directly, and additional plurals specified in this file.');
      initI18nPromise.then(async ({ language }) => {
        updateConfig({ language });

        // Initialise scenes translations into the Grafana namespace. Must finish before any scenes UI is rendered.
        return loadNamespacedResources(GRAFANA_NAMESPACE, language ?? DEFAULT_LANGUAGE, [loadScenesResources]);
      });

      //BMC code
      let tenantFeatureDTO = null;
      if (!isGrafanaAdmin()) {
        tenantFeatureDTO = await fetchTenantFeatures();
      }
      loadFeatures(tenantFeatureDTO);
      // End
      await initEchoSrv();
      // This needs to be done after the `initEchoSrv` since it is being used under the hood.
      startMeasure('frontend_app_init');

      setLocale(config.regionalFormat);
      setWeekStart(contextSrv.user.weekStart);
      setPanelRenderer(PanelRenderer);
      setPluginPage(PluginPage);
      setFolderPicker(LazyFolderPicker);
      setPanelDataErrorView(PanelDataErrorView);
      setLocationSrv(locationService);
      setCorrelationsService(new CorrelationsService());
      setEmbeddedDashboard(EmbeddedDashboardLazy);
      setTimeZoneResolver(() => contextSrv.user.timezone);
      initGrafanaLive();
      setCurrentUser(contextSrv.user);

      initAuthConfig();

      // Expose the app-wide eventbus
      setAppEvents(appEvents);

      // We must wait for translations to load because some preloaded store state requires translating
      await initI18nPromise;

      // Important that extension reducers are initialized before store
      addExtensionReducers();
      // BMC code
      // configureStore();
      const store: Store<StoreState> = configureStore();
      // End
      initExtensions();

      //BMC code
      if (!isGrafanaAdmin()) {
        await fetchGrafanaFeatures();
      }
      // End

      initAlerting();

      standardEditorsRegistry.setInit(getAllOptionEditors);
      standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);
      standardTransformersRegistry.setInit(getStandardTransformers);
      // BMC code
      variableAdapters.setInit(() => {
        const adapters: any = [
          createQueryVariableAdapter(),
          createCustomVariableAdapter(),
          createTextBoxVariableAdapter(),
          createConstantVariableAdapter(),
          createDataSourceVariableAdapter(),
          createIntervalVariableAdapter(),
          createAdHocVariableAdapter(),
          createSystemVariableAdapter(),
          createDatePickerVariableAdapter(),
        ];
        const optimizeDomainPickerEnabled = getFeatureStatus('opt_domain_picker');
        if (optimizeDomainPickerEnabled) {
          adapters.push(createOptimizeVariableAdapter());
        }
        return adapters;
      });
      // End
      monacoLanguageRegistry.setInit(getDefaultMonacoLanguages);
      setMonacoEnv();

      setQueryRunnerFactory(() => new QueryRunner());
      setVariableQueryRunner(new VariableQueryRunner());

      // Provide runRequest implementation to packages, @grafana/scenes in particular
      setRunRequest(runRequest);

      // Privide plugin import utils to packages, @grafana/scenes in particular
      setPluginImportUtils({
        importPanelPlugin,
        getPanelPluginFromCache: syncGetPanelPlugin,
      });

      // Login redirect requires locationUtil to be initialized
      locationUtil.initialize({
        config: window.grafanaBootData.settings,
        getTimeRangeForUrl: getTimeSrv().timeRangeForUrl,
        getVariablesUrlParams: getVariablesUrlParams,
      });

      if (config.featureToggles.useSessionStorageForRedirection) {
        handleRedirectTo();
      }

      // intercept anchor clicks and forward it to custom history instead of relying on browser's history
      document.addEventListener('click', interceptLinkClicks);

      // Init DataSourceSrv
      const dataSourceSrv = new DatasourceSrv();
      dataSourceSrv.init(config.datasources, config.defaultDatasource);
      setDataSourceSrv(dataSourceSrv);
      initWindowRuntime();

      // Do not pre-load apps if rendererDisableAppPluginsPreload is true and the request comes from the image renderer
      const skipAppPluginsPreload =
        config.featureToggles.rendererDisableAppPluginsPreload && contextSrv.user.authenticatedBy === 'render';
      if (contextSrv.user.orgRole !== '' && !skipAppPluginsPreload) {
        const appPluginsToAwait = getAppPluginsToAwait();
        const appPluginsToPreload = getAppPluginsToPreload();

        preloadPlugins(appPluginsToPreload);
        await preloadPlugins(appPluginsToAwait);
      }

      setHelpNavItemHook(useHelpNode);
      setPluginLinksHook(usePluginLinks);
      setPluginComponentHook(usePluginComponent);
      setPluginComponentsHook(usePluginComponents);
      setPluginFunctionsHook(usePluginFunctions);
      setGetObservablePluginLinks(getObservablePluginLinks);
      setGetObservablePluginComponents(getObservablePluginComponents);

      // initialize chrome service
      const queryParams = locationService.getSearchObject();
      const chromeService = new AppChromeService();
      const keybindingsService = new KeybindingSrv(locationService, chromeService);
      const newAssetsChecker = new NewFrontendAssetsChecker();
      newAssetsChecker.start();

      // Read initial kiosk mode from url at app startup
      chromeService.setKioskModeFromUrl(queryParams.kiosk);

      // Clean up old search local storage values
      try {
        cleanupOldExpandedFolders();
      } catch (err) {
        console.warn('Failed to clean up old expanded folders', err);
      }

      this.context = {
        backend: backendSrv,
        location: locationService,
        chrome: chromeService,
        keybindings: keybindingsService,
        newAssetsChecker,
        config,
      };

      // BMC code
      // Uncomment below code snippet to enable feature flag
      await loadConfigurableLinks(store);

      let disableGainSight = queryParams.disableGainSight;
      // Suppress the error
      if (getFeatureStatus('gainsight') && !disableGainSight) {
        await loadGainSightScript(store).catch((e: any) => {
          return true;
        });
      }
      // End

      setReturnToPreviousHook(useReturnToPreviousInternal);
      setMegaMenuOpenHook(useMegaMenuOpenInternal);
      setChromeHeaderHeightHook(useChromeHeaderHeight);

      if (config.featureToggles.crashDetection) {
        initializeCrashDetection();
      }

      if (config.featureToggles.dashboardLevelTimeMacros) {
        sceneUtils.registerVariableMacro('__from', DashboardLevelTimeMacro, true);
        sceneUtils.registerVariableMacro('__to', DashboardLevelTimeMacro, true);
      }

      const root = createRoot(document.getElementById('reactRoot')!);
      root.render(
        createElement(AppWrapper, {
          app: this,
        })
      );

      await postInitTasks();
    } catch (error) {
      console.error('Failed to start Grafana', error);
      window.__grafana_load_failed();
    } finally {
      stopMeasure('frontend_app_init');
    }
  }
}

function addExtensionReducers() {
  if (extensionsExports.length > 0) {
    extensionsExports[0].addExtensionReducers();
  }
}

function initExtensions() {
  if (extensionsExports.length > 0) {
    extensionsExports[0].init();
  }
}

// BMC code

// Uncomment below code snippet to enable feature flag
async function fetchTenantFeatures(): Promise<TenantFeatureDTO[] | null> {
  return backendSrv.get('/tenantfeatures');
}

async function fetchGrafanaFeatures() {
  return loadGrafanaFeatures().catch((e) => {
    console.log(e);
  });
}

// <!-- BMC code - Gainsight PX Tag-->
const loadGainSightScript = async (store: Store<StoreState>): Promise<any> => {
  // Get GS-Tag from IMS userinfo endpoint
  let { gsTag, preferences, tenantDomainName, userRoleNames } = await getGainsightData();
  await store.dispatch(updateGainSightUserPreferences(preferences));

  if (!gsTag) {
    return;
  }

  const user = contextSrv.user;
  const userDetails: any = {};
  const accountDetails: any = {};

  userDetails.id = user.id;
  userDetails.itomRoles = userRoleNames;
  accountDetails.name = user.orgName;
  accountDetails.id = user.orgId;
  accountDetails.website = tenantDomainName;

  const url = 'https://documents.bmc.com/products/docs/gainsight/main/aptrinsic.js';
  const param = gsTag;
  const i = 'aptrinsic';
  (window as any)[i] =
    (window as any)[i] ||
    function () {
      ((window as any)[i].q = (window as any)[i].q || []).push(arguments);
    };
  (window as any)[i].p = param;
  (window as any)[i].c = {
    cssFileEndpoint: 'https://documents.bmc.com/products/docs/gainsight/main/style.css',
    widgetFileEndpoint: 'https://documents.bmc.com/products/docs/gainsight/main/aptrinsic-widget.js',
    widgetNonce: window.nonce,
  };
  const node = document.createElement('script');
  node.async = true;
  node.src = url + '?a=' + param;
  const script = document.getElementsByTagName('script')[0];
  const bhdVersion = config.bhdVersion;
  node.onload = (_: any) => {
    console.log('Gainsight is loaded');
    (window as any)[i]('identify', userDetails, accountDetails);
    (window as any)[i]('set', 'globalContext', { application: 'dashboards' });
    // setting version in global context for IDD
    (window as any)[i]('set', 'globalContext', { version: bhdVersion });
  };
  node.onerror = (error: any) => {
    console.error('An error occurred while loading GainSight script; reason: ', error);
  };
  script?.parentNode?.insertBefore(node, script);
};

const loadConfigurableLinks = async (store: Store<StoreState>): Promise<CustomConfiguration> => {
  const cLs = await customConfigSrv.getCustomConfiguration();
  store.dispatch(updateConfigurableLinks(cLs));
  return cLs;
};
// <!-- BMC code - Gainsight PX Tag-->
// End

function handleRedirectTo(): void {
  const queryParams = locationService.getSearch();
  const redirectToParamKey = 'redirectTo';

  if (queryParams.has('auth_token')) {
    // URL Login should not be redirected
    window.sessionStorage.removeItem(RedirectToUrlKey);
    return;
  }

  if (queryParams.has(redirectToParamKey) && window.location.pathname !== '/') {
    const rawRedirectTo = queryParams.get(redirectToParamKey)!;
    window.sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent(rawRedirectTo));
    queryParams.delete(redirectToParamKey);
    window.history.replaceState({}, '', `${window.location.pathname}${queryParams.size > 0 ? `?${queryParams}` : ''}`);
    return;
  }

  if (!contextSrv.user.isSignedIn) {
    return;
  }

  const redirectTo = window.sessionStorage.getItem(RedirectToUrlKey);
  if (!redirectTo) {
    return;
  }

  window.sessionStorage.removeItem(RedirectToUrlKey);
  let decodedRedirectTo = decodeURIComponent(redirectTo);
  if (decodedRedirectTo.startsWith('/goto/')) {
    // In this case there should be a request to the backend
    const urlToRedirectTo = locationUtil.assureBaseUrl(decodedRedirectTo);
    window.location.replace(urlToRedirectTo);
    return;
  }
  // Ensure that the appsuburl is stripped from the redirect to in case of a frontend redirect
  const stripped = locationUtil.stripBaseFromUrl(decodedRedirectTo);
  locationService.replace(stripped);
}

export default new GrafanaApp();
