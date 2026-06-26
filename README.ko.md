# @react-native-motion-kit/swipe-deck

[English](README.md)

<div align="center">
  <img src="./assets/logo.png" width="300px" alt="React Native Motion Kit logo" />
</div>

Reanimated, Worklets, Gesture Handler 기반의 고성능 React Native용 Tinder 스타일
swipe deck / swipe card 라이브러리입니다.

## 특징

- **작은 render window**: 현재 카드와 bounded forward stack만 mount합니다.
- **Item-keyed rendering**: promoted card가 React Native view identity를 유지합니다.
- **Typed compound API**: `createSwipeDeck<T>()`로 typed deck family를 만듭니다.
- **Deck hooks**: state, action, event, animated overlay를 같은 factory에서 다룹니다.
- **Motion recipes**: gesture motion, programmatic action, undo restore를 따로 조정합니다.

## 설치

```sh
npm install @react-native-motion-kit/swipe-deck react-native-gesture-handler react-native-reanimated react-native-worklets
```

사용 중인 React Native 또는 Expo 버전에 맞춰 Reanimated/Worklets 설정을 완료하세요.
Babel 설정에서는 `react-native-worklets/plugin`을 마지막 Babel plugin으로 추가해야 합니다.

## 빠른 시작

```tsx
import { Text, View } from 'react-native';
import { createSwipeDeck, SwipeDeckMotion } from '@react-native-motion-kit/swipe-deck';

type Profile = {
  id: string;
  name: string;
};

const ProfileDeck = createSwipeDeck<Profile>({
  motion: SwipeDeckMotion.tinder(),
});

function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <View>
      <Text>{profile.name}</Text>
    </View>
  );
}

export function ProfileDeckScreen({ profiles }: { profiles: Profile[] }) {
  return (
    <ProfileDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
      <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
    </ProfileDeck.Root>
  );
}
```

Control, animated overlay, commit event가 필요하다면 같은 factory Root 주변에서
`ProfileDeck.useDeckState()`, `ProfileDeck.useDeckActions()`,
`ProfileDeck.useDeckInteraction()`, `ProfileDeck.useDeckEvent()`,
`ProfileDeck.useDeckEventListener()`를 사용하세요.

## 문서

공개 사이트를 준비하는 동안 전체 가이드는 이 저장소의 `docs/` 아래에서 관리합니다.

- [개요](docs/docs/1.x/ko/guide/getting-started/overview.mdx)
- [빠른 시작](docs/docs/1.x/ko/guide/getting-started/quick-start.mdx)
- [API 레퍼런스](docs/docs/1.x/ko/guide/usage/api-reference.mdx)
- [AI 사용 가이드](docs/docs/1.x/ko/guide/getting-started/ai.mdx)

AI가 읽기 좋은 문서는 docs build 시 생성됩니다.

- [llms.txt](docs/doc_build/ko/llms.txt)
- [llms-full.txt](docs/doc_build/ko/llms-full.txt)

## 라이선스

MIT
