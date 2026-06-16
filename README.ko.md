# @react-native-motion-kit/swipe-deck

[English](README.md)

<div align="center">
  <img src="./assets/logo.png" width="300px" alt="React Native Motion Kit logo" />
</div>

Reanimated와 Gesture Handler 기반의 고성능 React Native용 Tinder 스타일 swipe deck / swipe card 라이브러리입니다.

## 특징

- **작은 render window**: 현재 카드와 bounded forward stack만 mount합니다.
- **Item-keyed rendering**: promoted card가 React Native view identity를 유지합니다.
- **Typed compound API**: `createSwipeDeck<T>()`로 typed deck family를 만듭니다.
- **Motion preset**: Tinder 스타일 drag, rotation, dismiss, next-card, action motion을 조정합니다.
- **Reanimated-first**: gesture/animation 상태를 shared value와 worklet 중심으로 유지합니다.

## 설치

```sh
npm install @react-native-motion-kit/swipe-deck react-native-gesture-handler react-native-reanimated react-native-worklets
```

사용 중인 React Native 또는 Expo 버전에 맞춰 Reanimated/Worklets 설정을 완료하세요.
Babel 설정에서는 `react-native-worklets/plugin`을 마지막 Babel plugin으로 추가해야 합니다.

### 최소 지원 버전

| Package                        | Minimum  |
| ------------------------------ | -------- |
| `react`                        | `18.0.0` |
| `react-native`                 | `0.75.0` |
| `react-native-gesture-handler` | `2.24.0` |
| `react-native-reanimated`      | `4.0.0`  |
| `react-native-worklets`        | `0.5.0`  |

## 빠른 시작

`Root`, `Card`, 외부 action, state, interaction hook이 같은 factory instance를 공유해야 한다면 item type에 맞는 typed deck family를 하나 만드세요.

```tsx
import { createSwipeDeck, SwipeDeckMotion } from '@react-native-motion-kit/swipe-deck';

const ProfileDeck = createSwipeDeck<Profile>({
  motion: SwipeDeckMotion.tinder({
    drag: {
      mode: 'horizontal',
      liftYFactor: 0.15,
    },
    rotation: {
      mode: 'grab-position',
    },
    dismiss: {
      threshold: ({ width }) => width * 0.3,
      velocityThreshold: 800,
      minDuration: 300,
      maxDuration: 520,
    },
  }),
});

function ProfileDeckEvents() {
  ProfileDeck.useDeckEventListener('swipe', ({ item, direction }) => {
    console.log(item, direction);
  });
  ProfileDeck.useDeckEventListener('endReached', () => {
    console.log('No more cards');
  });

  return null;
}

function ProfileDeckScreen() {
  return (
    <>
      <ProfileDeckEvents />
      <ProfileDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
        <ProfileDeck.Card>
          {({ item, role, isActive }) => (
            <ProfileCard profile={item} role={role} active={isActive} />
          )}
        </ProfileDeck.Card>
      </ProfileDeck.Root>
    </>
  );
}
```

## 핵심 개념

### Bounded forward window

Deck은 전체 data set을 한 번에 렌더링하지 않습니다.

기본적으로 active index부터 최대 **3개의 item-keyed card**를 mount합니다.

1. current card
2. next card
3. next buffered card

이 방식은 dismissed previous card를 다시 채우지 않으면서도 현재 카드와 들어오는 stack의 연속성을 유지합니다.

`visibleCardCount`는 최대 예산입니다.

- 기본값은 더 자연스러운 next-card promotion을 위해 `3`입니다.
- `2`보다 작은 값은 데이터가 충분할 때 `2`로 정규화됩니다.
- `visibleCardCount={2}`는 현재 카드와 바로 다음 카드만 렌더링합니다.
- 실제 mount 개수는 active index부터 남은 데이터 개수를 넘지 않습니다.
- 짝수 값은 그대로 최대 예산으로 유지되며, 홀수로 올림 처리하지 않습니다.

### 안정적인 item key

`getKey`는 card identity 렌더링 계약의 일부이므로 필수입니다.

Key는 다음 조건을 만족해야 합니다.

- 같은 logical item은 swipe가 진행되어도 같은 key를 반환해야 합니다.
- 서로 다른 item은 같은 key를 공유하지 않는 것이 좋습니다.

그래야 promoted card가 React Native view identity를 유지하고, 다른 item의 native text subtree를 재사용하지 않습니다.

### Typed compound API

주요 API는 compound/slot 기반입니다.

- `Root`는 data, gesture state, deck-level option을 소유합니다.
- `Card`는 각 item의 rendering을 정의합니다.
- `createSwipeDeck<T>()`는 typed component family를 만듭니다.

```tsx
const ProfileDeck = createSwipeDeck<Profile>();

function ProfileDeckScreen() {
  return (
    <ProfileDeck.Root data={profiles} getKey={(item) => item.id}>
      <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
    </ProfileDeck.Root>
  );
}
```

이렇게 하면 `Root`, `Card`, 앞으로 추가될 slot들이 JSX에서 generic을 반복하지 않고 같은 item type을 공유할 수 있습니다.

Hook과 외부 UI가 공유할 수 있는 이름 붙은 factory instance가 필요하면 이 factory pattern을
사용하세요.

### Deck hooks

Factory hook은 Provider를 추가하거나 controller prop을 tree로 넘기지 않고도 deck 전체 state,
action, Reanimated interaction 값을 제공합니다. Hook은 `createSwipeDeck<T>()`로 만든 factory
instance에 scope됩니다.

```tsx
// profile-deck.ts
export const ProfileDeck = createSwipeDeck<Profile>();
```

Counter와 button처럼 React로 렌더링되는 UI에는 state/action hook을 사용하세요.

```tsx
function ProfileDeckControls() {
  const { activeIndex, count, canSwipe, canUndo, isCompleted } = ProfileDeck.useDeckState();
  const { swipeLeft, swipeRight, undo } = ProfileDeck.useDeckActions();
  const current = activeIndex >= 0 ? activeIndex + 1 : 0;

  return (
    <View>
      <Text>{isCompleted ? 'Done' : `${current} / ${count}`}</Text>
      <Pressable disabled={!canSwipe} onPress={swipeLeft}>
        <Text>Nope</Text>
      </Pressable>
      <Pressable disabled={!canUndo} onPress={undo}>
        <Text>Undo</Text>
      </Pressable>
      <Pressable disabled={!canSwipe} onPress={swipeRight}>
        <Text>Like</Text>
      </Pressable>
    </View>
  );
}
```

Swipe 진행도에 따라 움직이는 animated UI에는 interaction shared value를 사용하세요. 이 값들은
UI thread에서 업데이트되고 gesture의 매 frame마다 React rerender를 만들지 않습니다.

```tsx
function SwipeReactionOverlay() {
  const { signedProgress } = ProfileDeck.useDeckInteraction();

  const likeStyle = useAnimatedStyle(() => {
    const progress = Math.max(signedProgress.get(), 0);

    return {
      opacity: progress,
      transform: [{ scale: 0.9 + progress * 0.18 }],
    };
  });

  return <Animated.View pointerEvents="none" style={likeStyle} />;
}
```

Swipe, undo, index 변경, end reached 같은 commit된 model event에는 event hook을 사용하세요.

```tsx
function ProfileDeckEvents() {
  const lastSwipe = ProfileDeck.useDeckEvent('swipe', null);
  const endReached = ProfileDeck.useDeckEvent('endReached', false);

  ProfileDeck.useDeckEventListener('undo', ({ item }) => {
    console.log('Restored', item);
  });

  return (
    <Text>
      {endReached ? 'Done' : lastSwipe ? `Last swipe: ${lastSwipe.direction}` : 'No swipe yet'}
    </Text>
  );
}
```

Event hook은 commit 단위의 latest-value API입니다.

- `useDeckEvent()`는 event name별 최신 event 하나만 저장합니다. Event history가 아닙니다.
- `initialValue`는 event payload shape, `null`, `undefined`, 또는 `endReached`의 `false`로 제한됩니다.
  `swipe` 같은 object event에는 `null`을 사용하세요. `{}`는 event payload 타입을 넓혀버리지 않도록 의도적으로 막습니다.
- Object initial value를 넘기면 `eventName`을 기준으로 contextual typing이 걸립니다.
  그래서 `useDeckEvent('swipe', { ... })`에서는 `item`, `index`, `direction`이 자동완성됩니다.
- Initial value 없이 named deck을 읽어야 한다면 id를 두 번째 인자로 넘기면 됩니다.
  `useDeckEvent('swipe', 'nearby')`처럼 사용할 수 있고, initial value도 함께 넘기는 경우에는 id가 세 번째 인자입니다.
- Root가 attach될 때와 detach될 때 event snapshot은 clear됩니다. 그래서 fresh/detached deck에서는
  hook이 `initialValue`를 반환합니다.
- `useDeckEventListener()`는 imperative 구독입니다. Mounted listener는 attach/detach를 지나도
  같은 factory/id store에 구독된 상태를 유지하지만, active Root가 새 event를 emit할 때만 실행됩니다.
- Event는 commit path에서 emit됩니다. 같은 tick 안에서는 event payload가 해당 event의 source of truth이고,
  뒤따르는 `useDeckState()` render는 event 직후에 settle될 수 있습니다.

그리고 같은 factory의 Root 주변에서 control을 렌더링합니다.

```tsx
function ProfileDeckScreen() {
  return (
    <View>
      <ProfileDeck.Root data={profiles} getKey={(item) => item.id} undoEnabled>
        <ProfileDeck.Card>
          {({ item, isActive }) => (
            <View>
              <ProfileCard profile={item} />
              {isActive ? <SwipeReactionOverlay /> : null}
            </View>
          )}
        </ProfileDeck.Card>
      </ProfileDeck.Root>
      <ProfileDeckControls />
    </View>
  );
}
```

- `useDeckState(id?)`는 `activeIndex`, `count`, `isCompleted`, `canSwipe`, `canUndo` 같은 React 렌더링용 deck state를 반환합니다.
  현재 item이 필요하면 deck state가 primitive하고 stable하게 유지되도록 사용자의 `data[activeIndex]`에서 직접 계산하세요.
- `useDeckActions(id?)`는 `swipeLeft()`, `swipeRight()`, `undo()` 같은 stable action을 반환합니다.
  swipe action은 실행이 받아들여지면 `true`, deck이 아직 연결되지 않았거나 disabled/animating/layout 미측정/완료 상태라면 `false`를 반환합니다.
  `undo()`는 deck이 완료된 뒤에도 `canUndo`가 true라면 `true`를 반환합니다.
- `useDeckInteraction(id?)`는 progress 기반 UI를 위한 Reanimated shared value를 반환합니다.
  gesture progress는 UI thread에 남고, 매 frame React rerender를 만들지 않습니다.
  - `interaction.phase`는 UI thread lifecycle signal입니다:
    `idle | dragging | dismissing | undoing`.
  - deck이 drag 중인지, dismiss 중인지, restore 중인지 알아야 하는 visual feedback에는
    `phase`를 사용하세요. swipe, undo, index change처럼 commit된 model event는
    `useDeckEvent` / `useDeckEventListener`를 사용하세요.
  - `dismissing`은 dismiss가 accepted된 뒤 다음 item commit과 interaction reset이 끝날 때까지의
    lifecycle을 포함합니다. 즉, 화면 밖으로 나가는 animation frame만 의미하지는 않습니다.
  - programmatic springboard action은 action이 받아들여지는 즉시 `dismissing`으로 들어갑니다.
    anticipation 중에는 실제 dismiss phase가 시작되기 전까지 `interaction.direction`이 neutral일 수 있습니다.
- `useDeckEvent(eventName, initialValue?, id?)`는 React 렌더링용 최신 commit event를 반환합니다.
  첫 event 전과 deck이 detach된 뒤에는 `undefined` 또는 `initialValue`를 반환합니다.
- `useDeckEventListener(eventName, listener, id?)`는 앱 코드에서 별도 state를 만들지 않고 commit된 model event를 구독합니다.
  listener hook은 unmount 시 자동으로 정리됩니다.
  성공한 swipe는 `swipe -> indexChange -> endReached` 순서로 emit됩니다. Undo는
  `undo -> indexChange` 순서로 emit됩니다.

### Programmatic action motion

`motion`은 손으로 drag하는 gesture 기반 deck feel을 제어합니다. `actionMotion`은
`useDeckActions()`에서 실행하는 like/pass 버튼 같은 programmatic action만 제어합니다.
따라서 버튼으로 넘길 때의 움직임을 바꿔도 manual drag, threshold, flick 동작은 바뀌지 않습니다.

```tsx
import {
  createSwipeDeck,
  SwipeDeckActionMotion,
  SwipeDeckMotion,
} from '@react-native-motion-kit/swipe-deck';

const ProfileDeck = createSwipeDeck<Profile>({
  motion: SwipeDeckMotion.tinder(),
  actionMotion: SwipeDeckActionMotion.springboard({
    anticipationDistance: ({ width }) => width * 0.04,
    anticipationDuration: 80,
    dismissDuration: 320,
  }),
});

function LikeButton() {
  const actions = ProfileDeck.useDeckActions();

  return <Pressable onPress={actions.swipeRight}>Like</Pressable>;
}
```

제공되는 recipe는 다음과 같습니다.

- `SwipeDeckActionMotion.direct(options?)`: action 방향으로 바로 dismiss합니다. 생략한 값은
  deck에서 resolve된 dismiss duration, easing, offscreen multiplier를 재사용합니다.
- `SwipeDeckActionMotion.springboard(options?)`: 최종 방향의 반대쪽으로 살짝 움직인 뒤 화면 밖으로
  dismiss합니다. Anticipation 단계에서는 swipe progress를 중립으로 유지해 반대쪽 overlay가
  순간적으로 보이지 않게 하며, `interaction.direction`도 dismiss phase가 시작될 때까지
  중립으로 유지합니다. 생략한 dismiss 값은 deck에서 resolve된 dismiss duration, easing,
  offscreen multiplier를 재사용합니다.

특정 action 한 번만 override할 수도 있습니다.

```tsx
actions.swipeLeft(
  SwipeDeckActionMotion.direct({
    duration: 180,
  }),
);
```

`actionMotion` 우선순위는 deep merge가 아니라 replacement 방식입니다.

1. `createSwipeDeck({ actionMotion })`의 factory `actionMotion`
2. 해당 Root에서 factory default를 대체하는 `Root actionMotion`
3. `swipeLeft(recipe)` 또는 `swipeRight(recipe)`에 넘긴 per-call recipe

Action은 callback으로 바로 넘겨도 안전합니다. React Native press event가 `swipeRight` 또는
`swipeLeft`로 전달되면 그 event 인자는 무시하고 설정된 action motion을 사용합니다.

### Undo / back swipe motion

Undo는 opt-in입니다. 해당 deck에서 undo/back-swipe UX를 제공할 때 Root에 `undoEnabled`를
추가하세요. 활성화되면 성공한 swipe마다 key/index/direction metadata entry 하나를 LIFO undo stack에
저장합니다. Lookup은 현재 `data`에 대한 key-to-index map을 사용하고, data나 key가 바뀌면 invalid
entry를 prune합니다. 생략하면 성공한 swipe도 undo metadata를 저장하지 않고, `canUndo`는 `false`를
유지하며, `actions.undo()`는 `false`를 반환합니다.

Undo가 받아들여지면 deck은 main stack을 restored index 기준으로 잠시 렌더링하고, 그 실제 current
card를 카드가 원래 나갔던 방향에서 다시 중앙으로 들어오도록 animation한 뒤 restored index를
commit합니다.

```tsx
import { createSwipeDeck, SwipeDeckUndoMotion } from '@react-native-motion-kit/swipe-deck';

const ProfileDeck = createSwipeDeck<Profile>({
  undoMotion: SwipeDeckUndoMotion.spring({
    springConfig: {
      damping: 36,
      stiffness: 300,
      mass: 3,
    },
  }),
});

function ProfileDeckExample() {
  return (
    <ProfileDeck.Root data={profiles} getKey={(item) => item.id} undoEnabled>
      <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
    </ProfileDeck.Root>
  );
}

function UndoButton() {
  const state = ProfileDeck.useDeckState();
  const actions = ProfileDeck.useDeckActions();

  return (
    <Pressable disabled={!state.canUndo} onPress={actions.undo}>
      <Text>Undo</Text>
    </Pressable>
  );
}
```

Undo는 기본적으로 비활성화되어 있으므로 undo control을 노출하지 않는 deck은 undo history 비용을
내지 않습니다. `undoEnabled`를 켜면 key가 `data`에 남아 있는 동안 이전 swipe들을 LIFO 순서로 반복
복원할 수 있습니다. 오래 실행되는 undo-enabled deck은 해당 entry가 undo되거나 data 변경으로 prune될
때까지 accepted swipe마다 metadata entry 하나를 유지합니다. 기본 undo motion은 zero-duration
`SwipeDeckUndoMotion.timing()`을 사용하므로, 별도 motion을 설정하지 않으면 card를 즉시 복원합니다.

제공되는 recipe는 다음과 같습니다.

- `SwipeDeckUndoMotion.spring(options?)`: Reanimated `withSpring`으로 card를 복원합니다.
- `SwipeDeckUndoMotion.timing(options?)`: deterministic한 `withTiming`으로 card를 복원합니다.

두 recipe는 공통으로 다음 옵션을 받습니다.

- `from: 'auto' | 'left' | 'right'`: `auto`는 원래 swipe된 방향에서 card를 되돌립니다.
- `entryDistance`: 화면 밖 시작 거리를 number 또는 layout callback으로 지정합니다.

`timing`은 `duration`, `easing`을 추가로 받고 기본 duration은 `0`입니다. `spring`은 `springConfig`를 받습니다.

`undoMotion` 우선순위는 replacement 방식입니다.

1. `createSwipeDeck({ undoMotion })`의 factory `undoMotion`
2. 해당 Root에서 factory default를 대체하는 `Root undoMotion`
3. `actions.undo(recipe)`에 넘긴 per-call recipe

Undo도 callback으로 바로 넘겨도 안전합니다. React Native press event가 `undo`로 전달되면 그
event 인자는 무시하고 설정된 undo motion을 사용합니다. Undo restore 중 public interaction 값
(`progress`, `signedProgress`, `direction`, `translationX`, `translationY`)은 중립으로 유지되어,
progress 기반 swipe overlay가 순간적으로 깜빡이지 않습니다.

같은 factory에서 여러 Root를 렌더링할 때만 `id`를 사용하세요.

```tsx
function MultiDeckScreen() {
  const nearbyState = ProfileDeck.useDeckState('nearby');

  return (
    <>
      <ProfileDeck.Root id="recommended" data={recommended} getKey={(item) => item.id}>
        <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
      </ProfileDeck.Root>

      <ProfileDeck.Root id="nearby" data={nearby} getKey={(item) => item.id}>
        <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
      </ProfileDeck.Root>

      <Text>{nearbyState.activeIndex + 1}</Text>
    </>
  );
}
```

`id`는 item key가 아니라 factory 안에서 deck instance를 구분하는 namespace입니다.
서로 다른 factory는 둘 다 default id를 써도 충돌하지 않지만, 같은 factory와 같은 id의 Root 두 개가 동시에 mount되는 것은 잘못된 사용입니다.
id는 `"nearby"`, `"recommended"`처럼 화면/용도 단위의 안정적이고 적은 개수의 값으로 유지하세요.
Registry는 hook, action, interaction shared value의 identity를 안정적으로 유지하기 위해 factory lifetime 동안 id별 store를 유지합니다.
따라서 item id, timestamp, 매 render마다 바뀌는 값, 일회성 route 값에서 deck id를 만들지 마세요.
Factory와 id는 render path 밖에서 안정적으로 만들고 유지하세요. 동적 factory나 동적 id는 registry가
의도적으로 안정적으로 유지하는 long-lived namespace를 계속 만들 수 있습니다.

짧은 이름을 선호한다면 같은 factory instance에서 destructuring한 alias를 export해도 됩니다.

```ts
const ProfileDeck = createSwipeDeck<Profile>();

export const {
  Root: ProfileDeckRoot,
  Card: ProfileDeckCard,
  useDeckState: useProfileDeckState,
  useDeckActions: useProfileDeckActions,
  useDeckInteraction: useProfileDeckInteraction,
} = ProfileDeck;
```

Factory는 deck family마다 한 번만 만들고 shared module에서 export하세요. Hook, action, interaction은 같은 factory instance에서 만든 Root에만 연결됩니다. item type과 id가 같아도 `createSwipeDeck<Profile>()`를 다시 호출하면 별도 registry namespace가 만들어지므로, 한 factory의 hook으로 다른 factory의 Root를 제어할 수 없습니다.

### 간단한 inline 사용

카드 렌더링만 필요하다면 factory instance를 만들지 않고 static API를 사용할 수 있습니다.
작은 inline deck에는 유용하지만, `useDeckState`, `useDeckActions`, `useDeckInteraction`, `useDeckEvent`,
`useDeckEventListener` 같은 factory hook은 노출하지 않습니다.
Static `Root`는 `id`를 받지 않습니다. 이름이 있는 deck state, action, interaction, model event가 필요하면 factory instance를 사용하세요.
Static `Root`와 `Card`는 factory처럼 item type을 함께 고정하지 않습니다.
따라서 card render prop에서 `item` 타입이 필요하면 `Card`에 item type을 직접 넘기세요.

```tsx
import { SwipeDeck } from '@react-native-motion-kit/swipe-deck';

function InlineDeck() {
  return (
    <SwipeDeck.Root data={profiles} getKey={(item) => item.id}>
      <SwipeDeck.Card<Profile>>{({ item }) => <ProfileCard profile={item} />}</SwipeDeck.Card>
    </SwipeDeck.Root>
  );
}
```

## Motion

### Swipe progress를 따라가는 것

Buffered next card는 swipe progress에 따라 애니메이션됩니다.

- scale은 `1`에 가까워집니다.
- opacity는 `1`에 가까워집니다.
- `translateY`는 `0`에 가까워집니다.

Swipe가 commit되면 다음 일이 일어납니다.

- dismissed card는 화면 밖으로 나갑니다.
- promoted next card는 자신의 item identity를 유지합니다.
- 새로운 future item이 bounded window에 들어옵니다.

이 동작은 `SwipeDeckMotion.tinder(...)` 같은 motion preset으로 조정합니다.

### Drag mode

`drag.mode`는 drag 중 active card가 손가락 translation을 어떻게 사용할지 제어합니다.

| mode         | Active card 움직임                              |
| ------------ | ----------------------------------------------- |
| `free`       | 손가락의 X/Y 이동을 모두 따라갑니다.            |
| `horizontal` | 손가락의 Y 이동은 무시하고 X 이동만 반영합니다. |

`drag.liftYFactor`는 active card를 `abs(translationX) * liftYFactor`만큼 위로 올립니다.

```tsx
SwipeDeckMotion.tinder({
  drag: {
    mode: 'horizontal',
    liftYFactor: 0,
  },
  rotation: {
    mode: 'fixed',
    origin: 'bottom-center',
  },
});
```

`drag.mode: 'horizontal'`과 `rotation: { mode: 'fixed', origin: 'bottom-center' }`를 함께 쓰면 아래쪽 축을 기준으로 좌우로만 움직이는 느낌을 만들 수 있습니다.

### Motion 우선순위

Motion 값은 다음 순서로 resolve됩니다.

1. `createSwipeDeck({ motion })`의 factory motion default
2. 명시한 field만 부분 override하는 `Root motion`
3. `swipeThreshold`, `velocityThreshold` 같은 direct root prop

Factory motion과 Root motion은 deep merge됩니다. `maxDegrees`, `inputRange` 같은 numeric rotation tuning은 Root motion에서 명시적으로 덮어쓰지 않는 한 유지되며, `rotation.mode`를 바꿔도 mode default로 reset되지 않습니다.

### Motion preset 안정성

Motion preset은 module-scope constant 또는 `useMemo`로 안정적으로 유지하는 것을 권장합니다.

안정적인 preset reference를 유지하면 Reanimated easing function이나 spring config object를 넘길 때 불필요한 gesture/worklet setup 재생성을 피할 수 있습니다.

앱 전체 또는 deck family 단위 기본값은 render 바깥에서 정의하고 factory에 넘기세요.

```tsx
const profileDeckMotion = SwipeDeckMotion.tinder({
  rotation: {
    mode: 'fixed',
    origin: 'bottom-center',
  },
  dismiss: {
    threshold: ({ width }) => width * 0.3,
  },
});

const ProfileDeck = createSwipeDeck<Profile>({
  motion: profileDeckMotion,
});
```

Motion이 props 또는 state에 의존한다면 call site에서 config를 memoize하세요.

```tsx
function ProfileScreen({ slowMotion }: { slowMotion: boolean }) {
  const motion = useMemo(
    () =>
      SwipeDeckMotion.tinder({
        dismiss: {
          minDuration: slowMotion ? 420 : 220,
          maxDuration: slowMotion ? 700 : 420,
        },
      }),
    [slowMotion],
  );

  return (
    <ProfileDeck.Root data={profiles} getKey={(item) => item.id} motion={motion}>
      <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
    </ProfileDeck.Root>
  );
}
```

### Rotation

`rotation.mode`는 회전 기준점을 고정할지, gesture 시작 위치에서 계산할지 제어합니다. 기본값은 Tinder-like `mode: 'grab-position'`입니다. Rotation 설정은 swipe 인식을 바꾸지 않습니다. 다만 `dismiss.duration`을 생략하면 release target을 회전된 card geometry로 계산하기 때문에 velocity-derived dismiss timing은 달라질 수 있습니다.

#### Fixed rotation

기본 grab-position 동작 대신 모든 gesture가 같은 anchor를 사용해야 한다면 fixed rotation을 사용하세요.

| origin          | 느낌                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `center`        | 카드 중앙을 기준으로 회전합니다.                                                                                            |
| `top-center`    | 카드의 위쪽 중앙 edge를 기준으로 회전합니다. 위쪽은 거의 고정된 축처럼 느껴지고, 아래쪽은 더 큰 원호를 그리며 움직입니다.   |
| `bottom-center` | 카드의 아래쪽 중앙 edge를 기준으로 회전합니다. 아래쪽은 거의 고정된 축처럼 느껴지고, 위쪽은 더 큰 원호를 그리며 움직입니다. |

```tsx
SwipeDeckMotion.tinder({
  rotation: {
    mode: 'fixed',
    origin: 'bottom-center',
    direction: 'default',
  },
});
```

같은 고정 anchor에서 회전 부호만 반대로 만들고 싶다면 `direction: 'reverse'`를 사용하세요.

#### Grab-position rotation

Grab-position rotation은 기본 Tinder-like 동작입니다. `maxDegrees`, `inputRange` 같은 공통 rotation 값만 덮어쓰고 싶을 때 명시적으로 사용하세요.

```tsx
SwipeDeckMotion.tinder({
  rotation: {
    mode: 'grab-position',
    direction: 'default',
    maxDegrees: 25,
  },
});
```

카드 위쪽에서 잡으면 top-center anchor와 default rotation sign을 사용합니다. 아래쪽에서 잡으면 bottom-center anchor와 reverse rotation sign을 사용합니다. `direction: 'reverse'`를 주면 이 mapping을 뒤집습니다. `maxDegrees`, `inputRange`는 계속 설정할 수 있지만, 이 mode에서는 고정 `origin`은 의도적으로 받지 않습니다.

같은 `maxDegrees` 값도 edge 기반 rotation에서는 더 강하게 느껴집니다. 그래서 Tinder preset은 `maxDegrees`를 직접 지정하지 않은 경우 `top-center`, `bottom-center`, `grab-position`에 더 작은 기본 회전 각도를 사용합니다.

### Dismiss target

`dismiss.offscreenMultiplier`는 성공한 swipe의 release target을 제어합니다.

- 성공한 swipe는 항상 화면 밖으로 dismiss됩니다.
- 기본값 `1.5`는 카드를 `clearDistance * 1.5` 위치로 보냅니다.
- `clearDistance`는 손을 놓는 순간의 실제 swipe direction, rotation mode, rotation direction, gesture start position으로 계산합니다.
- `1`보다 작은 값은 `1`로 정규화됩니다.
- `duration`을 생략하면 release velocity와 target까지 남은 거리로 duration을 계산합니다.

대부분의 앱은 이 옵션을 생략하고 다음 값만 조정하면 됩니다.

- `threshold`
- `velocityThreshold`
- `duration`, `minDuration`, `maxDuration`
- Reanimated `easing`

`dismiss.easing`은 Reanimated `withTiming`과 같은 easing 값을 받습니다.
기본값은 `Easing.out(Easing.cubic)`입니다.

## Visible card budget

```tsx
function CompactDeck() {
  return (
    <SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={2}>
      {/* minimum budget: current + immediate next */}
    </SwipeDeck.Root>
  );
}

function DefaultDeck() {
  return (
    <SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
      {/* default budget for smoother next-card promotion */}
    </SwipeDeck.Root>
  );
}

function DeepStackDeck() {
  return (
    <SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={9}>
      {/* deeper stacked UI */}
    </SwipeDeck.Root>
  );
}
```

| 입력                                           | Mount되는 card                                           |
| ---------------------------------------------- | -------------------------------------------------------- |
| `visibleCardCount={1}`                         | 데이터가 충분할 때 최대 `2`개                            |
| `visibleCardCount={2}`                         | 데이터가 충분할 때 최대 `2`개                            |
| 남은 데이터가 10개이고 `visibleCardCount={20}` | 최대 남은 10개                                           |
| 짝수 값                                        | 최대 예산으로 그대로 유지되며, 홀수로 올림 처리하지 않음 |

## 기여하기

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## 라이선스

MIT
