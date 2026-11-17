#!/bin/sh
set -eu

AI_PROXY_UPSTREAM=${AI_PROXY_UPSTREAM:-https://router.bangkhan.com/v1}
while [ "${AI_PROXY_UPSTREAM%/}" != "$AI_PROXY_UPSTREAM" ]; do
  AI_PROXY_UPSTREAM=${AI_PROXY_UPSTREAM%/}
done
upstream=$(printf '%s' "$AI_PROXY_UPSTREAM" | sed 's/[\\&|]/\\&/g')
sed "s|__AI_UPSTREAM__|$upstream|g" /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

umask 077
: > /etc/nginx/conf.d/ai-auth.conf
chmod 600 /etc/nginx/conf.d/ai-auth.conf
if [ -n "${AI_PROXY_KEY:-}" ]; then
  cr=$(printf '\r')
  case "$AI_PROXY_KEY" in
    *'
'*|*"$cr"*|*'$'*)
      echo 'Invalid AI_PROXY_KEY: line breaks and nginx variable markers ($) are not allowed' >&2
      exit 1
      ;;
  esac
  key=$(printf '%s' "$AI_PROXY_KEY" | sed 's/[\\"$]/\\&/g')
  printf 'proxy_set_header Authorization "Bearer %s";\n' "$key" > /etc/nginx/conf.d/ai-auth.conf
fi

if ! nginx -t; then
  echo 'AI proxy nginx configuration is invalid; check AI_PROXY_UPSTREAM and AI_PROXY_KEY' >&2
  exit 1
fi
exec nginx -g 'daemon off;'
