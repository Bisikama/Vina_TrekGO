import { Image } from 'expo-image';

import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import {
  Radius,
  Spacing,
} from '@/constants/theme';

import type { RentalCatalogItem } from '@/features/rentals/types/rental-catalog';

import { useTheme } from '@/hooks/use-theme';

type RentalProductCardProps = {
  item: RentalCatalogItem;
  onPress?: () => void;
};

const currencyFormatter =
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

function formatSpec(
  spec: Record<string, unknown>,
) {
  return Object.entries(spec)
    .slice(0, 2)
    .map(([key, value]) => {
      if (
        typeof value !== 'string' &&
        typeof value !== 'number'
      ) {
        return null;
      }

      const label = key
        .replace(
          /([a-z])([A-Z])/g,
          '$1 $2',
        )
        .replace(
          /^./,
          (character) =>
            character.toUpperCase(),
        );

      return `${label}: ${value}`;
    })
    .filter(
      (value): value is string =>
        value !== null,
    )
    .join(' · ');
}

export function RentalProductCard({
  item,
  onPress,
}: RentalProductCardProps) {
  const theme = useTheme();

  const soldOut =
    item.availableCount === 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem chi tiết ${item.name}`}
      onPress={onPress}
      style={({ pressed }) =>
        pressed && styles.pressed
      }
    >
      <ThemedView
        type="surfaceElevated"
        style={[
          styles.card,
          {
            borderColor: theme.border,
          },
        ]}
      >
        <View
          style={[
            styles.imageFrame,
            {
              backgroundColor:
                theme.primarySurface,
            },
          ]}
        >
          {item.imageUrl ? (
            <Image
              source={item.imageUrl}
              style={styles.image}
              contentFit="contain"
              transition={180}
            />
          ) : (
            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Chưa có ảnh
            </ThemedText>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <ThemedText
              type="smallBold"
              themeColor="primary"
              style={styles.category}
            >
              {item.category.name.toUpperCase()}
            </ThemedText>

            <View
              style={[
                styles.stockBadge,
                {
                  backgroundColor:
                    soldOut
                      ? theme.dangerSurface
                      : theme.successSurface,
                },
              ]}
            >
              <ThemedText
                type="smallBold"
                themeColor={
                  soldOut
                    ? 'danger'
                    : 'success'
                }
                style={styles.stockText}
              >
                {soldOut
                  ? 'Hết hàng'
                  : `Còn ${item.availableCount}`}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={styles.name}>
            {item.name}
          </ThemedText>

          <ThemedText
            type="small"
            themeColor="textSecondary"
            numberOfLines={1}
          >
            {formatSpec(item.spec) ||
              item.description}
          </ThemedText>

          <View style={styles.priceRow}>
            <View>
              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Giá thuê
              </ThemedText>

              <ThemedText
                style={[
                  styles.price,
                  {
                    color: theme.primary,
                  },
                ]}
              >
                {currencyFormatter.format(
                  item.dailyPrice,
                )}

                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  /ngày
                </ThemedText>
              </ThemedText>
            </View>

            <View style={styles.deposit}>
              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Cọc
              </ThemedText>

              <ThemedText type="smallBold">
                {currencyFormatter.format(
                  item.depositAmount,
                )}
              </ThemedText>
            </View>
          </View>
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.large,
    overflow: 'hidden',
  },

  imageFrame: {
    height: 178,
    alignItems: 'center',
    justifyContent: 'center',
  },

  image: {
    width: '82%',
    height: '82%',
  },

  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },

  category: {
    fontSize: 11,
    letterSpacing: 0.8,
  },

  stockBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },

  stockText: {
    fontSize: 11,
  },

  name: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },

  price: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },

  deposit: {
    alignItems: 'flex-end',
  },

  pressed: {
    opacity: 0.76,
  },
});