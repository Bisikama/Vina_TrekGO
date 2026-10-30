import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./keys";

export interface OfflineMapPackage {
  trailId: string;
  trailName: string;
  downloadedAt: string;
  sizeMb: number;
  status: "DOWNLOADED" | "DOWNLOADING" | "ERROR";
  bbox?: [number, number, number, number];
  tileCount?: number;
}

export const offlineMapStorage = {
  /**
   * Đọc danh sách các gói bản đồ offline đã tải
   */
  async getPackages(): Promise<Record<string, OfflineMapPackage>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_PACKAGES);
      return data ? (JSON.parse(data) as Record<string, OfflineMapPackage>) : {};
    } catch (error) {
      console.warn("[offlineMapStorage] Lỗi khi đọc gói offline map:", error);
      return {};
    }
  },

  /**
   * Lưu hoặc cập nhật một gói bản đồ offline
   */
  async savePackage(pkg: OfflineMapPackage): Promise<void> {
    try {
      const current = await this.getPackages();
      current[pkg.trailId] = pkg;
      await AsyncStorage.setItem(
        STORAGE_KEYS.OFFLINE_PACKAGES,
        JSON.stringify(current),
      );
    } catch (error) {
      console.warn("[offlineMapStorage] Lỗi khi lưu gói offline map:", error);
    }
  },

  /**
   * Xóa một gói bản đồ offline
   */
  async removePackage(trailId: string): Promise<void> {
    try {
      const current = await this.getPackages();
      delete current[trailId];
      await AsyncStorage.setItem(
        STORAGE_KEYS.OFFLINE_PACKAGES,
        JSON.stringify(current),
      );
    } catch (error) {
      console.warn("[offlineMapStorage] Lỗi khi xóa gói offline map:", error);
    }
  },
};
