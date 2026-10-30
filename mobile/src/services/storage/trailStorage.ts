import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./keys";
import { PersonalTrail } from "@/types";
import { recordingDatabase } from "./recordingDatabase";

export const trailStorage = {
  /**
   * Đọc danh sách ID cung đường đã lưu từ AsyncStorage (Bookmarks)
   */
  async getSavedTrailIds(): Promise<string[] | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_TRAILS);
      return data ? (JSON.parse(data) as string[]) : null;
    } catch (error) {
      console.warn("[trailStorage] Lỗi khi đọc saved trails:", error);
      return null;
    }
  },

  /**
   * Lưu danh sách ID cung đường đã lưu xuống AsyncStorage (Bookmarks)
   */
  async saveTrailIds(ids: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_TRAILS, JSON.stringify(ids));
    } catch (error) {
      console.warn("[trailStorage] Lỗi khi lưu saved trails:", error);
    }
  },

  /**
   * Đọc danh sách cung đường cá nhân từ SQLite (trekgo_recordings.db)
   */
  async getPersonalTrails(): Promise<PersonalTrail[] | null> {
    try {
      // 1. Đọc từ SQLite database
      const sqliteTrails = await recordingDatabase.getAllPersonalTrails();
      if (sqliteTrails && sqliteTrails.length > 0) {
        return sqliteTrails;
      }

      // 2. Nếu SQLite chưa có dữ liệu, kiểm tra migration từ AsyncStorage cũ
      const legacyRaw = await AsyncStorage.getItem(STORAGE_KEYS.PERSONAL_TRAILS);
      if (legacyRaw) {
        const legacyTrails: PersonalTrail[] = JSON.parse(legacyRaw);
        if (legacyTrails && legacyTrails.length > 0) {
          await recordingDatabase.saveAllPersonalTrails(legacyTrails);
          await AsyncStorage.removeItem(STORAGE_KEYS.PERSONAL_TRAILS).catch(() => {});
          return legacyTrails;
        }
      }

      return null;
    } catch (error) {
      console.warn("[trailStorage] Lỗi khi đọc personal trails từ SQLite:", error);
      return null;
    }
  },

  /**
   * Lưu toàn bộ danh sách cung đường cá nhân vào SQLite
   */
  async savePersonalTrails(trails: PersonalTrail[]): Promise<void> {
    try {
      await recordingDatabase.saveAllPersonalTrails(trails);
      // Dọn dẹp AsyncStorage để không còn lưu dữ liệu recording/trail trong AsyncStorage nữa
      await AsyncStorage.removeItem(STORAGE_KEYS.PERSONAL_TRAILS).catch(() => {});
    } catch (error) {
      console.warn("[trailStorage] Lỗi khi lưu personal trails vào SQLite:", error);
    }
  },

  /**
   * Lưu hoặc cập nhật một cung đường cá nhân vào SQLite
   */
  async savePersonalTrail(trail: PersonalTrail, clientRecordingId?: string): Promise<void> {
    try {
      await recordingDatabase.savePersonalTrail(trail, clientRecordingId);
    } catch (error) {
      console.warn("[trailStorage] Lỗi khi lưu personal trail vào SQLite:", error);
    }
  },

  /**
   * Xóa cung đường cá nhân và dữ liệu recording liên quan khỏi SQLite
   */
  async deletePersonalTrail(trailId: string): Promise<void> {
    try {
      await recordingDatabase.deletePersonalTrail(trailId);
    } catch (error) {
      console.warn("[trailStorage] Lỗi khi xóa personal trail khỏi SQLite:", error);
    }
  },

  /**
   * Xóa toàn bộ dữ liệu trong SQLite (dọn sạch database)
   */
  async clearAllData(): Promise<void> {
    try {
      await recordingDatabase.clearAllData();
      await AsyncStorage.removeItem(STORAGE_KEYS.PERSONAL_TRAILS).catch(() => {});
    } catch (error) {
      console.warn("[trailStorage] Lỗi khi dọn sạch database:", error);
    }
  },
};
