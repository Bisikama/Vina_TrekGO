import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./keys";
import { TrekkerAccount, EquipmentItem } from "@/types";

export interface StoredCartItem {
  item: EquipmentItem;
  quantity: number;
}

export const accountStorage = {
  /**
   * Đọc thông tin hồ sơ Trekker
   */
  async getTrekkerAccount(): Promise<TrekkerAccount | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TREKKER_ACCOUNT);
      return data ? (JSON.parse(data) as TrekkerAccount) : null;
    } catch (error) {
      console.warn("[accountStorage] Lỗi khi đọc trekker account:", error);
      return null;
    }
  },

  /**
   * Lưu thông tin hồ sơ Trekker
   */
  async saveTrekkerAccount(account: TrekkerAccount): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.TREKKER_ACCOUNT,
        JSON.stringify(account),
      );
    } catch (error) {
      console.warn("[accountStorage] Lỗi khi lưu trekker account:", error);
    }
  },

  /**
   * Đọc giỏ hàng thuê đồ
   */
  async getRentalCart(): Promise<StoredCartItem[] | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RENTAL_CART);
      return data ? (JSON.parse(data) as StoredCartItem[]) : null;
    } catch (error) {
      console.warn("[accountStorage] Lỗi khi đọc rental cart:", error);
      return null;
    }
  },

  /**
   * Lưu giỏ hàng thuê đồ
   */
  async saveRentalCart(cart: StoredCartItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.RENTAL_CART,
        JSON.stringify(cart),
      );
    } catch (error) {
      console.warn("[accountStorage] Lỗi khi lưu rental cart:", error);
    }
  },
};
