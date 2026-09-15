# T&BEDU 학생 학습 플랫폼 — 구현 계획 (PLAN.md)

> 상태: **2단계(계획) 초안** · 브랜치 `feature/student-platform` (from `교재`)
> 작성 규칙: 단계별 진행, 매 단계 사용자 승인, DB스키마·태그분류·성취도계산은 확인 후 진행, 의미 단위 커밋.

## 0. Context (왜 만드나)

기존 `english-exam-app`(라이브=`교재` 브랜치)은 **교사/관리자용 문제 출제·시험지·교재 도구**다. 여기에 **학생용 학습 플랫폼**을 얹어, 학생이 반별 문제지를 풀고(마킹→자동채점), 성취도·취약점 분석·오답노트·성적추이를 받고, 반별 영상 강의를 보고, 과제·알림을 받게 한다. 영어(기존 AI 문제은행) + 수학(외부 문제지)을 함께 다룬다.

## 1. 확정된 상위 결정 (사용자 확인 완료)

| 항목 | 결정 |
|---|---|
| 학생 클라이언트 | **PWA 먼저** → 추후 **Capacitor로 네이티브** 전환 |
| 인증 | 학생/모바일용 **토큰(Bearer) API** 신설, 기존 교사 쿠키 JWT 유지 |
| 앱 구조(권장, 확인 필요) | **한 앱**(교재 확장) 내 role 분리: 교사/관리자 콘솔 + 학생 `/student/*` PWA |
| 수학 | **외부 문제지(PDF/이미지) 업로드 + 정답키·태그** → 학생 답 마킹·자동채점 |
| 재원생/비재원생 | 반 코드 등록=재원생(전체) / 비재원생=제한(샘플) |
| 문항 태그 | 유형 + 난도 + **능력영역 태그(다중)** + **교사 코멘트 수정 가능** |
| 성취도 | **영역별 정답률 + 전체 정답률** (취약=낮은 영역, 강점=높은 영역) |
| 답안 저장 | **제출(Submission)별 + 문항답(Answer)별** |
| 센터 | 청명·서천 구분 관리 |

## 2. 기존 자산 (재사용)

- Next.js 16.2.3 / React 19 / TS / Tailwind4, Prisma7 + Turso(libsql).
- 인증: `src/lib/auth.ts`(bcrypt+jose), 미들웨어 `src/proxy.ts`, role=admin|teacher.
- 문제은행: `Question`/`Exam`/`ExamItem`/`Passage`, 태그는 `Question.tags`(JSON), 난도 `difficulty`, 유형 `questionType`.
- 교재편집: `Textbook`/`Chapter`/`TextbookPage`/`Block`.

## 3. DB 스키마 (제안 — 3단계 진입 전 확인 필요)

기존 모델은 두되, 아래를 추가/확장한다. (SQLite/Prisma)

### 3.1 계정·조직
- `User` 확장: `role`에 `"student"` 추가. (교사/관리자는 그대로)
- `StudentProfile` (User 1:1): `userId`, `name`, `grade`("고1"…), `centerId`, `status`("enrolled"|"guest"), `phone?`, `parentPhone?`, `createdAt`.
- `Center`: `id`, `name`("청명"|"서천").
- `Class`(반): `id`, `centerId`, `name`, `grade`, `subject`("english"|"math"|"both"), `code`(unique, 반 코드), `teacherId?`, `active`.
- `Enrollment`: `id`, `studentId`, `classId`, `status`("active"|"left"), `joinedAt`. (학생↔반 다대다; 코드 입력으로 생성)

### 3.2 문항 태그 (취약점 근거)
- `Tag`: `id`, `subject`, `kind`("영역"|"단원"|"개념"), `name`, `parentId?`(계층 대비). 예 영어영역: 어법/어휘/독해추론/세부정보/빈칸추론…, 수학단원: 함수/미적분….
- `QuestionTag`: `questionId`↔`tagId` (영어 문항 다중 태그).
- `WorksheetItemTag`: `itemId`↔`tagId` (수학 문항 다중 태그).
- 난도는 기존 `difficulty` 재사용, 유형은 `questionType` 재사용.

### 3.3 수학 외부 문제지
- `Worksheet`: `id`, `subject="math"`, `title`, `source`(출처), `grade`, `fileUrl`(PDF/이미지, 외부 스토리지), `itemCount`, `createdAt`.
- `WorksheetItem`: `id`, `worksheetId`, `number`, `answer`(정답키), `points`, `choicesCount?`(객/주관 구분). 문제 본문 텍스트는 저장 안 함(이미지로 봄).

### 3.4 배정·제출·채점 (영어·수학 공통)
- `Assessment`(배정 대상 추상화): `id`, `subject`, `type`("exam"|"worksheet"), `examId?`, `worksheetId?`, `title`.
- `Assignment`(과제·마감): `id`, `classId`, `assessmentId`, `assignedAt`, `dueAt?`, `title`, `active`.
- `Submission`: `id`, `studentId`, `assignmentId`, `startedAt`, `submittedAt?`, `status`("in_progress"|"submitted"|"graded"), `score`, `totalPoints`, `correctCount`, `itemCount`. (재응시=새 Submission)
- `Answer`: `id`, `submissionId`, `refType`("question"|"worksheet_item"), `refId`, `selected`, `isCorrect`, `points`. (`@@index([submissionId])`)

### 3.5 분석·오답·코멘트
- `AchievementSnapshot`(추이용): `id`, `studentId`, `subject`, `submissionId?`, `overallRate`, `byTag`(JSON: {tagId: rate}), `createdAt`. (제출 채점 시 스냅샷 저장 → 성적추이 그래프)
- `WrongNote`(오답노트): `id`, `studentId`, `answerId`, `note?`(학생 메모), `resolved`, `createdAt`. (오답 자동 생성)
- `TeacherComment`: `id`, `teacherId`, `studentId`, `scope`("submission"|"tag"|"overall"), `submissionId?`, `tagId?`, `body`, `updatedAt`. (교사가 취약점 분석에 코멘트 추가·수정)

### 3.6 영상·시청
- `Video`: `id`, `title`, `subject`, `provider`("mux"|"vimeo"|"cloudflare"…확정 필요), `playbackId`/`assetId`, `duration`, `createdAt`.
- `VideoAssignment`: `videoId`↔`classId` (반별 노출).
- `WatchProgress`: `id`, `studentId`, `videoId`, `positionSec`, `percent`, `completed`, `updatedAt`.

### 3.7 알림
- `Notification`: `id`, `userId`, `type`("new_video"|"result"|"due_reminder"…), `title`, `body`, `read`, `linkUrl?`, `createdAt`.
- `PushSubscription`(웹푸시 VAPID): `id`, `userId`, `endpoint`, `p256dh`, `auth`. (네이티브 전환 시 FCM/APNs로 교체)

## 4. API 경로 (요약)

**학생용(토큰 Bearer, `/api/student/*`)** — 각 요청은 본인 데이터만 접근(서버 인가 검사 필수)
- `POST /api/auth/student/register` (반 코드 + 프로필), `POST /api/auth/student/login`, `POST /api/auth/refresh`
- `GET /api/student/assignments`(내 반 과제), `GET /api/student/assessments/:id`(문항/문제지)
- `POST /api/student/submissions`(마킹 제출→채점), `GET /api/student/submissions/:id`(결과)
- `GET /api/student/achievement`(전체+영역별, 추이), `GET /api/student/wrong-notes`, `PATCH /api/student/wrong-notes/:id`
- `GET /api/student/videos`, `POST /api/student/videos/:id/progress`
- `POST /api/student/push/subscribe`

**교사/관리자용(기존 쿠키 세션, `/api/*`)**
- classes/centers CRUD + 반 코드 발급, enrollments 조회
- worksheets 업로드(파일)+정답키/태그 입력, questions 태깅
- assessments/assignments CRUD(마감), 학생 submissions·achievement 열람, teacher-comments CRUD
- videos 업로드/반배정, notifications 발송

## 5. 화면 (요약)

- **학생 PWA(`/student`)**: 로그인/가입(코드), 홈(과제·마감·새영상), 문제 풀기(마킹 UI, 수학=문제지 이미지+답 마킹), 결과·성취도(영역별 막대+추이 그래프), 오답노트, 영상(진도율·다운로드 방지 플레이어).
- **교사/관리자 콘솔(기존 확장)**: 반 편성(센터·코드), 정답키/태깅 입력, 문제지 배정·마감, 학생별 성취도+코멘트, 영상 업로드/배정, 알림.

## 6. 구현 순서 (단계별, 각 단계 승인+커밋)

- **P1 인증·조직 기반**: student role, StudentProfile/Center/Class/Enrollment, 토큰 API, 학생 가입(코드)·로그인, 교사 반 편성 UI. `proxy.ts`에 student 경로 인가.
- **P2 문항 태그 시스템**: Tag/QuestionTag, 영어 문항 태깅 UI (취약점 근거 마련).
- **P3 배정·마킹·채점·성취도**: Assessment/Assignment/Submission/Answer, 학생 마킹→자동채점, 영역별+전체 정답률, AchievementSnapshot, TeacherComment.
- **P4 오답노트 + 성적 추이 그래프**: WrongNote 자동생성, 추이 차트.
- **P5 수학**: Worksheet/WorksheetItem 업로드+정답키·태그, 학생 마킹·채점(공통 파이프 재사용).
- **P6 영상**: 외부 스트리밍 연동, 반별 노출, WatchProgress, 다운로드 방지.
- **P7 과제·마감 관리** (P3 Assignment 확장: 알림 트리거 포함).
- **P8 PWA화 + 푸시**: manifest/service worker/설치, Web Push(VAPID), Notification.
- **P9(후일) Capacitor 네이티브 래핑** (스토어 배포는 사용자).

## 7. 확인받아야 할 결정사항 (3단계 착수 전/중)

1. **앱 구조**: "한 앱 + 학생 PWA 영역"(권장) vs 물리적 별도 학생 PWA 프로젝트?
2. **DB 스키마 3장**: 위 제안 확정 여부(특히 Assessment 추상화 채택 여부, 태그 계층 필요 여부).
3. **능력영역 태그 목록**: 영어/수학 각각의 초기 영역 세트를 사용자가 정의(취약점 리포트 문구 직결).
4. **성취도 표시**: 영역별 정답률 외에 등급/누적 평균 등 추가 표시 필요?
5. **영상 스트리밍 제공자**: Mux / Vimeo(Pro) / Cloudflare Stream 중 — 비용·다운로드방지·서명URL 고려.
6. **파일 스토리지**(수학 문제지 PDF/이미지): 스트리밍 제공자와 별개 — S3/R2/Vercel Blob 중.
7. **재원생 승격**: 비재원생이 나중에 코드 입력 시 자동 재원생 전환 규칙.
8. **개인정보**: 미성년자 데이터 최소수집·보호자 동의 범위(수집 항목 확정).

## 8. Self-Refine — 자가 비평 → 반영 내역

초안을 스스로 검토해 아래를 개선/반영했다.
- **보안/인가**: 학생 API가 남의 데이터에 접근 못 하도록 "본인 소유 검사 필수" 명시. 토큰 인증을 쿠키와 분리(모바일 대비). 반 코드 무차별 대입 대비 → (P1에서 레이트리밋·코드 만료/재발급 반영 예정).
- **엣지케이스**: 재응시=새 Submission(정책 명확화). 정답키/태그가 제출 후 변경될 때 → 채점은 제출 시점 기준 보존, 재채점은 명시적 액션. 학생 다반 소속(Enrollment 다대다). 비재원생→재원생 승격 경로(결정사항 7).
- **확장성**: 성취도를 매번 계산하지 않고 `AchievementSnapshot`로 캐시→추이 그래프·성능 동시 해결. 영어/수학 채점을 `Assessment`로 추상화해 파이프 1개로 재사용.
- **정직성/한계**: 웹(PWA)에서 영상 **다운로드 완전 차단은 불가**(화면녹화·스트림 추출 완전방지 X). 서명URL·짧은 만료·DRM-lite로 "쉬운 다운로드 방지"까지가 현실 — 완전차단은 네이티브(P9)에서 강화. PLAN에 이 한계를 명시.
- **스코프 방어**: 한 번에 다 구현 금지 → P1~P8로 쪼갬. 각 단계 승인·커밋.
