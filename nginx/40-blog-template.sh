#!/bin/sh
set -eu
mkdir -p /var/run/blog-template
cp /usr/share/nginx/blog/index.html /var/run/blog-template/index.html.tmp
mv /var/run/blog-template/index.html.tmp /var/run/blog-template/index.html
