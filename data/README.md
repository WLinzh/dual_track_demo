# Data Directory

This directory contains the SQLite database and related files.

## Files Created Automatically

- `dual_track.db` - Main SQLite database
- `dual_track.db-journal` - SQLite journal file (temporary)

## Database Initialization

The database is initialized automatically when you run:

```bash
pnpm setup
# or
pnpm dev:api
```

The schema is loaded from `../schema.sql` which includes:
- Table definitions
- Indexes
- Seed data (prompt versions, templates, documents)

## Backup

To backup your database:

```bash
cp data/dual_track.db data/dual_track_backup_$(date +%Y%m%d).db
```

## Reset

To reset the database:

```bash
rm data/dual_track.db
pnpm dev:api  # Will recreate from schema.sql
```

## Size Estimates

- Empty database: ~100 KB
- After 100 events: ~500 KB
- After 1000 events: ~2-5 MB

SQLite can handle databases up to 281 TB, but for production use with high concurrency, consider PostgreSQL.
