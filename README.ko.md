# @react-native-motion-kit/swipe-deck

[English](README.md)

Reanimated와 Gesture Handler 기반의 고성능 React Native용 Tinder 스타일 swipe deck / swipe card 라이브러리입니다.

## 특징

- **작은 render window**: 현재 카드와 bounded forward stack만 mount합니다.
- **Item-keyed rendering**: promoted card가 React Native view identity를 유지합니다.
- **Typed compound API**: `createSwipeDeck<T>()`로 typed deck family를 만듭니다.
- **Motion preset**: Tinder 스타일 drag, rotation, dismiss, next-card motion을 조정합니다.
- **Reanimated-first**: gesture/animation 상태를 shared value와 worklet 중심으로 유지합니다.

## 설치

```sh
npm install @react-native-motion-kit/swipe-deck react-native-gesture-handler react-native-reanimated react-native-worklets
```

사용 중인 React Native 또는 Expo 버전에 맞춰 Reanimated/Worklets 설정을 완료하세요.
Babel 설정에서는 `react-native-worklets/plugin`을 마지막 Babel plugin으로 추가해야 합니다.

## 빠른 시작

```tsx
import { createSwipeDeck, SwipeDeckMotion } from '@react-native-motion-kit/swipe-deck';

const profileDeckMotion = SwipeDeckMotion.tinder({
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
});

const SwipeDeck = createSwipeDeck<Profile>({
  motion: profileDeckMotion,
});

<SwipeDeck.Root
  data={profiles}
  getKey={(item) => item.id}
  visibleCardCount={3}
  onSwipe={({ item, direction }) => {
    console.log(item, direction);
  }}
  onEndReached={() => {
    console.log('No more cards');
  }}
>
  <SwipeDeck.Card>
    {({ item, role, isActive }) => <ProfileCard profile={item} role={role} active={isActive} />}
  </SwipeDeck.Card>
</SwipeDeck.Root>;
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

- `3`보다 작은 값은 데이터가 충분할 때 `3`으로 정규화됩니다.
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

<ProfileDeck.Root data={profiles} getKey={(item) => item.id}>
  <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
</ProfileDeck.Root>;
```

이렇게 하면 `Root`, `Card`, 앞으로 추가될 slot들이 JSX에서 generic을 반복하지 않고 같은 item type을 공유할 수 있습니다.

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
<SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
  {/* default/minimum budget */}
</SwipeDeck.Root>

<SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={9}>
  {/* deeper stacked UI */}
</SwipeDeck.Root>
```

| 입력                                           | Mount되는 card                                           |
| ---------------------------------------------- | -------------------------------------------------------- |
| `visibleCardCount={2}`                         | 데이터가 충분할 때 최대 `3`개                            |
| 남은 데이터가 10개이고 `visibleCardCount={20}` | 최대 남은 10개                                           |
| 짝수 값                                        | 최대 예산으로 그대로 유지되며, 홀수로 올림 처리하지 않음 |

## API 방향

MVP의 public API는 `Root`와 `Card` 중심으로 작게 시작합니다. 다만 장기적인 방향은 외부 제어를 위한 registry/controller 모델로 확장하는 것입니다.

앞으로의 API 방향에는 다음이 포함될 수 있습니다.

- public `Provider` 또는 registry boundary
- imperative action을 위한 controller hook
- `id` 기반 deck registration
- 외부 swipe control을 위한 trigger component
- 더 명시적인 prerender/window control

이 기능들은 아직 첫 shipped surface에는 포함하지 않습니다. 현재 API는 core deck을 작게 유지하면서, 이후 registry-first external control로 확장할 수 있는 여지를 남기는 방향입니다.

## 기여하기

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## 라이선스

MIT
