#!/usr/bin/env sh
# 为小内存 VPS 创建并启用 swap（默认 2G），幂等，root 运行。
# 用法：sudo sh deploy/swap.sh
#       sudo SWAP_SIZE_MB=4096 sh deploy/swap.sh
set -eu

SWAP_FILE="${SWAP_FILE:-/swapfile}"
SWAP_SIZE_MB="${SWAP_SIZE_MB:-2048}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 运行：sudo sh deploy/swap.sh" >&2
  exit 1
fi

if awk 'NR > 1 { print $1 }' /proc/swaps | grep -qxF "$SWAP_FILE"; then
  echo "swap 已启用（$SWAP_FILE）。"
else
  if [ ! -e "$SWAP_FILE" ]; then
    echo "创建 ${SWAP_SIZE_MB}MB swap 文件：$SWAP_FILE"
    # 个别文件系统不支持 fallocate，回退到 dd。
    if ! fallocate -l "${SWAP_SIZE_MB}M" "$SWAP_FILE" 2>/dev/null; then
      echo "fallocate 不可用，改用 dd（较慢）……"
      dd if=/dev/zero of="$SWAP_FILE" bs=1M count="$SWAP_SIZE_MB" 2>/dev/null
    fi
  fi
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE" >/dev/null
  swapon "$SWAP_FILE"
fi

# 确保重启后仍自动启用。
if ! awk -v f="$SWAP_FILE" '$1 == f { found = 1 } END { exit !found }' /etc/fstab; then
  printf '%s none swap sw 0 0\n' "$SWAP_FILE" >> /etc/fstab
  echo "已写入 /etc/fstab。"
fi

echo "完成。当前 swap："
swapon --show
