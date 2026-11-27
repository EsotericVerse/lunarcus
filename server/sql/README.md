# LAS SQL drivers

`LAS_IMPORT_SQL_TYPE` selects the driver used only by LAS import writes.
LAS Auth remains fixed on PostgreSQL through `LAS_HYPERDRIVE`.

- `postgres` uses the native Kysely PostgreSQL dialect and the existing
  `LAS_HYPERDRIVE` binding, falling back to `LAS_DATABASE_URL` only for the
  import writer.
- `mysql` uses the native Kysely MySQL dialect and `LAS_MYSQL_HYPERDRIVE` or
  `LAS_MYSQL_DATABASE_URL`.
- `mssql` uses the native Tedious TCP/TLS driver in `mssql.mjs` and
  `LAS_MSSQL_DATABASE_URL`; it does not use the Kysely MSSQL dialect or
  Hyperdrive.

The import path maps Scope to a fixed Galaxy table name per engine. It never
accepts a table name, SQL fragment, or connection URL from the upload body and
never runs DDL or migrations.

The installed LAS ZenStack v3 package is used by Auth and does not provide a
SQL Server provider in this repository. SQL Server import writes therefore
stay in their own native driver file unless the repository adopts a separate
ZenStack SQL Server runtime.
