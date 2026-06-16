# to maintain formatting of multiline commands in vscode, add the following to settings.json:
# "docker.languageserver.formatter.ignoreMultilineInstructions": true

# BMC code: replace base images
# ARG BASE_IMAGE=alpine-base
# ARG GO_IMAGE=go-builder-base
# ARG JS_IMAGE=js-builder-base
ARG BASE_IMAGE=cgr.dev/bmc.com/chainguard-base:latest
ARG JRE_IMAGE=cgr.dev/bmc.com/jre:openjdk-21
# When updating this, please do the same in the following dockerfiles and go.mod files
# administration/metricserver, jobs/init-db, source-plugins/bmc-csv-datasource
ARG GO_IMAGE=aus-harborpd-01.bmc.com/helix-cloudops/adereporting-base-golang:1.25.10-alpine
ARG JS_IMAGE=aus-harborpd-01.bmc.com/helix-cloudops/adereporting-base-node:24-alpine
ARG JS_PLATFORM=linux/amd64

# Default to building locally
ARG GO_SRC=go-builder
ARG JS_SRC=js-builder

# BMC code: Commented from 12.3.x
# Dependabot cannot update dependencies listed in ARGs
# By using FROM instructions we can delegate dependency updates to dependabot
# FROM alpine:3.23.3 AS alpine-base
# FROM ubuntu:22.04 AS ubuntu-base
# FROM golang:1.25.7-alpine AS go-builder-base
# FROM --platform=${JS_PLATFORM} node:24-alpine AS js-builder-base

# Javascript build stage
FROM --platform=${JS_PLATFORM} ${JS_IMAGE} AS js-builder
ARG JS_NODE_ENV=production
ARG JS_YARN_INSTALL_FLAG=--immutable
ARG JS_YARN_BUILD_FLAG=build

ENV NODE_OPTIONS=--max_old_space_size=8000

WORKDIR /tmp/grafana

# BMC code: Commented from 12.3.x
# RUN apk add --no-cache make build-base python3
RUN apk add --no-cache make build-base python3 git

COPY package.json project.json nx.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY packages packages
# BMC code: Added .npmrc and .yarnrc (Files not in Original 12.3.x)
COPY .npmrc ./
COPY .yarnrc ./
COPY e2e-playwright e2e-playwright
COPY public public
COPY LICENSE ./
COPY conf/defaults.ini ./conf/defaults.ini
COPY e2e e2e

#
# Set the node env according to defaults or argument passed
#
ENV NODE_ENV=${JS_NODE_ENV}
#
RUN if [ "$JS_YARN_INSTALL_FLAG" = "" ]; then \
    yarn install; \
  else \
    yarn install --immutable; \
  fi

COPY tsconfig.json eslint.config.js .editorconfig .browserslistrc .prettierrc.js ./
COPY scripts scripts
COPY emails emails

# Set the build argument according to default or argument passed
RUN yarn ${JS_YARN_BUILD_FLAG}

# Golang build stage
FROM ${GO_IMAGE} AS go-builder

ARG COMMIT_SHA=""
ARG BUILD_BRANCH=""
ARG GO_BUILD_TAGS="oss"
ARG WIRE_TAGS="oss"
# BMC code: Added BMC GitHub ARGs and FIPS related ENVs
ARG ADEREPORTING_GITHUB_USER=adereprt
ARG ADEREPORTING_GITHUB_TOKEN
ARG GOFIPS140=off
ENV GOFIPS140=${GOFIPS140}

RUN if grep -i -q alpine /etc/issue; then \
  apk add --no-cache \
  # This is required to allow building on arm64 due to https://github.com/golang/go/issues/22040
  binutils-gold \
  bash \
  # Install build dependencies
  gcc g++ make git; \
  fi

WORKDIR /tmp/grafana

COPY go.* ./
COPY .citools .citools

# BMC code: Private Go module configuration
RUN go env -w GOPRIVATE=github.bmc.com
RUN git config --system url."https://${ADEREPORTING_GITHUB_USER}:${ADEREPORTING_GITHUB_TOKEN}@github.bmc.com".insteadOf "https://github.bmc.com"

# Copy go dependencies first
# If updating this, please also update devenv/frontend-service/backend.dockerfile
COPY pkg/util/xorm pkg/util/xorm
COPY pkg/apiserver pkg/apiserver
COPY pkg/apimachinery pkg/apimachinery
COPY pkg/build pkg/build
COPY pkg/build/wire pkg/build/wire
COPY pkg/promlib pkg/promlib
COPY pkg/storage/unified/resource pkg/storage/unified/resource
COPY pkg/storage/unified/resourcepb pkg/storage/unified/resourcepb
COPY pkg/storage/unified/apistore pkg/storage/unified/apistore
COPY pkg/semconv pkg/semconv
COPY pkg/aggregator pkg/aggregator
COPY apps/playlist apps/playlist
COPY apps/plugins apps/plugins
COPY apps/shorturl apps/shorturl
COPY apps/correlations apps/correlations
COPY apps/preferences apps/preferences
COPY apps/provisioning apps/provisioning
COPY apps/secret apps/secret
COPY apps/scope apps/scope
COPY apps/investigations apps/investigations
COPY apps/logsdrilldown apps/logsdrilldown
COPY apps/advisor apps/advisor
COPY apps/dashboard apps/dashboard
COPY apps/folder apps/folder
COPY apps/preferences apps/preferences
COPY apps/iam apps/iam
COPY apps apps
COPY kindsv2 kindsv2
COPY apps/alerting/alertenrichment apps/alerting/alertenrichment
COPY apps/alerting/notifications apps/alerting/notifications
COPY apps/alerting/rules apps/alerting/rules
COPY pkg/codegen pkg/codegen
COPY pkg/plugins/codegen pkg/plugins/codegen
COPY apps/example apps/example

RUN go mod download

COPY embed.go Makefile build.go package.json ./
COPY cue.mod cue.mod
COPY kinds kinds
# BMC code: Commented from 12.3.x
# COPY local local
COPY packages/grafana-schema packages/grafana-schema
COPY public/app/plugins public/app/plugins
COPY public/api-merged.json public/api-merged.json
COPY pkg pkg
COPY scripts scripts
COPY conf conf
# BMC code: Commented out (not needed for BMC build)
# COPY .github .github

ENV COMMIT_SHA=${COMMIT_SHA}
ENV BUILD_BRANCH=${BUILD_BRANCH}

RUN make build-go GO_BUILD_TAGS=${GO_BUILD_TAGS} WIRE_TAGS=${WIRE_TAGS}

# From-tarball build stage
FROM ${BASE_IMAGE} AS tgz-builder

WORKDIR /tmp/grafana

ARG GRAFANA_TGZ="grafana-latest.linux-x64-musl.tar.gz"

COPY ${GRAFANA_TGZ} /tmp/grafana.tar.gz

# add -v to make tar print every file it extracts
RUN tar x -z -f /tmp/grafana.tar.gz --strip-components=1

# helpers for COPY --from
FROM ${GO_SRC} AS go-src
FROM ${JS_SRC} AS js-src

# ---------------------------------------------------------------------------
# JRE source: parameterized for FIPS and non-FIPS
#   Non-FIPS: cgr.dev/ORGANIZATION/jre:openjdk-21
#   FIPS:     cgr.dev/ORGANIZATION/jre-fips:openjdk-21
# ---------------------------------------------------------------------------
FROM ${JRE_IMAGE} AS jre-source

# ---------------------------------------------------------------------------
# JRE preparation: copy JRE binaries from jre-source and auto-detect FIPS.
# If the JRE image contains Bouncy Castle FIPS artifacts, include them and
# write /etc/java-fips.env for runtime activation.
# ---------------------------------------------------------------------------
FROM ${BASE_IMAGE} AS jre-prep
RUN --mount=from=jre-source,target=/jre-src,ro \
    mkdir -p /jre-staging/usr/lib/jvm && \
    cp -a /jre-src/usr/lib/jvm/. /jre-staging/usr/lib/jvm/ && \
    if [ -d /jre-src/usr/share/java/bouncycastle-fips ]; then \
      echo ">>> FIPS JRE detected — including Bouncy Castle FIPS artifacts" && \
      mkdir -p /jre-staging/usr/share/java \
               /jre-staging/usr/lib/jvm/jdk-fips-config \
               /jre-staging/etc && \
      cp -r /jre-src/usr/share/java/bouncycastle-fips /jre-staging/usr/share/java/ && \
      if [ -f /jre-src/usr/lib/jvm/jdk-fips-config/java.policy ]; then \
        cp /jre-src/usr/lib/jvm/jdk-fips-config/java.policy \
           /jre-staging/usr/lib/jvm/jdk-fips-config/java.policy; \
      fi && \
      printf '%s\n' \
        'JAVA_TOOL_OPTIONS=--module-path=/usr/share/java/bouncycastle-fips' \
        'JAVA_FIPS_CLASSPATH=/usr/share/java/bouncycastle-fips/*' \
        'CLASSPATH=/usr/share/java/bouncycastle-fips/*:./*:.' \
        'JDK_JAVA_FIPS_OPTIONS=--add-exports=java.base/sun.security.internal.spec=ALL-UNNAMED --add-exports=java.base/sun.security.provider=ALL-UNNAMED' \
        'JDK_JAVA_OPTIONS=--add-exports=java.base/sun.security.internal.spec=ALL-UNNAMED --add-exports=java.base/sun.security.provider=ALL-UNNAMED -Djavax.net.ssl.trustStoreType=FIPS' \
        'JAVA_TRUSTSTORE_OPTIONS=-Djavax.net.ssl.trustStoreType=FIPS' \
        > /jre-staging/etc/java-fips.env; \
    else \
      echo ">>> Standard JRE — no FIPS overlay"; \
    fi

# ---------------------------------------------------------------------------
# Final stage
# ---------------------------------------------------------------------------
FROM ${BASE_IMAGE}

USER root

LABEL maintainer="Grafana Labs <hello@grafana.com>"
LABEL org.opencontainers.image.source="https://github.com/grafana/grafana"

# BMC code:
# next 2 lines are commented from 12.3.x
# ARG GF_UID="472"
# ARG GF_GID="0"
ARG GF_UID="1000"
ARG GF_GID="1000"
# BMC code: End

ENV PATH="/usr/share/grafana/bin:$PATH" \
  GF_PATHS_CONFIG="/etc/grafana/grafana.ini" \
  GF_PATHS_DATA="/var/lib/grafana" \
  GF_PATHS_HOME="/usr/share/grafana" \
  GF_PATHS_LOGS="/var/log/grafana" \
  GF_PATHS_PLUGINS="/var/lib/grafana/plugins" \
  GF_PATHS_PROVISIONING="/etc/grafana/provisioning"

WORKDIR $GF_PATHS_HOME

# Install required packages (JRE is copied from jre-prep, NOT installed via apk)
RUN apk update && apk add --no-cache \
      ca-certificates \
      bash \
      curl \
      tzdata \
      python3 \
      py3-pip && \
    pip install --no-cache-dir --break-system-packages supervisor && \
    apk info -vv | sort

# Copy JRE binaries + optional FIPS artifacts from jre-prep stage
COPY --from=jre-prep /jre-staging/ /

ENV JAVA_HOME=/usr/lib/jvm/default-jvm

COPY conf ./conf
# BMC code: Added supervisord configuration
COPY supervisord.conf /opt/bmc/
# Dependencies already installed above (Wolfi/Chainguard)

# Copy musl dynamic linker from Alpine go-builder so musl-linked Grafana binary can execute on glibc-based Chainguard
COPY --from=go-src /lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1

COPY --from=go-src /tmp/grafana/conf ./conf

# BMC code: Replaced grafana user/group creation with 1000:1000 (from BMC base image).
# RUN if [ ! $(getent group "$GF_GID") ]; then \
#   if grep -i -q alpine /etc/issue; then \
#   addgroup -S -g $GF_GID grafana; \
#   else \
#   addgroup --system --gid $GF_GID grafana; \
#   fi; \
#   fi && \
#   GF_GID_NAME=$(getent group $GF_GID | cut -d':' -f1) && \
#   mkdir -p "$GF_PATHS_HOME/.aws" && \
#   if grep -i -q alpine /etc/issue; then \
#   adduser -S -u $GF_UID -G "$GF_GID_NAME" grafana; \
#   else \
#   adduser --system --uid $GF_UID --ingroup "$GF_GID_NAME" grafana; \
#   fi && \
#   mkdir -p "$GF_PATHS_PROVISIONING/datasources" \
#   "$GF_PATHS_PROVISIONING/dashboards" \
#   "$GF_PATHS_PROVISIONING/notifiers" \
#   "$GF_PATHS_PROVISIONING/plugins" \
#   "$GF_PATHS_PROVISIONING/access-control" \
#   "$GF_PATHS_PROVISIONING/alerting" \
#   "$GF_PATHS_LOGS" \
#   "$GF_PATHS_PLUGINS" \
#   "$GF_PATHS_DATA" && \
#   cp conf/sample.ini "$GF_PATHS_CONFIG" && \
#   cp conf/ldap.toml /etc/grafana/ldap.toml && \
#   chown -R "grafana:$GF_GID_NAME" "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING" && \
#   chmod -R 777 "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING"

RUN mkdir -p "$GF_PATHS_HOME/.aws" && \
  mkdir -p "$GF_PATHS_PROVISIONING/datasources" \
  "$GF_PATHS_PROVISIONING/dashboards" \
  "$GF_PATHS_PROVISIONING/notifiers" \
  "$GF_PATHS_PROVISIONING/plugins" \
  "$GF_PATHS_PROVISIONING/access-control" \
  "$GF_PATHS_PROVISIONING/alerting" \
  "$GF_PATHS_LOGS" \
  "$GF_PATHS_PLUGINS" \
  "$GF_PATHS_DATA" && \
  # BMC code: replaced sample.ini with custom.ini
  cp conf/custom.ini "$GF_PATHS_CONFIG" && \
  cp conf/ldap.toml /etc/grafana/ldap.toml && \
  # BMC code: replaced "grafana:$GF_GID_NAME" with 1000:1000
  chown -R 1000:1000 "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING" && \
  chmod -R 777 "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING" && \
  # BMC code: added below line
  chown -R 1000:1000 "$GF_PATHS_CONFIG"

COPY --from=go-src /tmp/grafana/bin/grafana* /tmp/grafana/bin/*/grafana* ./bin/
COPY --from=js-src /tmp/grafana/public ./public
COPY --from=js-src /tmp/grafana/LICENSE ./

EXPOSE 3000

# BMC code: Commented from 12.3.x
# ARG RUN_SH=./packaging/docker/run.sh

# BMC code: Commented from 12.3.x
# COPY ${RUN_SH} /run.sh

# BMC code: start
COPY --chown=1000:1000 ./packaging/docker/run.sh /run.sh
COPY --chown=1000:1000 ./packaging/docker/content-run.sh /content-run.sh
# Entrypoint wrapper: sources FIPS env vars at runtime if /etc/java-fips.env exists
RUN printf '#!/bin/sh\nif [ -f /etc/java-fips.env ]; then\n  while IFS= read -r line; do\n    export "$line"\n  done < /etc/java-fips.env\nfi\nexec "$@"\n' \
      > /entrypoint.sh && chmod +x /entrypoint.sh
# BMC code: end

# BMC code: Commented from 12.3.x
# USER "$GF_UID"
# ENTRYPOINT [ "/run.sh" ]
USER nonroot
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/opt/bmc/supervisord.conf"]
