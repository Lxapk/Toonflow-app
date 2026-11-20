FROM oven/bun:1.4.3

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY . .

# 版本号在构建时烘焙进产物（服务端 --define 与前端 vite define 均读取该变量），
# 未设置时 electrobun.config.ts 会回退到 2.0.0，因此必须由构建参数传入。
ARG appVersion=
ENV appVersion=${appVersion}

# ACT: 保留工作区与依赖以兼容运行时动态加载；需要缩减镜像时再拆分构建阶段。
RUN test -n "$appVersion" || (echo "构建参数 appVersion 不能为空，否则页面版本号会显示默认值 2.0.0" >&2; exit 1)
RUN bun install --frozen-lockfile

# writeAtomic 以 0600 创建临时文件，个别构建产物（如 pluginDeveloper.tool.js）因此只有 root 可读；
# 容器以 bun 用户运行，这里补齐读权限，否则启动时复制内置插件会 EACCES。
RUN bun run build:server \
    && mkdir -p data/workspaces/myProject \
    && chown -R bun:bun data \
    && find build -type f -exec chmod a+r {} + \
    && find build -type d -exec chmod a+rx {} +

ENV NODE_ENV=production
ENV TOONFLOW_DATA_DIR=/app/data

USER bun
EXPOSE 3000

CMD ["bun", "build/server/index.js"]
