FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm test -- --runInBand tracking/tracking.spec.ts

FROM build AS migrator
CMD ["npx", "prisma", "migrate", "deploy"]

FROM build AS runtime
ARG GIT_COMMIT_SHA=local
ENV NODE_ENV=production TZ=America/Sao_Paulo GIT_COMMIT_SHA=$GIT_COMMIT_SHA
USER node
EXPOSE 6969
CMD ["node", "dist/src/main.js"]

FROM build AS collector
USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/parser && /opt/parser/bin/pip install --no-cache-dir -r scripts/tracking/requirements.txt
ARG GIT_COMMIT_SHA=local
ENV NODE_ENV=production TZ=America/Sao_Paulo GIT_COMMIT_SHA=$GIT_COMMIT_SHA TRACKING_PYTHON=/opt/parser/bin/python
USER node
CMD ["node", "dist/src/tracking/worker/main.js"]
