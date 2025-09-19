# SQL query builder for TypeScript

This project is a transparent, lightweight and schema-less library for creating SQL statements, written in TypeScript.

Features:

- single [source file](./index.ts)
- no dependency
- [100% test coverage](./index.test.ts)

To use it, you can simply copy the content of the [`index.ts`](./index.ts) file in your project.

Heavily inspired by [SQL Bricks.js](https://github.com/datavjs/sql-bricks).

<!-- TOC -->
* [Usage](#usage)
  * [With `pg`](#with-pg)
  * [With `sqlite`](#with-sqlite)
* [Notes](#notes)
  * [Mutability](#mutability)
  * [Raw expressions](#raw-expressions)
* [API](#api)
  * [SELECT](#select)
    * [`select()`](#select-1)
    * [`.distinct()`](#distinct)
    * [`.where()`](#where)
    * [`.groupBy()`](#groupby)
    * [`.having()`](#having)
    * [`.orderBy()`](#orderby)
    * [`.limit()`](#limit)
    * [`.offset()`](#offset)
    * [`.innerJoin()`](#innerjoin)
    * [`.leftJoin()`](#leftjoin)
    * [`.rightJoin()`](#rightjoin)
    * [`.fullOuterJoin()`](#fullouterjoin)
    * [`.forUpdate()`](#forupdate)
  * [INSERT](#insert)
    * [`insert()`](#insert-1)
    * [`.into()`](#into)
    * [`.values()`](#values)
    * [`.select()`](#select-2)
    * [`.returning()`](#returning)
  * [UPDATE](#update)
    * [`update()`](#update-1)
    * [`.set()`](#set)
    * [`.where()`](#where-1)
  * [DELETE](#delete)
    * [`deleteFrom()`](#deletefrom)
    * [`.where()`](#where-2)
  * [WHERE clauses](#where-clauses)
  * [`setOption()`](#setoption)
* [Alternatives](#alternatives)
<!-- TOC -->

## Usage

### With [`pg`](https://github.com/brianc/node-postgres)

```js
import { sql } from "./query-builder.ts";

const { select } = sql;

const { text, values } = select(["id", "name"])
  .from("users")
  .where({
    id: 1,
  })
  .build();

// text: SELECT id, name FROM users WHERE id = $1
// values: [1]

const result = await pool.query(text, values);
```

Reference: https://node-postgres.com/

### With [`sqlite`](https://github.com/kriasoft/node-sqlite)

```js
import { sql } from "./query-builder.ts";

sql.set("placeholder", "?");

const { select } = sql;

const { text, values } = select(["id", "name"])
  .from("users")
  .where({
    id: 1,
  })
  .build();

// text: SELECT id, name FROM users WHERE id = ?
// values: [1]

const result = await db.get(text, values);
```

Reference: https://github.com/kriasoft/node-sqlite

## Notes

### Mutability

Statements are **mutable**:

```ts
const query = select()
  .from("users")
  .where({
    id: 1,
    name: "John"
  });
const { text, values } = query.build();
```

is equivalent to (without chaining):

```ts
const query = select();
query.from("users");
query.where({
  id: 1,
  name: "John"
});

// no need to write
// query = query.where({
//   id: 1,
//   name: "John"
// });

const { text, values } = query.build();
```

### Raw expressions

The API does not cover all SQL functions like `SUM()` or `COUNT()̀`. For this use case, you can use `raw()`:

```ts
const { select, raw } = sql;

select(raw("COUNT(*)"))
  .from("users")
// SELECT COUNT(*) FROM users
```

## API

### SELECT

#### `select()`

```ts
select()
  .from("users")
// SELECT * FROM users

select(["id", "name"])
  .from("users")
// SELECT id, name FROM users
```

#### `.distinct()`

```ts
select(["id", "name"])
  .distinct()
  .from("users")
// SELECT DISTINCT id, name FROM users
```

#### `.where()`

With an object:

```ts
select()
  .from("users")
  .where({
    id: 1,
    name: "John"
  })
// SELECT * FROM users WHERE id = $1 AND name = $2
```

With a [WHERE clause](#where-clauses):

```ts
const { select, isNull } = sql;

select()
  .from("users")
  .where(isNull("id"))
// SELECT * FROM users WHERE id IS NULL
```

#### `.groupBy()`

```ts
select()
  .from("users")
  .groupBy(["id", "name"])
// SELECT * FROM users GROUP BY id, name
```

#### `.having()`

```ts
const { select, raw } = sql;

select()
  .from("users")
  .groupBy(["id", "name"])
  .having(raw("SUM(value) > ?", [1]))
// SELECT * FROM users GROUP BY id, name HAVING SUM(value) > $1
```

#### `.orderBy()`

```ts
select()
  .from("users")
  .orderBy(["id", "name DESC"])
// SELECT * FROM users ORDER BY id, name DESC
```

#### `.limit()`

```ts
select()
  .from("users")
  .limit(5)
// SELECT * FROM users LIMIT $1
```

#### `.offset()`

```ts
select()
  .from("users")
  .limit(5)
  .offset(10)
// SELECT * FROM users LIMIT $1 OFFSET $2
```

#### `.innerJoin()`

```ts
select()
  .from("users")
  .innerJoin("sessions", {
    "users.id": "sessions.user_id",
  })
// SELECT * FROM users INNER JOIN sessions ON users.id = sessions.user_id
```

#### `.leftJoin()`

```ts
select()
  .from("users")
  .leftJoin("sessions", {
    "users.id": "sessions.user_id",
  })
// SELECT * FROM users LEFT JOIN sessions ON users.id = sessions.user_id
```

#### `.rightJoin()`

```ts
select()
  .from("users")
  .rightJoin("sessions", {
    "users.id": "sessions.user_id",
  })
// SELECT * FROM users RIGHT JOIN sessions ON users.id = sessions.user_id
```

#### `.fullOuterJoin()`

```ts
select()
  .from("users")
  .fullOuterJoin("sessions", {
    "users.id": "sessions.user_id",
  })
// SELECT * FROM users FULL OUTER JOIN sessions ON users.id = sessions.user_id
```

#### `.forUpdate()`

```ts
select()
  .from("users")
  .forUpdate()
// SELECT * FROM users FOR UPDATE
```

### INSERT

#### `insert()`
#### `.into()`
#### `.values()`

```ts
insert()
  .into("users")
  .values([
    {
      id: 1,
      name: "John"
    },
    {
      id: 2,
      name: "Joe"
    },
  ])
// INSERT INTO users (id, name) VALUES ($1, $2), ($3, $4)
```

#### `.select()`

```ts
insert()
  .into("new_users")
  .select(select(["name"]).from("users"))
// INSERT INTO new_users (name) SELECT name FROM users
```

#### `.returning()`

```ts
insert()
  .into("users")
  .values([
    { name: "John" }
  ])
  .returning()
// INSERT INTO users (name) VALUES ($1) RETURNING *

insert()
  .into("users")
  .values([
    { name: "John" }
  ])
  .returning(["id", "name"])
// INSERT INTO users (name) VALUES ($1) RETURNING id, name
```

### UPDATE

#### `update()`
#### `.set()`

```ts
update("users")
  .set({
    name: "John"
  })
// UPDATE users SET name = $1
```

#### `.where()`

With an object:

```ts
update("users")
  .set({
    name: "Joe"
  })
  .where({
    id: 1,
    name: "John"
  })
// UPDATE users SET name = $1 WHERE id = $2 AND name = $3
```

With a [WHERE clause](#where-clauses):

```ts
const { update, isNull } = sql;

update("users")
  .set({
    name: "Joe"
  })
  .where(isNull("id"))
// UPDATE users SET name = $1 WHERE id IS NULL
```

### DELETE

#### `deleteFrom()`
#### `.where()`

```ts
deleteFrom("users")
  .where({
    id: 1
  })
// DELETE FROM users WHERE id = $1
```

### WHERE clauses

| Condition                                | Output                  |
|------------------------------------------|-------------------------|
| `eq("id", 1)`                            | `id = $1`               |
| `notEq("id", 1)`                         | `id <> $1`              |
| `lt("id", 1)`                            | `id < $1`               |
| `lte("id", 1)`                           | `id <= $1`              |
| `gt("id", 1)`                            | `id > $1`               |
| `gte("id", 1)`                           | `id >= $1`              |
| `isNull("id")`                           | `id IS NULL`            |
| `isNotNull("id")`                        | `id IS NOT NULL`        |
| `between("id", 1, 2)`                    | `id BETWEEN $1 AND $2`  |
| `like("name", "Jo%")`                    | `name LIKE $1`          |
| `ilike("name", "Jo%")`                   | `name ILIKE $1`         |
| `in("id", [1, 2, 3])`                    | `id IN ($1, $2, $3)`    |
| `and([eq("id", 1), eq("name", "John")])` | `id = $1 AND name = $2` |
| `or([eq("id", 1), eq("name", "John")]`   | `id = $1 OR name = $2`  |
| `not(eq("id", 1))`                       | `NOT id = $1`           |
| `raw("custom_fn(?, ?)", [1, 2])`         | `custom_fn($1, $2)`     |

### `setOption()`

Configure database-specific options:

```ts
import { sql } from "./query-builder.ts";

sql.setOption("placeholder", "?");
sql.setOption("quoteChar", "`");
```

## Alternatives

- `Knex`: https://knexjs.org/
- `kysely`: https://kysely.dev/
- `sql-bricks`: https://github.com/datavjs/sql-bricks
- `squel` (unmaintained): https://github.com/hiddentao/squel
- `sql-query`: https://github.com/dresende/node-sql-query
