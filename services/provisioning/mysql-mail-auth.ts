import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { normalizeSha512Crypt } from "@/lib/mail/sha512-crypt";

export type MysqlMailAuthResult = {
  ok: boolean;
  email?: string;
  error?: string;
  database?: string;
};

let pool: Pool | null = null;

function mysqlConfigured(): boolean {
  if (process.env.MAIL_MYSQL_URL?.trim()) return true;
  if (process.env.MAIL_MYSQL_HOST?.trim() && process.env.MAIL_MYSQL_USER?.trim()) return true;
  return false;
}

function parseMysqlUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "mailserver",
    waitForConnections: true,
    connectionLimit: 5,
  };
}

function poolOptions() {
  const url = process.env.MAIL_MYSQL_URL?.trim();
  if (url) return parseMysqlUrl(url);

  return {
    host: process.env.MAIL_MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.MAIL_MYSQL_PORT ?? "3306"),
    user: process.env.MAIL_MYSQL_USER ?? "mailuser",
    password: process.env.MAIL_MYSQL_PASSWORD ?? "",
    database: process.env.MAIL_MYSQL_DATABASE ?? "mailserver",
    waitForConnections: true,
    connectionLimit: 5,
  };
}

function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(poolOptions());
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
  return typeof id === "number" ? id : null;
}

/**
 * Upsert Dovecot auth into MySQL `mailserver.virtual_users`.
 * Password MUST be SHA512-CRYPT (`$6$…`).
 */
export async function upsertMysqlVirtualUser(input: {
  email: string;
  passwordHash: string;
  domain?: string;
}): Promise<MysqlMailAuthResult> {
  if (!mysqlConfigured()) {
    return {
      ok: false,
      error:
        "MySQL mail auth not configured (set MAIL_MYSQL_URL or MAIL_MYSQL_HOST/USER/PASSWORD/DATABASE)",
    };
  }

  const email = input.email.toLowerCase().trim();
  const domain = (input.domain ?? email.split("@")[1] ?? "").toLowerCase();
  const password = normalizeSha512Crypt(input.passwordHash);
  if (!email || !domain) {
    return { ok: false, error: "email required" };
  }
  if (!password) {
    return {
      ok: false,
      error: "password must be SHA512-CRYPT ($6$…) — bcrypt/argon are rejected",
    };
  }

  const db = poolOptions().database ?? "mailserver";
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
          KEY domain_id (domain_id),
          CONSTRAINT fk_virtual_users_domain
            FOREIGN KEY (domain_id) REFERENCES virtual_domains (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    const cols = await columnNames(conn, "virtual_users");
    if (!cols.has("email") || !cols.has("password")) {
      return {
        ok: false,
        error: "virtual_users must have email and password columns",
        database: db,
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
    } else if (cols.has("domain") && cols.has("active")) {
      await conn.query(
        `INSERT INTO virtual_users (email, password, domain, active)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           password = VALUES(password),
           active = 1`,
        [email, password, domain],
      );
    } else {
      await conn.query(
        `INSERT INTO virtual_users (email, password)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE password = VALUES(password)`,
        [email, password],
      );
    }

    return { ok: true, email, database: db };
  } catch (error) {
    return {
      ok: false,
      email,
      database: db,
      error: error instanceof Error ? error.message : "MySQL upsert failed",
    };
  } finally {
    conn?.release();
  }
}

export async function deactivateMysqlVirtualUser(email: string): Promise<MysqlMailAuthResult> {
  if (!mysqlConfigured()) {
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
  if (!mysqlConfigured()) {
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

export function isMysqlMailAuthConfigured(): boolean {
  return mysqlConfigured();
}
