# 하나비 · 세 사람이 만드는 불꽃

한국어 3인 전용 온라인 협동 카드게임. React/Vite/TypeScript UI와 Node/Socket.IO 서버가 하나의 Render 웹서비스에서 실행됩니다. 외부 이미지·로고·폰트를 사용하지 않으며 카드와 불꽃은 CSS와 문자 기호로 제작했습니다.

## 실행

Node.js 22.22 이상이 필요합니다.

```sh
npm ci
npm run dev
```

개발 화면은 http://localhost:5173 입니다. 배포와 동일한 실행은 다음과 같습니다.

```sh
npm run build
npm start
```

기본 포트는 3001이며 `PORT`로 변경합니다. PC·모바일에서 같은 주소로 접속하고 방 코드 또는 `/?room=ABCDEF` 초대 링크를 사용합니다. 이름을 입력해 입장하고, 방장은 가장 화려한 옷을 입은 사람을 첫 플레이어로 지정합니다. 정확히 3명 모두 연결되고 준비하면 자동 시작합니다. 종료 후 재대결은 기존 자리를 유지하고 준비를 초기화합니다.

## 검증

```sh
npx playwright install chromium
npm run check
```

- 규칙 테스트: 50장 분포, 5장 배분, 3인 순환, 전체 일치 힌트와 부정 정보, 카드별 기록 유지, 잘못된 요청의 무변경, 토큰 제한, 실패 제출, 5 완성 보너스, 마지막 인출 후 3턴, 25점 종료, 카드 보존, 본인 정체 비전송.
- Socket.IO 통합 테스트: 3개 독립 연결, 상태 동기화, 토큰/덱 비노출, 중복 턴 및 위조 자리 거절, 연결 끊김·복구, 파일 스냅샷을 이용한 서버 재시작 복구, 종료·재대결.
- Playwright E2E: 저장소가 분리된 독립 브라우저 컨텍스트 3개(모바일 포함), UI 입장·준비·힌트·로그, 새로고침, 수신 WebSocket 상태의 비밀정보 검사, 실제 제출로 종료, 재대결, 수평 넘침 검사. desktop/mobile 스크린샷과 실패 시 trace는 `test-results/`에 기록됩니다.
- GitHub Actions에서 타입검사·테스트·빌드·E2E를 실행합니다.

## 공식 규칙 및 충돌 처리

구현 전 [R&R Games 영문 룰북](https://cdn.1j1ju.com/medias/b3/a9/0e-hanabi-rulebook.pdf) 양쪽 페이지를 렌더링해 직접 읽고 [Hanabi-Live rules.md](https://github.com/Hanabi-Live/hanabi-live/blob/main/docs/rules.md)와 대조했습니다.

| 항목 | 채택한 동작 |
| --- | --- |
| 기본판 카드 | 5색 50장. 포장 구성의 60장 중 6번째 색은 제외 |
| 첫 플레이어 | 공식판의 가장 화려한 옷을 입은 사람을 로비에서 방장이 지정. 교차 자료의 무작위 시작은 제외 |
| 플레이 인원 | 공식판 2~5인 중 요청한 3인만 허용. 교차 자료의 6인은 제외 |
| 실수 3회 | 공식판 즉시 패배. 교차 자료의 명시적 최종 0점 표시 채택, 쌓은 점수는 별도 표시 |
| 마지막 카드 | 뽑은 턴은 추가 3턴에 포함하지 않음. 다음 사람부터 각각 1턴, 마지막 인출자도 마지막에 1턴 |
| 점수 합산 | 기본판 5개 색상 높이 합. 공식판 예시의 6개 불꽃 합산은 기본판에 적용하지 않음 |
| 대화 | 공식판 기본 소통 제한과 사용자 요청에 따라 자유 채팅·음성 없음 |
| 변형 | 다색, 와일드, 덱 소진 후 무제한 플레이 등 모두 제외 |

1은 색상마다 3장, 2·3·4는 각각 2장, 5는 1장입니다. 토큰은 8개로 시작하고 상한 8개입니다. 8개일 때 버리기 금지, 없는 카드 힌트 금지, 자신에게 힌트 금지. 모든 일치 카드를 서버가 지정하며 비일치 정보도 기록합니다. 실패 카드와 버린 카드는 공개합니다. 25점/실수 3회는 카드 인출 전 즉시 종료합니다.

## 서버 권위와 자리 복구

모든 요청은 Zod strict 스키마, 현재 자리, 현재 턴, revision을 검증합니다. 카드 ID는 무작위 UUID로 카드 정체를 인코딩하지 않습니다. 클라이언트 요청에 카드 정체·일치 목록을 포함할 수 없습니다. 서버는 관찰자마다 허용된 필드만 구성하며, 자기 카드 color/rank, 덱 배열, 자리 복구 토큰을 상태로 보내지 않습니다. 본인 카드가 충분한 힌트로 추론 가능해도 실제 정체 필드를 보내지 않습니다. 결과에서도 본인 손은 비공개입니다.

자리 복구 키는 서버가 발급한 256비트 난수이며 해당 브라우저의 localStorage에 저장합니다. 링크에 복구 키를 넣지 않습니다. 같은 키의 새 연결은 이전 연결을 종료합니다. 새로고침·일시 단절 후 자동 복구하고, 같은 기기의 새 탭에서도 방별 키를 복구합니다. 다른 기기로 자리를 옮기는 기능은 제공하지 않습니다. 미연결 플레이어의 턴은 기다립니다. 자유 입력은 로비 이름만 허용하며 문자를 제한합니다. 요청은 연결당 10초 40회 제한, 페이로드 4KB 제한 및 동일 Origin 검사로 보호합니다. HTTPS 배포에서 통신·복구 키가 암호화됩니다.

게임 상태는 `DATA_DIR/rooms.json`에 서버 전용 파일로 원자적 저장합니다(기본 `data/`). 연결이 없는 방은 마지막 활동 후 24시간에 정리합니다. 데이터 디렉터리는 웹 정적 경로에 포함되지 않습니다. 단일 서버 인스턴스만 지원합니다.

## GitHub → Render 배포

`render.yaml`은 무료 Node 웹서비스, health check, 자동 배포, 빌드/실행 명령을 포함합니다. GitHub 저장소를 Render의 New → Blueprint에서 연결하면 됩니다. 수동 Web Service 방식도 가능합니다:

- Runtime: Node, branch: main, instance: Free
- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Health check: `/healthz`
- `NODE_VERSION=22.22.0`, `NODE_ENV=production`, `DATA_DIR=/tmp/hanabi-data`

Render가 `PORT`를 지정하며 HTTP와 Socket.IO가 동일 포트를 사용합니다. 별도 프런트 서비스·외부 DB·비밀 환경변수는 필요 없습니다.

**운영 제한:** [Render 무료 서비스](https://render.com/docs/free)는 비활성 시 절전하며 디스크가 영구적이지 않습니다. 일반 재접속은 복구되지만 서비스 교체/재배포/절전으로 파일이 사라지면 방도 사라집니다. 영구 복구가 필요하면 유료 서비스의 persistent disk를 `/var/data`에 마운트하고 `DATA_DIR=/var/data/hanabi`로 지정하세요. 무료로 제공한 설정은 비용을 발생시키는 디스크를 자동 생성하지 않습니다. 진행 중 게임을 유지하려면 재배포 시간을 조절하세요.

## 배포 주소

- 게임: https://hanabi-three.onrender.com
- 소스: https://github.com/tkakrnl5000/hanabi-three
- Render 대시보드: https://dashboard.render.com/web/srv-db5eviflk1mc739p2ds0

배포된 주소에서도 같은 3인 E2E를 실행할 수 있습니다:

```sh
E2E_BASE_URL=https://hanabi-three.onrender.com npm run test:e2e
```

PowerShell에서는 `$env:E2E_BASE_URL='https://hanabi-three.onrender.com'` 설정 후 `npm run test:e2e`를 실행합니다.
