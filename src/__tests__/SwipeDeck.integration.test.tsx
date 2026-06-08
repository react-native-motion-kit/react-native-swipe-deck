import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { createSwipeDeck, SwipeDeck, SwipeDeckActionMotion } from '../index';

type Profile = {
  id: string;
  name: string;
};

const adaProfile: Profile = { id: 'ada', name: 'Ada' };
const graceProfile: Profile = { id: 'grace', name: 'Grace' };
const profiles: Profile[] = [adaProfile, graceProfile];

const getProfileKey = (profile: Profile) => profile.id;

async function measureDeckFromVisibleCard(cardName: string) {
  await fireEvent(screen.getByText(cardName), 'layout', {
    nativeEvent: {
      layout: {
        height: 500,
        width: 300,
        x: 0,
        y: 0,
      },
    },
  });
}

describe('SwipeDeck factory hooks', () => {
  it('keeps actions disabled until the deck is measured, then publishes swipe state', async () => {
    const ProfileDeck = createSwipeDeck<Profile>();
    const onSwipe = jest.fn();
    const onIndexChange = jest.fn();
    const user = userEvent.setup();

    function DeckControls() {
      const state = ProfileDeck.useDeckState();
      const actions = ProfileDeck.useDeckActions();
      const [lastActionResult, setLastActionResult] = useState('none');

      return (
        <View>
          <Text>
            state:{state.activeIndex}:{state.count}:{String(state.canSwipe)}:
            {String(state.isCompleted)}
          </Text>
          <Text>action:{lastActionResult}</Text>
          <Pressable
            accessibilityLabel="Force swipe right"
            accessibilityRole="button"
            onPress={() => setLastActionResult(String(actions.swipeRight()))}
          >
            <Text>Force swipe right</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Swipe right"
            accessibilityRole="button"
            disabled={!state.canSwipe}
            onPress={() => actions.swipeRight()}
          >
            <Text>Swipe right</Text>
          </Pressable>
        </View>
      );
    }

    function Example() {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root
            data={profiles}
            getKey={getProfileKey}
            onIndexChange={onIndexChange}
            onSwipe={onSwipe}
          >
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    await render(<Example />);

    expect(screen.getByRole('button', { name: 'Swipe right' })).toBeDisabled();

    await user.press(screen.getByRole('button', { name: 'Force swipe right' }));

    expect(screen.getByText('action:false')).toBeOnTheScreen();

    await measureDeckFromVisibleCard('Ada');

    expect(await screen.findByText('state:0:2:true:false')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Swipe right' })).toBeEnabled();

    await user.press(screen.getByRole('button', { name: 'Force swipe right' }));

    expect(await screen.findByText('action:true')).toBeOnTheScreen();
    expect(await screen.findByText('state:1:2:true:false')).toBeOnTheScreen();
    expect(screen.getByText('Grace')).toBeOnTheScreen();
    expect(onSwipe).toHaveBeenCalledWith({
      direction: 'right',
      index: 0,
      item: profiles[0],
    });
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('updates action gating when disabled changes after mount', async () => {
    const ProfileDeck = createSwipeDeck<Profile>();
    const user = userEvent.setup();

    function DeckControls() {
      const state = ProfileDeck.useDeckState();
      const actions = ProfileDeck.useDeckActions();
      const [lastActionResult, setLastActionResult] = useState('none');

      return (
        <View>
          <Text>canSwipe:{String(state.canSwipe)}</Text>
          <Text>action:{lastActionResult}</Text>
          <Pressable
            accessibilityLabel="Force swipe right"
            accessibilityRole="button"
            onPress={() => setLastActionResult(String(actions.swipeRight()))}
          >
            <Text>Force swipe right</Text>
          </Pressable>
        </View>
      );
    }

    function Example({ disabled = false }: { disabled?: boolean }) {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root data={profiles} disabled={disabled} getKey={getProfileKey}>
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    const renderResult = await render(<Example />);

    await measureDeckFromVisibleCard('Ada');

    expect(await screen.findByText('canSwipe:true')).toBeOnTheScreen();

    await renderResult.rerender(<Example disabled />);

    expect(await screen.findByText('canSwipe:false')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Force swipe right' }));

    expect(await screen.findByText('action:false')).toBeOnTheScreen();
  });

  it('accepts callback-safe and per-call action motion actions', async () => {
    const ProfileDeck = createSwipeDeck<Profile>({
      actionMotion: SwipeDeckActionMotion.springboard({
        anticipationDistance: 18,
      }),
    });
    const user = userEvent.setup();

    function DeckControls() {
      const state = ProfileDeck.useDeckState();
      const actions = ProfileDeck.useDeckActions();
      const [lastActionResult, setLastActionResult] = useState('none');

      return (
        <View>
          <Text>
            state:{state.activeIndex}:{String(state.isCompleted)}
          </Text>
          <Text>action:{lastActionResult}</Text>
          <Pressable
            accessibilityLabel="Callback swipe right"
            accessibilityRole="button"
            onPress={actions.swipeRight}
          >
            <Text>Callback swipe right</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Direct swipe left"
            accessibilityRole="button"
            onPress={() =>
              setLastActionResult(
                String(
                  actions.swipeLeft(
                    SwipeDeckActionMotion.direct({
                      duration: 180,
                    }),
                  ),
                ),
              )
            }
          >
            <Text>Direct swipe left</Text>
          </Pressable>
        </View>
      );
    }

    function Example() {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root data={profiles} getKey={getProfileKey}>
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    await render(<Example />);
    await measureDeckFromVisibleCard('Ada');

    await user.press(screen.getByRole('button', { name: 'Callback swipe right' }));

    expect(await screen.findByText('state:1:false')).toBeOnTheScreen();
    expect(screen.getByText('Grace')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Direct swipe left' }));

    expect(await screen.findByText('action:true')).toBeOnTheScreen();
    expect(await screen.findByText('state:2:true')).toBeOnTheScreen();
  });
});

describe('static SwipeDeck surface', () => {
  it('mounts multiple static roots without factory ids', async () => {
    await render(
      <>
        <SwipeDeck.Root<Profile> data={[adaProfile]} getKey={getProfileKey}>
          <SwipeDeck.Card<Profile>>{({ item }) => <Text>{item.name}</Text>}</SwipeDeck.Card>
        </SwipeDeck.Root>
        <SwipeDeck.Root<Profile> data={[graceProfile]} getKey={getProfileKey}>
          <SwipeDeck.Card<Profile>>{({ item }) => <Text>{item.name}</Text>}</SwipeDeck.Card>
        </SwipeDeck.Root>
      </>,
    );

    expect(screen.getByText('Ada')).toBeOnTheScreen();
    expect(screen.getByText('Grace')).toBeOnTheScreen();
  });
});
