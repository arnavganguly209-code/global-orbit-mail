import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { normalizeSha512Crypt } from "@/lib/mail/sha512-crypt";

const execFileAsync = promisify(execFile);

/** Dovecot 2.3 variants: "user authenticated" or "auth succeeded". */
function isDoveadmAuthSuccess(output: string): boolean {
  const text = output.replace(/\r/g, "\n");
  // Fail closed if an explicit failure is the only signal and success never appears.
  const succeeded =
    /passdb:\s*user authenticated/i.test(text) ||
    /passdb:[^\n]*\bauth succeeded\b/i.test(text) ||
    /\bauth succeeded\b/i.test(text) ||
    /\buser authenticated\b/i.test(text);
  if (succeeded) return true;
  return false;
}

export type MysqlMailAuthResult = {
  ok: boolean;
  email?: string;
  error?: string;
  database?: string;
  authTest?: boolean;
  authOutput?: string;
};

type MysqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

let pool: Pool | null = null;
let cachedConfig: MysqlConfig | null = null;

function parseConnectLine(connect: string): Partial<MysqlConfig> {
  const out: Partial<MysqlConfig> = {};
  const cleaned = connect.replace(/['"]/g, " ");
  const host = cleaned.match(/(?:^|\s)host=([^\s]+)/)?.[1];
  const port = cleaned.match(/(?:^|\s)port=([^\s]+)/)?.[1];
  const user = cleaned.match(/(?:^|\s)user=([^\s]+)/)?.[1];
  const password = cleaned.match(/(?:^|\s)password=([^\s]+)/)?.[1];
  const dbname =
    cleaned.match(/(?:^|\s)dbname=([^\s]+)/)?.[1] ??
    cleaned.match(/(?:^|\s)database=([^\s]+)/)?.[1];
  if (host) out.host = host;
  if (port) out.port = Number(port);
  if (user) out.user = user;
  if (password !== undefined) out.password = password;
  if (dbname) out.database = dbname;
  return out;
}

function loadFromDovecotSqlConf(): Partial<MysqlConfig> {
  const candidates = [
    process.env.DOVECOT_SQL_CONF?.trim(),
    "/etc/dovecot/dovecot-sql.conf.ext",
    "/etc/dovecot/conf.d/dovecot-sql.conf.ext",
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      const text = readFileSync(file, "utf8");
      const connect = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.startsWith("connect") && l.includes("="));
      if (!connect) continue;
      const value = connect.replace(/^connect\s*=\s*/, "").trim();
      return parseConnectLine(value);
    } catch {
      // try next
    }
  }
  return {};
}

function resolveMysqlConfig(): MysqlConfig | null {
  if (cachedConfig) return cachedConfig;

  const url = process.env.MAIL_MYSQL_URL?.trim();
  if (url) {
    try {
      const u = new URL(url);
      cachedConfig = {
        host: u.hostname || "127.0.0.1",
        port: u.port ? Number(u.port) : 3306,
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname.replace(/^\//, "") || "mailserver",
      };
      return cachedConfig;
    } catch {
      return null;
    }
  }

  const fromFile = loadFromDovecotSqlConf();
  const host =
    process.env.MAIL_MYSQL_HOST?.trim() || fromFile.host || "127.0.0.1";
  const user = process.env.MAIL_MYSQL_USER?.trim() || fromFile.user;
  // Local mail VPS: default host is always reachable; require a user from env or dovecot conf.
  if (!user) return null;

  cachedConfig = {
    host,
    port: Number(process.env.MAIL_MYSQL_PORT ?? fromFile.port ?? 3306),
    user,
    password: process.env.MAIL_MYSQL_PASSWORD ?? fromFile.password ?? "",
    database:
      process.env.MAIL_MYSQL_DATABASE?.trim() || fromFile.database || "mailserver",
  };
  return cachedConfig;
}

export function isMysqlMailAuthConfigured(): boolean {
  return resolveMysqlConfig() !== null;
}

function getPool(): Pool {
  const cfg = resolveMysqlConfig();
  if (!cfg) throw new Error("MySQL mail auth not configured");
  if (!pool) {
    pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
}

async function tableExists(conn: PoolConnection, name: string): Promise<boolean> {
  const [rows] = await conn.query<RowDataPacket[]>("SHOW TABLES LIKE ?", [name]);
  return rows.length > 0;
}

async function columnNames(conn: PoolConnection, table: string): Promise<Set<string>> {
  const [rows] = await conn.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${table}\``);
  return new Set(rows.map((r) => String(r.Field).toLowerCase()));
}

async function ensureDomainId(conn: PoolConnection, domain: string): Promise<number | null> {
  if (!(await tableExists(conn, "virtual_domains"))) return null;
  const cols = await columnNames(conn, "virtual_domains");
  if (!cols.has("name")) return null;

  await conn.query(
    `INSERT INTO virtual_domains (name) VALUES (?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [domain],
  );
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM virtual_domains WHERE name = ? LIMIT 1`,
    [domain],
  );
  const id = rows[0]?.id;
  return typeof id === "number" ? id : Number(id) || null;
}

/**
 * Ensure MariaDB/MySQL virtual_domains row exists for Postfix/Dovecot maps.
 */
export async function upsertMysqlVirtualDomain(domain: string): Promise<MysqlMailAuthResult> {
  const cfg = resolveMysqlConfig();
  if (!cfg) {
    return {
      ok: false,
      error:
        "MySQL mail auth not configured (MAIL_MYSQL_* or /etc/dovecot/dovecot-sql.conf.ext)",
    };
  }
  const name = domain.toLowerCase().trim();
  if (!name) return { ok: false, error: "domain required" };

  let conn: PoolConnection | null = null;
  try {
    conn = await getPool().getConnection();
    if (!(await tableExists(conn, "virtual_domains"))) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS virtual_domains (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
    const id = await ensureDomainId(conn, name);
    if (id == null) {
      return { ok: false, error: "failed to upsert virtual_domains", database: cfg.database };
    }
    return { ok: true, database: cfg.database };
  } catch (error) {
    return {
      ok: false,
      database: cfg.database,
      error: error instanceof Error ? error.message : "virtual_domains upsert failed",
    };
  } finally {
    conn?.release();
  }
}

/**
 * Upsert Dovecot auth into MySQL/MariaDB mailserver.virtual_users (SHA512-CRYPT only).
 */
export async function upsertMysqlVirtualUser(input: {
  email: string;
  passwordHash: string;
  domain?: string;
}): Promise<MysqlMailAuthResult> {
  const cfg = resolveMysqlConfig();
  if (!cfg) {
    return {
      ok: false,
      error:
        "MySQL mail auth not configured (MAIL_MYSQL_* or /etc/dovecot/dovecot-sql.conf.ext)",
    };
  }

  const email = input.email.toLowerCase().trim();
  const domain = (input.domain ?? email.split("@")[1] ?? "").toLowerCase();
  const password = normalizeSha512Crypt(input.passwordHash);
  if (!email || !domain) return { ok: false, error: "email required" };
  if (!password) {
    return {
      ok: false,
      error: "password must be SHA512-CRYPT ($6$…) — bcrypt/argon rejected",
    };
  }

  let conn: PoolConnection | null = null;
  try {
    conn = await getPool().getConnection();

    if (!(await tableExists(conn, "virtual_users"))) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS virtual_domains (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS virtual_users (
          id INT NOT NULL AUTO_INCREMENT,
          domain_id INT NOT NULL,
          email VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY email (email),
          KEY domain_id (domain_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    const cols = await columnNames(conn, "virtual_users");
    if (!cols.has("email") || !cols.has("password")) {
      return {
        ok: false,
        error: "virtual_users must have email and password columns",
        database: cfg.database,
      };
    }

    const domainId = cols.has("domain_id") ? await ensureDomainId(conn, domain) : null;

    if (cols.has("domain_id") && domainId != null) {
      await conn.query(
        `INSERT INTO virtual_users (email, password, domain_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           password = VALUES(password),
           domain_id = VALUES(domain_id)`,
        [email, password, domainId],
      );
    } else if (cols.has("domain")) {
      const hasActive = cols.has("active");
      if (hasActive) {
        await conn.query(
          `INSERT INTO virtual_users (email, password, domain, active)
           VALUES (?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE password = VALUES(password), active = 1`,
          [email, password, domain],
        );
      } else {
        await conn.query(
          `INSERT INTO virtual_users (email, password, domain)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE password = VALUES(password)`,
          [email, password, domain],
        );
      }
    } else {
      await conn.query(
        `INSERT INTO virtual_users (email, password)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE password = VALUES(password)`,
        [email, password],
      );
    }

    const [verify] = await conn.query<RowDataPacket[]>(
      `SELECT email, LEFT(password, 3) AS prefix FROM virtual_users WHERE email = ? LIMIT 1`,
      [email],
    );
    if (!verify[0]?.email) {
      return {
        ok: false,
        email,
        database: cfg.database,
        error: "MySQL upsert reported ok but SELECT found no row",
      };
    }
    if (String(verify[0].prefix) !== "$6$") {
      return {
        ok: false,
        email,
        database: cfg.database,
        error: `stored password prefix is '${verify[0].prefix}' — expected $6$ (SHA512-CRYPT)`,
      };
    }

    return { ok: true, email, database: cfg.database };
  } catch (error) {
    console.error("[mail-auth:upsert]", {
      email,
      database: cfg.database,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      email,
      database: cfg.database,
      error: error instanceof Error ? error.message : "MySQL upsert failed",
    };
  } finally {
    conn?.release();
  }
}

/** Prove Dovecot passdb accepts the mailbox. Required gate for provision success. */
export async function doveadmAuthTest(
  email: string,
  password: string,
): Promise<{ ok: boolean; output: string; skipped?: boolean }> {
  const bin = process.env.DOVEADM_PATH?.trim() || "doveadm";
  try {
    const { stdout, stderr } = await execFileAsync(
      bin,
      ["auth", "test", email.toLowerCase().trim(), password],
      { timeout: 20_000, maxBuffer: 1024 * 1024 },
    );
    const output = `${stdout}\n${stderr}`.trim();
    const ok = isDoveadmAuthSuccess(output);
    return { ok, output };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string; code?: string };
    const output = `${err.stdout ?? ""}\n${err.stderr ?? err.message ?? ""}`.trim();
    if (isDoveadmAuthSuccess(output)) {
      return { ok: true, output };
    }
    // Binary missing (dev / PATH) — try absolute path used on Ubuntu mail hosts
    if (err.code === "ENOENT" && bin === "doveadm") {
      try {
        const { stdout, stderr } = await execFileAsync(
          "/usr/bin/doveadm",
          ["auth", "test", email.toLowerCase().trim(), password],
          { timeout: 20_000, maxBuffer: 1024 * 1024 },
        );
        const out2 = `${stdout}\n${stderr}`.trim();
        return { ok: isDoveadmAuthSuccess(out2), output: out2 };
      } catch (error2) {
        const err2 = error2 as { stdout?: string; stderr?: string; message?: string; code?: string };
        const out2 = `${err2.stdout ?? ""}\n${err2.stderr ?? err2.message ?? ""}`.trim();
        if (isDoveadmAuthSuccess(out2)) return { ok: true, output: out2 };
        if (err2.code === "ENOENT" && process.env.DOVECOT_REQUIRE_AUTH_TEST === "false") {
          return {
            ok: true,
            skipped: true,
            output: "doveadm not installed; MySQL row verified only",
          };
        }
        return { ok: false, output: out2 || "doveadm auth test failed" };
      }
    }
    return { ok: false, output: output || "doveadm auth test failed" };
  }
}

/**
 * Write MySQL virtual_users + prove doveadm auth test.
 * Fails closed — mailbox must not be considered provisioned otherwise.
 */
export async function provisionDovecotAuth(input: {
  email: string;
  password: string;
  passwordHash: string;
  domain?: string;
}): Promise<MysqlMailAuthResult> {
  const upsert = await upsertMysqlVirtualUser({
    email: input.email,
    passwordHash: input.passwordHash,
    domain: input.domain,
  });
  if (!upsert.ok) return upsert;

  const auth = await doveadmAuthTest(input.email, input.password);
  return {
    ...upsert,
    authTest: auth.ok,
    authOutput: auth.output,
    ok: auth.ok,
    error: auth.ok
      ? undefined
      : `doveadm auth test failed after MySQL write: ${auth.output}`,
  };
}

export async function deactivateMysqlVirtualUser(email: string): Promise<MysqlMailAuthResult> {
  if (!isMysqlMailAuthConfigured()) {
    return { ok: false, error: "MySQL mail auth not configured" };
  }
  const normalized = email.toLowerCase().trim();
  let conn: PoolConnection | null = null;
  try {
    conn = await getPool().getConnection();
    if (!(await tableExists(conn, "virtual_users"))) {
      return { ok: true, email: normalized };
    }
    const cols = await columnNames(conn, "virtual_users");
    if (cols.has("active")) {
      await conn.query(`UPDATE virtual_users SET active = 0 WHERE email = ?`, [normalized]);
    } else {
      await conn.query(`DELETE FROM virtual_users WHERE email = ?`, [normalized]);
    }
    return { ok: true, email: normalized };
  } catch (error) {
    return {
      ok: false,
      email: normalized,
      error: error instanceof Error ? error.message : "MySQL deactivate failed",
    };
  } finally {
    conn?.release();
  }
}

export async function activateMysqlVirtualUser(email: string): Promise<MysqlMailAuthResult> {
  if (!isMysqlMailAuthConfigured()) {
    return { ok: false, error: "MySQL mail auth not configured" };
  }
  const normalized = email.toLowerCase().trim();
  let conn: PoolConnection | null = null;
  try {
    conn = await getPool().getConnection();
    if (!(await tableExists(conn, "virtual_users"))) {
      return { ok: false, error: "virtual_users missing" };
    }
    const cols = await columnNames(conn, "virtual_users");
    if (cols.has("active")) {
      await conn.query(`UPDATE virtual_users SET active = 1 WHERE email = ?`, [normalized]);
    }
    return { ok: true, email: normalized };
  } catch (error) {
    return {
      ok: false,
      email: normalized,
      error: error instanceof Error ? error.message : "MySQL activate failed",
    };
  } finally {
    conn?.release();
  }
}

/** Remove or deactivate a domain in MariaDB virtual_domains (+ cascade users when FK exists). */
export async function deactivateMysqlVirtualDomain(domain: string): Promise<MysqlMailAuthResult> {
  const cfg = resolveMysqlConfig();
  if (!cfg) {
    return { ok: false, error: "MySQL mail auth not configured" };
  }
  const name = domain.toLowerCase().trim();
  if (!name) return { ok: false, error: "domain required" };
  let conn: PoolConnection | null = null;
  try {
    conn = await getPool().getConnection();
    if (!(await tableExists(conn, "virtual_domains"))) {
      return { ok: true, database: cfg.database };
    }
    const cols = await columnNames(conn, "virtual_domains");
    if (cols.has("active")) {
      await conn.query(`UPDATE virtual_domains SET active = 0 WHERE name = ?`, [name]);
    } else {
      // Prefer deleting users first when no FK cascade
      if (await tableExists(conn, "virtual_users")) {
        const userCols = await columnNames(conn, "virtual_users");
        if (userCols.has("domain")) {
          await conn.query(`DELETE FROM virtual_users WHERE domain = ?`, [name]);
        } else if (userCols.has("domain_id")) {
          await conn.query(
            `DELETE FROM virtual_users WHERE domain_id IN (SELECT id FROM virtual_domains WHERE name = ?)`,
            [name],
          );
        }
      }
      await conn.query(`DELETE FROM virtual_domains WHERE name = ?`, [name]);
    }
    return { ok: true, database: cfg.database };
  } catch (error) {
    return {
      ok: false,
      database: cfg.database,
      error: error instanceof Error ? error.message : "virtual_domains deactivate failed",
    };
  } finally {
    conn?.release();
  }
}

/** Upsert Postfix-style virtual_aliases (address → goto). */
export async function upsertMysqlVirtualAlias(input: {
  address: string;
  goto: string;
}): Promise<MysqlMailAuthResult> {
  const cfg = resolveMysqlConfig();
  if (!cfg) {
    return { ok: false, error: "MySQL mail auth not configured" };
  }
  const address = input.address.toLowerCase().trim();
  const goto = input.goto.toLowerCase().trim();
  if (!address || !goto) return { ok: false, error: "address and goto required" };

  let conn: PoolConnection | null = null;
  try {
    conn = await getPool().getConnection();
    if (!(await tableExists(conn, "virtual_aliases"))) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS virtual_aliases (
          id INT NOT NULL AUTO_INCREMENT,
          source VARCHAR(255) NOT NULL,
          destination TEXT NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY source (source)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
    const cols = await columnNames(conn, "virtual_aliases");
    if (cols.has("address") && cols.has("goto")) {
      await conn.query(
        `INSERT INTO virtual_aliases (address, goto) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE goto = VALUES(goto)`,
        [address, goto],
      );
    } else if (cols.has("source") && cols.has("destination")) {
      await conn.query(
        `INSERT INTO virtual_aliases (source, destination) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE destination = VALUES(destination)`,
        [address, goto],
      );
    } else {
      return {
        ok: false,
        database: cfg.database,
        error: "virtual_aliases schema unsupported (need address/goto or source/destination)",
      };
    }
    return { ok: true, database: cfg.database };
  } catch (error) {
    return {
      ok: false,
      database: cfg.database,
      error: error instanceof Error ? error.message : "virtual_aliases upsert failed",
    };
  } finally {
    conn?.release();
  }
}
