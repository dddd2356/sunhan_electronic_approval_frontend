import React, {useEffect} from 'react';
import './App.css';
import EmploymentContract from "./views/Detail/EmploymentContract";
import {Route, Routes, useNavigate} from "react-router-dom";
import SignIn from "./views/Authentication/SignIn";
import MainPage from "./views/Detail/MainPage";
import EmploymentContractBoard from "./components/EmploymentContractBoard";
import AdminDashboard from "./components/AdminDashBoard";
import LeaveApplicationBoard from "./components/LeaveApplicationBoard";
import LeaveApplication from "./views/Detail/LeaveApplication";
import MyPage from "./views/Detail/MyPage";
import AdminVacationManagement from "./components/AdminVacationManagement";
import SyncManagementDashboard from "./components/SyncManagementDashboard";
import AdminVacationStatistics from "./components/AdminVacationStatistics";
import MyApprovalLineEditor from "./components/MyApprovalLineEditor";
import MyApprovalLines from "./components/MyApprovalLines";
import WorkScheduleBoard from "./components/WorkScheduleBoard";
import WorkScheduleEditor from "./components/WorkScheduleEditor";
import PositionManagement from "./components/PositionManagement";
import AdminMemoManagement from "./components/AdminContractMemoManagement";
import ConsentIssuePage from "./components/ConsentIssuePage";
import ConsentManagementPage from "./components/ConsentManagementPage";
import ConsentMyListPage from "./components/ConsentMyListPage";
import ConsentMyIssuedPage from "./components/ConsentMyIssuedPage";
import ConsentWritePage from "./components/ConsentWritePage";
import axios from "axios";
import {useCookies} from "react-cookie";


function App() {
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;
    const navigate = useNavigate();
    const API_BASE_URL = process.env.REACT_APP_API_URL;
    // 🔥 새로고침 시 사용자 정보 복구
    useEffect(() => {
        const initializeUser = async () => {
            const token = localStorage.getItem('accessToken') || cookies.accessToken;

            if (!token) {
                console.log('⏭️ 토큰 없음 - 초기화 건너뜀');
                return;
            }

            if (window.location.pathname === '/') {
                console.log('⏭️ 로그인 페이지 - 초기화 건너뜀');
                return;
            }

            const tokenExpires = localStorage.getItem('tokenExpires');
            if (tokenExpires) {
                const expiresDate = new Date(tokenExpires);
                if (expiresDate < new Date()) {
                    console.log('⚠️ 토큰 만료 - 로그인 페이지로 이동');
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('tokenExpires');
                    localStorage.removeItem('userCache');
                    navigate('/');
                    return;
                }
            }

            // ✅ 캐시 먼저 확인 (5분 이내)
            const cached = localStorage.getItem('userCache');
            if (cached) {
                try {
                    const userData = JSON.parse(cached);
                    const cacheAge = Date.now() - (userData.timestamp || 0);

                    if (cacheAge < 5 * 60 * 1000) {
                        console.log('✅ 캐시 사용 (API 호출 생략)');
                        return; // ✅ API 호출 생략
                    }
                } catch (e) {
                    console.error('캐시 파싱 실패:', e);
                }
            }

            try {
                console.log('🔄 앱 초기화: 사용자 정보 로딩 중...');

                const response = await axios.get(`${API_BASE_URL}/user/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                console.log('✅ 사용자 정보 복구 완료:', response.data);

                const userCache = {
                    userName: response.data.userName,
                    deptName: response.data.deptName || response.data.deptCode,
                    jobLevel: Number(response.data.jobLevel ?? response.data.joblevel ?? 0),
                    role: response.data.role,
                    permissions: response.data.permissions || [],
                    userId: response.data.userId,
                    timestamp: Date.now() // ✅ 타임스탬프 추가
                };

                localStorage.setItem('userCache', JSON.stringify(userCache));
                console.log('💾 캐시 저장 완료:', userCache);

            } catch (error: any) {
                console.error('❌ 사용자 정보 로딩 실패:', error);

                if (error.response?.status === 401 || error.response?.status === 403) {
                    console.log('🔒 인증 실패 - 로그인 페이지로 이동');
                    localStorage.removeItem('userCache');
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('tokenExpires');
                    navigate('/');
                }
            }
        };

        initializeUser();
    }, []);

  return (
      <Routes>

          <Route path="/" element={<SignIn/>} />

        <Route path="/detail">
            <Route path="main-page" element={<MainPage/>} />
            <Route path="my-page" element={<MyPage/>}/>
            <Route path="approval-lines" element={<MyApprovalLines />} />
            <Route path="approval-lines/new" element={<MyApprovalLineEditor />} />
            <Route path="approval-lines/:id" element={<MyApprovalLineEditor />} />
            <Route path="employment-contract" element={<EmploymentContractBoard/>} />
            <Route path="employment-contract/view/:id" element={<EmploymentContract/>} />
            <Route path="employment-contract/edit/:id" element={<EmploymentContract/>} />
            {/* Leave Application */}
            <Route path="leave-application" element={<LeaveApplicationBoard/>} />          {/* board */}
            <Route path="leave-application/view/:id" element={<LeaveApplication/>} />      {/* view */}
            <Route path="leave-application/edit/:id" element={<LeaveApplication/>} />      {/* edit */}

            {/* ✅ 근무현황표 라우트 추가 */}
            <Route path="work-schedule" element={<WorkScheduleBoard/>} />
            <Route path="work-schedule/view/:id" element={<WorkScheduleEditor/>} />
            <Route path="work-schedule/edit/:id" element={<WorkScheduleEditor/>} />

            {/* ✅ 직책 관리 라우트 */}
            <Route path="positions" element={<PositionManagement/>} />
            {/* 동의서 작성 (대상자) */}
            <Route path="consent/write/:agreementId" element={<ConsentWritePage/>} />
            {/* 내가 받은 동의서 목록 (일반 사용자) */}
            <Route path="consent/my-list" element={<ConsentMyListPage />} />
        </Route>
          {/* ===== 관리자 페이지 라우트 추가 ===== */}
          <Route path="/admin">
              <Route path="dashboard" element={<AdminDashboard/>} />
              {/* 근로계약서 */}
              <Route path="memo-management" element={<AdminMemoManagement />} />
              <Route path="vacation" element={<AdminVacationManagement/>}/>
              <Route path="sync-management-dashboard" element={<SyncManagementDashboard/>}/>
              <Route path="vacation-statistics" element={<AdminVacationStatistics/>} />
              {/* 동의서 관리 (관리 권한 필요) */}
              <Route path="consent/management" element={<ConsentManagementPage />} />
              {/* 내가 발송한 동의서 목록 (생성 권한 보유자) */}
              <Route path="consent/my-issued" element={<ConsentMyIssuedPage />} />
              {/* 동의서 발송 (생성 권한 필요) */}
              <Route path="consent/issue" element={<ConsentIssuePage />} />
          </Route>
    </Routes>
  );
}

export default App;