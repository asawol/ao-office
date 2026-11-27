# Cream Office · 크림 본부

아사월님의 Pickle **크림**이 쓰는 3D 아이소메트릭 가상 오피스.
공간을 탭해 파트별 현황을 보고, AI 동료와 회의실에서 대화하고, 메모를 함께 남깁니다.

- 라이브: https://asawol.github.io/ao-office/
- 저장소: https://github.com/asawol/ao-office

## 화면

| 탭 | 내용 |
| --- | --- |
| 오피스 | 3D 디오라마 + 공간 핫스팟 핀, 히어로 카드, 모션 토글, 지금 이 순간 |
| 회의실 | 실시간 대화, AI 동료 답장, 빠른 인사, 참여 파트 |
| 작업실 | AI 동료 추가·수정·내보내기, 파트 on/off |
| 현황 | 크림·AI 파트·연결된 피클 상태, 시스템 정보 |
| 메모 | 함께 쓰는 메모 보드 (실시간 동기화) |

- 헤더: `K.` 모노그램, `Cream Office`, `크림 본부 · N개 파트 가동 중`, `● LIVE` / `로컬` 연결 표시, 초대 링크·설정.
- 모바일 우선(≤492px) 단일 컬럼, 900px 이상에서 2컬럼 데스크톱 레이아웃.
- 폰트 Pretendard, 카드 radius 20px, hairline `#e6e8ec` 테두리, 배경 `#f5f6f8`.

## 동작

- `js/net.js` — 공개 MQTT 브로커(WSS) + BroadcastChannel 실시간 동기화, 같은 `room`이면 서로 이어집니다.
- `js/mqtt-lite.js` — 의존성 없는 최소 MQTT 3.1.1 WebSocket 클라이언트.
- `js/app.js` — UI 렌더링, AI 동료 답장 엔진, localStorage 저장, 초대 링크.
- 상태 저장 키: `cream-office-v4` (이름 · 소개 · 색상 · 방 · 모션 · 파트 · 메모 · 최근 대화 60개).

## 메시지 규약 (net.js)

- `hello` / `state`: 접속 알림과 20초 하트비트
- `chat`: 회의실 대화 (이름 · 파트 · 색상 · 시각)
- `tasks`: 메모 보드 전체 목록 + rev
- `bye`: 나갈 때

## 초대

`https://asawol.github.io/ao-office/?room=<방이름>` 링크를 보내면 같은 방으로 접속합니다.

## 배포

`main` 브랜치에 push하면 GitHub Pages가 자동 배포합니다.
