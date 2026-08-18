FROM node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS production-dependencies

WORKDIR /app/server

COPY server/package.json server/package-lock.json server/.npmrc ./
RUN npm ci --omit=dev \
    && npm cache clean --force

FROM node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS runtime

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app/server

# The application starts with node directly; package managers are unnecessary at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /opt/yarn-v* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/pnpm /usr/local/bin/pnpx

COPY --from=production-dependencies --chown=node:node /app/server/node_modules ./node_modules
COPY --chown=node:node server/package.json server/server.js ./
COPY --chown=node:node server/src ./src
COPY --chown=node:node .agents/upstream-skills/watchlist.json .agents/upstream-skills/snapshot.json /app/.agents/upstream-skills/

RUN mkdir -p /app/server/.private/f1-media /app/server/uploads \
    && chown -R node:node /app/server/.private /app/server/uploads

USER node

EXPOSE 5000
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/ops/health/live').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "server.js"]
