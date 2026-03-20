import React, { useEffect } from 'react';
import './App.css';
import EmploymentContract from "./views/Detail/EmploymentContract";
import { Route, Routes, useNavigate } from "react-router-dom";
import SignIn from "./views/Authentication/SignIn";
import MainPage from "./views/Detail/MainPage";
import EmploymentContractBoard from "./components/EmploymentContractBoard";
import AdminDashboard from "./components/AdminDashBoard";
import LeaveApplicationBoard from "./components/LeaveApplicationBoard";
import LeaveApplication from "./views/Detail/LeaveApplication";
import MyPage from "./views/Detail/MyPage";
import AdminVacationManagement from "./components/AdminVacationManagement";
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
import UserRegistrationPage from "./components/UserRegistrationPage";
import DepartmentManagementPage from "./components/DepartmentManagementPage";
import axiosInstance from "./views/Authentication/axiosInstance";

function App() {
    const navigate = useNavigate();

    useEffect(() => {
        const initializeUser = async () => {
            // 로그인 페이지면 건너뜀
            if (window.location.pathname === '/') return;

            // 5분 이내 캐시 있으면 API 호출 생략
            const cached = localStorage.getItem('userCache');
            if (cached) {
                try {
                    const userData = JSON.parse(cached);
                    if (Date.now() - (userData.timestamp || 0) < 5 * 60 * 1000) return;
                } catch {
                    localStorage.removeItem('userCache');
                }
            }

            try {
                // 토큰 체크 없이 바로 호출 — httpOnly 쿠키가 자동으로 전송됨
                const response = await axiosInstance.get('/user/me');
                const userCache = {
                    userName: response.data.userName,
                    deptName: response.data.deptName || response.data.deptCode,
                    jobLevel: Number(response.data.jobLevel ?? response.data.joblevel ?? 0),
                    role: response.data.role,
                    permissions: response.data.permissions || [],
                    userId: response.data.userId,
                    timestamp: Date.now()
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
                <Route path="leave-application" element={<LeaveApplicationBoard/>} />
                <Route path="leave-application/view/:id" element={<LeaveApplication/>} />
                <Route path="leave-application/edit/:id" element={<LeaveApplication/>} />
                <Route path="work-schedule" element={<WorkScheduleBoard/>} />
                <Route path="work-schedule/view/:id" element={<WorkScheduleEditor/>} />
                <Route path="work-schedule/edit/:id" element={<WorkScheduleEditor/>} />
                <Route path="positions" element={<PositionManagement/>} />
                <Route path="consent/write/:agreementId" element={<ConsentWritePage/>} />
                <Route path="consent/my-list" element={<ConsentMyListPage />} />
            </Route>
            <Route path="/admin">
                <Route path="users/register" element={<UserRegistrationPage />} />
                <Route path="departments/manage" element={<DepartmentManagementPage />} />
                <Route path="dashboard" element={<AdminDashboard/>} />
                <Route path="memo-management" element={<AdminMemoManagement />} />
                <Route path="vacation" element={<AdminVacationManagement/>}/>
                <Route path="vacation-statistics" element={<AdminVacationStatistics/>} />
                <Route path="consent/management" element={<ConsentManagementPage />} />
                <Route path="consent/my-issued" element={<ConsentMyIssuedPage />} />
                <Route path="consent/issue" element={<ConsentIssuePage />} />
            </Route>
        </Routes>
    );
}

export default App;