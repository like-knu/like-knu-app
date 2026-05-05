import { updateMenuRating, useMenuRating } from '@/api/meal';
import StarIcon from '@/assets/icons/star.svg';
import { useTheme } from '@/common/contexts/ThemeContext';
import FontText from '@/common/text/FontText';
import colors from '@/constants/colors';
import { useDeviceId } from '@/utils/device';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

const FILLED_COLOR = '#FAA131';
const STAR_SIZE = 28;
const RATINGS = [1, 2, 3, 4, 5] as const;
const DEBOUNCE_MS = 250;

const MenuRating = ({ menuId }: { menuId: string }) => {
  const { theme } = useTheme();
  const { deviceId } = useDeviceId();
  const { data, mutate } = useMenuRating(menuId, deviceId);
  const pendingRatingRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  if (!data) {
    return null;
  }

  const ownRating = data.ownRating ?? 0;

  const handleSelect = (rating: number) => {
    if (!deviceId) {
      return;
    }
    const nextOwnRating = ownRating === rating ? null : rating;
    mutate(
      { ...data, ownRating: nextOwnRating },
      { revalidate: false }
    );

    pendingRatingRef.current = rating;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const ratingToSend = pendingRatingRef.current;
      timeoutRef.current = null;
      pendingRatingRef.current = null;
      if (ratingToSend == null) return;
      try {
        const next = await updateMenuRating(menuId, deviceId, ratingToSend);
        mutate(next, { revalidate: false });
      } catch {
        mutate();
      }
    }, DEBOUNCE_MS);
  };

  return (
    <View style={styles.container}>
      <View style={styles.stars}>
        {RATINGS.map(value => (
          <Pressable
            key={value}
            onPress={() => handleSelect(value)}
            hitSlop={6}
          >
            <StarIcon
              width={STAR_SIZE}
              height={STAR_SIZE}
              fill={value <= ownRating ? FILLED_COLOR : colors[theme].gray200}
            />
          </Pressable>
        ))}
      </View>
      {data.ratingCount > 0 ? (
        <FontText fontWeight="500" style={[styles.summary, { color: colors[theme].gray100 }]}>
          평균 {data.averageRating.toFixed(1)} ({data.ratingCount})
        </FontText>
      ) : (
        <FontText fontWeight="500" style={[styles.summary, { color: colors[theme].gray100 }]}>
          첫 평가를 남겨보세요
        </FontText>
      )}
    </View>
  );
};

export default MenuRating;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12
  },
  stars: {
    flexDirection: 'row',
    gap: 8
  },
  summary: {
    fontSize: 12
  }
});
