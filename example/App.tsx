import {
  createSwipeDeck,
  SwipeDeckActionMotion,
  SwipeDeckMotion,
  SwipeDeckUndoMotion,
  type SwipeRole,
} from '@react-native-motion-kit/swipe-deck';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle } from 'react-native-reanimated';

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

const ProfileDeck = createSwipeDeck<Profile>({
  motion: SwipeDeckMotion.tinder({
    drag: {
      mode: 'free',
      liftYFactor: 0.3,
    },
    rotation: {
      mode: 'grab-position',
      direction: 'reverse',
      maxDegrees: 25,
    },
    dismiss: {
      threshold: ({ width }) => width * 0.3,
      velocityThreshold: 800,
      minDuration: 300,
      offscreenMultiplier: 1.2,
      maxDuration: 520,
    },
  }),
  actionMotion: SwipeDeckActionMotion.springboard({
    anticipationDistance: 40,
    anticipationDuration: 160,
    dismissDuration: 500,
    anticipationEasing: Easing.out(Easing.quad),
    dismissEasing: Easing.in(Easing.cubic),
  }),
  undoMotion: SwipeDeckUndoMotion.spring({
    springConfig: {
      damping: 36,
      stiffness: 300,
      mass: 3,
    },
  }),
});

function SwipeReactionOverlay() {
  const { signedProgress } = ProfileDeck.useDeckInteraction();

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

function DeckPhaseFeedback() {
  const { dismissDirection, phase } = ProfileDeck.useDeckInteraction();

  const idleStyle = useAnimatedStyle(() => {
    return {
      opacity: phase.get() === 'idle' ? 1 : 0.32,
    };
  });

  const draggingStyle = useAnimatedStyle(() => {
    return {
      opacity: phase.get() === 'dragging' ? 1 : 0.32,
    };
  });

  const dismissingStyle = useAnimatedStyle(() => {
    return {
      opacity: phase.get() === 'dismissing' ? 1 : 0.32,
    };
  });

  const undoingStyle = useAnimatedStyle(() => {
    return {
      opacity: phase.get() === 'undoing' ? 1 : 0.32,
    };
  });

  const leftDismissStyle = useAnimatedStyle(() => {
    return {
      opacity: dismissDirection.get() === 'left' ? 1 : 0.24,
    };
  });

  const rightDismissStyle = useAnimatedStyle(() => {
    return {
      opacity: dismissDirection.get() === 'right' ? 1 : 0.24,
    };
  });

  return (
    <View pointerEvents="none" style={styles.phaseFeedback}>
      <Animated.View style={[styles.phasePill, styles.idlePhasePill, idleStyle]}>
        <Text style={styles.phaseText}>Idle</Text>
      </Animated.View>
      <Animated.View style={[styles.phasePill, styles.draggingPhasePill, draggingStyle]}>
        <Text style={styles.phaseText}>Drag</Text>
      </Animated.View>
      <Animated.View style={[styles.phasePill, styles.dismissPhasePill, dismissingStyle]}>
        <Text style={styles.phaseText}>Dismiss</Text>
      </Animated.View>
      <Animated.View style={[styles.phasePill, styles.undoPhasePill, undoingStyle]}>
        <Text style={styles.phaseText}>Undo</Text>
      </Animated.View>
      <Animated.View style={[styles.phasePill, styles.leftDismissPill, leftDismissStyle]}>
        <Text style={styles.phaseText}>Left</Text>
      </Animated.View>
      <Animated.View style={[styles.phasePill, styles.rightDismissPill, rightDismissStyle]}>
        <Text style={styles.phaseText}>Right</Text>
      </Animated.View>
    </View>
  );
}

type ProfileCardProps = {
  isActive: boolean;
  profile: Profile;
  role: SwipeRole;
};

function ProfileCard({ isActive, profile, role }: ProfileCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: profile.accent }]}>
      <Text style={styles.role}>{role}</Text>
      {isActive ? <SwipeReactionOverlay /> : null}
      <View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.bio}>{profile.bio}</Text>
        <Text style={styles.active}>{isActive ? 'Active card' : 'Buffered card'}</Text>
      </View>
    </View>
  );
}

function ProfileDeckControls() {
  const { activeIndex, count, canSwipe, canUndo, isCompleted } = ProfileDeck.useDeckState();
  const { swipeLeft, swipeRight, undo } = ProfileDeck.useDeckActions();
  const current = activeIndex >= 0 ? activeIndex + 1 : 0;
  const counterText = isCompleted ? 'Done' : `${current} / ${count}`;

  return (
    <View style={styles.controls}>
      <Text style={styles.counter}>{counterText}</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={!canUndo}
          onPress={undo}
          style={[styles.iconButton, styles.undoButton, !canUndo && styles.disabledButton]}
        >
          <Text style={styles.iconText}>Undo</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canSwipe}
          onPress={() =>
            swipeLeft(
              SwipeDeckActionMotion.direct({
                duration: 240,
              }),
            )
          }
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
  const indexChangeEvent = ProfileDeck.useDeckEvent('indexChange', { index: 0 });

  console.log('indexChangeEvent', indexChangeEvent);

  ProfileDeck.useDeckEventListener('swipe', ({ item, direction }) => {
    console.log(`Swiped ${item.name} ${direction}`);
  });
  ProfileDeck.useDeckEventListener('undo', ({ item, direction }) => {
    console.log(`Undid ${item.name} ${direction}`);
  });
  ProfileDeck.useDeckEventListener('endReached', () => {
    console.log('No more profiles');
  });

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
          <ProfileDeck.Root
            data={profiles}
            getKey={(item) => item.id}
            undoEnabled
            visibleCardCount={3}
            containerStyle={styles.deck}
          >
            <ProfileDeck.Card style={styles.cardShadow}>
              {({ item, role, isActive }) => (
                <ProfileCard profile={item} role={role} isActive={isActive} />
              )}
            </ProfileDeck.Card>
          </ProfileDeck.Root>
          <DeckPhaseFeedback />
          <ProfileDeckControls />
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
  phaseFeedback: {
    alignItems: 'center',
    bottom: 108,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  phasePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  idlePhasePill: {
    backgroundColor: 'rgba(161, 161, 170, 0.72)',
  },
  draggingPhasePill: {
    backgroundColor: 'rgba(96, 165, 250, 0.82)',
  },
  dismissPhasePill: {
    backgroundColor: 'rgba(52, 211, 153, 0.82)',
  },
  undoPhasePill: {
    backgroundColor: 'rgba(251, 191, 36, 0.82)',
  },
  leftDismissPill: {
    backgroundColor: 'rgba(248, 113, 113, 0.82)',
  },
  rightDismissPill: {
    backgroundColor: 'rgba(74, 222, 128, 0.82)',
  },
  phaseText: {
    color: '#09090b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
  undoButton: {
    backgroundColor: '#fbbf24',
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 18,
  },
  disabledButton: {
    opacity: 0.45,
  },
  actionText: {
    color: '#09090b',
    fontSize: 16,
    fontWeight: '900',
  },
  iconText: {
    color: '#09090b',
    fontSize: 14,
    fontWeight: '900',
  },
});
