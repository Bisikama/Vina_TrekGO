import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { usePickupPoints } from "../hooks/usePickupPoints";
import type { PickupPointOption } from "../types";

export interface CreateTripConfigStepProps {
  capacity: number;
  selectedPickupPointId?: string;
  destinationId?: string;
  pickupPoints?: PickupPointOption[];
  loadingPickupPoints?: boolean;
  onChangeCapacity: (val: number) => void;
  onSelectPickupPoint: (pickupPointId: string) => void;
}

export function CreateTripConfigStep({
  capacity,
  selectedPickupPointId,
  destinationId,
  pickupPoints: propPickupPoints,
  loadingPickupPoints: propLoading,
  onChangeCapacity,
  onSelectPickupPoint,
}: CreateTripConfigStepProps) {
  // If pickupPoints not passed from parent, use real API hook
  const shouldFetch = !propPickupPoints && Boolean(destinationId);
  const { pickupPoints: apiPickupPoints, loading: apiLoading } = usePickupPoints(
    destinationId,
    shouldFetch,
  );

  const pickupPoints = propPickupPoints || apiPickupPoints;
  const loading = propLoading ?? apiLoading;

  React.useEffect(() => {
    if (!selectedPickupPointId && pickupPoints.length > 0) {
      onSelectPickupPoint(pickupPoints[0].id);
    }
  }, [selectedPickupPointId, pickupPoints, onSelectPickupPoint]);

  function handleCapacityChange(text: string) {
    const num = parseInt(text.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      onChangeCapacity(Math.max(1, num));
    } else {
      onChangeCapacity(1);
    }
  }

  function incrementCapacity() {
    onChangeCapacity(capacity + 1);
  }

  function decrementCapacity() {
    if (capacity > 1) {
      onChangeCapacity(capacity - 1);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Bước 3: Sĩ số & Điểm tập kết</Text>
      <Text style={styles.stepDescription}>
        Cấu hình số lượng thành viên tối đa (đã tính Host) và điểm hẹn tập trung.
      </Text>

      {/* Sĩ số (Capacity) */}
      <View style={styles.card}>
        <View style={styles.labelRow}>
          <Text style={styles.cardTitle}>Sĩ số tối đa của chuyến</Text>
          <Text style={styles.cardNote}>(Đã tính cả bạn - Host)</Text>
        </View>

        <View style={styles.counterRow}>
          <TouchableOpacity
            style={[styles.counterButton, capacity <= 1 && styles.buttonDisabled]}
            onPress={decrementCapacity}
            disabled={capacity <= 1}
          >
            <Ionicons name="remove" size={18} color={Colors.onSurface} />
          </TouchableOpacity>

          <View style={styles.capacityInputBox}>
            <TextInput
              style={styles.capacityInput}
              keyboardType="number-pad"
              value={String(capacity)}
              onChangeText={handleCapacityChange}
              maxLength={4}
            />
            <Text style={styles.capacityUnit}>người</Text>
          </View>

          <TouchableOpacity
            style={styles.counterButton}
            onPress={incrementCapacity}
          >
            <Ionicons name="add" size={18} color={Colors.onSurface} />
          </TouchableOpacity>
        </View>

        <Text style={styles.capacityHint}>
          Chuyến đi sẽ có tối đa {capacity} người (Host + {Math.max(0, capacity - 1)} thành viên tham gia).
        </Text>
      </View>

      {/* Pickup Points */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Chọn điểm tập kết <Text style={styles.required}>*</Text>
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Colors.primaryDark} />
            <Text style={styles.loadingText}>Đang tải điểm tập kết...</Text>
          </View>
        ) : pickupPoints.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="bus-outline" size={24} color={Colors.mute} />
            <Text style={styles.emptyText}>
              Không có điểm tập kết nào cho khu vực này.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.pickupList}
            showsVerticalScrollIndicator={false}
          >
            {pickupPoints.map((item) => {
              const isSelected = item.id === selectedPickupPointId;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.pickupItem,
                    isSelected && styles.pickupItemSelected,
                  ]}
                  onPress={() => onSelectPickupPoint(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.pickupIcon}>
                    <Ionicons
                      name="location"
                      size={18}
                      color={
                        isSelected ? Colors.primaryDark : Colors.onSurfaceVariant
                      }
                    />
                  </View>

                  <View style={styles.pickupContent}>
                    <Text
                      style={[
                        styles.pickupName,
                        isSelected && styles.pickupNameSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {item.address ? (
                      <Text style={styles.pickupAddress}>{item.address}</Text>
                    ) : null}
                  </View>

                  {isSelected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={Colors.primaryDark}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 16,
  },
  card: {
    padding: 16,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    marginBottom: 14,
    ...Shadows.card,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  cardNote: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  required: {
    color: "#DC2626",
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  counterButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  capacityInputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
  },
  capacityInput: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primaryDark,
    textAlign: "center",
    minWidth: 40,
    padding: 0,
  },
  capacityUnit: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    fontWeight: "600",
  },
  capacityHint: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: 4,
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  emptyBox: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 6,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
  },
  pickupList: {
    maxHeight: 180,
    marginTop: 10,
  },
  pickupItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    marginBottom: 8,
    backgroundColor: Colors.surfaceContainerLow,
  },
  pickupItemSelected: {
    borderColor: Colors.primaryDark,
    backgroundColor: "#F0FDF4",
  },
  pickupIcon: {
    marginRight: 10,
  },
  pickupContent: {
    flex: 1,
  },
  pickupName: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  pickupNameSelected: {
    color: Colors.primaryDark,
  },
  pickupAddress: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
});
