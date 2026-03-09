# 선한병원 프론트엔드 코드 리뷰

**리뷰 일자:** 2026-03-07
**리뷰 대상:** `src/` 하위 전체 소스 파일
**기술 스택:** React, TypeScript, Axios, react-cookie, react-router-dom

---

## 1. 프로젝트 개요

선한병원 전자결재 시스템의 프론트엔드로, 아래 기능을 제공합니다.

- 로그인 / 인증
- 근로계약서 관리
- 휴가원 신청 및 결재
- 근무현황표
- 동의서 발송 / 작성
- 관리자 대시보드 (권한 관리, 휴가 관리, 부서/직원 관리)

---

## 2. 심각도 분류 기준

| 심각도 | 설명 |
|--------|------|
| **[CRITICAL]** | 보안 취약점 또는 운영 장애를 유발할 수 있는 문제 |
| **[HIGH]** | 버그 가능성이 높거나 유지보수에 심각한 지장을 주는 문제 |
| **[MEDIUM]** | 코드 품질 저하, 코드 중복, 불일관성 |
| **[LOW]** | 스타일, 네이밍, 소소한 개선 사항 |

---

## 3. 보안 (Security)

### [CRITICAL] accessToken을 localStorage에 저장

**파일:** `src/views/Authentication/SignIn/index.tsx:44`, `src/views/Authentication/axiosInstance/index.tsx:13`

`accessToken`을 `localStorage`에 저장하는 것은 **XSS(Cross-Site Scripting) 공격**에 취약합니다. 악성 스크립트가 실행될 경우 `localStorage`의 토큰은 즉시 탈취될 수 있습니다.

```ts
// 현재 코드 (취약)
localStorage.setItem('accessToken', token);
```

**권고사항:**
`httpOnly` 쿠키를 사용하면 JavaScript에서 접근 자체가 불가능하여 XSS로부터 안전합니다. 현재 쿠키도 함께 사용하고 있으나 `secure: false`, `httpOnly`가 빠진 상태입니다. 백엔드와 협의하여 서버 측에서 `httpOnly` 쿠키로 토큰을 내려주도록 변경하는 것을 강력 권고합니다.

---

### [CRITICAL] 쿠키 설정 시 `secure: false`

**파일:** `src/views/Authentication/SignIn/index.tsx:58`

```ts
setCookie('accessToken', token, {
    expires,
    path: '/',
    secure: false,   // HTTP 환경에서 평문 전송 허용
    sameSite: 'lax'
});
```

HTTPS 환경이라면 `secure: true`로 설정해야 합니다. `false`로 유지하면 HTTP 통신 중 중간자 공격(MITM)으로 토큰이 노출될 수 있습니다.

---

### [HIGH] 클라이언트 사이드에서만 권한 검사

**파일:** `src/components/SideBar/index.tsx:218~380`

메뉴 노출 여부를 클라이언트 상태값(`isAdmin`, `permissions`, `jobLevel`)으로만 판단합니다.

```ts
const canViewContractMemoAdmin = (permissions.includes('HR_CONTRACT')) || jobLevel === 6;
```

사용자가 개발자 도구에서 상태를 조작하면 숨겨진 메뉴에 접근할 수 있습니다. 클라이언트 권한 검사는 UX 목적에 그쳐야 하며, **모든 민감한 API는 백엔드에서 반드시 재검증**해야 합니다. 백엔드 검증이 이미 되어있는지 확인이 필요합니다.

---

### [HIGH] 프로덕션 코드에 민감한 디버그 로그 다수 존재

**파일:** `src/App.tsx`, `src/components/SideBar/index.tsx`, `src/views/Authentication/SignIn/index.tsx` 등 전체

```ts
console.log("🔐 토큰 저장 시도:", { token: token.substring(0, 20) + "..." });
console.log("✅ 사용자 정보 복구 완료:", response.data);
```

토큰 정보, 사용자 데이터, 권한 정보가 브라우저 콘솔에 그대로 출력됩니다. 브라우저 콘솔은 누구나 볼 수 있으므로 내부 정보가 노출될 수 있습니다.

**권고사항:** `process.env.NODE_ENV === 'development'` 조건으로 감싸거나, 운영 배포 전 모든 `console.log`를 제거하세요.

---

## 4. 아키텍처 및 설계

### [HIGH] HTTP 클라이언트 혼용 (axios vs fetch)

**파일:**
- `axios` 사용: `src/apis/contract/index.ts`, `src/apis/consent/index.ts`, `src/components/SideBar/index.tsx`
- `fetch` 사용: `src/apis/leaveApplications/index.ts`, `src/components/AdminVacationManagement/index.tsx`

프로젝트 내에서 `axios`와 브라우저 기본 `fetch` API를 혼용하고 있습니다. `axiosInstance`에는 인터셉터가 구성되어 있어 토큰 주입과 401 자동 로그아웃을 처리하지만, `fetch`를 사용하는 파일은 이 인터셉터의 혜택을 받지 못합니다.

**권고사항:** 모든 API 호출을 `axiosInstance`로 통일하세요.

---

### [HIGH] API Base URL 불일치

**파일:**
- `src/apis/leaveApplications/index.ts:1` → `process.env.REACT_APP_API_URL || '/api/v1'`
- `src/components/AdminVacationManagement/index.tsx:72` → `/api/v1` (하드코딩)

```ts
// AdminVacationManagement - 하드코딩
const response = await fetch(`/api/v1/admin/users?year=${targetYear}`, ...);

// leaveApplications API - 환경변수 사용
const API_BASE = process.env.REACT_APP_API_URL || '/api/v1';
```

환경 변수를 사용하지 않고 URL을 하드코딩하면 서버 주소가 변경될 때 일일이 찾아 수정해야 합니다.

**권고사항:** 모든 API 호출에 `process.env.REACT_APP_API_URL`을 사용하세요.

---

### [HIGH] App.tsx에 인증 로직과 라우팅 혼재

**파일:** `src/App.tsx`

`App.tsx`가 라우팅 정의와 사용자 정보 초기화(API 호출, 캐시 관리, 토큰 만료 체크) 역할을 동시에 담당하고 있습니다. 역할이 분리되어 있지 않아 유지보수가 어렵습니다.

**권고사항:** 인증/사용자 초기화 로직을 별도 `AuthProvider` 또는 커스텀 훅(`useAuthInit`)으로 분리하세요.

---

### [MEDIUM] 사용자 정보 캐시 로직이 여러 파일에 중복

**파일:** `src/App.tsx:64~100`, `src/components/SideBar/index.tsx:70~115`

`localStorage`의 `userCache`를 읽고 쓰는 로직이 `App.tsx`와 `SideBar/index.tsx`에 각각 중복 구현되어 있습니다. 캐시 구조나 키 이름이 변경될 경우 두 곳을 모두 수정해야 합니다.

**권고사항:** Context API 또는 Zustand/Redux와 같은 전역 상태 관리 라이브러리를 도입하고, 사용자 정보 조회/캐싱을 한 곳에서 관리하세요.

---

## 5. 버그 및 로직 오류

### [HIGH] fetchUsers의 필터링 결과 미사용

**파일:** `src/apis/contract/index.ts:72~78`

```ts
export const fetchUsers = async (token?: string): Promise<User[]> => {
    const resp = await axios.get<User[]>(`${API_BASE}/user/all`, authHeader(token));
    const data = resp.data || [];
    // 서버가 이미 재직자만 내려주면 filter는 무해합니다.
    const activeOnly = data.filter(u => String(u.useFlag ?? '1') === '1');
    return resp.data;  // <-- activeOnly를 쓰지 않고 원본 반환
};
```

`activeOnly`로 필터링했지만 `resp.data`(원본)를 반환하고 있습니다. 퇴직자도 목록에 포함됩니다.

---

### [HIGH] handleClick의 타입 비교 오류

**파일:** `src/components/LeaveApplicationBoard/index.tsx:476`

```ts
(currentUser?.role === 'ADMIN' && currentUser?.jobLevel >= '2' && ...)
```

`jobLevel`이 `string` 타입인 상황에서 `'>='`로 비교하면 사전순(lexicographic) 비교가 수행됩니다. 예를 들어 `'10' >= '2'`는 `false`입니다.

**권고사항:** `parseInt(currentUser.jobLevel, 10) >= 2`와 같이 숫자로 변환하여 비교하세요.

---

### [HIGH] handleSearch에서 result가 초기화되지 않을 수 있음

**파일:** `src/components/LeaveApplicationBoard/index.tsx:510~548`

```ts
let result: PaginationData;

if (tab === 'my') {
    result = await searchMyApplications(...);
} else if (tab === 'pending') {
    result = await searchPendingApplications(...);
} else if (tab === 'allPending') {
    result = await searchPendingApplications(...);
} else {
    result = await searchCompletedApplications(...);
}

setPaginationData(result);  // tab이 위 조건에 해당하지 않으면 undefined 접근
```

TypeScript는 `result`가 미할당 상태일 수 있다고 경고할 것이며, 예상치 못한 `tab` 값이 들어오면 런타임 오류가 발생합니다.

---

### [MEDIUM] useEffect 의존성 배열 누락

**파일:** `src/App.tsx:116`

```ts
useEffect(() => {
    initializeUser();
}, []); // navigate, cookies가 의존성에서 누락
```

`initializeUser` 내부에서 `navigate`와 `cookies`를 사용하지만 의존성 배열이 비어 있습니다. React Hooks의 규칙(exhaustive-deps)을 위반하며, `cookies`가 변경되어도 재실행되지 않습니다.

**파일:** `src/components/SideBar/index.tsx:120`

```ts
useEffect(() => { ... }, [token]); // checkUserStatus, checkConsentPermissions 등 의존성 누락
```

---

### [MEDIUM] getLeaveTypeFromFormData 중복 호출

**파일:** `src/components/LeaveApplicationBoard/index.tsx:814~816`

```tsx
{getLeaveTypeLabel(getLeaveTypeFromFormData(app) !== '-'
    ? getLeaveTypeFromFormData(app)  // 동일 함수를 두 번 호출
    : app.leaveType)}
```

동일한 연산이 두 번 수행됩니다. 변수에 저장 후 재사용해야 합니다.

---

### [MEDIUM] canViewCompleted가 렌더 함수 내부에서 매번 재계산

**파일:** `src/components/LeaveApplicationBoard/index.tsx:605~612`

```ts
const canViewCompleted = Boolean(currentUser && ( ... ));
```

이 변수는 컴포넌트 렌더링마다 재계산됩니다. `useMemo`로 메모이제이션하거나 `useEffect` 내에서 상태로 관리하는 것이 적절합니다.

---

## 6. 타입 안전성

### [HIGH] any 타입 남용

**파일:** 프로젝트 전반

```ts
// leaveApplications/index.ts
export const saveLeaveApplication = async (id: number, updateData: any, token: string)
export const updateSignature = async (id: number, signatureType: string, signatureData: any, token: string)

// contract/index.ts
export const updateContract = async (id: number, saveData: any, token?: string)
```

`any` 타입은 TypeScript의 타입 검사를 무력화시킵니다. 실제 데이터 구조에 맞는 인터페이스를 정의하여 사용해야 합니다.

---

### [MEDIUM] User 인터페이스 중복 정의

아래 파일들에 각각 `User` 인터페이스가 별도로 정의되어 있으며, 필드 구성도 다릅니다.

| 파일 | jobLevel 타입 | role 타입 |
|------|--------------|-----------|
| `src/types/index.ts` | 없음 | `number` |
| `src/apis/contract/index.ts` | `string` | `string` |
| `src/components/LeaveApplicationBoard/index.tsx` | `string` | `string` |
| `src/components/AdminVacationManagement/index.tsx` | `string?` | 없음 |

**권고사항:** 공통 타입을 `src/types/` 디렉터리에 통합 정의하고 재사용하세요.

---

### [MEDIUM] jobLevel 타입 혼재 (string vs number)

프로젝트 전반에서 `jobLevel`이 어떤 파일에서는 `string`, 어떤 파일에서는 `number`로 처리됩니다.

```ts
// SideBar: number로 비교
const canCreatePositionAdmin = jobLevel === 6;

// LeaveApplicationBoard: string으로 비교
parseInt(currentUser.jobLevel) === 2

// AdminVacationManagement: string을 함수에 전달
getPositionByJobLevel(selectedUser.jobLevel)
```

타입을 `number`로 통일하고, 서버 응답에서 변환 처리를 한 곳에서 수행해야 합니다.

---

## 7. 성능

### [MEDIUM] SideBar에서 매 렌더링마다 API 호출 가능성

**파일:** `src/components/SideBar/index.tsx`

`token`이 변경될 때마다 `checkUserStatus()`와 `checkConsentPermissions()`를 호출합니다. 컴포넌트가 리렌더링되어 `token` 참조가 바뀌면 불필요한 API 호출이 발생할 수 있습니다.

---

### [MEDIUM] filteredApplications useMemo 내 중복 필터 로직

**파일:** `src/components/LeaveApplicationBoard/index.tsx:127~186`

`my` 탭과 그 외 탭의 검색 필터 로직이 거의 동일하지만 중복 구현되어 있습니다. 공통 필터 함수를 추출하여 재사용하면 코드량과 유지보수 비용을 줄일 수 있습니다.

---

## 8. 코드 품질

### [MEDIUM] Layout 컴포넌트에서 React import 누락

**파일:** `src/components/Layout/index.tsx:1`

```ts
import {useCallback, useEffect, useState} from "react";
// React 자체는 import되지 않음
```

JSX 변환 방식(React 17+의 automatic JSX transform)에 따라 동작할 수 있지만, `React.FC` 타입을 사용하는 경우 명시적 `import React`가 필요합니다.

---

### [MEDIUM] 인라인 스타일과 CSS 클래스 혼용

**파일:** `src/components/AdminVacationManagement/index.tsx:330~378`

```tsx
<button
    style={{
        padding: '10px 20px',
        backgroundColor: recalculating ? '#9ca3af' : '#10b981',
        color: 'white',
        ...
    }}
>
```

CSS 클래스 방식과 인라인 스타일이 혼용되어 있습니다. 스타일은 CSS 파일에서 일관되게 관리하는 것이 유지보수에 유리합니다.

---

### [MEDIUM] 토큰을 컴포넌트 최상단과 핸들러 함수 내부에서 이중으로 읽음

**파일:** `src/components/SideBar/index.tsx:31, 123, 169, 195`

```ts
// 컴포넌트 최상단
const token = localStorage.getItem('accessToken') || cookies.accessToken;

// 함수 내부에서 다시 읽음
const checkUserStatus = () => {
    const token = localStorage.getItem('accessToken') || cookies.accessToken;
    ...
};
```

같은 값을 여러 번 읽어 변수 이름이 충돌합니다. 컴포넌트 레벨의 `token`을 재사용하거나, 별도 커스텀 훅으로 분리하세요.

---

### [LOW] 주석처리된 코드 잔존

**파일:** `src/index.tsx:14`

```tsx
{/*<BrowserRouter>*/}
<BrowserRouter>
```

불필요한 주석 코드는 제거하세요.

---

### [LOW] 이모지를 사용한 console 로그

**파일:** 전체 파일

```ts
console.log('✅ 사용자 정보 복구 완료:', response.data);
console.log('🔄 앱 초기화: 사용자 정보 로딩 중...');
console.error('❌ 사용자 정보 로딩 실패:', error);
```

개발 단계에서 가독성을 위한 이모지 로그는 유용하지만, 운영 환경에서는 제거되어야 합니다.

---

## 9. 추가 파일별 발견 이슈

### [CRITICAL] ConsentWritePage - token을 URL 경로에 직접 사용

**파일:** `src/components/ConsentWritePage/index.tsx:56`

```ts
// ❌ 현재 코드 (Line 56) - JWT 전체 문자열이 URL에 들어감
const response = await fetch(`${API_BASE}/user/${token}/signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
});
```

`token`(JWT 전체 문자열)을 URL 경로 파라미터로 넣고 있습니다. JWT 토큰은 수백 자이므로 이 URL은 실제로 동작하지 않으며, 서버 로그·브라우저 히스토리에 토큰이 평문으로 노출됩니다.

**같은 파일 Line 119에 이미 올바른 엔드포인트가 있습니다:**
```ts
// ✅ Line 119 - /user/me/signature 사용 (올바른 방식)
const response = await fetch(`${API_BASE}/user/me/signature`, {
    headers: { Authorization: `Bearer ${token}` }
});
```

**수정 방법:**

```ts
// ✅ 변경 후 (Line 56) - /user/me/signature로 통일
// HttpOnly 쿠키 전환 전
const response = await fetch(`${API_BASE}/user/me/signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
});

// ✅ 변경 후 (HttpOnly 쿠키 전환 후) - Authorization 헤더도 제거
const response = await fetch(`${API_BASE}/user/me/signature`, {
    method: 'POST',
    credentials: 'include',
    body: formData
});
```

**추가로 수정 필요한 부분 (같은 파일):**

```ts
// Line 92 - fetchConsentAgreement token 인자 제거 (HttpOnly 전환 시)
// ❌ 변경 전
const data = await fetchConsentAgreement(Number(agreementId), token);

// ✅ 변경 후
const data = await fetchConsentAgreement(Number(agreementId));

// Line 308 - submitConsentAgreement token 인자 제거 (HttpOnly 전환 시)
// ❌ 변경 전
await submitConsentAgreement(Number(agreementId), submitData, token);

// ✅ 변경 후
await submitConsentAgreement(Number(agreementId), submitData);

// Line 119 - loadUserSignature Authorization 헤더 제거 (HttpOnly 전환 시)
// ❌ 변경 전
const response = await fetch(`${API_BASE}/user/me/signature`, {
    headers: { Authorization: `Bearer ${token}` }
});

// ✅ 변경 후
const response = await fetch(`${API_BASE}/user/me/signature`, {
    credentials: 'include'
});
```

---

### [HIGH] MyApprovalLineEditor - setCurrentUserId 로직 항상 같은 값 반환

**파일:** `src/components/MyApprovalLineEditor/index.tsx:102`

```ts
setCurrentUserId(data.userId || data.userId === 0 ? data.userId : data.userId);
```

삼항 연산자의 두 분기 모두 `data.userId`를 반환하는 동어반복(tautology)입니다. `data.userId === 0` 조건은 결코 유의미하게 작동하지 않습니다.

---

### [HIGH] EmploymentContractBoard - currentUser.id vs currentUser.userId 혼용

**파일:** `src/components/EmploymentContractBoard/index.tsx:492`

```ts
} else if (contract.status === 'SENT_TO_EMPLOYEE' && contract.employeeId === currentUser.id) {
```

같은 컴포넌트 내에서 사용자 ID를 어떤 곳은 `currentUser.id`, 어떤 곳은 `currentUser.userId`로 참조합니다. 서버는 `userId`를 내려주므로 `currentUser.id`는 항상 `undefined`가 되어 이 조건은 절대 `true`가 되지 않습니다.

---

### [HIGH] ConsentIssuePage - consent API 함수 미사용, 중복 fetch 구현

**파일:** `src/components/ConsentIssuePage/index.tsx:87~126`

`src/apis/consent/index.ts`에 이미 `issueConsent`, `issueBatchConsents` 함수가 구현되어 있지만, `ConsentIssuePage`는 이를 사용하지 않고 동일한 API를 직접 `fetch`로 중복 구현하고 있습니다.

---

### [HIGH] 다수 API 파일에서 URL 하드코딩

| 파일 | 하드코딩 방식 |
|------|--------------|
| `src/apis/workSchedule/index.ts` | `const API_BASE = '/api/v1/work-schedules'` |
| `src/apis/contractMemo/index.ts` | `` `/api/v1/memo/...` `` 직접 사용 |
| `src/components/OrganizationChart/index.tsx` | `/api/v1/user/search`, `/api/v1/departments/...` |
| `src/components/MyApprovalLines/index.tsx` | `/api/v1/approval-lines/...` |
| `src/components/MyApprovalLineEditor/index.tsx` | `/api/v1/approval-lines/...`, `/api/v1/user/me` |
| `src/components/PositionManagement/index.tsx` | `/api/v1/user/me/permissions` |

환경변수(`REACT_APP_API_URL`)를 사용하지 않아, 서버 주소 변경 시 전체 파일을 수작업으로 수정해야 합니다.

---

### [MEDIUM] getPositionByJobLevel 함수 5곳에 중복 정의

동일한 `jobLevel → 직책명` 변환 함수가 아래 파일에 각각 따로 구현되어 있습니다.

- `src/components/AdminVacationManagement/index.tsx`
- `src/views/Detail/MainPage/index.tsx`
- `src/views/Detail/MyPage/index.tsx`
- `src/components/OrganizationChart/index.tsx` (`getJobLevelText`)
- `src/components/MyApprovalLineEditor/index.tsx` (`getJobLevelText`)

`src/utils/` 또는 `src/types/` 디렉터리에 공통 유틸 함수로 추출하세요.

---

### [MEDIUM] OrganizationChart - 주석 처리된 fetchDepartments 함수 잔존

**파일:** `src/components/OrganizationChart/index.tsx:83~95`

```ts
// const fetchDepartments = async () => {
//     try {
//         ...
//     }
// };
```

완전히 주석 처리된 함수가 그대로 남아 있습니다. 불필요한 주석 코드는 제거해야 합니다.

---

### [MEDIUM] MainPage - 매우 큰 단일 컴포넌트 (800+ 줄)

**파일:** `src/views/Detail/MainPage/index.tsx`

하나의 컴포넌트가 사용자 정보, 휴가 현황, 근무현황 캘린더, 최근 활동, 메모(공지) 등 5개 이상의 서로 다른 기능을 처리합니다. 유지보수를 위해 기능별 하위 컴포넌트로 분리하는 것을 권고합니다.

또한, 같은 `useEffect` 블록 안에 `fetchMemos`와 `fetchVacationData`가 함께 정의되어 있어 실행 흐름이 불명확합니다.

---

### [MEDIUM] WorkScheduleBoard - selectedMembers 상태가 실제로 사용되지 않음

**파일:** `src/components/WorkScheduleBoard/index.tsx:29~33`

```ts
const [selectedMembers, setSelectedMembers] = useState<{id: string; name: string;}[]>([]);
const removeSelectedMember = (userId: string) => { ... };
```

`selectedMembers`는 OrgChartModal에서 선택 시 채워지지만, 근무표 생성 로직(`handleCreate`)에서 전혀 사용되지 않습니다. 사용되지 않는 상태와 함수입니다.

---

### [MEDIUM] DepartmentManagementPage - onChange에서 즉시 API 호출

**파일:** `src/components/DepartmentManagementPage/index.tsx:386`

```tsx
<select
    onChange={(e) => handleMoveUser(user.userId, e.target.value)}
    defaultValue=""  // 비제어 컴포넌트
>
```

`<select>`가 비제어 컴포넌트(`defaultValue`)로 사용되면서 `onChange` 이벤트에서 즉시 API를 호출합니다. 사용자가 실수로 드롭다운을 건드리면 의도치 않은 부서 이동이 발생할 수 있습니다. 별도 "이동" 버튼으로 확인 단계를 분리하는 것이 안전합니다. (현재는 `window.confirm`이 있어 최소한의 방어는 되지만 UX가 좋지 않습니다.)

---

### [LOW] contractMemo API - 환경변수 없이 절대 경로 사용

**파일:** `src/apis/contractMemo/index.ts:11`

```ts
const API_BASE = '';
// ...
await axios.post(`${API_BASE}/api/v1/memo/${userId}`, ...)
```

`API_BASE`가 빈 문자열로, 결국 `/api/v1/memo/...`로 하드코딩됩니다.

---

### [LOW] EmploymentContractBoard - console.log 프로덕션 잔존

**파일:** `src/components/EmploymentContractBoard/index.tsx:361~362`

```ts
useEffect(() => {
    console.log('직원 목록:', users);
}, [users]);
```

디버그용 로그가 useEffect와 함께 남아 있습니다.

---

## 10. 파일별 주요 이슈 종합 요약

| 파일 | 심각도 | 주요 이슈 |
|------|--------|-----------|
| `src/App.tsx` | HIGH | localStorage 토큰, useEffect 의존성 누락, 인증 로직 혼재 |
| `src/views/Authentication/SignIn/index.tsx` | CRITICAL | secure:false 쿠키, localStorage 토큰 |
| `src/views/Authentication/axiosInstance/index.tsx` | MEDIUM | 인터셉터 양호, 단 fetch 사용 파일에는 미적용 |
| `src/components/SideBar/index.tsx` | HIGH | 클라이언트 권한 검사, 토큰 이중 읽기, 캐시 로직 중복 |
| `src/components/Layout/index.tsx` | LOW | React import 누락 가능성 |
| `src/components/LeaveApplicationBoard/index.tsx` | HIGH | 타입 비교 오류, 함수 중복 호출, 필터 로직 중복 |
| `src/components/AdminVacationManagement/index.tsx` | HIGH | fetch 사용(axios 미사용), URL 하드코딩, 인라인 스타일 혼용 |
| `src/components/UserRegistrationPage/index.tsx` | LOW | 양호 (단순하고 명확) |
| `src/components/EmploymentContractBoard/index.tsx` | HIGH | currentUser.id vs .userId 혼용, console.log 잔존 |
| `src/components/ConsentWritePage/index.tsx` | CRITICAL | token을 URL 경로에 직접 사용 |
| `src/components/ConsentIssuePage/index.tsx` | HIGH | consent API 미사용, 중복 fetch 구현 |
| `src/components/MyApprovalLineEditor/index.tsx` | HIGH | 삼항 연산자 tautology, URL 하드코딩 |
| `src/components/MyApprovalLines/index.tsx` | MEDIUM | fetch 사용, URL 하드코딩 |
| `src/components/WorkScheduleBoard/index.tsx` | MEDIUM | selectedMembers 미사용, axios/fetch 혼용 |
| `src/components/OrganizationChart/index.tsx` | MEDIUM | 주석 처리된 함수 잔존, URL 하드코딩 |
| `src/components/DepartmentManagementPage/index.tsx` | MEDIUM | onChange에서 즉시 API 호출 |
| `src/views/Detail/MainPage/index.tsx` | MEDIUM | 거대 단일 컴포넌트, useEffect 중첩 |
| `src/apis/contract/index.ts` | HIGH | fetchUsers 필터 결과 미사용, any 타입 |
| `src/apis/leaveApplications/index.ts` | HIGH | fetch 사용, console.log 잔존 |
| `src/apis/consent/index.ts` | LOW | 양호 (함수형으로 잘 분리됨) |
| `src/apis/contractMemo/index.ts` | MEDIUM | URL 하드코딩 (API_BASE = '') |
| `src/apis/workSchedule/index.ts` | MEDIUM | URL 하드코딩 |
| `src/types/index.ts` | MEDIUM | User.role 타입이 number인데 실제로는 string |

---

## 11. 개선 우선순위 권고

### 즉시 조치 (보안·Critical 버그)
1. `ConsentWritePage` - `token`을 URL 경로에서 제거, `userId`로 교체
2. `localStorage` 토큰 저장 → `httpOnly` 쿠키로 전환 (백엔드 협업 필요)
3. `secure: false` → `secure: true` (HTTPS 적용 시)
4. 프로덕션 배포 전 `console.log` 전면 제거 또는 환경변수 조건부 처리

### 단기 개선 (버그/안정성)
5. `fetchUsers` (`src/apis/contract`) - `activeOnly` 필터 결과 실제 반환
6. `EmploymentContractBoard` - `currentUser.id` → `currentUser.userId`로 통일
7. `MyApprovalLineEditor` - `setCurrentUserId` 삼항 연산자 정리
8. `jobLevel` 타입을 `number`로 통일, 서버 응답에서 변환 처리 일원화
9. `handleClick` (LeaveApplicationBoard) - 문자열 비교 → 숫자 비교로 수정
10. `useEffect` 의존성 배열 정확히 명시

### 중기 개선 (아키텍처/유지보수)
11. 모든 API 호출을 `axiosInstance`로 통일 (fetch 제거)
12. 모든 API URL을 `process.env.REACT_APP_API_URL` 기반으로 통일
13. `ConsentIssuePage` - 중복 fetch 제거, `consent/index.ts` API 함수 사용
14. `getPositionByJobLevel` 공통 유틸 함수로 추출 (5곳 중복 제거)
15. 공통 `User` 타입을 `src/types/`에 단일 정의
16. 전역 상태 관리 도입으로 사용자 정보 캐시 중복 제거 (App.tsx, SideBar 중복)
17. 인증 초기화 로직을 `AuthProvider`로 분리
18. `MainPage` 기능별 하위 컴포넌트로 분리
19. API 레이어의 `any` 타입을 실제 DTO 인터페이스로 교체
20. 주석 처리된 코드 전면 정리

---

## 12. HttpOnly 쿠키 전환 시 수정 필요 항목

> **전제 조건:** 백엔드에서 로그인 응답 시 `Set-Cookie: accessToken=...; HttpOnly; Secure; SameSite=Lax; Path=/` 헤더를 내려주도록 변경되어야 합니다. HttpOnly 쿠키는 JavaScript에서 읽을 수 없고, 브라우저가 자동으로 요청에 포함시킵니다.

---

### [필수] 백엔드 협업 항목

| 항목 | 내용 |
|------|------|
| 로그인 응답 | `Set-Cookie: accessToken=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...` |
| 로그아웃 응답 | `Set-Cookie: accessToken=; HttpOnly; Max-Age=0; Path=/` (쿠키 만료 처리) |
| 토큰 만료 정보 | 별도 JSON 필드(`expiresAt`)로 내려주도록 협의 (프론트에서 만료 체크용) |
| CORS 설정 | `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Origin: <정확한 도메인>` 설정 필요 |

---

### [필수] `src/views/Authentication/SignIn/index.tsx`

**현재 코드 (제거 대상):**
```ts
// Line 44-45: localStorage에 토큰 저장 → 제거
localStorage.setItem('accessToken', token);
localStorage.setItem('tokenExpires', expires.toISOString());

// Line 55-60: 클라이언트 측 쿠키 설정 → 제거 (서버가 Set-Cookie로 내려줌)
setCookie('accessToken', token, {
    expires,
    path: '/',
    secure: false,
    sameSite: 'lax'
});
```

**변경 방향:**
- `localStorage.setItem('accessToken', ...)` 제거
- `localStorage.setItem('tokenExpires', ...)` 제거 (백엔드가 별도 필드로 만료 시각 제공 시 별도 비httpOnly 쿠키 또는 메모리 상태로 관리)
- `setCookie('accessToken', ...)` 제거 (서버 Set-Cookie가 자동 처리)
- `useCookies` import가 더 이상 필요 없으면 제거

---

### [필수] `src/views/Authentication/axiosInstance/index.tsx`

**현재 코드 (수정 대상):**
```ts
// Line 5-8: withCredentials는 이미 설정되어 있어 유지
const axiosInstance = axios.create({
    baseURL: process.env.REACT_APP_API_URL || '',
    withCredentials: true,  // ← 이 설정이 HttpOnly 쿠키 자동 전송에 필수. 유지
});

// Line 10-24: Request Interceptor - localStorage 읽는 부분 제거
axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const accessToken = localStorage.getItem('accessToken'); // ← 제거
        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`; // ← 제거
        }
        return config;
    }
);

// Line 27-39: Response Interceptor - localStorage 정리 코드 수정
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('accessToken');    // ← 제거
            localStorage.removeItem('tokenExpires');   // ← 제거
            localStorage.removeItem('userCache');      // 유지 (사용자 캐시는 정리)
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);
```

**변경 방향:**
- Request Interceptor 전체 제거 (HttpOnly 쿠키는 브라우저가 자동 전송, `Authorization` 헤더 불필요)
- Response Interceptor에서 `localStorage.removeItem('accessToken')`, `removeItem('tokenExpires')` 제거
- `withCredentials: true`는 반드시 유지

---

### [필수] `src/App.tsx`

**수정 대상 (Line 33, 39, 51-62):**
```ts
// Line 33: localStorage 토큰 읽기 → 제거
const token = localStorage.getItem('accessToken') || cookies.accessToken;

// Line 39: 동일 패턴 → 제거
const token = localStorage.getItem('accessToken') || cookies.accessToken;

// Line 51-62: localStorage 기반 토큰 만료 체크 → 수정
const tokenExpires = localStorage.getItem('tokenExpires');
if (tokenExpires) {
    const expiresDate = new Date(tokenExpires);
    if (expiresDate < new Date()) {
        localStorage.removeItem('accessToken');    // 제거
        localStorage.removeItem('tokenExpires');   // 제거
        localStorage.removeItem('userCache');
        navigate('/');
    }
}
```

**변경 방향:**
- `localStorage.getItem('accessToken')` 참조 전면 제거
- 토큰 존재 여부 확인이 필요한 경우: `/user/me` API 호출 결과(성공/401)로 판단
- 만료 체크는 백엔드에서 토큰 만료 시 401 응답을 내려주면 axiosInstance 인터셉터가 자동 처리

---

### [필수] `src/components/SideBar/index.tsx`

**수정 대상 (다수의 localStorage 토큰 참조):**
```ts
// Line 31, 61, 123, 169, 195: localStorage 토큰 읽기 → 전부 제거
const token = localStorage.getItem('accessToken') || cookies.accessToken;

// Line 75: 캐시 무효화용 토큰 해시 → 제거
const cachedToken = localStorage.getItem('cachedTokenHash');

// Line 169-170: 토큰 해시 저장 → 제거
const currentTokenHash = (localStorage.getItem('accessToken') || cookies.accessToken || '').substring(0, 50);
localStorage.setItem('cachedTokenHash', currentTokenHash);

// Line 204-207: 로그아웃 시 쿠키 제거 → 수정
removeCookie("accessToken", { path: "/", secure: false, sameSite: "lax" });
localStorage.removeItem('accessToken');    // 제거
localStorage.removeItem('tokenExpires');   // 제거

// handleLogout의 Authorization 헤더 → 제거 (쿠키가 자동 전송됨)
await axios.post(`${API_BASE_URL}/auth/logout/web`, {}, {
    headers: { "Authorization": `Bearer ${token}` },  // 제거
    withCredentials: true  // 유지
});
```

**변경 방향:**
- 모든 `localStorage.getItem('accessToken')` 제거
- `removeCookie('accessToken', ...)` 제거 (서버 로그아웃 응답의 `Set-Cookie`가 만료 처리)
- API 함수 인자로 전달하던 `token` 매개변수 제거
- `localStorage.removeItem('tokenExpires')` 제거, `localStorage.removeItem('userCache')` 유지

---

### [필수] `src/components/ProfileCompletionPopup/index.tsx`

**수정 대상 (Line 197, 287):**
```ts
// document.cookie 직접 파싱으로 HttpOnly 쿠키 읽기 시도 → 제거 (HttpOnly 쿠키는 JS에서 읽기 불가)
document.cookie.split('; ').find(row => row.startsWith('accessToken='))?.split('=')[1];
```

**변경 방향:**
- `document.cookie`에서 토큰을 읽는 코드 전부 제거
- fetch 요청에 `credentials: 'include'` 옵션은 이미 있으므로 유지 (쿠키 자동 전송)
- `Authorization` 헤더 주입 코드 제거

---

### [필수] 모든 컴포넌트 - `token` 매개변수 제거

아래 파일들은 `localStorage.getItem('accessToken')`으로 토큰을 읽어 Authorization 헤더에 수동으로 주입하고 있습니다. HttpOnly 쿠키 전환 후에는 이 패턴이 전부 제거되어야 합니다.

| 파일 | 수정 내용 |
|------|----------|
| `src/views/Detail/MyPage/index.tsx` (L81, 101, 204, 287) | `Authorization` 헤더 제거, `credentials: 'include'` 유지 |
| `src/views/Detail/LeaveApplication/index.tsx` (L349, 375 등 20여 곳) | 동일 |
| `src/views/Detail/EmploymentContract/index.tsx` (L783) | 동일 |
| `src/components/DepartmentManagementPage/index.tsx` (L63, 88 등) | 동일 |
| `src/components/ConsentIssuePage/index.tsx` (L54, 91, 111) | 동일 |
| `src/components/ConsentMyListPage/index.tsx` (L49, 57, 181) | 동일 |
| `src/components/AdminContractMemoManagement/index.tsx` (L84) | 동일 |
| `src/components/WorkScheduleEditor/index.tsx` (L113, 221 등) | 동일 |
| `src/components/AdminVacationManagement/index.tsx` | 동일 |
| `src/components/LeaveApplicationBoard/index.tsx` | 동일 |
| `src/components/EmploymentContractBoard/index.tsx` | 동일 |
| `src/components/OrganizationChart/index.tsx` | 동일 |
| `src/components/MyApprovalLines/index.tsx` | 동일 |
| `src/components/MyApprovalLineEditor/index.tsx` | 동일 |
| `src/components/PositionManagement/index.tsx` | 동일 |
| `src/apis/contract/index.ts` | `token?: string` 매개변수 제거, `authHeader()` 함수 제거 |
| `src/apis/consent/index.ts` | 동일 |
| `src/apis/leaveApplications/index.ts` | 동일 |
| `src/apis/contractMemo/index.ts` | 동일 |
| `src/apis/workSchedule/index.ts` | 동일 |

**공통 수정 패턴:**
```ts
// 변경 전
const token = localStorage.getItem('accessToken') || cookies.accessToken;
const response = await fetch('/api/v1/...', {
    headers: { Authorization: `Bearer ${token}` },
});

// 변경 후 (fetch 사용 시)
const response = await fetch('/api/v1/...', {
    credentials: 'include',  // 쿠키 자동 전송
});

// 변경 후 (axiosInstance 사용 시 - withCredentials:true가 이미 설정되어 있음)
const response = await axiosInstance.get('/api/v1/...');
```

---

### [필수] `src/apis/index.ts` - 로그인 요청

```ts
// 로그인 API 호출 시 withCredentials 또는 credentials:'include' 추가 필요
// 서버가 Set-Cookie로 응답할 때 브라우저가 쿠키를 저장하려면 credentials 설정이 필요
const signInRequest = async (body: SignInRequestDto) => {
    return await axios.post(`${API_DOMAIN}/auth/sign-in`, body, {
        withCredentials: true,  // ← 추가
    });
};
```

---

### [선택] `src/App.tsx` - 로그인 여부 판단 방식 변경

HttpOnly 쿠키는 JS에서 읽을 수 없으므로, 로그인 여부를 확인하려면 API 호출 결과로 판단해야 합니다.

```ts
// 변경 전: localStorage 토큰 존재 여부로 로그인 판단
const isLoggedIn = !!localStorage.getItem('accessToken');

// 변경 후: /user/me API 호출 성공 여부로 판단
try {
    const response = await axiosInstance.get('/user/me');
    // 성공 → 로그인 상태
} catch (e) {
    // 401 → 미로그인, 로그인 페이지로 이동
    navigate('/');
}
```

---

### 전환 후 제거 가능한 항목 정리

| 항목 | 제거 대상 |
|------|----------|
| `localStorage.getItem('accessToken')` | 전체 프로젝트에서 제거 |
| `localStorage.setItem('accessToken', ...)` | `SignIn/index.tsx`에서 제거 |
| `localStorage.removeItem('accessToken')` | 전체 프로젝트에서 제거 |
| `localStorage.getItem('tokenExpires')` | 제거 (만료는 401 응답으로 처리) |
| `localStorage.setItem('tokenExpires', ...)` | 제거 |
| `localStorage.removeItem('tokenExpires')` | 제거 |
| `localStorage.setItem('cachedTokenHash', ...)` | 제거 |
| `localStorage.getItem('cachedTokenHash')` | 제거 |
| `document.cookie` 직접 파싱 | `ProfileCompletionPopup`에서 제거 |
| `Authorization: Bearer ${token}` 헤더 | 전체 컴포넌트·API 파일에서 제거 |
| `setCookie('accessToken', ...)` 클라이언트 설정 | `SignIn/index.tsx`에서 제거 |
| `removeCookie('accessToken', ...)` | `SideBar/index.tsx`에서 제거 |
| `authHeader(token)` 헬퍼 함수 | `apis/contract/index.ts` 등에서 제거 |
| `token?: string` 매개변수 | 모든 API 함수 시그니처에서 제거 |

---

## 13. HttpOnly 쿠키 전환 - 프론트 실제 수정 코드

> 파일별로 정확히 어떤 코드를 어떻게 바꿔야 하는지 작성합니다.

---

### Step 1. `src/views/Authentication/axiosInstance/index.tsx`

**가장 먼저 수정. 이 파일이 모든 axios 요청의 기반입니다.**

```ts
// ❌ 변경 전 (전체 파일)
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || "/api/v1";

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
});

axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('tokenExpires');
            localStorage.removeItem('userCache');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
```

```ts
// ✅ 변경 후
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || "/api/v1";

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,  // HttpOnly 쿠키 자동 전송 - 반드시 유지
});

// Request Interceptor 전체 제거 (쿠키가 자동으로 전송됨)

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('userCache');  // 사용자 캐시만 정리
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
```

---

### Step 2. `src/views/Authentication/SignIn/index.tsx`

**로그인 후 토큰 저장 코드 제거. 백엔드 Set-Cookie가 자동 처리.**

```ts
// ❌ 제거할 코드 (Line 16, 44-64)
const [cookies, setCookie] = useCookies(['accessToken']);  // setCookie 제거 (cookies도 불필요하면 제거)

// Line 34: 유지 (userCache 정리는 필요)
localStorage.removeItem('userCache');

// Line 44-51: 전체 제거
try {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('tokenExpires', expires.toISOString());
} catch (e) { ... }

// Line 53-64: 전체 제거
try {
    setCookie('accessToken', token, { ... });
} catch (e) { ... }
```

```ts
// ✅ 변경 후 signInResponse 함수
const signInResponse = (responseBody: ResponseBody<SignInResponseDto>) => {
    if (!responseBody) return;
    const { code } = responseBody;
    if (code === ResponseCode.VALIDATION_FAIL) alert('아이디와 비밀번호를 입력하세요.');
    if (code === ResponseCode.SIGN_IN_FAIL) setMessage('로그인 정보가 일치하지 않습니다.');
    if (code === ResponseCode.DATABASE_ERROR) alert('데이터베이스 오류입니다.');
    if (code !== ResponseCode.SUCCESS) return;

    // 토큰 저장 코드 전부 제거 (백엔드 Set-Cookie가 자동 처리)
    localStorage.removeItem('userCache');  // 이전 캐시만 정리
    navigate('/detail/main-page');
};
```

> `useCookies` import, `const [cookies, setCookie]` 선언 모두 제거
> `token`, `expiresIn`, `expires` 변수 선언도 제거 (더 이상 사용 안 함)

---

### Step 3. `src/apis/index.ts`

**로그인 요청 시 `withCredentials: true` 추가. 브라우저가 Set-Cookie를 저장하려면 필수.**

```ts
// ❌ 변경 전
export const signInRequest = async (requestBody: SignInRequestDto) => {
    const result = await axios.post(SIGN_IN_URL(), requestBody)
        .then(responseHandler<SignInResponseDto>)
        .catch(errorHandler);
    return result;
};
```

```ts
// ✅ 변경 후
export const signInRequest = async (requestBody: SignInRequestDto) => {
    const result = await axios.post(SIGN_IN_URL(), requestBody, {
        withCredentials: true,  // Set-Cookie 응답 수신에 필수
    })
        .then(responseHandler<SignInResponseDto>)
        .catch(errorHandler);
    return result;
};
```

---

### Step 4. `src/App.tsx`

**로그인 판단을 localStorage 토큰 체크 → /user/me API 호출 결과로 변경.**

```ts
// ❌ 제거할 코드
const [cookies] = useCookies(['accessToken']);          // 제거
const token = localStorage.getItem('accessToken') || cookies.accessToken;  // 제거

// useEffect 내부
const token = localStorage.getItem('accessToken') || cookies.accessToken;  // 제거
if (!token) { return; }  // 제거

const tokenExpires = localStorage.getItem('tokenExpires');  // 제거
if (tokenExpires) { ... }  // tokenExpires 블록 전체 제거

// axios.get 에서
headers: { Authorization: `Bearer ${token}` }  // 제거

// catch 블록에서
localStorage.removeItem('accessToken');    // 제거
localStorage.removeItem('tokenExpires');   // 제거
```

```ts
// ✅ 변경 후 App.tsx useEffect
import axiosInstance from './views/Authentication/axiosInstance';

useEffect(() => {
    const initializeUser = async () => {
        // 로그인 페이지면 건너뜀
        if (window.location.pathname === '/') return;

        // 캐시 확인 (5분 이내)
        const cached = localStorage.getItem('userCache');
        if (cached) {
            try {
                const userData = JSON.parse(cached);
                const cacheAge = Date.now() - (userData.timestamp || 0);
                if (cacheAge < 5 * 60 * 1000) return;
            } catch (e) {
                localStorage.removeItem('userCache');
            }
        }

        try {
            // withCredentials:true 설정된 axiosInstance 사용 → 쿠키 자동 전송
            const response = await axiosInstance.get('/user/me');

            const userCache = {
                userName: response.data.userName,
                deptName: response.data.deptName || response.data.deptCode,
                jobLevel: Number(response.data.jobLevel ?? 0),
                role: response.data.role,
                permissions: response.data.permissions || [],
                userId: response.data.userId,
                timestamp: Date.now(),
            };
            localStorage.setItem('userCache', JSON.stringify(userCache));

        } catch (error: any) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.removeItem('userCache');
                navigate('/');
            }
        }
    };

    initializeUser();
}, []);
```

> `useCookies` import 제거, `axios` import를 `axiosInstance` import로 교체

---

### Step 5. `src/components/SideBar/index.tsx`

**변경량이 가장 많은 파일. 순서대로 수정.**

#### 5-1. 최상단 token 변수 제거 (Line 30-31)
```ts
// ❌ 제거
const [cookies, , removeCookie] = useCookies(["accessToken"]);
const token = localStorage.getItem('accessToken') || cookies.accessToken;

// ✅ 변경 후 (useCookies 자체 불필요)
// 두 줄 모두 삭제
```

#### 5-2. useEffect 수정 (Line 60-120)
```ts
// ❌ 변경 전
useEffect(() => {
    const currentToken = localStorage.getItem('accessToken') || cookies.accessToken;
    if (!currentToken) {
        localStorage.removeItem('userCache');
        return;
    }
    const cachedUser = localStorage.getItem('userCache');
    if (cachedUser) {
        const cachedToken = localStorage.getItem('cachedTokenHash');
        const currentTokenHash = currentToken.substring(0, 50);
        if (cachedToken !== currentTokenHash) {
            localStorage.removeItem('userCache');
            localStorage.removeItem('cachedTokenHash');
            checkUserStatus();
            checkConsentPermissions();
            return;
        }
        // ... 캐시 로드
    }
    checkUserStatus();
    checkConsentPermissions();
}, [token]);
```

```ts
// ✅ 변경 후
useEffect(() => {
    const cachedUser = localStorage.getItem('userCache');
    if (cachedUser) {
        try {
            const userData = JSON.parse(cachedUser);
            setProfileName(userData.userName || '사용자');
            setProfileDepartment(userData.deptName || '');
            setJobLevel(Number(userData.jobLevel) || 0);
            setIsAdmin(userData.role === 'ADMIN');
            setPermissions(userData.permissions || []);
            if (userData.userId) fetchProfileImage(userData.userId);
            if (!userData.consentPermissions) {
                checkConsentPermissions();
            } else {
                setCanCreateConsent(userData.consentPermissions.canCreate);
                setCanManageConsent(userData.consentPermissions.canManage);
            }
            return;
        } catch (e) {
            localStorage.removeItem('userCache');
        }
    }
    checkUserStatus();
    checkConsentPermissions();
}, []);  // token 의존성 제거
```

#### 5-3. checkUserStatus 수정 (Line 122-177)
```ts
// ❌ 변경 전
const checkUserStatus = () => {
    const token = localStorage.getItem('accessToken') || cookies.accessToken;
    axios.get(`${API_BASE_URL}/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    .then((res) => {
        // ...
        localStorage.setItem('cachedTokenHash',
            (localStorage.getItem('accessToken') || cookies.accessToken || '').substring(0, 50));
    })
```

```ts
// ✅ 변경 후 (axiosInstance import 필요)
import axiosInstance from '../../views/Authentication/axiosInstance';

const checkUserStatus = () => {
    axiosInstance.get('/user/me')
    .then((res) => {
        const userData = res.data;
        setProfileName(userData.userName || '사용자');
        setProfileDepartment(userData.deptName || userData.deptCode || '');
        const level = userData.jobLevel ?? 0;
        setJobLevel(Number(level));
        setIsAdmin(userData.role === 'ADMIN');
        setPermissions(Array.isArray(userData.permissions) ? userData.permissions : []);

        localStorage.setItem('userCache', JSON.stringify({
            userName: userData.userName,
            deptName: userData.deptName || userData.deptCode,
            jobLevel: Number(level),
            role: userData.role,
            permissions: userData.permissions || [],
            userId: userData.userId,
        }));
        // cachedTokenHash 저장 코드 제거
        if (userData.userId) fetchProfileImage(userData.userId);
    })
    .catch((err) => console.error('사용자 정보 로드 실패', err));
};
```

#### 5-4. fetchProfileImage 수정 (Line 179-192)
```ts
// ❌ 변경 전
axios.get(`${API_BASE_URL}/user/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
})

// ✅ 변경 후
axiosInstance.get(`/user/${userId}`)
```

#### 5-5. handleLogout 수정 (Line 194-215)
```ts
// ❌ 변경 전
const handleLogout = async () => {
    const token = localStorage.getItem('accessToken') || cookies.accessToken;
    try {
        await axios.post(`${API_BASE_URL}/auth/logout/web`, {}, {
            headers: { "Authorization": `Bearer ${token}` },
            withCredentials: true
        });
    } finally {
        removeCookie("accessToken", { path: "/", secure: false, sameSite: "lax" });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('tokenExpires');
        localStorage.removeItem('userCache');
        localStorage.removeItem('cachedTokenHash');
        window.location.href = '/';
    }
};
```

```ts
// ✅ 변경 후
const handleLogout = async () => {
    try {
        // axiosInstance 사용 → 쿠키 자동 전송, 백엔드가 Set-Cookie로 쿠키 만료 처리
        await axiosInstance.post('/auth/logout/web', {});
    } finally {
        localStorage.removeItem('userCache');         // 사용자 캐시만 정리
        localStorage.removeItem('cachedTokenHash');   // 제거
        window.location.href = '/';
    }
};
```

#### 5-6. checkConsentPermissions 수정 (Line 224-246)
```ts
// ❌ 변경 전
const response = await axios.get(`${API_BASE_URL}/consents/permissions`, {
    headers: { Authorization: `Bearer ${token}` }
});

// ✅ 변경 후
const response = await axiosInstance.get('/consents/permissions');
```

---

### Step 6. API 파일 4개

#### `src/apis/contract/index.ts`

```ts
// ❌ 제거
const authHeader = (token?: string) =>
    token ? {headers: {Authorization: `Bearer ${token}`}} : undefined;

// 모든 함수에서 token 매개변수 및 authHeader(token) 제거
export const fetchContract = async (id: number, token?: string): Promise<Contract> => {
    const resp = await axios.get<Contract>(`/employment-contract/${id}`, authHeader(token));

// ✅ 변경 후
export const fetchContract = async (id: number): Promise<Contract> => {
    const resp = await axios.get<Contract>(`/employment-contract/${id}`);
```

> `authHeader` 함수 삭제, 모든 함수에서 `token?: string` 매개변수 제거, `authHeader(token)` 제거
> 이미 `axiosInstance`를 import하고 있으므로 `withCredentials`는 자동 적용
> `downloadContract`처럼 responseType이 필요한 경우: `axios.get(url, { responseType: 'blob' })`

---

#### `src/apis/consent/index.ts`

```ts
// ❌ 변경 전 패턴
export const issueConsent = async (data: ..., token: string) => {
    return axios.post('/consents', data, {
        headers: { Authorization: `Bearer ${token}` }
    });
};

// ✅ 변경 후
export const issueConsent = async (data: ...) => {
    return axiosInstance.post('/consents', data);
};
```

> 모든 함수에서 `token: string` 매개변수 제거, Authorization 헤더 제거

---

#### `src/apis/leaveApplications/index.ts`

```ts
// ❌ 제거
const withAuth = (token: string) => ({ ... });
const authHeaderOnly = (token: string) => ({ ... });

// 모든 fetch → axiosInstance로 교체
const response = await fetch('/api/v1/leave-applications', {
    headers: withAuth(token)
});

// ✅ 변경 후
const response = await axiosInstance.get('/leave-applications');
```

> `fetch` → `axiosInstance` 전환, `withAuth`, `authHeaderOnly` 헬퍼 삭제
> 모든 함수에서 `token: string` 매개변수 제거

---

#### `src/apis/workSchedule/index.ts`

```ts
// ❌ 변경 전 패턴
export const fetchWorkSchedules = async (token: string) => {
    return axios.get('/work-schedules', {
        headers: { Authorization: `Bearer ${token}` }
    });
};

// ✅ 변경 후
export const fetchWorkSchedules = async () => {
    return axiosInstance.get('/work-schedules');
};
```

---

#### `src/apis/contractMemo/index.ts`

```ts
// ❌ 제거
const authHeader = (token?: string) =>
    token ? {headers: {Authorization: `Bearer ${token}`}} : undefined;

// ✅ 변경 후 - authHeader 제거, axiosInstance 사용, token 매개변수 제거
export const createMemo = async (userId: string, content: string) => {
    return axiosInstance.post(`/api/v1/memo/${userId}`, { content });
};
```

---

### Step 7. 컴포넌트 파일 공통 수정 패턴

아래 14개 파일 모두 동일한 패턴으로 수정합니다.

**대상 파일:**
- `src/components/ProfileCompletionPopup/index.tsx`
- `src/components/AdminVacationManagement/index.tsx`
- `src/components/EmploymentContractBoard/index.tsx`
- `src/components/ConsentWritePage/index.tsx`
- `src/components/ConsentIssuePage/index.tsx`
- `src/components/ConsentManagementPage/index.tsx`
- `src/components/ConsentMyIssuedPage/index.tsx`
- `src/components/ConsentMyListPage/index.tsx`
- `src/components/AdminContractMemoManagement/index.tsx`
- `src/components/MyApprovalLineEditor/index.tsx`
- `src/components/MyApprovalLines/index.tsx`
- `src/components/OrganizationChart/index.tsx`
- `src/components/WorkScheduleBoard/index.tsx`
- `src/components/WorkScheduleEditor/index.tsx`
- `src/components/DepartmentManagementPage/index.tsx`
- `src/components/AdminDashBoard/index.tsx`
- `src/components/UserRegistrationPage/index.tsx`
- `src/components/PositionManagement/index.tsx`
- `src/views/Detail/MainPage/index.tsx`
- `src/views/Detail/MyPage/index.tsx`
- `src/views/Detail/LeaveApplication/index.tsx`
- `src/views/Detail/EmploymentContract/index.tsx`

**공통 수정 패턴 A - axios 직접 사용 파일:**
```ts
// ❌ 변경 전
const [cookies] = useCookies(['accessToken']);
const token = localStorage.getItem('accessToken') || cookies.accessToken;

axios.get('/api/v1/...', {
    headers: { Authorization: `Bearer ${token}` }
});

// ✅ 변경 후
import axiosInstance from '../views/Authentication/axiosInstance'; // 경로는 파일마다 다름

axiosInstance.get('/...');  // withCredentials:true 자동 적용, 쿠키 자동 전송
```

**공통 수정 패턴 B - fetch 직접 사용 파일:**
```ts
// ❌ 변경 전
const token = localStorage.getItem('accessToken') || cookies.accessToken;
await fetch('/api/v1/...', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});

// ✅ 변경 후 (axiosInstance로 교체 권장)
await axiosInstance.post('/...', data);

// 또는 fetch 유지 시 credentials 추가
await fetch('/api/v1/...', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },  // Authorization 헤더 제거
    credentials: 'include',  // 쿠키 자동 전송
    body: JSON.stringify(data)
});
```

**공통 수정 패턴 C - API 함수에 token 인자 전달 제거:**
```ts
// ❌ 변경 전
fetchContracts(false, token)
fetchCurrentUser(token)
createContract(employeeId, token)

// ✅ 변경 후
fetchContracts(false)
fetchCurrentUser()
createContract(employeeId)
```

---

### Step 7 특이 케이스

#### `src/components/ProfileCompletionPopup/index.tsx`
```ts
// ❌ 변경 전 - document.cookie로 HttpOnly 쿠키 읽기 시도 (읽기 불가)
const token = document.cookie.split('; ')
    .find(row => row.startsWith('accessToken='))?.split('=')[1];

// ✅ 변경 후 - 토큰 읽기 코드 전체 제거, credentials:'include'만 유지
await fetch(`/api/v1/user/${userId}/signature`, {
    method: 'POST',
    credentials: 'include',  // 이미 있음, 유지
    body: form,
    // Authorization 헤더 제거
});
```

---

### 수정 완료 체크리스트

| 순서 | 파일 | 핵심 수정 내용 | 완료 |
|------|------|--------------|------|
| 1 | `axiosInstance/index.tsx` | Request Interceptor 제거 | ☐ |
| 2 | `SignIn/index.tsx` | localStorage 저장 코드 제거 | ☐ |
| 3 | `apis/index.ts` | `withCredentials: true` 추가 | ☐ |
| 4 | `App.tsx` | token 체크 → axiosInstance `/user/me` | ☐ |
| 5 | `SideBar/index.tsx` | token 변수 제거, axiosInstance 전환 | ☐ |
| 6 | `apis/contract/index.ts` | `authHeader` 제거, token 매개변수 제거 | ☐ |
| 7 | `apis/consent/index.ts` | token 매개변수 제거 | ☐ |
| 8 | `apis/leaveApplications/index.ts` | fetch → axiosInstance, token 제거 | ☐ |
| 9 | `apis/workSchedule/index.ts` | token 매개변수 제거 | ☐ |
| 10 | `apis/contractMemo/index.ts` | `authHeader` 제거, token 매개변수 제거 | ☐ |
| 11 | `ProfileCompletionPopup` | `document.cookie` 읽기 코드 제거 | ☐ |
| 12 | `AdminVacationManagement` | token 변수 제거, Authorization 헤더 제거 | ☐ |
| 13 | `EmploymentContractBoard` | token 인자 제거 | ☐ |
| 14 | `ConsentWritePage` | token 제거, fetch credentials 유지 | ☐ |
| 15 | `ConsentIssuePage` | token 제거 | ☐ |
| 16 | `ConsentManagementPage` | token 제거 | ☐ |
| 17 | `ConsentMyIssuedPage` | token 제거 | ☐ |
| 18 | `ConsentMyListPage` | token 제거 | ☐ |
| 19 | `AdminContractMemoManagement` | token 제거 | ☐ |
| 20 | `MyApprovalLineEditor` | token 제거 | ☐ |
| 21 | `MyApprovalLines` | token 제거 | ☐ |
| 22 | `OrganizationChart` | token 제거 | ☐ |
| 23 | `WorkScheduleBoard` | token 제거 | ☐ |
| 24 | `WorkScheduleEditor` | token 제거 | ☐ |
| 25 | `DepartmentManagementPage` | token 제거 | ☐ |
| 26 | `AdminDashBoard` | token 제거 | ☐ |
| 27 | `UserRegistrationPage` | token 제거 | ☐ |
| 28 | `PositionManagement` | token 제거 | ☐ |
| 29 | `MainPage/index.tsx` | token 제거 | ☐ |
| 30 | `MyPage/index.tsx` | token 제거, fetch credentials 유지 | ☐ |
| 31 | `LeaveApplication/index.tsx` | token 인자 제거 (20여 곳) | ☐ |
| 32 | `EmploymentContract/index.tsx` | Authorization 헤더 제거 | ☐ |

---

## 14. HttpOnly 쿠키 전환 - 수정 순서 및 파일별 깨지는 부분 전체 분석

> 전체 소스 파일을 분석한 결과입니다. **수정 순서를 지키지 않으면 중간에 앱이 완전히 동작하지 않는 상태가 됩니다.**

---

### 수정 순서 (Phase별)

```
Phase 0 (백엔드) → Phase 1 (인프라) → Phase 2 (진입점) → Phase 3 (API 레이어) → Phase 4 (컴포넌트)
```

| Phase | 대상 | 이유 |
|-------|------|------|
| **Phase 0** | 백엔드 | Set-Cookie, parseBearerToken → 쿠키 읽기 전환 |
| **Phase 1** | `axiosInstance/index.tsx` | 모든 axios 요청의 기반. 여기를 먼저 바꿔야 나머지가 동작 |
| **Phase 1** | `SignIn/index.tsx` | 토큰 저장 방식 제거 |
| **Phase 2** | `App.tsx` | 앱 진입점. 로그인 판단 로직이 틀리면 전체 앱이 깨짐 |
| **Phase 2** | `SideBar/index.tsx` | 메뉴 전체 렌더링에 영향 |
| **Phase 3** | API 파일 4개 | 컴포넌트가 이 함수들을 호출하므로 먼저 수정 |
| **Phase 4** | 나머지 컴포넌트 전체 | Phase 3 완료 후 순서 무관 |

---

### Phase 0 - 백엔드 (프론트 작업 전 완료 필요)

백엔드가 준비되지 않으면 Phase 1부터 진행해도 **모든 API가 401**을 반환합니다.

- 로그인 시: `Set-Cookie: accessToken=...; HttpOnly; Secure; SameSite=Lax; Path=/`
- 로그아웃 시: `Set-Cookie: accessToken=; Max-Age=0; HttpOnly; Path=/`
- `parseBearerToken()` → `request.getCookies()`로 변경
- CORS: `allowCredentials(true)`, `allowedOrigins("정확한 도메인")`

---

### Phase 1-1. `src/views/Authentication/axiosInstance/index.tsx`

**깨지는 부분 없음** (단, 수정하지 않으면 Authorization 헤더를 계속 전송)

**수정 내용:**

| 구분 | 현재 | 변경 후 |
|------|------|---------|
| Request Interceptor | localStorage 읽어서 `Authorization` 헤더 주입 | **전체 제거** (쿠키 자동 전송) |
| Response Interceptor | 401 시 `localStorage.removeItem('accessToken')` | 해당 줄만 제거, 나머지 유지 |
| `withCredentials: true` | 이미 설정됨 | **유지 필수** |

```ts
// 제거할 코드 (Line 10-24)
axiosInstance.interceptors.request.use(
    (config) => {
        const accessToken = localStorage.getItem('accessToken'); // 제거
        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`; // 제거
        }
        return config;
    }
);

// 수정할 코드 (Line 27-39)
// localStorage.removeItem('accessToken') 줄만 제거
// localStorage.removeItem('tokenExpires') 줄만 제거
// localStorage.removeItem('userCache')는 유지 (사용자 캐시 정리)
// window.location.href = '/' 유지
```

---

### Phase 1-2. `src/views/Authentication/SignIn/index.tsx`

**깨지는 부분:** 수정 전에는 로그인해도 localStorage에 토큰이 없어서 앱이 로그인 상태를 인식 못 함

**수정 내용:**

```ts
// 제거 (Line 44-45)
localStorage.setItem('accessToken', token);
localStorage.setItem('tokenExpires', expires.toISOString());

// 제거 (Line 55-60) - 서버가 Set-Cookie로 자동 처리
setCookie('accessToken', token, { expires, path: '/', secure: false, sameSite: 'lax' });

// 유지 - 로그인 성공 후 navigate('/detail/main-page')
```

> `useCookies` import, `setCookie` 선언도 사용처가 없어지면 제거

---

### Phase 2-1. `src/App.tsx` ⚠️ 가장 중요

**깨지는 부분:**

| 위치 | 현재 코드 | 증상 |
|------|----------|------|
| Line 33 | `localStorage.getItem('accessToken') \|\| cookies.accessToken` | 항상 `null` 반환 |
| Line 41 | `if (!token) { return; }` | **항상 실행됨** → 사용자 정보 로딩 전혀 안 됨 |
| Line 51-61 | `localStorage.getItem('tokenExpires')` | 항상 `null` → 만료 체크 무력화 |
| Line 84 | `Authorization: Bearer ${token}` | `Bearer null` 전송 → API 401 |
| Line 107 | `localStorage.removeItem('accessToken')` | 지워도 없는 값 |

**결과:** 로그인 후 메인 페이지 진입해도 사용자 정보가 로드되지 않아 사이드바 이름·부서·권한 메뉴 전부 공백이 됩니다.

**수정 방향:**
```ts
// 변경 전: 토큰 존재 여부로 초기화 여부 결정
const token = localStorage.getItem('accessToken') || cookies.accessToken;
if (!token) return;

// 변경 후: /user/me API 결과로 판단 (withCredentials:true로 쿠키 자동 전송됨)
try {
    const response = await axiosInstance.get('/user/me');
    // 성공 시 사용자 정보 세팅
} catch (error) {
    if (error.response?.status === 401) {
        navigate('/');
        return;
    }
}
```

---

### Phase 2-2. `src/components/SideBar/index.tsx` ⚠️ 메뉴 전체에 영향

**깨지는 부분:**

| 위치 | 현재 코드 | 증상 |
|------|----------|------|
| Line 31 | `localStorage.getItem('accessToken') \|\| cookies.accessToken` | 항상 `null` |
| Line 63-67 | token으로 useEffect 실행 여부 결정 | 실행 안 됨 → 사용자 정보 로드 실패 |
| Line 124 | `Authorization: Bearer ${token}` | `Bearer null` → 401 |
| Line 169 | `(localStorage.getItem('accessToken') \|\| ...).substring(0,50)` | `null.substring` → **런타임 에러** |
| Line 195 | `Authorization: Bearer ${token}` | 401 |
| Line 227 | `Authorization: Bearer ${token}` | 401 |

**결과:** 사이드바 사용자 이름·부서·직책 공백, 관리자 메뉴 미표시, 동의서 권한 메뉴 미표시

**수정 방향:**
- `const token = localStorage.getItem('accessToken') || cookies.accessToken;` 전부 제거
- `axiosInstance` 호출로 교체 (쿠키 자동 전송)
- `Authorization` 헤더 전달 코드 제거
- `cachedTokenHash` 관련 로직 제거

---

### Phase 3. API 레이어 4개 파일

컴포넌트들이 이 함수에 token을 전달하고 있습니다. 함수 시그니처를 먼저 바꿔야 컴포넌트 수정이 수월합니다.

#### `src/apis/contract/index.ts`

**깨지는 부분:**
- 모든 함수가 `token?: string`을 받아 `authHeader(token)` 헬퍼로 Authorization 헤더 구성
- token이 undefined면 헤더가 없어서 401 반환

**수정:** `authHeader()` 헬퍼 제거, `token?: string` 매개변수 제거, `axiosInstance` 사용하도록 변경

영향 함수 (16개): `fetchContract`, `fetchContracts`, `fetchUsers`, `fetchCurrentUser`, `fetchUserSignature`, `fetchSignaturesForContract`, `createContract`, `updateContract`, `signContract`, `sendContract`, `returnToAdmin`, `approveContract`, `downloadContract`, `deleteContract`, `rejectCompletedContract`, `fetchPreviousContracts`

#### `src/apis/consent/index.ts`

**깨지는 부분:**
- 모든 함수가 `token: string` (필수)를 받아 `Authorization: Bearer ${token}` 헤더 구성
- token이 undefined면 TypeScript 컴파일 에러 또는 `Bearer undefined` → 401

**수정:** 동일 패턴. `token: string` 매개변수 제거

영향 함수: `issueConsent`, `issueBatchConsents`, `getConsentList`, `getConsentDetail`, `getMyConsentList`, `getMyIssuedList`, `getConsentPermissions`, `updateConsentPermissions`, `deleteConsent`, `resendConsent`, `signConsent` 등 전체

#### `src/apis/leaveApplications/index.ts`

**깨지는 부분:**
- `withAuth(token)`, `authHeaderOnly(token)` 헬퍼 함수로 헤더 구성
- `fetch()` 직접 사용 → `withCredentials` 개념 없음 → 쿠키 미전송 → 401

**수정:** 헬퍼 함수 제거, `fetch` → `axiosInstance` 전환, token 매개변수 제거

영향 함수: 20개 이상 전체 함수

#### `src/apis/workSchedule/index.ts`

**깨지는 부분:**
- 모든 함수가 `token: string` 받아서 `Authorization: Bearer ${token}` 전송

**수정:** token 매개변수 제거, `axiosInstance` 사용

영향 함수: `fetchWorkSchedules`, `createWorkSchedule`, `getWorkScheduleById`, `updateWorkSchedule`, `deleteWorkSchedule`, `addMembersToSchedule`, `removeMemberFromSchedule`, `updateWorkEntry`, `getWorkScheduleEntries` 등

#### `src/apis/contractMemo/index.ts`

**깨지는 부분:**
- `authHeader(token?)` 헬퍼로 헤더 구성, token 없으면 헤더 없음 → 401

**수정:** `authHeader()` 헬퍼 제거, token 매개변수 제거

영향 함수: `createMemo`, `updateMemo`, `deleteMemo`, `getMyMemos`, `getUserMemos`

---

### Phase 4. 컴포넌트 파일별 깨지는 부분

#### `src/components/ProfileCompletionPopup/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 197 | `document.cookie`로 HttpOnly 쿠키 읽기 시도 | token 항상 `undefined` |
| Line 199 | `Authorization: Bearer undefined` | 서명 업로드 API 401 |
| Line 287, 289 | 동일 | 프로필 수정 API 401 |

**수정:** `document.cookie` 파싱 제거, `credentials: 'include'` 유지, `Authorization` 헤더 제거

---

#### `src/components/AdminVacationManagement/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 35-36 | token 항상 null | |
| Line 78 | `Authorization: Bearer null` | 관리자 유저 목록 로딩 실패 |
| Line 111 | 동일 | 휴가 데이터 로딩 실패 |
| Line 144 | 동일 | 휴가 재계산 실패 |
| Line 178, 208 | 동일 | 휴가 삭제/수정 실패 |

**결과:** 관리자 휴가 관리 페이지 전체 기능 불능

---

#### `src/components/EmploymentContractBoard/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 295-296 | token 항상 null | |
| Line 351 | `fetchCurrentUser(null)` → 401 | 현재 사용자 정보 로드 실패 |
| Line 447+ | axiosInstance 사용 중 (일부) | axiosInstance는 자동 쿠키 전송으로 정상 동작 가능 |

**결과:** 근로계약서 작성자 정보 로드 실패, 일부 버튼 비활성화

---

#### `src/components/ConsentWritePage/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 15-16 | token 항상 null | |
| Line 56 | `Authorization: Bearer null` | 서명 업로드 API 401 |
| Line 119 | 동일 | 동의서 서명 제출 실패 |

**결과:** 동의서 작성/서명 기능 전체 불능

---

#### `src/components/ConsentIssuePage/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 36-37 | token 항상 null | |
| Line 54 | 권한 확인 API 401 | 동의서 발송 권한 없음으로 처리 |
| Line 91, 111 | 동의서 발송 API 401 | 발송 기능 불능 |

---

#### `src/components/MyApprovalLineEditor/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 63-64 | token 항상 null | |
| Line 98 | 사용자 목록 조회 401 | 결재선 편집 화면 빈 목록 |
| Line 120, 267, 283, 312, 314 | 결재선 저장/수정/삭제 401 | 모든 결재선 편집 기능 불능 |

---

#### `src/components/MyApprovalLines/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 32-33 | token 항상 null | |
| Line 60, 88, 106, 131, 148 | Authorization Bearer null | 결재선 목록/저장/삭제 전체 401 |

**결과:** 나의 결재선 페이지 전체 기능 불능

---

#### `src/components/OrganizationChart/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 36-37 | token 항상 null | |
| Line 71, 100-101, 136 | API 401 | 조직도 사용자/부서 검색 불능 |

---

#### `src/components/WorkScheduleBoard/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 11-12 | token 항상 null | |
| Line 44, 112, 152 | API 401 | 근무표 목록 조회/생성/삭제 불능 |

---

#### `src/components/WorkScheduleEditor/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 32-33 | token 항상 null | |
| Line 113, 222, 269 | API 401 | 근무표 조회/수정/멤버 관리 불능 |

---

#### `src/components/DepartmentManagementPage/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 24-25 | token 항상 null | |
| Line 61-64, 88-99, 109-110, 140, 162-165, 192-195 | 모든 axios 호출 401 | 부서 목록/추가/수정/삭제, 직원 이동 전체 불능 |

---

#### `src/components/AdminDashBoard/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 143-144 | token 항상 null | |
| Line 159, 184, 262-264, 281-282 | API 401 | 대시보드 통계 데이터 로딩 실패 |

---

#### `src/components/UserRegistrationPage/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 13-14 | token 항상 null | |
| Line 37, 52-53, 98 | API 401 | 회원 등록/조회/수정 불능 |

---

#### `src/components/PositionManagement/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 17-18 | token 항상 null | |
| Line 39, 65-66, 72 | API 401 | 권한 조회/수정 불능 |
| Line 47-51 | 권한 없음으로 판단 → 리다이렉트 | 페이지 접근 자체 불능 |

---

#### `src/components/ConsentManagementPage/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 40-41 | token 항상 null | |
| Line 70, 89 | API 401 | 동의서 목록/상세 로딩 실패 |

---

#### `src/components/ConsentMyIssuedPage/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 34-35 | token 항상 null | |
| Line 55, 80 | API 401 | 내가 발송한 동의서 목록 조회 실패 |

---

#### `src/components/ConsentMyListPage/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 22-23 | token 항상 null | |
| Line 49, 57, 181 | API 401 | 동의서 목록/서명 기능 불능 |

---

#### `src/components/AdminContractMemoManagement/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 29-30 | token 항상 null | |
| Line 84, 101 | API 401 | 계약 메모 조회/관리 불능 |

---

#### `src/components/LeaveApplicationBoard/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 49-50 | token 항상 null | |
| Line 413 | fetch Authorization Bearer null | PDF 다운로드 실패 |
| API 함수 호출 전체 | token 인자로 null 전달 | 휴가 목록/신청/결재 전체 401 |

---

#### `src/views/Detail/MainPage/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 108-109 | token 항상 null | |
| 메모/휴가 현황 API | Bearer null 또는 token 인자로 null | 메인 대시보드 모든 데이터 로딩 실패 |

---

#### `src/views/Detail/MyPage/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 28-29 | token 항상 null | |
| Line 81, 101 | fetch Authorization Bearer null | 사용자 정보/서명 조회 실패 |
| Line 200 | 동일 | 프로필 수정 실패 |

---

#### `src/views/Detail/LeaveApplication/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| 20여 곳의 API 호출 | token null로 전달 | 휴가원 신청/조회/결재/서명 전체 기능 불능 |

---

#### `src/views/Detail/EmploymentContract/index.tsx`

| 위치 | 깨지는 이유 | 증상 |
|------|-----------|------|
| Line 783 | Authorization Bearer null | 계약서 관련 API 401 |

---

### 전체 파급 영향 요약

| 구분 | 파일 수 | 증상 |
|------|--------|------|
| 앱 진입/초기화 완전 불능 | 2 (`App.tsx`, `SideBar`) | 로그인해도 사용자 정보 없음, 메뉴 공백 |
| 페이지 전체 기능 불능 | 16개 컴포넌트·뷰 | 모든 API 401 |
| 특정 기능만 불능 | 3개 | PDF 다운로드, 서명, 프로필 수정 |
| **영향 없음** | `userCache` 표시, UI 레이아웃 | localStorage 캐시는 별개 |

> **결론: HttpOnly 쿠키 전환은 전체 앱 리팩토링에 가깝습니다. Phase 순서를 반드시 지키고, 백엔드 준비 확인 후 시작하세요.**
