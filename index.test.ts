import { describe } from "node:test";
import assert from "node:assert";
import { sql, type Expression, Statement } from "./index";

describe("SQL query builder", () => {
  describe("SELECT statements", () => {
    describe("SELECT", () => {
      check(
        sql.select(["id", "name"]).from("users").where({
          id: 1,
        }),
        "SELECT id, name FROM users WHERE id = $1",
        [1],
      );
    });

    describe("SELECT *", () => {
      check(sql.select().from("users"), "SELECT * FROM users", []);
    });

    describe("SELECT COUNT", () => {
      check(
        sql.select([sql.raw("COUNT(*)")]).from("users"),
        "SELECT COUNT(*) FROM users",
        [],
      );
    });

    describe("SELECT DISTINCT", () => {
      check(
        sql.select(["id", "name"]).distinct().from("users"),
        "SELECT DISTINCT id, name FROM users",
        [],
      );
    });

    describe("SELECT WHERE", () => {
      check(
        sql.select().from("users").where(sql.isNull("id")),
        "SELECT * FROM users WHERE id IS NULL",
        [],
      );
    });

    describe("GROUP BY/HAVING", () => {
      check(
        sql
          .select()
          .from("users")
          .groupBy(["id", "name"])
          .having(sql.raw("SUM(value) > ?", [1])),
        "SELECT * FROM users GROUP BY id, name HAVING SUM(value) > $1",
        [1],
      );
    });

    describe("ORDER BY", () => {
      check(
        sql.select().from("users").orderBy(["id", "name DESC"]),
        "SELECT * FROM users ORDER BY id, name DESC",
        [],
      );
    });

    describe("JOIN", () => {
      describe("INNER JOIN", () => {
        check(
          sql.select().from("users").innerJoin("sessions", {
            "users.id": "sessions.user_id",
          }),
          "SELECT * FROM users INNER JOIN sessions ON users.id = sessions.user_id",
          [],
        );
      });

      describe("LEFT JOIN", () => {
        check(
          sql.select().from("users").leftJoin("sessions", {
            "users.id": "sessions.user_id",
          }),
          "SELECT * FROM users LEFT JOIN sessions ON users.id = sessions.user_id",
          [],
        );
      });

      describe("RIGHT JOIN", () => {
        check(
          sql.select().from("users").rightJoin("sessions", {
            "users.id": "sessions.user_id",
          }),
          "SELECT * FROM users RIGHT JOIN sessions ON users.id = sessions.user_id",
          [],
        );
      });

      describe("FULL JOIN", () => {
        check(
          sql.select().from("users").fullOuterJoin("sessions", {
            "users.id": "sessions.user_id",
          }),
          "SELECT * FROM users FULL OUTER JOIN sessions ON users.id = sessions.user_id",
          [],
        );
      });
    });

    describe("LIMIT/OFFSET", () => {
      check(
        sql.select().from("users").limit(5).offset(10),
        "SELECT * FROM users LIMIT $1 OFFSET $2",
        [5, 10],
      );
    });

    describe("FOR UPDATE", () => {
      check(
        sql.select().from("users").forUpdate(),
        "SELECT * FROM users FOR UPDATE",
        [],
      );
    });
  });

  describe("INSERT statements", () => {
    describe("INSERT", () => {
      check(
        sql
          .insert()
          .into("users")
          .values([
            {
              id: 1,
              name: "John",
            },
            {
              id: 2,
              name: "Joe",
            },
          ]),
        "INSERT INTO users (id, name) VALUES ($1, $2), ($3, $4)",
        [1, "John", 2, "Joe"],
      );
    });

    describe("INSERT SELECT", () => {
      check(
        sql
          .insert()
          .into("new_users")
          .select(sql.select(["name"]).from("users")),
        "INSERT INTO new_users (name) SELECT name FROM users",
        [],
      );
    });

    describe("INSERT RETURNING *", () => {
      check(
        sql
          .insert()
          .into("users")
          .values([{ name: "John" }])
          .returning(),
        "INSERT INTO users (name) VALUES ($1) RETURNING *",
        ["John"],
      );
    });

    describe("INSERT RETURNING", () => {
      check(
        sql
          .insert()
          .into("users")
          .values([{ name: "John" }])
          .returning(["id", "name"]),
        "INSERT INTO users (name) VALUES ($1) RETURNING id, name",
        ["John"],
      );
    });
  });

  describe("UPDATE statements", () => {
    describe("UPDATE", () => {
      check(
        sql.update("users").set({ name: "John" }).where({ id: 1 }),
        "UPDATE users SET name = $1 WHERE id = $2",
        ["John", 1],
      );
    });
  });

  describe("DELETE statements", () => {
    describe("DELETE", () => {
      check(
        sql.deleteFrom("users").where({ id: 1 }),
        "DELETE FROM users WHERE id = $1",
        [1],
      );
    });
  });

  describe("WHERE clauses", () => {
    describe("=", () => {
      check(sql.eq("id", 1), "id = $1", [1]);
    });

    describe("= NULL", () => {
      check(sql.eq("id", null), "id IS NULL", []);
    });

    describe("<>", () => {
      check(sql.notEq("id", 1), "id <> $1", [1]);
    });

    describe("<> NULL", () => {
      check(sql.notEq("id", null), "id IS NOT NULL", []);
    });

    describe("<", () => {
      check(sql.lt("id", 1), "id < $1", [1]);
    });

    describe("<=", () => {
      check(sql.lte("id", 1), "id <= $1", [1]);
    });

    describe(">", () => {
      check(sql.gt("id", 1), "id > $1", [1]);
    });

    describe(">=", () => {
      check(sql.gte("id", 1), "id >= $1", [1]);
    });

    describe("IS NULL", () => {
      check(sql.isNull("id"), "id IS NULL", []);
    });

    describe("IS NOT NULL", () => {
      check(sql.isNotNull("id"), "id IS NOT NULL", []);
    });

    describe("BETWEEN", () => {
      check(sql.between("id", 1, 2), "id BETWEEN $1 AND $2", [1, 2]);
    });

    describe("LIKE", () => {
      check(sql.like("name", "Jo%"), "name LIKE $1", ["Jo%"]);
    });

    describe("LIKE + escape character", () => {
      check(sql.like("name", "Jo%", "~"), "name LIKE $1 ESCAPE '~'", ["Jo%"]);
    });

    describe("ILIKE", () => {
      check(sql.ilike("name", "Jo%"), "name ILIKE $1", ["Jo%"]);
    });

    describe("ILIKE + escape character", () => {
      check(sql.ilike("name", "Jo%", "~"), "name ILIKE $1 ESCAPE '~'", ["Jo%"]);
    });

    describe("IN", () => {
      check(sql.in("id", [1, 2, 3]), "id IN ($1, $2, $3)", [1, 2, 3]);
    });

    describe("AND", () => {
      check(
        sql.and([sql.eq("id", 1), sql.eq("name", "John")]),
        "(id = $1 AND name = $2)",
        [1, "John"],
      );
    });

    describe("OR", () => {
      check(
        sql.or([sql.eq("id", 1), sql.eq("name", "John")]),
        "(id = $1 OR name = $2)",
        [1, "John"],
      );
    });

    describe("NOT", () => {
      check(sql.not(sql.eq("id", 1)), "NOT id = $1", [1]);
    });

    describe("raw()", () => {
      check(
        sql
          .select()
          .from("users")
          .where(sql.raw("custom_fn(?, ?)", [1, 2])),
        "SELECT * FROM users WHERE custom_fn($1, $2)",
        [1, 2],
      );
    });
  });

  describe("quotes", () => {
    describe("reserved words in table name", () => {
      describe("basic", () => {
        check(sql.select().from("user"), `SELECT * FROM "user"`, []);
      });

      describe("with schema", () => {
        check(
          sql.select().from("system.user"),
          `SELECT * FROM "system"."user"`,
          [],
        );
      });

      describe("with alias", () => {
        check(sql.select().from("user u"), `SELECT * FROM "user" u`, []);
      });

      describe("with schema and alias", () => {
        check(
          sql.select().from("system.user AS u"),
          `SELECT * FROM "system"."user" AS u`,
          [],
        );
      });

      describe("with schema and alias without AS", () => {
        check(
          sql.select().from("system.user u"),
          `SELECT * FROM "system"."user" u`,
          [],
        );
      });
    });

    describe("reserved words in columns name", () => {
      check(
        sql
          .select(["user", "system"])
          .from("users")
          .groupBy(["period"])
          .orderBy(["both"]),
        `SELECT "user", "system" FROM users GROUP BY "period" ORDER BY "both"`,
        [],
      );
    });

    describe("with uppercase characters", () => {
      check(sql.select(["Id"]).from("Users"), `SELECT "Id" FROM "Users"`, []);
    });
  });

  describe("options", () => {
    describe("custom placeholder (node-mysql)", () => {
      sql.setOption("placeholder", "?");

      check(
        sql.select().from("users").where({
          id: 1,
        }),
        "SELECT * FROM users WHERE id = ?",
        [1],
      );

      sql.setOption("placeholder", "$%d");
    });

    describe("custom placeholder (node-sqlite3)", () => {
      sql.setOption("placeholder", "?%d");

      check(
        sql.select().from("users").where({
          id: 1,
        }),
        "SELECT * FROM users WHERE id = ?1",
        [1],
      );

      sql.setOption("placeholder", "$%d");
    });

    describe("custom quote character", () => {
      sql.setOption("quoteChar", "`");

      check(sql.select().from("user"), "SELECT * FROM \`user\`", []);

      sql.setOption("quoteChar", '"');
    });
  });
});

function check(
  statement: Statement | Expression,
  expectedSQL: string,
  expectedValues: any[],
) {
  if (statement instanceof Statement) {
    const result = statement.build();
    assert.equal(result.text, expectedSQL);
    assert.deepEqual(result.values, expectedValues);
  } else {
    const ctx = {
      values: [],
    };
    const result = statement(ctx);
    assert.equal(result, expectedSQL);
    assert.deepEqual(ctx.values, expectedValues);
  }
}
