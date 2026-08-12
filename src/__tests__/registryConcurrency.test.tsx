import { describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { Activity, useLayoutEffect } from 'react';
import { Text } from 'react-native';

import { createSwipeDeck } from '../index';
import { createSwipeDeckRegistry } from '../registry/registry';

async function flushRegistryEvictionMicrotask() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('SwipeDeck registry concurrent lifecycle', () => {
  it('rebases a hidden hook consumer onto the current store before its effects mount', async () => {
    const registry = createSwipeDeckRegistry();
    const renderedInteractions: ReturnType<typeof registry.useDeckInteraction>[] = [];
    const committedInteractions: ReturnType<typeof registry.useDeckInteraction>[] = [];
    const replacementInteractions: ReturnType<typeof registry.useDeckInteraction>[] = [];

    function AnchorConsumer() {
      registry.useDeckInteraction('route:concurrent');

      return <Text>anchor</Text>;
    }

    function LateConsumer() {
      const interaction = registry.useDeckInteraction('route:concurrent');

      renderedInteractions.push(interaction);

      useLayoutEffect(() => {
        committedInteractions.push(interaction);
      }, [interaction]);

      return <Text>late</Text>;
    }

    function ReplacementConsumer() {
      const interaction = registry.useDeckInteraction('route:concurrent');

      useLayoutEffect(() => {
        replacementInteractions.push(interaction);
      }, [interaction]);

      return <Text>replacement</Text>;
    }

    const anchorRender = await render(<AnchorConsumer />);
    const hiddenRender = await render(
      <Activity mode="hidden">
        <LateConsumer />
      </Activity>,
    );

    const staleInteraction = renderedInteractions.at(-1);

    expect(staleInteraction).toBeDefined();
    expect(committedInteractions).toEqual([]);

    await anchorRender.unmount();
    await flushRegistryEvictionMicrotask();

    const replacementRender = await render(<ReplacementConsumer />);
    const currentInteraction = replacementInteractions[0];

    expect(currentInteraction).toBeDefined();
    expect(currentInteraction).not.toBe(staleInteraction);

    await expect(
      hiddenRender.rerender(
        <Activity mode="visible">
          <LateConsumer />
        </Activity>,
      ),
    ).resolves.toBeUndefined();

    expect(committedInteractions.at(-1)).toBe(currentInteraction);

    await hiddenRender.unmount();
    await replacementRender.unmount();
  });

  it('attaches a hidden Root to the current store when it becomes visible', async () => {
    const ProfileDeck = createSwipeDeck<{ id: string }>();
    const getProfileKey = jest.fn((item: { id: string }) => item.id);

    function AnchorConsumer() {
      ProfileDeck.useDeckInteraction('route:root');

      return <Text>anchor</Text>;
    }

    function CurrentStateProbe() {
      const state = ProfileDeck.useDeckState('route:root');

      return <Text>current-count:{state.count}</Text>;
    }

    function LateRoot() {
      return (
        <ProfileDeck.Root id="route:root" data={[{ id: 'ada' }]} getKey={getProfileKey}>
          {null}
        </ProfileDeck.Root>
      );
    }

    const anchorRender = await render(<AnchorConsumer />);
    const hiddenRender = await render(
      <Activity mode="hidden">
        <LateRoot />
      </Activity>,
    );

    expect(getProfileKey).toHaveBeenCalled();

    await anchorRender.unmount();
    await flushRegistryEvictionMicrotask();

    const replacementRender = await render(<CurrentStateProbe />);

    expect(replacementRender.getByText('current-count:0')).toBeOnTheScreen();

    await expect(
      hiddenRender.rerender(
        <Activity mode="visible">
          <LateRoot />
        </Activity>,
      ),
    ).resolves.toBeUndefined();

    expect(await replacementRender.findByText('current-count:1')).toBeOnTheScreen();

    await hiddenRender.unmount();
    await replacementRender.unmount();
  });
});
