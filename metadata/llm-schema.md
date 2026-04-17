# Karpathy LLM with Obsidian Idea
# Project Structure is defined in /maps/vault-map.md 



# Page Conventions
Every wiki page MUST have YAML frontmatter:
---
title: Page Title
type: place 
tags: #brovis
location: 
best-for: 
sources: [file.pdf]
related: [[linked-page]]
created: YYYY-MM-DD
updated: YYYY-MM-DD
confidence: high|medium|low
---

## Time-Sensitive Claims
Any statement about current political status, government, economic conditions, safety/travel advisories, population figures, or ongoing conflicts MUST be followed by a last-verified date inline:

> "Venezuela is currently under authoritarian rule (verified 2026-04-14)."

Omit the tag only for stable historical facts (ancient ruins, geography, founding dates). The LINT workflow flags pages that contain time-sensitive language without a verified date.

## Workflows
**Ingest workflow**: 
1. read the full source document from /3 MLOps/1 Ingestion/
2. discuss key takeaways with the user before writing anything
3. create/update data pages based on the place information
4. create links to associated pages, like country where the place is located
5. update /data/index.md
6. update /data/log.md

**Query**: 
1. read index.md first
2. synthesize with [[links]]