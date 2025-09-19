export function sql() {}

interface Options {
  placeholder: string;
  quoteChar: string;
}

const options: Options = {
  placeholder: "$%d",
  quoteChar: '"',
};

sql.setOption = function <T extends keyof Options>(o: T, value: Options[T]) {
  options[o] = value;
};

interface BuildContext {
  values: any[];
}

function joinParts(parts: Array<string | undefined>) {
  return parts.filter((s) => !!s).join(" ");
}

export abstract class Statement {
  build() {
    const values: any[] = [];

    return {
      text: joinParts(
        this.computeParts({
          values,
        }),
      ),
      values,
    };
  }

  protected abstract computeParts(ctx: BuildContext): Array<string | undefined>;
}

export type Expression = (ctx: BuildContext) => string;

function joinExpression(type: string, table: string, on: Record<string, any>) {
  return () => {
    // we cannot use sql.and() since the right part of the expression must be escaped with handleColumn() instead of handleValue()
    const condition = Object.entries(on)
      .map(([column, value]) => {
        return handleColumn(column) + " = " + handleColumn(value);
      })
      .join(" AND ");

    return `${type} JOIN ${handleTable(table)} ON ${condition}`;
  };
}

class SelectStatement extends Statement {
  private _table?: string;
  private _distinct = false;
  private _columns: Array<string | Expression> = [];
  private _joins: Expression[] = [];
  private _where: Expression[] = [];
  private _orderBy: string[] = [];
  private _groupBy: string[] = [];
  private _having?: Expression;
  private _limit?: number;
  private _offset?: number;
  private _forUpdate = false;

  constructor(columns?: Array<string | Expression>) {
    super();
    if (columns) {
      this._columns.push(...columns);
    }
  }

  distinct() {
    this._distinct = true;
    return this;
  }

  from(table: string) {
    this._table = table;
    return this;
  }

  innerJoin(table: string, on: Record<string, any>) {
    this._joins.push(joinExpression("INNER", table, on));
    return this;
  }

  leftJoin(table: string, on: Record<string, any>) {
    this._joins.push(joinExpression("LEFT", table, on));
    return this;
  }

  rightJoin(table: string, on: Record<string, any>) {
    this._joins.push(joinExpression("RIGHT", table, on));
    return this;
  }

  fullOuterJoin(table: string, on: Record<string, any>) {
    this._joins.push(joinExpression("FULL OUTER", table, on));
    return this;
  }

  where(arg: Record<string, any> | Expression) {
    if (typeof arg === "function") {
      this._where.push(arg as Expression);
    } else {
      for (const [column, value] of Object.entries(arg)) {
        this._where.push(sql.eq(column, value));
      }
    }
    return this;
  }

  groupBy(columns: string[]) {
    this._groupBy.push(...columns);
    return this;
  }

  having(expr: Expression) {
    this._having = expr;
    return this;
  }

  orderBy(columns: string[]) {
    this._orderBy.push(...columns);
    return this;
  }

  limit(limit: number) {
    this._limit = limit;
    return this;
  }

  offset(offset: number) {
    this._offset = offset;
    return this;
  }

  forUpdate() {
    this._forUpdate = true;
    return this;
  }

  protected override computeParts(ctx: BuildContext) {
    return [
      "SELECT",
      this.distinctPart(),
      this.columnsPart(ctx),
      this.fromPart(),
      this.joinsPart(ctx),
      this.wherePart(ctx),
      this.groupByPart(),
      this.havingPart(ctx),
      this.orderByPart(),
      this.limitPart(ctx),
      this.offsetPart(ctx),
      this.forUpdatePart(),
    ];
  }

  protected distinctPart() {
    if (this._distinct) {
      return "DISTINCT";
    }
  }

  protected columnsPart(ctx: BuildContext) {
    if (this._columns.length) {
      return this._columns
        .map((column) => {
          return typeof column === "function"
            ? column(ctx)
            : handleColumn(column);
        })
        .join(", ");
    } else {
      return "*";
    }
  }

  protected fromPart() {
    if (this._table) {
      return `FROM ${handleTable(this._table)}`;
    }
  }

  protected joinsPart(ctx: BuildContext) {
    if (this._joins.length) {
      return this._joins.map((join) => join(ctx)).join(" ");
    }
  }

  protected wherePart(ctx: BuildContext) {
    if (this._where.length) {
      return "WHERE " + groupExpression(this._where, " AND ", false)(ctx);
    }
  }

  protected groupByPart() {
    if (this._groupBy.length) {
      return "GROUP BY " + handleColumns(this._groupBy);
    }
  }

  protected havingPart(ctx: BuildContext) {
    if (this._having) {
      return "HAVING " + this._having(ctx);
    }
  }

  protected orderByPart() {
    if (this._orderBy.length) {
      return "ORDER BY " + handleColumns(this._orderBy);
    }
  }

  protected limitPart(ctx: BuildContext) {
    if (this._limit) {
      // PostgreSQL/SQLite syntax
      return "LIMIT " + handleValue(this._limit, ctx);
    }
  }

  protected offsetPart(ctx: BuildContext) {
    if (this._offset) {
      // PostgreSQL/SQLite syntax
      return "OFFSET " + handleValue(this._offset, ctx);
    }
  }

  protected forUpdatePart() {
    if (this._forUpdate) {
      return "FOR UPDATE";
    }
  }
}

sql.select = (columns?: Array<string | Expression>) =>
  new SelectStatement(columns);

class InsertStatement extends Statement {
  private _table?: string;
  private _values: Array<Record<string, any>> = [];
  private _select?: SelectStatement;
  private _returning: string[] = [];

  into(table: string) {
    this._table = table;
    return this;
  }

  values(values: Array<Record<string, any>>) {
    this._values.push(...values);
    return this;
  }

  select(statement: SelectStatement) {
    this._select = statement;
    return this;
  }

  returning(columns = ["*"]) {
    this._returning.push(...columns);
    return this;
  }

  protected override computeParts(ctx: BuildContext) {
    return [
      "INSERT",
      this.intoPart(),
      this.columnsPart(),
      this.valuesPart(ctx),
      this.returningPart(),
    ];
  }

  protected intoPart() {
    if (this._table) {
      return "INTO " + handleTable(this._table);
    }
  }

  protected columnsPart() {
    if (this._values.length) {
      const columns = Object.keys(this._values[0]!);
      return "(" + columns.map(handleColumn).join(", ") + ")";
    }

    if (this._select) {
      // @ts-expect-error protected method
      return "(" + this._select.columnsPart() + ")";
    }
  }

  protected valuesPart(ctx: BuildContext) {
    if (this._values.length) {
      const columns = Object.keys(this._values[0]!);
      const values = this._values.map(
        (values) =>
          `(${columns.map((column) => handleValue(values[column], ctx)).join(", ")})`,
      );
      return "VALUES " + values.join(", ");
    }

    if (this._select) {
      // @ts-expect-error protected method
      return joinParts(this._select.computeParts(ctx));
    }
  }

  protected returningPart() {
    if (this._returning.length) {
      return "RETURNING " + handleColumns(this._returning);
    }
  }
}

sql.insert = () => new InsertStatement();

class UpdateStatement extends Statement {
  private _values: Record<string, any> = {};
  private _where: Expression[] = [];

  constructor(private readonly table: string) {
    super();
  }

  set(values: Record<string, any>) {
    Object.assign(this._values, values);
    return this;
  }

  where(arg: Record<string, any> | Expression) {
    if (typeof arg === "function") {
      this._where.push(arg as Expression);
    } else {
      for (const [column, value] of Object.entries(arg)) {
        this._where.push(sql.eq(column, value));
      }
    }
    return this;
  }

  protected override computeParts(ctx: BuildContext) {
    return [
      `UPDATE ${handleTable(this.table)}`,
      this.setPart(ctx),
      this.wherePart(ctx),
    ];
  }

  protected setPart(ctx: BuildContext) {
    const values = [];

    for (const [column, value] of Object.entries(this._values)) {
      values.push(`${handleColumn(column)} = ${handleValue(value, ctx)}`);
    }

    return "SET " + values.join(", ");
  }

  protected wherePart(ctx: BuildContext) {
    if (this._where.length) {
      return "WHERE " + groupExpression(this._where, " AND ", false)(ctx);
    }
  }
}

sql.update = (table: string) => new UpdateStatement(table);

class DeleteStatement extends Statement {
  private readonly _table: string;
  private _where: Expression[] = [];

  constructor(table: string) {
    super();
    this._table = table;
  }

  where(arg: Record<string, any> | Expression) {
    if (typeof arg === "function") {
      this._where.push(arg as Expression);
    } else {
      for (const [column, value] of Object.entries(arg)) {
        this._where.push(sql.eq(column, value));
      }
    }
    return this;
  }

  protected override computeParts(ctx: BuildContext) {
    return [`DELETE FROM ${handleTable(this._table)}`, this.wherePart(ctx)];
  }

  protected wherePart(ctx: BuildContext) {
    if (this._where.length) {
      return "WHERE " + groupExpression(this._where, " AND ", false)(ctx);
    }
  }
}

sql.deleteFrom = (table: string) => new DeleteStatement(table);

function groupExpression(
  clauses: Expression[],
  op: string,
  includeParens = true,
) {
  return (ctx: BuildContext) => {
    const output = clauses.map((expr) => expr(ctx)).join(op);
    return includeParens ? `(${output})` : output;
  };
}

sql.and = (clauses: Expression[]) => groupExpression(clauses, " AND ");
sql.or = (clauses: Expression[]) => groupExpression(clauses, " OR ");
sql.not = (expr: Expression) => (ctx: BuildContext) => "NOT " + expr(ctx);

function unaryExpression(column: string, op: string) {
  return () => `${handleColumn(column)} ${op}`;
}

sql.isNull = (column: string) => unaryExpression(column, "IS NULL");
sql.isNotNull = (column: string) => unaryExpression(column, "IS NOT NULL");

function binaryExpression(column: string, op: string, value: any) {
  return (ctx: BuildContext) =>
    `${handleColumn(column)} ${op} ${handleValue(value, ctx)}`;
}

sql.eq = (column: string, value: any) => {
  return value === null
    ? sql.isNull(column)
    : binaryExpression(column, "=", value);
};

sql.notEq = (column: string, value: any) => {
  return value === null
    ? sql.isNotNull(column)
    : binaryExpression(column, "<>", value);
};

sql.lt = (column: string, value: any) => binaryExpression(column, "<", value);
sql.lte = (column: string, value: any) => binaryExpression(column, "<=", value);
sql.gt = (column: string, value: any) => binaryExpression(column, ">", value);
sql.gte = (column: string, value: any) => binaryExpression(column, ">=", value);

sql.between = (column: string, low: any, high: any) => {
  return (ctx: BuildContext) =>
    `${handleColumn(column)} BETWEEN ${handleValue(low, ctx)} AND ${handleValue(high, ctx)}`;
};

function likeExpression(
  column: string,
  op: string,
  value: any,
  escapeChar?: string,
) {
  return (ctx: BuildContext) => {
    const output = `${handleColumn(column)} ${op} ${handleValue(value, ctx)}`;
    return escapeChar ? `${output} ESCAPE '${escapeChar}'` : output;
  };
}

sql.like = (column: string, value: any, escapeChar?: string) =>
  likeExpression(column, "LIKE", value, escapeChar);

sql.ilike = (column: string, value: any, escapeChar?: string) =>
  likeExpression(column, "ILIKE", value, escapeChar);

sql.in = (column: string, values: any[]) => {
  return (ctx: BuildContext) =>
    `${handleColumn(column)} IN (${values.map((value) => handleValue(value, ctx)).join(", ")})`;
};

sql.raw = (text: string, values: any[] = []) => {
  return (ctx: BuildContext) => {
    let i = 0;
    return text.replace(/\?/g, () => {
      if (i >= values.length) {
        throw new Error("not enough values");
      }

      return handleValue(values[i++], ctx);
    });
  };
};

function handleColumns(columns: string[]) {
  return columns.map(handleColumn).join(", ");
}

const WITH_SCHEMA_OR_ALIAS_REGEX = /^((\w+)\.)?(\w+)(( AS)? \w+)?$/i;

function handleTable(table: string) {
  return handleColumn(table);
}

function handleColumn(name: string) {
  const match = WITH_SCHEMA_OR_ALIAS_REGEX.exec(name);

  if (match) {
    const schema = match[2];
    const table = match[3] as string;
    const alias = match[4];

    let output = schema
      ? `${quoteKey(schema)}.${quoteKey(table)}`
      : quoteKey(table);

    if (alias) {
      output += alias;
    }

    return output;
  }

  return quoteKey(name);
}

const UPPERCASE_REGEX = /[A-Z]/;

// SQL:2023 specification: https://en.wikipedia.org/wiki/List_of_SQL_reserved_words
// prettier-ignore
const RESERVED_KEYWORDS = new Set(["abs", "absent", "acos", "all", "allocate", "alter", "and", "any", "any_value", "are", "array", "array_agg", "array_max_cardinality", "as", "asensitive", "asin", "asymmetric", "at", "atan", "atomic", "authorization", "avg", "begin", "begin_frame", "begin_partition", "between", "bigint", "binary", "blob", "boolean", "both", "btrim", "by", "call", "called", "cardinality", "cascaded", "case", "cast", "ceil", "ceiling", "char", "char_length", "character", "character_length", "check", "classifier", "clob", "close", "coalesce", "collate", "collect", "column", "commit", "condition", "connect", "constraint", "contains", "convert", "copy", "corr", "corresponding", "cos", "cosh", "count", "covar_pop", "covar_samp", "create", "cross", "cube", "cume_dist", "current", "current_catalog", "current_date", "current_default_transform_group", "current_path", "current_role", "current_row", "current_schema", "current_time", "current_timestamp", "current_transform_group_for_type", "current_user", "cursor", "cycle", "date", "day", "deallocate", "dec", "decfloat", "decimal", "declare", "default", "define", "delete", "dense_rank", "deref", "describe", "deterministic", "disconnect", "distinct", "double", "drop", "dynamic", "each", "element", "else", "empty", "end", "end_frame", "end_partition", "end-exec", "equals", "escape", "every", "except", "exec", "execute", "exists", "exp", "external", "extract", "false", "fetch", "filter", "first_value", "float", "floor", "for", "foreign", "frame_row", "free", "from", "full", "function", "fusion", "get", "global", "grant", "greatest", "group", "grouping", "groups", "having", "hold", "hour", "identity", "in", "indicator", "initial", "inner", "inout", "insensitive", "insert", "int", "integer", "intersect", "intersection", "interval", "into", "is", "join", "json", "json_array", "json_arrayagg", "json_exists", "json_object", "json_objectagg", "json_query", "json_scalar", "json_serialize", "json_table", "json_table_primitive", "json_value", "lag", "language", "large", "last_value", "lateral", "lead", "leading", "least", "left", "like", "like_regex", "listagg", "ln", "local", "localtime", "localtimestamp", "log", "log10", "lower", "lpad", "ltrim", "match", "match_number", "match_recognize", "matches", "max", "member", "merge", "method", "min", "minute", "mod", "modifies", "module", "month", "multiset", "national", "natural", "nchar", "nclob", "new", "no", "none", "normalize", "not", "nth_value", "ntile", "null", "nullif", "numeric", "occurrences_regex", "octet_length", "of", "offset", "old", "omit", "on", "one", "only", "open", "or", "order", "out", "outer", "over", "overlaps", "overlay", "parameter", "partition", "pattern", "per", "percent", "percent_rank", "percentile_cont", "percentile_disc", "period", "portion", "position", "position_regex", "power", "precedes", "precision", "prepare", "primary", "procedure", "ptf", "range", "rank", "reads", "real", "recursive", "ref", "references", "referencing", "regr_avgx", "regr_avgy", "regr_count", "regr_intercept", "regr_r2", "regr_slope", "regr_sxx", "regr_sxy", "regr_syy", "release", "result", "return", "returns", "revoke", "right", "rollback", "rollup", "row", "row_number", "rows", "rpad", "running", "savepoint", "scope", "scroll", "search", "second", "seek", "select", "sensitive", "session_user", "set", "show", "similar", "sin", "sinh", "skip", "smallint", "some", "specific", "specifictype", "sql", "sqlexception", "sqlstate", "sqlwarning", "sqrt", "start", "static", "stddev_pop", "stddev_samp", "submultiset", "subset", "substring", "substring_regex", "succeeds", "sum", "symmetric", "system", "system_time", "system_user", "table", "tablesample", "tan", "tanh", "then", "time", "timestamp", "timezone_hour", "timezone_minute", "to", "trailing", "translate", "translate_regex", "translation", "treat", "trigger", "trim", "trim_array", "true", "truncate", "uescape", "union", "unique", "unknown", "unnest", "update", "upper", "user", "using", "value", "value_of", "values", "var_pop", "var_samp", "varbinary", "varchar", "varying", "versioning", "when", "whenever", "where", "width_bucket", "window", "with", "within", "without", "year"]);

function quoteKey(name: string) {
  if (UPPERCASE_REGEX.test(name) || RESERVED_KEYWORDS.has(name)) {
    return options.quoteChar + name + options.quoteChar;
  }
  return name;
}

function handleValue(value: any, ctx: BuildContext) {
  ctx.values.push(value);
  return options.placeholder.replace("%d", String(ctx.values.length));
}
