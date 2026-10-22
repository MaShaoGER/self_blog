# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base
# 默认官方源；国内构建用 --build-arg NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 \
  COREPACK_NPM_REGISTRY=$NPM_REGISTRY
RUN corepack enable

FROM base AS deps
# ARG 只在声明的阶段有效，这里要重新声明才能收到 --build-arg。
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm config set registry "$NPM_REGISTRY" \
  && pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Content lives in the mounted volume at runtime, not in the image.
RUN rm -rf data .env .env.local && pnpm build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 BLOG_DATA_DIR=/app/data
RUN groupadd --system --gid 1001 blog && useradd --system --uid 1001 --gid blog blog \
  && mkdir -p /app/data/posts /app/data/uploads && chown -R blog:blog /app/data
COPY --from=build --chown=blog:blog /app/.next/standalone ./
COPY --from=build --chown=blog:blog /app/.next/static ./.next/static
USER blog
EXPOSE 3000
VOLUME ["/app/data"]
# sharp 的原生依赖缺失时图片上传/访问会全挂，这种镜像不应该进入 healthy。
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "require('sharp'); fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
