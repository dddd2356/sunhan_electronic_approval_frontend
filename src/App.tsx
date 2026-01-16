import React from 'react';
import './App.css';
import EmploymentContract from "./views/Detail/EmploymentContract";
import {Route, Routes} from "react-router-dom";
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
import ConsentPreviewPage from "./components/ConsentPreviewPage";
import ConsentWritePage from "./components/ConsentWritePage";


function App() {
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
              <Route path="consent/preview" element={<ConsentPreviewPage/>}/>
          </Route>
    </Routes>
  );
}

export default App;