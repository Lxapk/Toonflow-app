#!/usr/bin/env python3
"""Toonflow 最小补丁集。

共两处改动，均不涉及业务逻辑：

1. 服务端 apps/server/src/utils/workspace/index.ts
   把 isLocalHostRequest 的 return 语句改为恒真，
   使反向代理 / 局域网环境下可以安装插件。

2. 前端 apps/web/index.html
   在 <head> 内联注入浏览器 API 兜底脚本，
   使 HTTP + 局域网 IP 访问时 crypto.randomUUID / crypto.subtle.digest
   等仅在安全上下文提供的 API 可用。

任一目标未命中时以非零码退出，构建失败而非静默产出。
"""
import sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else "src")
script_dir = Path(__file__).resolve().parent
errors = []
applied = []


def apply_server_patch() -> None:
    target = root / "apps/server/src/utils/workspace/index.ts"
    if not target.is_file():
        errors.append(f"服务端补丁：文件不存在 {target}")
        return
    text = target.read_text(encoding="utf-8")
    old = "  return localAddress && localHost;\n"
    new = "  // patched: 服务器部署下始终按本机访问处理，便于反向代理环境安装插件。\n  return true;\n"
    count = text.count(old)
    if count == 0:
        errors.append("服务端补丁：未找到目标语句，上游可能已改动 isLocalHostRequest")
        return
    if count > 1:
        errors.append(f"服务端补丁：目标语句出现 {count} 次，无法确定替换位置")
        return
    target.write_text(text.replace(old, new, 1), encoding="utf-8")
    applied.append("isLocalHostRequest -> 恒真")


def apply_frontend_patch() -> None:
    target = root / "apps/web/index.html"
    polyfill = script_dir / "browser-polyfill.js"
    if not target.is_file():
        errors.append(f"前端补丁：文件不存在 {target}")
        return
    if not polyfill.is_file():
        errors.append(f"前端补丁：脚本不存在 {polyfill}")
        return
    html = target.read_text(encoding="utf-8")
    marker = '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
    if html.count(marker) != 1:
        errors.append("前端补丁：未找到唯一的 viewport 注入点")
        return
    body = polyfill.read_text(encoding="utf-8")
    # 内联注入，避免额外请求；脚本本身在原生支持时不做任何改动。
    injection = (
        marker
        + "    <script>\n"
        + body
        + "    </script>\n"
    )
    target.write_text(html.replace(marker, injection, 1), encoding="utf-8")
    applied.append("browser-polyfill -> index.html")


apply_server_patch()
apply_frontend_patch()

for item in applied:
    print(f"  ✓ {item}")

if errors:
    print("\n补丁失败：", file=sys.stderr)
    for item in errors:
        print(f"  - {item}", file=sys.stderr)
    sys.exit(1)

print(f"\n补丁应用完成（共 {len(applied)} 处，未改动其他代码）")
