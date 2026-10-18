#!/usr/bin/env sh
# 打包 data/（文章、评论、设置、图片）到 deploy/backups/，保留最近 14 份。
# 用 crontab 每天跑：0 4 * * * cd /opt/self_blog && sh deploy/backup.sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p deploy/backups
stamp=$(date +%Y%m%d-%H%M%S)
tar --exclude='sessions.json' --exclude='*.tmp' -czf "deploy/backups/data-$stamp.tar.gz" data
ls -1t deploy/backups/data-*.tar.gz | tail -n +15 | xargs -r rm --
echo "已备份到 deploy/backups/data-$stamp.tar.gz"
