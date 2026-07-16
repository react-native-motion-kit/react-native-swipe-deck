import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { makeMutable } from 'react-native-reanimated';

import type { SwipeDeckRenderedCardMotionConfig } from '../core/renderedCardMotionTypes';
import type { SwipeDirection } from '../types';

import { SwipeDeckCard } from '../components/SwipeDeckCard';
import { SwipeDeckRenderedCard } from '../components/SwipeDeckRenderedCard';

type Profile = {
  id: string;
  name: string;
};

const profile: Profile = { id: 'ada', name: 'Ada' };

const motionConfig: SwipeDeckRenderedCardMotionConfig = {
  nextScale: 0.95,
  nextOpacity: 1,
  nextTranslateY: 12,
  drag: {
    mode: 'horizontal',
    liftYFactor: 0.3,
  },
  rotation: {
    mode: 'fixed',
    origin: 'center',
    direction: 'default',
    maxDegrees: 20,
    inputRange: 100,
  },
};

async function renderActiveCard({
  dismissDirection,
  translateX,
  translateY,
}: {
  dismissDirection: SwipeDirection | null;
  translateX: number;
  translateY: number;
}) {
  await render(
    <SwipeDeckRenderedCard
      itemIndex={0}
      itemKey={profile.id}
      item={profile}
      descriptor={{ index: 0, offset: 0, role: 'current', isActive: true }}
      cardSlot={<SwipeDeckCard<Profile>>{({ item }) => <Text>{item.name}</Text>}</SwipeDeckCard>}
      swipeProgress={makeMutable(0)}
      activeTranslateX={makeMutable(translateX)}
      activeTranslateY={makeMutable(translateY)}
      dismissDirection={makeMutable(dismissDirection)}
      dragItemIndex={makeMutable(0)}
      undoProgress={makeMutable(0)}
      undoFromTranslateX={makeMutable(0)}
      undoFromTranslateY={makeMutable(0)}
      activeItemIndex={makeMutable(0)}
      gestureStartYRatio={makeMutable(0.5)}
      motionConfig={motionConfig}
    />,
  );
}

describe('SwipeDeckRenderedCard', () => {
  it('renders an accepted upward dismiss in horizontal drag mode', async () => {
    await renderActiveCard({ dismissDirection: 'up', translateX: 0, translateY: -180 });

    expect(screen.getByTestId('swipe-deck-card-current')).toHaveStyle({
      transform: [{ translateX: 0 }, { translateY: -180 }, { rotate: '0deg' }],
    });
  });

  it('keeps horizontal movement constrained for non-upward interaction', async () => {
    await renderActiveCard({ dismissDirection: 'right', translateX: 100, translateY: -180 });

    expect(screen.getByTestId('swipe-deck-card-current')).toHaveStyle({
      transform: [{ translateX: 100 }, { translateY: -30 }, { rotate: '20deg' }],
    });
  });

  it('keeps vertical finger movement constrained before a dismiss is accepted', async () => {
    await renderActiveCard({ dismissDirection: null, translateX: 100, translateY: -180 });

    expect(screen.getByTestId('swipe-deck-card-current')).toHaveStyle({
      transform: [{ translateX: 100 }, { translateY: -30 }, { rotate: '20deg' }],
    });
  });
});
