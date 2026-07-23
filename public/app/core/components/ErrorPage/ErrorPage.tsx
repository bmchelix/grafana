import { Trans } from '@grafana/i18n';
import { getConfig } from 'app/core/config';
import bmcPageNotFoundIconSvg from 'img/bmc_page_not_found_icon.svg';

import { Page } from '../Page/Page';

export function ErrorPage() {
  const homePage = getConfig().appSubUrl + '/';
  return (
    <Page navId="not-found">
      <Page.Contents>
        <div className="bmc_error_container page-body">
          <div>
            <img src={bmcPageNotFoundIconSvg} alt="" />
          </div>
          <div>
            <h3 className="bmc_error_main_text">
              <Trans i18nKey="bmc.error-page.title">Oops... we could not load that page.</Trans>
            </h3>
          </div>
          <div className="bmc_error_sub_text">
            <p>
              <Trans i18nKey="bmc.error-page.description">
                This page might have been removed, had its name changed, or is temporarily unavailable.
              </Trans>
            </p>
            <p>
              <Trans i18nKey="bmc.error-page.go-back">Go back to the</Trans>&nbsp;
              <a className="bmc_error_links" href={homePage}>
                <Trans i18nKey="bmc.error-page.home-page">Home Page</Trans>
              </a>
              , <Trans i18nKey="bmc.error-page.or-contact">or contact</Trans>&nbsp;
              <a className="bmc_error_links" href="https://www.bmc.com/support" target="_blank" rel="noreferrer">
                <Trans i18nKey="bmc.error-page.bmc-support">BMC Support</Trans>
              </a>
              .
            </p>
          </div>
        </div>
      </Page.Contents>
      <Page.Contents>
        <div className="bmc_error_container page-body">
          <div>
            <img src={bmcPageNotFoundIconSvg} alt="" />
          </div>
          <div>
            <h3 className="bmc_error_main_text">
              <Trans i18nKey="bmc.error-page.title">Oops... we could not load that page.</Trans>
            </h3>
          </div>
          <div className="bmc_error_sub_text">
            <p>
              <Trans i18nKey="bmc.error-page.description">
                This page might have been removed, had its name changed, or is temporarily unavailable.
              </Trans>
            </p>
            <p>
              <Trans i18nKey="bmc.error-page.go-back">Go back to the</Trans>&nbsp;
              <a className="bmc_error_links" href={homePage}>
                <Trans i18nKey="bmc.error-page.home-page">Home Page</Trans>
              </a>
              , <Trans i18nKey="bmc.error-page.or-contact">or contact</Trans>&nbsp;
              <a className="bmc_error_links" href="https://www.bmc.com/support" target="_blank" rel="noreferrer">
                <Trans i18nKey="bmc.error-page.bmc-support">BMC Support</Trans>
              </a>
              .
            </p>
          </div>
        </div>
      </Page.Contents>
    </Page>
  );
}

export default ErrorPage;
