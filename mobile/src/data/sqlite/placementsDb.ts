import * as SQLite from "expo-sqlite";
import type { WallPlacement } from "@/types/placement";

const DB_NAME = "wallviz.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function ensureColumn(db: SQLite.SQLiteDatabase, table: string, column: string, ddl: string) {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS placements (
          id TEXT PRIMARY KEY NOT NULL,
          wallpaper_id TEXT NOT NULL,
          texture_url TEXT NOT NULL,
          width REAL NOT NULL,
          height REAL NOT NULL,
          scale REAL NOT NULL,
          rotation_deg REAL NOT NULL,
          opacity REAL NOT NULL,
          anchor_transform TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS room_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          label TEXT,
          placement_count INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        );
      `);
      await ensureColumn(db, "placements", "anchor_id", "anchor_id TEXT");
      await ensureColumn(db, "placements", "local_position", "local_position TEXT");
      await ensureColumn(db, "placements", "anchor_position", "anchor_position TEXT");
      await ensureColumn(db, "placements", "anchor_rotation", "anchor_rotation TEXT");
      return db;
    })();
  }
  return dbPromise;
}

function vecToJson(v: [number, number, number] | undefined): string | null {
  return v ? JSON.stringify(v) : null;
}

function jsonToVec(s: string | null): [number, number, number] | undefined {
  if (!s) return undefined;
  return JSON.parse(s) as [number, number, number];
}

export async function savePlacementsToDb(placements: WallPlacement[]): Promise<void> {
  const db = await getDb();
  await db.execAsync("DELETE FROM placements");
  for (const p of placements) {
    await db.runAsync(
      `INSERT INTO placements (
        id, wallpaper_id, texture_url, width, height, scale, rotation_deg, opacity,
        anchor_transform, anchor_id, local_position, anchor_position, anchor_rotation, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.wallpaperId,
        p.textureUrl,
        p.width,
        p.height,
        p.scale,
        p.rotationDeg,
        p.opacity,
        p.anchorTransform ? JSON.stringify(p.anchorTransform) : null,
        p.anchorId ?? null,
        vecToJson(p.localPosition),
        vecToJson(p.anchorPosition),
        vecToJson(p.anchorRotation),
        p.createdAt,
      ],
    );
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO room_sessions (id, label, placement_count, updated_at)
     VALUES ('default', 'Last room', ?, ?)`,
    [placements.length, Date.now()],
  );
}

export async function loadPlacementsFromDb(): Promise<WallPlacement[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    wallpaper_id: string;
    texture_url: string;
    width: number;
    height: number;
    scale: number;
    rotation_deg: number;
    opacity: number;
    anchor_transform: string | null;
    anchor_id: string | null;
    local_position: string | null;
    anchor_position: string | null;
    anchor_rotation: string | null;
    created_at: number;
  }>("SELECT * FROM placements ORDER BY created_at ASC");

  return rows.map((r) => ({
    id: r.id,
    wallpaperId: r.wallpaper_id,
    textureUrl: r.texture_url,
    width: r.width,
    height: r.height,
    scale: r.scale,
    rotationDeg: r.rotation_deg,
    opacity: r.opacity,
    anchorTransform: r.anchor_transform ? (JSON.parse(r.anchor_transform) as number[]) : undefined,
    anchorId: r.anchor_id ?? undefined,
    localPosition: jsonToVec(r.local_position),
    anchorPosition: jsonToVec(r.anchor_position),
    anchorRotation: jsonToVec(r.anchor_rotation),
    createdAt: r.created_at,
  }));
}

export async function getSessionMeta(): Promise<{ placementCount: number; updatedAt: number } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ placement_count: number; updated_at: number }>(
    "SELECT placement_count, updated_at FROM room_sessions WHERE id = 'default'",
  );
  if (!row) return null;
  return { placementCount: row.placement_count, updatedAt: row.updated_at };
}
