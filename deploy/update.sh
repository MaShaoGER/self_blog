#!/usr/bin/env sh
# BLOG_DEPLOY_CONFIG=/etc/self_blog/deploy.env sh deploy/update.sh [--rollback|--no-pull]
set -eu
umask 077
fail() { echo "$*" >&2; exit 1; }
action=${1:-update}
case "$action" in update|--rollback|--no-pull) ;; *) fail '用法：update.sh [--rollback|--no-pull]' ;; esac
[ "$#" -le 1 ] || fail '参数过多。'
[ -n "${BLOG_DEPLOY_CONFIG:-}" ] && [ -f "$BLOG_DEPLOY_CONFIG" ] || fail '请设置外部 BLOG_DEPLOY_CONFIG。'
# Administrator-owned shell configuration, never user-uploaded content.
set -a
. "$BLOG_DEPLOY_CONFIG"
set +a
: "${BLOG_REPO_DIR:?}" "${BLOG_ENV_FILE:?}" "${BLOG_HOST_DATA_DIR:?}"
cd "$BLOG_REPO_DIR"
BLOG_REPO_DIR=$(pwd -P)
BLOG_STATE_DIR=${BLOG_STATE_DIR:-../self_blog-state}
BLOG_DEPLOY_MODE=${BLOG_DEPLOY_MODE:-gateway}
BLOG_COMPOSE_PROJECT_NAME=${BLOG_COMPOSE_PROJECT_NAME:-self-blog}
BLOG_GIT_REMOTE=${BLOG_GIT_REMOTE:-origin}
BLOG_GIT_BRANCH=${BLOG_GIT_BRANCH:-main}
case "$BLOG_DEPLOY_MODE" in
  gateway) mode_file=docker-compose.gateway.yml ;;
  preview) mode_file=docker-compose.preview.yml ;;
  https) mode_file=docker-compose.yml ;;
  *) fail 'BLOG_DEPLOY_MODE 必须为 gateway、preview 或 https。' ;;
esac
[ -f "$BLOG_ENV_FILE" ] || fail '运行环境文件不存在。'
[ -d "$BLOG_HOST_DATA_DIR/posts" ] && [ -d "$BLOG_HOST_DATA_DIR/uploads" ] || fail '外部数据需要 posts 和 uploads 目录。'
BLOG_HOST_DATA_DIR=$(cd "$BLOG_HOST_DATA_DIR" && pwd -P)
BLOG_ENV_FILE=$(cd "$(dirname "$BLOG_ENV_FILE")" && pwd -P)/$(basename "$BLOG_ENV_FILE")
case "$BLOG_HOST_DATA_DIR/" in "$BLOG_REPO_DIR/"*) fail '数据必须位于仓库外。' ;; esac
case "$BLOG_ENV_FILE" in "$BLOG_REPO_DIR/"*) fail '运行环境必须位于仓库外。' ;; esac
mkdir -p "$BLOG_STATE_DIR"
BLOG_STATE_DIR=$(cd "$BLOG_STATE_DIR" && pwd -P)
case "$BLOG_STATE_DIR/" in "$BLOG_REPO_DIR/"*) fail '部署状态必须位于仓库外。' ;; esac
export BLOG_HOST_DATA_DIR BLOG_ENV_FILE BLOG_STATE_DIR
lock="$BLOG_STATE_DIR/.update-lock"
mkdir "$lock" 2>/dev/null || fail '已有部署运行；确认无进程后才可删除 .update-lock。'
cleanup() { rmdir "$lock" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
git rev-parse --verify HEAD >/dev/null
[ -z "$(git status --porcelain)" ] || fail '仓库存在未提交修改，请先处理。'
compose() { docker compose --project-name "$BLOG_COMPOSE_PROJECT_NAME" --env-file "$BLOG_ENV_FILE" -f "$mode_file" "$@"; }
old_image=
[ ! -f "$BLOG_STATE_DIR/current-image" ] || old_image=$(cat "$BLOG_STATE_DIR/current-image")
if [ "$action" = --rollback ]; then
  [ -s "$BLOG_STATE_DIR/previous-image" ] || fail '没有可回退镜像。'
  new_image=$(cat "$BLOG_STATE_DIR/previous-image")
else
  new_image=
fi
BACKUP_REQUIRE_NEW=1 BACKUP_DIR="$BLOG_STATE_DIR/backups" sh deploy/backup.sh
if [ "$action" != --rollback ]; then
  if [ "$action" != --no-pull ]; then
    git fetch "$BLOG_GIT_REMOTE" "$BLOG_GIT_BRANCH"
    git merge --ff-only FETCH_HEAD
  fi
  commit=$(git rev-parse --verify HEAD)
  # A rebuild of the same commit must preserve its previously running image.
  new_image="self-blog:$commit-$(date +%Y%m%d%H%M%S)-$$"
  docker build --build-arg "NPM_REGISTRY=${NPM_REGISTRY:-https://registry.npmjs.org}" -t "$new_image" .
fi
BLOG_IMAGE=$new_image
export BLOG_IMAGE
docker image inspect "$BLOG_IMAGE" >/dev/null
if ! compose up --wait --wait-timeout 180 --no-build || ! compose exec -T blog node scripts/healthcheck.mjs; then
  if [ -n "$old_image" ]; then
    BLOG_IMAGE=$old_image
    export BLOG_IMAGE
    if compose up --wait --wait-timeout 180 --no-build && compose exec -T blog node scripts/healthcheck.mjs; then
      echo '部署失败，已恢复此前镜像。' >&2
    else
      echo '部署失败，恢复也失败；请检查容器日志和外部备份。' >&2
    fi
  else
    echo '首次部署失败，没有已记录镜像可恢复。' >&2
  fi
  exit 1
fi
if [ -n "$old_image" ] && [ "$old_image" != "$new_image" ]; then
  printf '%s\n' "$old_image" > "$BLOG_STATE_DIR/previous-image.tmp"
  mv "$BLOG_STATE_DIR/previous-image.tmp" "$BLOG_STATE_DIR/previous-image"
fi
printf '%s\n' "$new_image" > "$BLOG_STATE_DIR/current-image.tmp"
mv "$BLOG_STATE_DIR/current-image.tmp" "$BLOG_STATE_DIR/current-image"
echo "部署完成：$new_image（$BLOG_COMPOSE_PROJECT_NAME）"
