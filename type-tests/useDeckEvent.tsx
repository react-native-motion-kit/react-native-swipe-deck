import type { SwipeEvent } from '../src';

import { createSwipeDeck } from '../src';

type Profile = {
  id: string;
  name: string;
};

const ProfileDeck = createSwipeDeck<Profile>();
const profile: Profile = { id: 'ada', name: 'Ada' };

function expectType<T>(_value: T): void {}

expectType<SwipeEvent<Profile> | undefined>(ProfileDeck.useDeckEvent('swipe'));
expectType<SwipeEvent<Profile> | undefined>(ProfileDeck.useDeckEvent('swipe', 'nearby'));
expectType<SwipeEvent<Profile> | null>(ProfileDeck.useDeckEvent('swipe', null));
expectType<SwipeEvent<Profile> | undefined>(ProfileDeck.useDeckEvent('swipe', undefined));
expectType<SwipeEvent<Profile>>(
  ProfileDeck.useDeckEvent('swipe', {
    item: profile,
    index: 0,
    direction: 'right',
  }),
);
expectType<true | undefined>(ProfileDeck.useDeckEvent('endReached'));
expectType<boolean>(ProfileDeck.useDeckEvent('endReached', false));

// @ts-expect-error Empty object hides the event payload shape and must stay invalid.
ProfileDeck.useDeckEvent('swipe', {});

// @ts-expect-error Swipe events only support left/right directions.
ProfileDeck.useDeckEvent('swipe', {
  item: profile,
  index: 0,
  direction: 'up',
});

const rootWithCallbackProp = (
  // @ts-expect-error Root callback props were intentionally replaced by event hooks.
  <ProfileDeck.Root data={[profile]} getKey={(item) => item.id} onSwipe={() => undefined}>
    <ProfileDeck.Card>{() => null}</ProfileDeck.Card>
  </ProfileDeck.Root>
);

void rootWithCallbackProp;
