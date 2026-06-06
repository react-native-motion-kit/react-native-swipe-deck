import { createSwipeDeck, SwipeDeckMotion } from '@react-native-motion-kit/swipe-deck';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

type Profile = {
  id: string;
  name: string;
  bio: string;
  accent: string;
};

const profiles: Profile[] = Array.from({ length: 150 }, (_, index) => ({
  id: `profile-${index}`,
  name: `Profile ${index + 1}`,
  bio: `Swipe deck item ${index + 1}`,
  accent: index % 2 === 0 ? '#7c3aed' : '#0891b2',
}));

const SwipeDeck = createSwipeDeck<Profile>({
  motion: SwipeDeckMotion.tinder({
    drag: {
      mode: 'free',
      liftYFactor: 0.3,
    },
    rotation: {
      mode: 'grab-position',
      direction: 'default',
    },
    dismiss: {
      threshold: ({ width }) => width * 0.3,
      velocityThreshold: 800,
      minDuration: 300,
      offscreenMultiplier: 1.2,
      maxDuration: 520,
    },
  }),
});

function CardReactionOverlay() {
  const { signedProgress } = SwipeDeck.useDeckInteraction();

  const passStyle = useAnimatedStyle(() => {
    const progress = Math.max(-signedProgress.get(), 0);

    return {
      opacity: progress,
      transform: [{ scale: 0.9 + progress * 0.18 }],
    };
  });

  const likeStyle = useAnimatedStyle(() => {
    const progress = Math.max(signedProgress.get(), 0);

    return {
      opacity: progress,
      transform: [{ scale: 0.9 + progress * 0.18 }],
    };
  });

  return (
    <View pointerEvents="none" style={styles.reactionOverlay}>
      <View style={[styles.reactionAnchor, styles.passAnchor]}>
        <Animated.View style={[styles.reactionBadge, styles.passBadge, passStyle]}>
          <Text style={styles.reactionText}>PASS</Text>
        </Animated.View>
      </View>
      <View style={[styles.reactionAnchor, styles.likeAnchor]}>
        <Animated.View style={[styles.reactionBadge, styles.likeBadge, likeStyle]}>
          <Text style={styles.reactionText}>LOVE</Text>
        </Animated.View>
      </View>
    </View>
  );
}

function DeckControls() {
  const { activeIndex, count, canSwipe, isCompleted } = SwipeDeck.useDeckState();
  const { swipeLeft, swipeRight } = SwipeDeck.useDeckActions();
  const current = activeIndex >= 0 ? activeIndex + 1 : 0;
  const counterText = isCompleted ? 'Done' : `${current} / ${count}`;

  return (
    <View style={styles.controls}>
      <Text style={styles.counter}>{counterText}</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={!canSwipe}
          onPress={swipeLeft}
          style={[styles.actionButton, styles.passButton, !canSwipe && styles.disabledButton]}
        >
          <Text style={styles.actionText}>Nope</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canSwipe}
          onPress={swipeRight}
          style={[styles.actionButton, styles.likeButton, !canSwipe && styles.disabledButton]}
        >
          <Text style={styles.actionText}>Like</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>React Native Motion Kit</Text>
          <Text style={styles.title}>Swipe Deck</Text>
          <Text style={styles.subtitle}>
            A bounded forward window advances with item-stable cards.
          </Text>
        </View>

        <View style={styles.deckFrame}>
          <SwipeDeck.Root
            data={profiles}
            getKey={(item) => item.id}
            visibleCardCount={3}
            containerStyle={styles.deck}
            onSwipe={({ item, direction }) => {
              console.log(`Swiped ${item.name} ${direction}`);
            }}
            onEndReached={() => {
              console.log('No more profiles');
            }}
          >
            <SwipeDeck.Card style={styles.cardShadow}>
              {({ item, role, isActive }) => (
                <View style={[styles.card, { backgroundColor: item.accent }]}>
                  <Text style={styles.role}>{role}</Text>
                  {isActive ? <CardReactionOverlay /> : null}
                  <View>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.bio}>{item.bio}</Text>
                    <Text style={styles.active}>{isActive ? 'Active card' : 'Buffered card'}</Text>
                  </View>
                </View>
              )}
            </SwipeDeck.Card>
          </SwipeDeck.Root>
          <DeckControls />
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#09090b',
    padding: 24,
  },
  header: {
    gap: 6,
    marginBottom: 24,
    marginTop: 48,
  },
  eyebrow: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fafafa',
    fontSize: 40,
    fontWeight: '800',
  },
  subtitle: {
    color: '#d4d4d8',
    fontSize: 16,
  },
  deckFrame: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 104,
  },
  deck: {
    flex: 0,
    height: 440,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 12,
  },
  card: {
    borderRadius: 32,
    flex: 1,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: 28,
  },
  role: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
    textTransform: 'uppercase',
  },
  name: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
  },
  bio: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 18,
    marginTop: 8,
  },
  active: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 18,
    textTransform: 'uppercase',
  },
  reactionOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  reactionAnchor: {
    position: 'absolute',
    top: 48,
  },
  passAnchor: {
    right: 24,
    transform: [{ rotate: '12deg' }],
  },
  likeAnchor: {
    left: 24,
    transform: [{ rotate: '-12deg' }],
  },
  reactionBadge: {
    borderRadius: 18,
    borderWidth: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  passBadge: {
    borderColor: '#fb7185',
  },
  likeBadge: {
    borderColor: '#34d399',
  },
  reactionText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  controls: {
    alignItems: 'center',
    bottom: 24,
    gap: 14,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  counter: {
    color: '#e4e4e7',
    fontSize: 14,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    minWidth: 112,
    paddingHorizontal: 22,
  },
  passButton: {
    backgroundColor: '#fb7185',
  },
  likeButton: {
    backgroundColor: '#34d399',
  },
  disabledButton: {
    opacity: 0.45,
  },
  actionText: {
    color: '#09090b',
    fontSize: 16,
    fontWeight: '900',
  },
});
