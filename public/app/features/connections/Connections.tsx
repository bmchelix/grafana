import { Navigate, Route, Routes, useLocation } from 'react-router-dom-v5-compat';

import { StoreState, useSelector } from 'app/types/store';

import { FEATURE_CONST, getFeatureStatus } from '../dashboard/services/featureFlagSrv';
import { isGrafanaAdmin } from '../plugins/admin/permissions';

import { ROUTES } from './constants';
import { AddNewConnectionPage } from './pages/AddNewConnectionPage';
import ConnectionsHomePage from './pages/ConnectionsHomePage';
import { DataSourceDashboardsPage } from './pages/DataSourceDashboardsPage';
import { DataSourceDetailsPage } from './pages/DataSourceDetailsPage';
import { DataSourcesListPage } from './pages/DataSourcesListPage';
import { EditDataSourcePage } from './pages/EditDataSourcePage';
import { NewDataSourcePage } from './pages/NewDataSourcePage';

function RedirectToAddNewConnection() {
  const { search } = useLocation();
  return (
    <Navigate
      replace
      to={{
        // BMC Change Inline: Redirect to your connection page for non super admin
        pathname: isGrafanaAdmin() ? ROUTES.AddNewConnection : ROUTES.DataSources,
        search,
      }}
    />
  );
}

export default function Connections() {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const isAddNewConnectionPageOverridden = Boolean(navIndex['standalone-plugin-page-/connections/add-new-connection']);
  // BMC code: comment next line
  // const shouldEnableFeatureHighlights = isOpenSourceBuildOrUnlicenced();

  return (
    <Routes>
      {/* BMC Change Inline: Redirect non-grafana-admins to data sources list, show home page only to grafana admins */}
      <Route
        caseSensitive
        path={'/'}
        element={isGrafanaAdmin() ? <ConnectionsHomePage /> : <Navigate replace to={ROUTES.DataSources} />}
      />
      {/* The route paths need to be relative to the parent path (ROUTES.Base), so we need to remove that part */}
      <Route caseSensitive path={ROUTES.DataSources.replace(ROUTES.Base, '')} element={<DataSourcesListPage />} />
      {/* BMC Code change: Below condition */}
      {getFeatureStatus(FEATURE_CONST.DASHBOARDS_SSRF_FEATURE_NAME) || isGrafanaAdmin() ? (
        <Route caseSensitive path={ROUTES.DataSourcesNew.replace(ROUTES.Base, '')} element={<NewDataSourcePage />} />
      ) : null}
      <Route
        caseSensitive
        path={ROUTES.DataSourcesDetails.replace(ROUTES.Base, '')}
        element={<DataSourceDetailsPage />}
      />
      <Route caseSensitive path={ROUTES.DataSourcesEdit.replace(ROUTES.Base, '')} element={<EditDataSourcePage />} />

      {/* BMC Change: Block permissions, insights, cache tabs routes */}
      {/* {shouldEnableFeatureHighlights && (
        <>
          <Route
            caseSensitive
            path={ROUTES.DataSourcesEdit.replace(ROUTES.Base, '') + '/permissions'}
            element={<PermissionsFeatureHighlightPage />}
          />
          <Route
            caseSensitive
            path={ROUTES.DataSourcesEdit.replace(ROUTES.Base, '') + '/insights'}
            element={<InsightsFeatureHighlightPage />}
          />
          <Route
            caseSensitive
            path={ROUTES.DataSourcesEdit.replace(ROUTES.Base, '') + '/cache'}
            element={<CacheFeatureHighlightPage />}
          />
        </>
      )} */}

      <Route
        caseSensitive
        path={ROUTES.DataSourcesDashboards.replace(ROUTES.Base, '')}
        element={<DataSourceDashboardsPage />}
      />

      {/* "Add new connection" page - we don't register a route in case a plugin already registers a standalone page for it */}
      {!isAddNewConnectionPageOverridden && (
        <Route
          caseSensitive
          path={ROUTES.AddNewConnection.replace(ROUTES.Base, '')}
          element={<AddNewConnectionPage />}
        />
      )}

      {/* Redirect from earlier routes to updated routes */}
      <Route path={ROUTES.ConnectDataOutdated.replace(ROUTES.Base, '')} element={<RedirectToAddNewConnection />} />
      <Route path={`/your-connections/:page`} element={<Navigate replace to={`${ROUTES.Base}/:page`} />} />
      <Route
        path={ROUTES.YourConnectionsOutdated.replace(ROUTES.Base, '')}
        element={<Navigate replace to={ROUTES.DataSources} />}
      />

      {/* Not found */}
      <Route element={<Navigate replace to="/notfound" />} />
    </Routes>
  );
}
