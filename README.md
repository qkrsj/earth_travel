# 🌏 지구여행 (Earth Travel)

실사 지구본을 돌리며 내가 여행한 나라와 도시를 색칠하고, 도시마다 코스·사진·일기를 남기는 여행 기록 앱입니다.
iOS · Android · Web 을 하나의 코드(Expo / React Native)로 만들고, 백엔드는 직접 운영하는 Node.js API + PostgreSQL 입니다.

| 지구본 | 나라 지도 · 도시 색칠 | 여행 기록 |
| --- | --- | --- |
| 실사 텍스처(NASA Blue Marble) 3D 지구본, 방문 횟수별 색상 | 나라를 누르면 상세 지도 + 도시 점, 도시마다 원하는 색 지정 | 코스(일차별 장소), 사진, 일기 · 공개/비공개 |

## 핵심 기능

1. **실사 지구본** – 지구본을 돌리다 나라를 누르면 카메라가 그 나라로 날아가고, 방문 횟수를 `＋/－` 로 기록합니다.
2. **방문 횟수별 색상** – 1회 / 2회 / 3~4회 / 5~9회 / 10회+ 로 나라 색이 달라지고, 많이 간 나라일수록 지구본에서 살짝 솟아오릅니다.
3. **나라 지도에서 도시 체크** – 나라의 상세 지도 위에 주요 도시가 점으로 표시됩니다. 도시를 눌러 색을 고르면 방문 체크가 되고, 한눈에 어떤 도시를 갔는지 보입니다. (확대/이동, 도시 검색 지원)
4. **도시별 여행 기록** – 제목, 여행 기간, 일차별 코스, 사진(여러 장 + 설명), 일기/메모를 남깁니다.
5. **공개 / 비공개** – 공개한 기록은 `둘러보기` 탭과 각 도시 페이지에서 다른 여행자들이 참고할 수 있습니다. 비공개 기록은 본인만 볼 수 있습니다.

## 구조

```
earth_travel/
├── server/                 # 백엔드 API (Fastify + Drizzle ORM + PostgreSQL)
│   ├── src/
│   │   ├── routes/         # auth, geo, visits, records, uploads, globe
│   │   ├── db/schema.ts    # 테이블 정의
│   │   ├── geo/            # 국가 경계 GeoJSON (Natural Earth, ISO 코드 + 한국어 이름)
│   │   └── storage/        # 사진 저장소 (로컬 디스크 / S3 · R2 · MinIO)
│   ├── public/globe/       # 3D 지구본 페이지 (globe.gl / three.js)
│   ├── drizzle/            # SQL 마이그레이션
│   ├── scripts/            # migrate, seed-cities
│   └── test/               # API 통합 테스트 (vitest + 실제 PostgreSQL)
├── app/                    # 모바일 · 웹 앱 (Expo SDK 57, Expo Router)
│   └── src/
│       ├── app/            # 화면 (파일 기반 라우팅)
│       ├── components/     # GlobeView, CountryMap, RecordCard ...
│       └── lib/            # API 클라이언트, 인증, 색상
└── docker-compose.yml      # 로컬 PostgreSQL + API
```

### 설계 포인트

- **지구본은 서버가 서빙하는 웹 페이지** (`/globe/`) 입니다. 앱에서는 `react-native-webview`, 웹에서는 `iframe` 으로 같은 페이지를 띄우고
  `postMessage` 로 방문 정보/선택 이벤트를 주고받습니다. three.js 라이브러리와 지구 텍스처도 우리 서버에서 서빙하므로 외부 CDN 에 의존하지 않고,
  지구본 디자인을 고칠 때 **앱 스토어 심사 없이** 서버 배포만으로 반영됩니다.
- **나라 지도는 네이티브 SVG** (`react-native-svg` + `d3-geo`) 로 그려서 도시 터치 반응이 빠릅니다. 하와이·프랑스령 기아나처럼 멀리 떨어진 작은 영토 때문에
  본토가 작아지지 않도록 본토 기준으로 화면을 맞추고, 날짜변경선을 넘는 나라(러시아 등)도 한 덩어리로 보이게 회전합니다.
- **도시 데이터**는 GeoNames 기반 `all-the-cities` 에서 나라별 인구 상위 30개 + 인구 5만 이상 + 수도/주도 (약 12,700개) 를 DB 에 시드합니다.
- **사진 업로드**: 앱이 `POST /uploads` 로 사진을 올리면 서버가 저장소 키를 돌려주고, 기록 저장 시 그 키만 전달합니다. 서버가 URL 을 직접 만들기 때문에
  임의의 외부 URL 을 기록에 끼워 넣을 수 없습니다. 기록에서 빠진 사진은 저장소에서도 삭제됩니다.
- **인증**: 이메일 + 비밀번호 (bcrypt), JWT 30일. 토큰은 iOS Keychain / Android Keystore (`expo-secure-store`) 에 저장합니다.

## 로컬에서 실행하기

필요: Node.js 20+, Docker (또는 로컬 PostgreSQL 16)

### 1. 백엔드

```bash
docker compose up -d db              # PostgreSQL 실행

cd server
cp .env.example .env
npm install
npm run db:migrate                   # 테이블 생성
npm run db:seed                      # 도시 데이터 약 1.3만 개 입력
npm run dev                          # http://localhost:4000
```

- 확인: http://localhost:4000/health , 지구본 페이지 http://localhost:4000/globe/
- 테스트: `npm test` (테스트 DB `earth_travel_test` 필요 — `createdb -U earth earth_travel_test`, 또는 `TEST_DATABASE_URL` 지정)

### 2. 앱

```bash
cd app
npm install
npx expo start          # w: 웹, i: iOS 시뮬레이터, a: 안드로이드 에뮬레이터
```

- 기본 API 주소: iOS 시뮬레이터/웹 `http://localhost:4000`, 안드로이드 에뮬레이터 `http://10.0.2.2:4000`
- **실제 휴대폰**으로 테스트할 때는 PC 의 LAN IP 를 지정하세요: `EXPO_PUBLIC_API_URL=http://192.168.0.10:4000 npx expo start`
  (서버의 `PUBLIC_BASE_URL` 도 같은 주소로 맞춰야 사진이 보입니다)
- 사용한 모듈(webview, svg, image-picker, secure-store 등)은 모두 Expo Go 에 포함되어 있어 바로 실행할 수 있습니다.

## API 요약

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/auth/signup`, `/auth/login` | 회원가입 / 로그인 → `{ token, user }` | |
| GET | `/me` | 내 정보 | ✅ |
| GET | `/geo/countries` | 전 세계 국가 경계 GeoJSON (`code`, `name`, `nameKo`) | |
| GET | `/geo/countries/:code` | 한 나라의 상세 경계 | |
| GET | `/countries/:code/cities?q=` | 나라의 도시 목록 (인구순) | |
| GET | `/cities/:id`, `/cities/:id/stats` | 도시 정보 / 공개·내 기록 수 | |
| GET | `/me/countries` | 방문한 나라 + 방문 횟수 + 방문 도시 수 | ✅ |
| PUT | `/me/countries/:code` | `{ visitCount }` 방문 횟수 설정 (0 = 해제) | ✅ |
| GET | `/me/countries/:code/cities` | 그 나라에서 방문한 도시와 색 | ✅ |
| PUT / DELETE | `/me/cities/:cityId` | `{ color: "#RRGGBB" }` 도시 방문 체크·색 지정 / 취소 | ✅ |
| POST | `/uploads` | 사진 업로드 (multipart, jpg/png/webp/heic, 10MB) → `{ key, url }` | ✅ |
| POST | `/records` | 기록 작성 (`cityId, title, content, tripStart, tripEnd, visibility, stops[], photos[]`) | ✅ |
| GET / PATCH / DELETE | `/records/:id` | 기록 조회(비공개는 본인만) / 수정 / 삭제 | 조회 외 ✅ |
| GET | `/me/records?cityId=&countryCode=&cursor=` | 내 기록 목록 | ✅ |
| GET | `/records/public?cityId=&countryCode=&cursor=` | 공개 기록 피드 | |

## 실제 운영 & 앱 출시 로드맵

### 1단계 — 백엔드 배포

| 구성 요소 | 추천 (시작 비용 낮은 순) |
| --- | --- |
| API 서버 | `server/Dockerfile` 그대로 배포: Fly.io, Railway, Render, AWS App Runner / ECS, GCP Cloud Run |
| PostgreSQL | Neon, Supabase(Postgres 만 사용), Railway Postgres, AWS RDS |
| 사진 저장소 | **Cloudflare R2** (전송료 무료) 또는 AWS S3 + CloudFront |
| 도메인 / HTTPS | `api.내도메인.com` — 앱 스토어 정책상 HTTPS 필수 |

운영 환경 변수:

```env
DATABASE_URL=postgres://...
JWT_SECRET=<openssl rand -hex 32 로 생성>
PUBLIC_BASE_URL=https://api.your-domain.com
STORAGE_DRIVER=s3
S3_BUCKET=earth-travel-photos
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # R2 인 경우
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL=https://photos.your-domain.com
```

컨테이너는 시작할 때 마이그레이션을 자동 적용합니다. 최초 1회 도시 데이터 시드: `npm run db:seed:prod` (컨테이너 안에서 실행).

### 2단계 — 앱 빌드 & 스토어 제출 (EAS)

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest build:configure
# eas.json 의 EXPO_PUBLIC_API_URL 을 실제 API 주소로 수정
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform ios       # App Store Connect (Apple Developer, 연 $99)
npx eas-cli@latest submit --platform android   # Google Play Console (1회 $25)
```

- `app.json` 의 `ios.bundleIdentifier` / `android.package` (`com.earthtravel.app`) 를 본인 소유 도메인 기반으로 바꾸세요.
- 아이콘/스플래시: `app/assets/` 이미지를 교체.
- JS 코드 변경은 `eas update` 로 심사 없이 OTA 배포할 수 있습니다.

### 3단계 — 출시 전 체크리스트

- [ ] **개인정보처리방침 URL** (스토어 필수) — 수집 항목: 이메일, 닉네임, 사진, 여행 기록
- [ ] **회원 탈퇴 기능** (App Store 필수 요구사항) — `DELETE /me` 추가 (DB 는 `on delete cascade` 로 준비됨, 사진 파일 삭제 포함)
- [ ] **사용자 생성 콘텐츠(UGC) 정책** — 공개 기록이 있으므로 Apple 가이드라인 1.2 에 따라 신고/차단 기능 필요
- [ ] Sign in with Apple — 소셜 로그인(구글/카카오)을 추가하면 Apple 로그인도 필수
- [ ] 비밀번호 재설정 메일, 로그인 시도 제한(rate limit, `@fastify/rate-limit`)
- [ ] 사진 리사이즈/썸네일 (업로드 시 `sharp` 로 변환 또는 Cloudflare Images)
- [ ] 에러 모니터링 (Sentry), DB 백업 정책

### 이후 아이디어

- 좋아요 · 북마크 · 댓글, 팔로우
- 기록의 코스를 지구본 위 아크(arc) 경로로 표시
- 도시가 목록에 없을 때 직접 추가 (사용자 정의 장소)
- "올해의 여행" 공유 이미지 생성
- 오프라인 캐시 (지구본 GeoJSON/텍스처를 앱에 번들)
