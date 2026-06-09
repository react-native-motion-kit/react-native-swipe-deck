import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { createSwipeDeck, SwipeDeck, SwipeDeckActionMotion, SwipeDeckUndoMotion } from '../index';

type Profile = {
  id: string;
  name: string;
};

const adaProfile: Profile = { id: 'ada', name: 'Ada' };
const graceProfile: Profile = { id: 'grace', name: 'Grace' };
const linusProfile: Profile = { id: 'linus', name: 'Linus' };
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

  it('does not scan the full data set for undo keys when undo is disabled', async () => {
    const ProfileDeck = createSwipeDeck<Profile>();
    const manyProfiles = Array.from({ length: 20 }, (_, index) => ({
      id: `profile-${index}`,
      name: `Profile ${index}`,
    }));
    const getVisibleProfileKey = jest.fn((profile: Profile, index: number) => {
      if (index > 2) {
        throw new Error(`Unexpected off-window key lookup: ${index}`);
      }

      return profile.id;
    });

    function Example() {
      return (
        <ProfileDeck.Root data={manyProfiles} getKey={getVisibleProfileKey}>
          <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
        </ProfileDeck.Root>
      );
    }

    await render(<Example />);

    expect(screen.getByText('Profile 0')).toBeOnTheScreen();
    expect(getVisibleProfileKey).toHaveBeenCalled();
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

  it('refreshes root action motion before immediate post-rerender actions observe interaction state', async () => {
    const ProfileDeck = createSwipeDeck<Profile>();
    const user = userEvent.setup();

    function DeckControls() {
      const actions = ProfileDeck.useDeckActions();
      const interaction = ProfileDeck.useDeckInteraction();
      const [probe, setProbe] = useState('none');

      return (
        <View>
          <Text>probe:{probe}</Text>
          <Pressable
            accessibilityLabel="Probe swipe right"
            accessibilityRole="button"
            onPress={() => {
              const accepted = actions.swipeRight();

              setProbe(`${String(accepted)}:${interaction.direction.get()}`);
            }}
          >
            <Text>Probe swipe right</Text>
          </Pressable>
        </View>
      );
    }

    function Example({
      actionMotion,
    }: {
      actionMotion:
        | ReturnType<typeof SwipeDeckActionMotion.direct>
        | ReturnType<typeof SwipeDeckActionMotion.springboard>;
    }) {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root
            actionMotion={actionMotion}
            data={[adaProfile, graceProfile, linusProfile]}
            getKey={getProfileKey}
          >
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    const renderResult = await render(
      <Example actionMotion={SwipeDeckActionMotion.direct({ duration: 120 })} />,
    );
    await measureDeckFromVisibleCard('Ada');

    await user.press(screen.getByRole('button', { name: 'Probe swipe right' }));

    expect(await screen.findByText('probe:true:1')).toBeOnTheScreen();
    expect(screen.getByText('Grace')).toBeOnTheScreen();

    await renderResult.rerender(
      <Example actionMotion={SwipeDeckActionMotion.springboard({ anticipationDuration: 120 })} />,
    );

    await user.press(screen.getByRole('button', { name: 'Probe swipe right' }));

    expect(await screen.findByText('probe:true:0')).toBeOnTheScreen();
    expect(screen.getByText('Linus')).toBeOnTheScreen();
  });

  it('restores the latest swiped card through callback-safe undo actions', async () => {
    const ProfileDeck = createSwipeDeck<Profile>({
      undoMotion: SwipeDeckUndoMotion.timing({
        duration: 120,
      }),
    });
    const onSwipe = jest.fn();
    const onUndo = jest.fn();
    const onIndexChange = jest.fn();
    const user = userEvent.setup();

    function DeckControls() {
      const state = ProfileDeck.useDeckState();
      const actions = ProfileDeck.useDeckActions();
      const interaction = ProfileDeck.useDeckInteraction();
      const [lastActionResult, setLastActionResult] = useState('none');
      const [interactionText, setInteractionText] = useState('0:0:0');

      useEffect(() => {
        setInteractionText(
          `${interaction.progress.get()}:${interaction.signedProgress.get()}:${interaction.direction.get()}`,
        );
      }, [interaction, state.activeIndex, state.canUndo]);

      return (
        <View>
          <Text>
            state:{state.activeIndex}:{String(state.canSwipe)}:{String(state.canUndo)}:
            {String(state.isCompleted)}
          </Text>
          <Text>interaction:{interactionText}</Text>
          <Text>action:{lastActionResult}</Text>
          <Pressable
            accessibilityLabel="Swipe right"
            accessibilityRole="button"
            onPress={() => setLastActionResult(String(actions.swipeRight()))}
          >
            <Text>Swipe right</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Undo"
            accessibilityRole="button"
            disabled={!state.canUndo}
            onPress={actions.undo}
          >
            <Text>Undo</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Timed undo"
            accessibilityRole="button"
            onPress={() =>
              setLastActionResult(
                String(
                  actions.undo(
                    SwipeDeckUndoMotion.timing({
                      duration: 80,
                    }),
                  ),
                ),
              )
            }
          >
            <Text>Timed undo</Text>
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
            undoEnabled
            onIndexChange={onIndexChange}
            onSwipe={onSwipe}
            onUndo={onUndo}
          >
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    await render(<Example />);
    await measureDeckFromVisibleCard('Ada');

    expect(await screen.findByText('state:0:true:false:false')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await user.press(screen.getByRole('button', { name: 'Swipe right' }));

    expect(await screen.findByText('state:1:true:true:false')).toBeOnTheScreen();
    expect(screen.getByText('Grace')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    await user.press(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('state:0:true:false:false')).toBeOnTheScreen();
    expect(screen.getByText('Ada')).toBeOnTheScreen();
    expect(screen.getByText('interaction:0:0:0')).toBeOnTheScreen();
    expect(onSwipe).toHaveBeenCalledTimes(1);
    expect(onUndo).toHaveBeenCalledWith({
      direction: 'right',
      index: 0,
      item: profiles[0],
    });
    expect(onIndexChange.mock.calls).toEqual([[1], [0]]);
    const undoCallOrder = onUndo.mock.invocationCallOrder[0];
    const restoreIndexChangeCallOrder = onIndexChange.mock.invocationCallOrder[1];

    if (undoCallOrder === undefined || restoreIndexChangeCallOrder === undefined) {
      throw new Error('Expected undo and restore index-change callback order to be recorded.');
    }

    expect(undoCallOrder).toBeLessThan(restoreIndexChangeCallOrder);
  });

  it('tracks undo history from committed pan gestures when undo is enabled', async () => {
    const ProfileDeck = createSwipeDeck<Profile>();
    const user = userEvent.setup();

    function DeckControls() {
      const state = ProfileDeck.useDeckState();
      const actions = ProfileDeck.useDeckActions();

      return (
        <View>
          <Text>
            state:{state.activeIndex}:{String(state.canSwipe)}:{String(state.canUndo)}:
            {String(state.isCompleted)}
          </Text>
          <Pressable accessibilityLabel="Undo" accessibilityRole="button" onPress={actions.undo}>
            <Text>Undo</Text>
          </Pressable>
        </View>
      );
    }

    function Example() {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root data={profiles} getKey={getProfileKey} undoEnabled>
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    await render(<Example />);
    await measureDeckFromVisibleCard('Ada');

    fireGestureHandler(getByGestureTestId('swipe-deck-pan'), [
      { state: 2, y: 250 },
      { state: 4, translationX: 180, translationY: 0, velocityX: 0, y: 250 },
      { state: 5, translationX: 180, translationY: 0, velocityX: 0, y: 250 },
    ]);

    expect(await screen.findByText('state:1:true:true:false')).toBeOnTheScreen();
    expect(screen.getByText('Grace')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('state:0:true:false:false')).toBeOnTheScreen();
    expect(screen.getByText('Ada')).toBeOnTheScreen();
  });

  it('resets interaction state without undo history after a canceled pan gesture', async () => {
    const ProfileDeck = createSwipeDeck<Profile>();
    const onSwipe = jest.fn();

    function DeckControls() {
      const state = ProfileDeck.useDeckState();
      const interaction = ProfileDeck.useDeckInteraction();
      const [interactionText, setInteractionText] = useState('0:0:0');

      useEffect(() => {
        setInteractionText(
          `${interaction.progress.get()}:${interaction.signedProgress.get()}:${interaction.direction.get()}`,
        );
      }, [interaction, state.activeIndex, state.canSwipe, state.canUndo]);

      return (
        <View>
          <Text>
            state:{state.activeIndex}:{String(state.canSwipe)}:{String(state.canUndo)}:
            {String(state.isCompleted)}
          </Text>
          <Text>interaction:{interactionText}</Text>
        </View>
      );
    }

    function Example() {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root data={profiles} getKey={getProfileKey} onSwipe={onSwipe} undoEnabled>
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    await render(<Example />);
    await measureDeckFromVisibleCard('Ada');

    fireGestureHandler(getByGestureTestId('swipe-deck-pan'), [
      { state: 2, y: 250 },
      { state: 4, translationX: 30, translationY: 8, velocityX: 0, y: 250 },
      { state: 5, translationX: 30, translationY: 8, velocityX: 0, y: 250 },
    ]);

    expect(await screen.findByText('state:0:true:false:false')).toBeOnTheScreen();
    expect(screen.getByText('interaction:0:0:0')).toBeOnTheScreen();
    expect(screen.getByText('Ada')).toBeOnTheScreen();
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('keeps accepted swipes in LIFO undo history', async () => {
    const ProfileDeck = createSwipeDeck<Profile>();
    const user = userEvent.setup();

    function DeckControls() {
      const state = ProfileDeck.useDeckState();
      const actions = ProfileDeck.useDeckActions();

      return (
        <View>
          <Text>
            state:{state.activeIndex}:{String(state.canSwipe)}:{String(state.canUndo)}:
            {String(state.isCompleted)}
          </Text>
          <Pressable
            accessibilityLabel="Swipe right"
            accessibilityRole="button"
            onPress={actions.swipeRight}
          >
            <Text>Swipe right</Text>
          </Pressable>
          <Pressable accessibilityLabel="Undo" accessibilityRole="button" onPress={actions.undo}>
            <Text>Undo</Text>
          </Pressable>
        </View>
      );
    }

    function Example() {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root
            data={[adaProfile, graceProfile, linusProfile]}
            getKey={getProfileKey}
            undoEnabled
          >
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    await render(<Example />);
    await measureDeckFromVisibleCard('Ada');

    await user.press(screen.getByRole('button', { name: 'Swipe right' }));
    expect(await screen.findByText('state:1:true:true:false')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Swipe right' }));
    expect(await screen.findByText('state:2:true:true:false')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('state:1:true:true:false')).toBeOnTheScreen();
    expect(screen.getByText('Grace')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('state:0:true:false:false')).toBeOnTheScreen();
    expect(screen.getByText('Ada')).toBeOnTheScreen();
  });

  it('does not track undo history until undo is enabled', async () => {
    const ProfileDeck = createSwipeDeck<Profile>();
    const user = userEvent.setup();

    function DeckControls() {
      const state = ProfileDeck.useDeckState();
      const actions = ProfileDeck.useDeckActions();

      return (
        <View>
          <Text>
            state:{state.activeIndex}:{String(state.canSwipe)}:{String(state.canUndo)}:
            {String(state.isCompleted)}
          </Text>
          <Pressable
            accessibilityLabel="Swipe right"
            accessibilityRole="button"
            onPress={actions.swipeRight}
          >
            <Text>Swipe right</Text>
          </Pressable>
          <Pressable accessibilityLabel="Undo" accessibilityRole="button" onPress={actions.undo}>
            <Text>Undo</Text>
          </Pressable>
        </View>
      );
    }

    function Example() {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root data={[adaProfile, graceProfile, linusProfile]} getKey={getProfileKey}>
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    await render(<Example />);
    await measureDeckFromVisibleCard('Ada');

    await user.press(screen.getByRole('button', { name: 'Swipe right' }));
    expect(await screen.findByText('state:1:true:false:false')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Swipe right' }));
    expect(await screen.findByText('state:2:true:false:false')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('state:2:true:false:false')).toBeOnTheScreen();
  });

  it('clears completed state when undo restores the last card', async () => {
    const ProfileDeck = createSwipeDeck<Profile>({
      undoMotion: SwipeDeckUndoMotion.timing({
        duration: 120,
      }),
    });
    const user = userEvent.setup();

    function DeckControls() {
      const state = ProfileDeck.useDeckState();
      const actions = ProfileDeck.useDeckActions();

      return (
        <View>
          <Text>
            state:{state.activeIndex}:{String(state.canSwipe)}:{String(state.canUndo)}:
            {String(state.isCompleted)}
          </Text>
          <Pressable
            accessibilityLabel="Swipe right"
            accessibilityRole="button"
            onPress={actions.swipeRight}
          >
            <Text>Swipe right</Text>
          </Pressable>
          <Pressable accessibilityLabel="Undo" accessibilityRole="button" onPress={actions.undo}>
            <Text>Undo</Text>
          </Pressable>
        </View>
      );
    }

    function Example() {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root data={[adaProfile]} getKey={getProfileKey} undoEnabled>
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    await render(<Example />);
    await measureDeckFromVisibleCard('Ada');

    await user.press(screen.getByRole('button', { name: 'Swipe right' }));

    expect(await screen.findByText('state:1:false:true:true')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('state:0:true:false:false')).toBeOnTheScreen();
    expect(screen.getByText('Ada')).toBeOnTheScreen();
  });

  it('discards removed undo history entries without resurrecting re-added keys', async () => {
    const ProfileDeck = createSwipeDeck<Profile>({
      undoMotion: SwipeDeckUndoMotion.timing({
        duration: 120,
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
            state:{state.activeIndex}:{String(state.canSwipe)}:{String(state.canUndo)}:
            {String(state.isCompleted)}
          </Text>
          <Text>action:{lastActionResult}</Text>
          <Pressable
            accessibilityLabel="Swipe right"
            accessibilityRole="button"
            onPress={() => setLastActionResult(String(actions.swipeRight()))}
          >
            <Text>Swipe right</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Force undo"
            accessibilityRole="button"
            onPress={() => setLastActionResult(String(actions.undo()))}
          >
            <Text>Force undo</Text>
          </Pressable>
        </View>
      );
    }

    function Example({ deckData }: { deckData: Profile[] }) {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root data={deckData} getKey={getProfileKey} undoEnabled>
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    const renderResult = await render(<Example deckData={profiles} />);
    await measureDeckFromVisibleCard('Ada');

    await user.press(screen.getByRole('button', { name: 'Swipe right' }));

    expect(await screen.findByText('state:1:true:true:false')).toBeOnTheScreen();

    await renderResult.rerender(<Example deckData={[graceProfile]} />);

    expect(await screen.findByText('state:1:false:false:true')).toBeOnTheScreen();

    await renderResult.rerender(<Example deckData={profiles} />);

    expect(await screen.findByText('state:1:true:false:false')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Force undo' }));

    expect(await screen.findByText('action:false')).toBeOnTheScreen();
  });

  it('preserves valid undo history across reorder and restores by current key index', async () => {
    const ProfileDeck = createSwipeDeck<Profile>({
      undoMotion: SwipeDeckUndoMotion.timing({
        duration: 120,
      }),
    });
    const onUndo = jest.fn();
    const user = userEvent.setup();

    function DeckControls() {
      const state = ProfileDeck.useDeckState();
      const actions = ProfileDeck.useDeckActions();

      return (
        <View>
          <Text>
            state:{state.activeIndex}:{String(state.canSwipe)}:{String(state.canUndo)}:
            {String(state.isCompleted)}
          </Text>
          <Pressable
            accessibilityLabel="Swipe right"
            accessibilityRole="button"
            onPress={actions.swipeRight}
          >
            <Text>Swipe right</Text>
          </Pressable>
          <Pressable accessibilityLabel="Undo" accessibilityRole="button" onPress={actions.undo}>
            <Text>Undo</Text>
          </Pressable>
        </View>
      );
    }

    function Example({ deckData }: { deckData: Profile[] }) {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root data={deckData} getKey={getProfileKey} onUndo={onUndo} undoEnabled>
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    const renderResult = await render(<Example deckData={profiles} />);
    await measureDeckFromVisibleCard('Ada');

    await user.press(screen.getByRole('button', { name: 'Swipe right' }));

    expect(await screen.findByText('state:1:true:true:false')).toBeOnTheScreen();

    await renderResult.rerender(<Example deckData={[linusProfile, graceProfile, adaProfile]} />);

    expect(await screen.findByText('state:1:true:true:false')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('state:2:true:false:false')).toBeOnTheScreen();
    expect(screen.getByText('Ada')).toBeOnTheScreen();
    expect(onUndo).toHaveBeenCalledWith({
      direction: 'right',
      index: 2,
      item: adaProfile,
    });
  });

  it('keeps undo history valid when data and getKey change in the same render', async () => {
    const ProfileDeck = createSwipeDeck<Profile>({
      undoMotion: SwipeDeckUndoMotion.timing({
        duration: 120,
      }),
    });
    const renamedAdaProfile: Profile = { id: 'renamed-ada', name: 'Ada' };
    const getProfileNameKey = (profile: Profile) => profile.name.toLowerCase();
    const onUndo = jest.fn();
    const user = userEvent.setup();

    function DeckControls() {
      const state = ProfileDeck.useDeckState();
      const actions = ProfileDeck.useDeckActions();

      return (
        <View>
          <Text>
            state:{state.activeIndex}:{String(state.canSwipe)}:{String(state.canUndo)}:
            {String(state.isCompleted)}
          </Text>
          <Pressable
            accessibilityLabel="Swipe right"
            accessibilityRole="button"
            onPress={actions.swipeRight}
          >
            <Text>Swipe right</Text>
          </Pressable>
          <Pressable accessibilityLabel="Undo" accessibilityRole="button" onPress={actions.undo}>
            <Text>Undo</Text>
          </Pressable>
        </View>
      );
    }

    function Example({
      deckData,
      keyExtractor,
    }: {
      deckData: Profile[];
      keyExtractor: (profile: Profile, index: number) => string;
    }) {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root data={deckData} getKey={keyExtractor} onUndo={onUndo} undoEnabled>
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    const renderResult = await render(<Example deckData={profiles} keyExtractor={getProfileKey} />);
    await measureDeckFromVisibleCard('Ada');

    await user.press(screen.getByRole('button', { name: 'Swipe right' }));

    expect(await screen.findByText('state:1:true:true:false')).toBeOnTheScreen();

    await renderResult.rerender(
      <Example deckData={[graceProfile, renamedAdaProfile]} keyExtractor={getProfileNameKey} />,
    );

    expect(await screen.findByText('state:1:true:true:false')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('state:1:true:false:false')).toBeOnTheScreen();
    expect(onUndo).toHaveBeenCalledWith({
      direction: 'right',
      index: 1,
      item: renamedAdaProfile,
    });
  });

  it('cancels pending undo restore when data removes the restored key mid-animation', async () => {
    const ProfileDeck = createSwipeDeck<Profile>({
      undoMotion: SwipeDeckUndoMotion.spring({
        springConfig: {
          damping: 16,
          stiffness: 180,
        },
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
            state:{state.activeIndex}:{String(state.canSwipe)}:{String(state.canUndo)}:
            {String(state.isCompleted)}
          </Text>
          <Text>action:{lastActionResult}</Text>
          <Pressable
            accessibilityLabel="Swipe right"
            accessibilityRole="button"
            onPress={() => setLastActionResult(String(actions.swipeRight()))}
          >
            <Text>Swipe right</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Undo"
            accessibilityRole="button"
            onPress={() => setLastActionResult(String(actions.undo()))}
          >
            <Text>Undo</Text>
          </Pressable>
        </View>
      );
    }

    function Example({ deckData }: { deckData: Profile[] }) {
      return (
        <>
          <DeckControls />
          <ProfileDeck.Root data={deckData} getKey={getProfileKey} undoEnabled>
            <ProfileDeck.Card>{({ item }) => <Text>{item.name}</Text>}</ProfileDeck.Card>
          </ProfileDeck.Root>
        </>
      );
    }

    const renderResult = await render(<Example deckData={profiles} />);
    await measureDeckFromVisibleCard('Ada');

    await user.press(screen.getByRole('button', { name: 'Swipe right' }));

    expect(await screen.findByText('state:1:true:true:false')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('action:true')).toBeOnTheScreen();
    expect(screen.getByText('Ada')).toBeOnTheScreen();

    await renderResult.rerender(<Example deckData={[graceProfile]} />);

    expect(await screen.findByText('state:1:false:false:true')).toBeOnTheScreen();
    expect(screen.queryByText('Ada')).not.toBeOnTheScreen();
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
