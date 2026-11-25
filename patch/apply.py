#!/usr/bin/env python3
"""最小补丁：只让 isLocalHostRequest 始终返回真。

改动范围：仅 apps/server/src/utils/workspace/index.ts 中的一行 return 语句。
其余代码（含 localAddress / localHost 的计算）保持上游原样，不影响任何其他功能。

目标语句找不到或出现多次时以非零码退出，构建失败而非静默放过。
"""
import sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else "src")
target = root / "apps/server/src/utils/workspace/index.ts"

if not target.is_file():
    print(f"补丁失败：文件不存在 {target}", file=sys.stderr)
    sys.exit(1)

text = target.read_text(encoding="utf-8")
old = "  return localAddress && localHost;\n"
new = "  // patched: 服务器部署下始终按本机访问处理，便于反向代理环境安装插件。\n  return true;\n"

count = text.count(old)
if count == 0:
    print("补丁失败：未找到目标语句，上游可能已改动 isLocalHostRequest", file=sys.stderr)
    sys.exit(1)
if count > 1:
    print(f"补丁失败：目标语句出现 {count} 次，无法确定替换位置", file=sys.stderr)
    sys.exit(1)

target.write_text(text.replace(old, new, 1), encoding="utf-8")
print("  ✓ isLocalHostRequest 已改为始终返回真")
print("补丁应用完成（仅 1 处，未改动其他代码）")
