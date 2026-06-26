# React Native Swipe Deck

> [English](./README.md) | 한국어

<div align="center">
  <img src="./assets/logo.png" width="300px" alt="React Native Motion Kit 로고" />
</div>

## 개요

React Native에서 Tinder 스타일 card stack을 만들 때 gesture state, programmatic action, animation state, commit event를 매 화면마다 직접 연결하고 있나요?

`@react-native-motion-kit/swipe-deck`는 React Native용 고성능 swipe deck 라이브러리입니다.
Reanimated, Worklets, Gesture Handler를 기반으로 card stack, like/pass button, progress 기반 overlay, undo flow, 여러 독립 deck instance를 typed compound API로 다룰 수 있습니다.

### 주요 기능

- 🤌 **Gesture 중심 Deck UX** - Tinder 스타일 card stack에 맞춰 drag, flick, threshold, direction control을 조정합니다
- 🏎️ **고성능 애니메이션** - React Native Reanimated와 Worklets 기반으로 UI thread에서 부드러운 card motion을 만듭니다
- 🪟 **Bounded Render Window** - 전체 데이터가 아니라 active card와 작은 forward stack만 mount합니다
- 🧬 **Item-Stable Promotion** - 안정적인 item key로 promoted card가 React Native view identity를 유지합니다
- 🧠 **Typed Compound API** - Root, Card, hook, action, event를 하나의 typed deck family로 묶습니다
- 🎛️ **외부 제어 API** - button이나 다른 UI에서 swipeLeft, swipeRight, undo를 programmatic하게 실행합니다
- 🎨 **Motion Recipes** - gesture motion, programmatic action, undo restore를 각각 독립적으로 조정합니다
- 🧩 **Multi-Instance Management** - 안정적인 factory-scoped id로 여러 deck root를 독립적으로 관리합니다
- ↩️ **Undo Support** - action-safe undo motion과 LIFO history로 back-swipe UX를 opt-in으로 제공합니다
- 🪄 **쉬운 API** - Root와 Card로 시작하고 control이나 event가 필요할 때만 hook을 추가합니다

## 빠른 시작

### 📚 문서

전체 문서는 여기에서 확인할 수 있습니다: <https://react-native-swipe-deck.pages.dev/ko/>

### 예제 & 데모

- [📁 예제 프로젝트](https://github.com/react-native-motion-kit/react-native-swipe-deck/tree/main/example) - 다양한 use case를 담은 실제 구현 코드입니다

### 🤖 AI

- [llms.txt](https://react-native-swipe-deck.pages.dev/ko/llms.txt): 모든 문서 페이지의 제목, 링크, 간단한 설명을 담은 structured index 파일입니다.
- [llms-full.txt](https://react-native-swipe-deck.pages.dev/ko/llms-full.txt): 모든 문서 페이지의 전체 내용을 하나로 합친 full-content 파일입니다.

### 설치

```sh
npm install @react-native-motion-kit/swipe-deck react-native-gesture-handler react-native-reanimated react-native-worklets
```

사용 중인 React Native 또는 Expo 버전에 맞춰 Reanimated/Worklets 설정을 완료하세요.
Babel 설정에서는 `react-native-worklets/plugin`을 마지막 Babel plugin으로 추가해야 합니다.

### 기본 사용법

```tsx
import { Pressable, Text, View } from 'react-native';
import { createSwipeDeck, SwipeDeckMotion } from '@react-native-motion-kit/swipe-deck';

type Profile = {
  id: string;
  name: string;
  bio: string;
};

const ProfileDeck = createSwipeDeck<Profile>({
  motion: SwipeDeckMotion.tinder(),
});

function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <View>
      <Text>{profile.name}</Text>
      <Text>{profile.bio}</Text>
    </View>
  );
}

function ProfileDeckControls() {
  const { activeIndex, count, canSwipe } = ProfileDeck.useDeckState();
  const { swipeLeft, swipeRight } = ProfileDeck.useDeckActions();
  const current = activeIndex >= 0 ? activeIndex + 1 : 0;

  return (
    <View>
      <Text>{`${current} / ${count}`}</Text>
      <Pressable disabled={!canSwipe} onPress={swipeLeft}>
        <Text>Nope</Text>
      </Pressable>
      <Pressable disabled={!canSwipe} onPress={swipeRight}>
        <Text>Like</Text>
      </Pressable>
    </View>
  );
}

export function ProfileDeckScreen({ profiles }: { profiles: Profile[] }) {
  return (
    <View>
      <ProfileDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
        <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
      </ProfileDeck.Root>

      <ProfileDeckControls />
    </View>
  );
}
```

Control, animated overlay, commit event가 필요하다면 `Root`와 같은 `ProfileDeck` factory에서 제공하는 hook을 사용하세요:
`ProfileDeck.useDeckState()`, `ProfileDeck.useDeckActions()`, `ProfileDeck.useDeckInteraction()`, `ProfileDeck.useDeckEvent()`, `ProfileDeck.useDeckEventListener()`.

## 기여

프로젝트 기여 방법과 개발 환경 설정은 [Contributing Guide](CONTRIBUTING.md)를 참고하세요.

## 라이선스

[MIT](./LICENSE)
