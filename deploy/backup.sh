#!/usr/bin/env sh
# 打包外部运行数据（文章、评论、设置、图片），默认保留最近 14 份。
# 用法：
#   sh deploy/backup.sh
#   BACKUP_KEEP=30 sh deploy/backup.sh
#   BACKUP_REMOTE=r2:blog-backup sh deploy/backup.sh   # 装了 rclone 时同步到异地
# crontab：0 4 * * * cd /opt/self_blog && sh deploy/backup.sh
set -eu
umask 077
cd "$(dirname "$0")/.."

BACKUP_DATA_DIR="${BACKUP_DATA_DIR:-${BLOG_HOST_DATA_DIR:-../self_blog-data}}"
BACKUP_DIR="${BACKUP_DIR:-deploy/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
BACKUP_REMOTE="${BACKUP_REMOTE:-}"

case "$BACKUP_KEEP" in
  ''|*[!0-9]*|0*) echo "BACKUP_KEEP 必须是正整数。" >&2; exit 1 ;;
esac

mkdir -p "$BACKUP_DIR"
[ -d "$BACKUP_DATA_DIR" ] || { echo "备份数据目录不存在。" >&2; exit 1; }

# 目录锁：cron 重叠或手动触发时，后一个进程直接退出。进程被 kill -9 会留下锁，
# 删掉 deploy/backups/.lock 目录即可恢复。
lock="$BACKUP_DIR/.lock"
if ! mkdir "$lock" 2>/dev/null; then
  echo "已有备份进程在运行，跳过。"
  [ "${BACKUP_REQUIRE_NEW:-0}" != 1 ] || exit 1
  exit 0
fi
cleanup() { rmdir "$lock" 2>/dev/null || true; }
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

stamp=$(date +%Y%m%d-%H%M%S)-$$
partial="$BACKUP_DIR/data-$stamp.tar.gz.partial"
archive="$BACKUP_DIR/data-$stamp.tar.gz"

# 先写 .partial，校验可读后再改名，坏包不会占用「最近 N 份」的名额。
if ! tar --exclude='sessions.json' --exclude='*.tmp' --transform='s,^\.,data,' -czf "$partial" -C "$BACKUP_DATA_DIR" .; then
  rm -f "$partial"
  echo "打包失败，已删除 $partial" >&2
  exit 1
fi
if ! tar -tzf "$partial" >/dev/null 2>&1; then
  rm -f "$partial"
  echo "备份校验失败，已删除 $partial" >&2
  exit 1
fi
mv "$partial" "$archive"

echo "已备份到 $archive"

# 可选异地：设置了 BACKUP_REMOTE 且装了 rclone 时再传一份。
if [ -n "$BACKUP_REMOTE" ]; then
  if command -v rclone >/dev/null 2>&1; then
    rclone copy "$archive" "$BACKUP_REMOTE"
    echo "已同步到 $BACKUP_REMOTE"
  else
    echo "设置了 BACKUP_REMOTE 但没装 rclone；本地备份已保留，异地同步失败。" >&2
    exit 1
  fi
fi

# 异地同步成功后再清理历史；read 保留目录中的空格，避免 xargs 拆开路径。
ls -1t "$BACKUP_DIR"/data-*.tar.gz 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" |
  while IFS= read -r old; do rm -- "$old"; done
