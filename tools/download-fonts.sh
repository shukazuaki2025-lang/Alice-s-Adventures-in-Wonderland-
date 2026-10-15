#!/bin/bash
set -e
# IM Fell English
curl -sL "https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap" | grep -oP 'url\([^)]+\)' | grep woff2 | sed 's/url(\(.*\))/\1/' | xargs -I {} curl -sL {} -o public/assets/fonts/im-fell-english.woff2

# Noto Serif SC
curl -sL "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap" | grep -oP 'url\([^)]+\)' | grep woff2 | head -n 1 | sed 's/url(\(.*\))/\1/' | xargs -I {} curl -sL {} -o public/assets/fonts/noto-serif-sc.woff2

# LXGW WenKai
curl -sL "https://fonts.googleapis.com/css2?family=LXGW+WenKai:wght@400;700&display=swap" | grep -oP 'url\([^)]+\)' | grep woff2 | head -n 1 | sed 's/url(\(.*\))/\1/' | xargs -I {} curl -sL {} -o public/assets/fonts/lxgw-wenkai.woff2

# Zen Old Mincho
curl -sL "https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@400;700&display=swap" | grep -oP 'url\([^)]+\)' | grep woff2 | head -n 1 | sed 's/url(\(.*\))/\1/' | xargs -I {} curl -sL {} -o public/assets/fonts/zen-old-mincho.woff2
