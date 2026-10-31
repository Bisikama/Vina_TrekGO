import * as SQLite from "expo-sqlite";

import { MAPTILER_API_KEY, MAPTILER_STYLE_URL } from "@/constants/map";

import { base64Encode, remoteUrlForKey } from "./offlineMapProtocol";

// Tăng số này sau khi tạo lại gói, vì file đã chép vào máy sẽ không tự bị thay.
const OFFLINE_MAP_PACK_VERSION = 1;
const DATABASE_NAME = `offline-map-v${OFFLINE_MAP_PACK_VERSION}.db`;

export type PackLookup = { base64: string } | { remoteUrl: string };

let packPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;

function openPack() {
  if (!packPromise) {
    packPromise = SQLite.importDatabaseFromAssetAsync(DATABASE_NAME, {
      assetId: require("../../../assets/maps/offline-map.db"),
    })
      .then(() => SQLite.openDatabaseAsync(DATABASE_NAME))
      .catch((error) => {
        // Không mở được gói thì map vẫn chạy bằng mạng như trước.
        console.warn("[offlineMapPack] Không mở được gói bản đồ:", error);
        return null;
      });
  }
  return packPromise;
}

export async function lookupPackResource(key: string): Promise<PackLookup> {
  const pack = await openPack();
  if (pack) {
    try {
      const row = await pack.getFirstAsync<{ data: Uint8Array }>(
        "SELECT data FROM resources WHERE key = ?",
        key,
      );
      if (row) return { base64: base64Encode(row.data) };
    } catch (error) {
      console.warn("[offlineMapPack] Lỗi đọc gói bản đồ:", error);
    }
  }
  return { remoteUrl: remoteUrlForKey(key, MAPTILER_STYLE_URL, MAPTILER_API_KEY) };
}
