import { createSwipeDeck } from '@react-native-motion-kit/swipe-deck';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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

const SwipeDeck = createSwipeDeck<Profile>();

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
                  <View>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.bio}>{item.bio}</Text>
                    <Text style={styles.active}>{isActive ? 'Active card' : 'Buffered card'}</Text>
                  </View>
                </View>
              )}
            </SwipeDeck.Card>
          </SwipeDeck.Root>
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
    paddingBottom: 56,
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
});
