import React, {useState, useEffect, useCallback, useMemo} from 'react';
import { useCookies } from 'react-cookie';
import Layout from "../Layout";
import "./style.css";
import {
    Building2,
    Shield,
    TrendingDown,
    TrendingUp,
    UserCheck,
    Users,
    X,
    Settings,
    Check,
    AlertCircle,
    Search,
    ChevronRight,
    Briefcase, AlertTriangle, Lock
} from "lucide-react";

// --- Interfaces ---
interface TestDataDeleteResult {
    success: boolean;
    message: string;
    userCount: number;
    employmentContractCount: number;
    leaveApplicationCount: number;
    leaveApplicationDayCount: number;
    leaveApplicationAttachmentCount: number;
    workScheduleCount: number;
    workScheduleEntryCount: number;
    vacationHistoryCount: number;
    consentAgreementCount: number;
    contractMemoCount: number;
    approvalProcessCount: number;
    approvalHistoryCount: number;
    deptDutyConfigCount: number;
    approvalLineCount: number;
    approvalStepCount: number;
    positionCount: number;
    userPermissionCount: number;
}

interface User {
    userId: string;
    userName: string;
    deptCode: string;
    jobLevel: string;
    role: string;
    useFlag: string;
}

interface UserListResponse {
    userDtos: User[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}

interface CurrentUserPermissions {
    userId: string;
    userName: string;
    jobLevel: string;
    role: string;
    deptCode: string;
    isAdmin: boolean;
}

interface PermissionType {
    name: string;
    displayName: string;
}

interface UserPermission {
    id: number;
    userId: string;
    permissionType: string;
    createdAt: string;
}

interface DeptPermission {
    id: number;
    deptCode: string;
    permissionType: string;
    createdAt: string;
}

interface Department {
    deptCode: string;
    deptName: string;
}

interface StatCardProps {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    change?: {
        value: number;
        type: 'positive' | 'negative';
    };
}

interface AdminStats {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    totalDepartments: number;
}

// --- Constants ---
const PERMISSION_DISPLAY_MAP: Record<string, string> = {
    'MANAGE_USERS': '회원 및 부서 관리',
    'HR_LEAVE_APPLICATION': '휴가원 관리',
    'HR_CONTRACT': '근로계약서 관리',
    'WORK_SCHEDULE_CREATE': '근무현황표 생성/작성',
    'WORK_SCHEDULE_DEPT_MANAGE': '부서 근무현황표 관리',
    'WORK_SCHEDULE_MANAGE': '근무현황표 완료 문서 관리',
    'FINAL_APPROVAL_LEAVE_APPLICATION': '휴가원 전결 승인',
    'FINAL_APPROVAL_WORK_SCHEDULE': '근무현황표 전결 승인',
    'CONSENT_CREATE': '동의서 발송 (생성)',
    'CONSENT_MANAGE': '동의서 관리 (전체 조회)',
    'FINAL_APPROVAL_ALL': '모든 문서 전결 승인',
};

const HR_PERMISSION_TYPES_LIST = [
    'MANAGE_USERS',
    'HR_CONTRACT',
    'HR_LEAVE_APPLICATION',
    'WORK_SCHEDULE_CREATE',
    'WORK_SCHEDULE_DEPT_MANAGE',
    'WORK_SCHEDULE_MANAGE',
    'FINAL_APPROVAL_LEAVE_APPLICATION',
    'FINAL_APPROVAL_WORK_SCHEDULE',
    'CONSENT_CREATE',
    'CONSENT_MANAGE',
    'FINAL_APPROVAL_ALL'
];

export const AdminDashboard: React.FC = () => {
    // ## State Management ##
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    // Test Data
    const [testAccounts, setTestAccounts] = useState<string[]>([]);
    const [showTestDataModal, setShowTestDataModal] = useState<boolean>(false);
    const [testDataLoading, setTestDataLoading] = useState<boolean>(false);
    const [testDataResult, setTestDataResult] = useState<TestDataDeleteResult | null>(null);

    // 테스트 계정 조회
    const fetchTestAccounts = async () => {
        try {
            const res = await fetch('/api/admin/test-data/accounts', {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Failed to fetch test accounts');
            const accounts = await res.json();
            setTestAccounts(accounts);
        } catch (e: any) {
            console.error('Test accounts fetch error:', e.message);
        }
    };

    // 테스트 데이터 삭제
    const handleDeleteTestData = async () => {
        if (!window.confirm(
            `⚠️ 경고: 테스트 계정(99990~99999) ${testAccounts.length}개와 관련된 모든 데이터가 삭제됩니다.\n` +
            '이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?'
        )) {
            return;
        }

        setTestDataLoading(true);
        setTestDataResult(null);

        try {
            const res = await fetch('/api/admin/test-data', {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });

            if (!res.ok) throw new Error('Failed to delete test data');

            const result: TestDataDeleteResult = await res.json();
            setTestDataResult(result);

            if (result.success) {
                alert('테스트 데이터가 성공적으로 삭제되었습니다.');
                await fetchTestAccounts(); // 목록 갱신
                await fetchStats(); // 통계 갱신
                await fetchUsers(currentPage, usersPerPage, showAllUsers, searchTerm); // 사용자 목록 갱신
            } else {
                alert(`삭제 실패: ${result.message}`);
            }
        } catch (e: any) {
            alert('테스트 데이터 삭제 중 오류가 발생했습니다.');
            console.error('Test data deletion error:', e);
        } finally {
            setTestDataLoading(false);
        }
    };

    // 모달 열기
    const handleOpenTestDataModal = async () => {
        setShowTestDataModal(true);
        setTestDataResult(null);
        await fetchTestAccounts();
    };

    const [pageGroup, setPageGroup] = useState<number>(0); // 현재 페이지 그룹 (0부터 시작)
    const pagesPerGroup = 5; // 한 그룹에 표시할 페이지 수
    const [isPageChanging, setIsPageChanging] = useState<boolean>(false);

    // Current Admin User
    const [currentUser, setCurrentUser] = useState<CurrentUserPermissions | null>(null);
    // Users Data
    const [users, setUsers] = useState<User[]>([]);
    const [showAllUsers, setShowAllUsers] = useState<boolean>(false); // Toggle inactive users
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(0); // 💡 페이지 번호를 0부터 시작하도록 변경 (Spring Data JPA 표준)
    const [totalItems, setTotalItems] = useState<number>(0); // 💡 총 항목 수 추가
    const usersPerPage = 10; // 💡 페이지 크기 변경

    // Drawer (User Detail) State
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
    const [newJobLevel, setNewJobLevel] = useState<string>('');

    // Department Modal State
    const [isDeptModalOpen, setIsDeptModalOpen] = useState<boolean>(false);
    const [selectedDeptPermission, setSelectedDeptPermission] = useState<string>('');
    const [selectedTargetDept, setSelectedTargetDept] = useState<string>('');

    // Permissions Data
    const [permissionTypes, setPermissionTypes] = useState<PermissionType[]>([]);
    const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
    const [deptPermissions, setDeptPermissions] = useState<DeptPermission[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [hrPermissionLoading, setHrPermissionLoading] = useState<boolean>(false);
    const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, activeUsers: 0, inactiveUsers: 0, totalDepartments: 0 });

    const [newPassword, setNewPassword] = useState<string>('');
    const [showPasswordSection, setShowPasswordSection] = useState<boolean>(false);

    // ## API Helpers ##
    const getAuthHeaders = useCallback(() => {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };
    }, [token]);

    // ✅ 통계 데이터 호출 함수
    const fetchStats = useCallback(async () => {
        try {
            const url = `/api/v1/admin/stats`; // 새 통계 API
            const res = await fetch(url, {
                headers: getAuthHeaders(),
            });

            if (!res.ok) throw new Error('Failed to load stats');

            const data: AdminStats = await res.json();
            setStats(data);
        } catch (e: any) {
            console.error("Failed to fetch stats:", e);
        }
    }, [getAuthHeaders]);

    // ## Data Fetching Functions ##
    const fetchUsers = useCallback(async (page: number, size: number, showAll: boolean, term: string) => {
        setError('');
        try {
            const url = `/api/v1/admin/my-department-users?page=${page}&size=${size}&showAll=${showAll}&searchTerm=${term}`;

            const res = await fetch(url, { // ✅ 수정된 url 변수 사용
                headers: getAuthHeaders(),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to load users');
            }

            const data: UserListResponse = await res.json();
            setUsers(data.userDtos);
            setTotalItems(data.totalElements); // 💡 총 항목 수 업데이트
            // setTotalPages(data.totalPages); // totalPages는 totalItems와 usersPerPage로 계산 가능
            setCurrentPage(data.number); // 💡 백엔드에서 받은 페이지 번호 업데이트
            return data.userDtos;
        } catch (e: any) {
            setError(e.message);
        } finally {
        setIsPageChanging(false); // 로딩 완료
    }
    }, [getAuthHeaders]);

    const fetchPermissionTypes = useCallback(async () => {
        try {
            const res = await fetch('/api/v1/admin/permissions/types', {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Failed to load permission types');
            const data = await res.json();

            // Filter and Sort Logic
            const priorityOrder = HR_PERMISSION_TYPES_LIST;

            const hrPermissions = data.permissionTypes
                .filter((type: string) => HR_PERMISSION_TYPES_LIST.includes(type))
                .map((type: string) => ({
                    name: type,
                    displayName: PERMISSION_DISPLAY_MAP[type] || type
                }));

            hrPermissions.sort((a: PermissionType, b: PermissionType) =>
                priorityOrder.indexOf(a.name) - priorityOrder.indexOf(b.name)
            );

            setPermissionTypes(hrPermissions);
        } catch (e: any) {
            console.error('Permission types fetch error:', e.message);
        }
    }, [getAuthHeaders]);

    const fetchUserPermissions = useCallback(async () => {
        if (!token) return;
        try {
            setHrPermissionLoading(true);

            // 💡 [개선] 단일 API 호출
            const res = await fetch('/api/v1/admin/permissions/users/all', {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Failed to load user permissions');

            const data = await res.json();
            const userPermissionMap = data.userPermissions as Record<string, string[]>;

            const groupedPermissions: UserPermission[] = Object.entries(userPermissionMap).map(([userId, permissions], index) => ({
                id: index,
                userId,
                permissionType: permissions.join(','),
                createdAt: new Date().toISOString()
            }));

            setUserPermissions(groupedPermissions);
        } catch (e: any) {
            console.error('User permissions fetch error (Unified):', e.message);
        } finally {
            setHrPermissionLoading(false);
        }
    }, [getAuthHeaders, token]);

    const fetchDeptPermissions = useCallback(async () => {
        if (!token) return;
        try {
            // 💡 [개선] 단일 API 호출
            const res = await fetch('/api/v1/admin/permissions/departments/all', {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Failed to load department permissions');

            const data = await res.json();
            const deptPermissionMap = data.deptPermissions as Record<string, string[]>;

            const groupedPermissions: DeptPermission[] = Object.entries(deptPermissionMap).map(([deptCode, permissions], index) => ({
                id: index,
                deptCode,
                permissionType: permissions.join(','),
                createdAt: new Date().toISOString()
            }));

            setDeptPermissions(groupedPermissions);
        } catch (e: any) {
            console.error('Dept permissions fetch error (Unified):', e.message);
        }
    }, [getAuthHeaders, token]);

    const fetchDepartments = useCallback(async () => {
        try {
            // ✅ 변경: 전체 활성 부서 목록 API 호출
            const res = await fetch('/api/v1/departments', {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Failed to load departments');
            const data: Department[] = await res.json();
            setDepartments(data);
        } catch (e: any) {
            console.error('Departments fetch error:', e.message);
        }
    }, [getAuthHeaders]); // ✅ users 의존성 제거

    // 5. 퇴사/복직 처리 (기존 toggleUserStatus API 사용)
    const handleToggleUserStatus = async () => {
        if (!selectedUser) return;

        const isActive = selectedUser.useFlag === '1';
        const action = isActive ? '퇴사' : '복직';

        if (!window.confirm(`${selectedUser.userName}(${selectedUser.userId})님을 ${action} 처리하시겠습니까?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/v1/admin/users/${selectedUser.userId}/toggle-status`, {
                method: 'PUT',
                headers: getAuthHeaders(),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `${action} 처리 실패`);
            }

            const data = await res.json();
            const newUseFlag = data.useFlag;

            // 로컬 상태 업데이트
            setUsers(prev => prev.map(u =>
                u.userId === selectedUser.userId ? {...u, useFlag: newUseFlag} : u
            ));
            setSelectedUser(prev => prev ? {...prev, useFlag: newUseFlag} : null);

            alert(`${action} 처리가 완료되었습니다.`);

            // 통계 새로고침
            await fetchStats();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedUser || !newPassword) {
            alert('새 비밀번호를 입력해주세요.');
            return;
        }

        if (newPassword.length < 4) {
            alert('비밀번호는 최소 4자 이상이어야 합니다.');
            return;
        }

        if (!window.confirm(`${selectedUser.userName}님의 비밀번호를 변경하시겠습니까?\n다음 로그인 시 비밀번호 변경이 필요합니다.`)) {
            return;
        }

        try {
            const res = await fetch('/api/v1/admin/reset-user-password', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    targetUserId: selectedUser.userId,
                    newPassword: newPassword
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || '비밀번호 변경 실패');
            }

            alert('비밀번호가 변경되었습니다.\n해당 사용자는 다음 로그인 시 비밀번호를 변경해야 합니다.');
            setNewPassword('');
            setShowPasswordSection(false);
        } catch (e: any) {
            alert(e.message);
        }
    };

    // ## Initialization Effect ##
    useEffect(() => {
        const initialize = async () => {
            if (!token) {
                setLoading(false);
                setError('Please log in to access the admin dashboard.');
                return;
            }

            setLoading(true);
            try {
                // 1. Verify Admin Role
                const permRes = await fetch('/api/v1/user/me/permissions', { headers: getAuthHeaders() });
                if (!permRes.ok) throw new Error('Could not verify admin permissions.');
                const permData: CurrentUserPermissions = await permRes.json();

                if (!permData.isAdmin) throw new Error('You do not have access to the admin dashboard.');

                setCurrentUser(permData);

                // 2. Load Core Data in parallel
                await Promise.all([
                    // 💡 초기 로드 시 0페이지를 요청
                    fetchUsers(0, usersPerPage, showAllUsers, searchTerm),
                    fetchPermissionTypes(),
                    fetchUserPermissions(),
                    fetchDeptPermissions(),
                    fetchDepartments()
                ]);

            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        initialize();
    }, [getAuthHeaders, token]);

    // ✅ 통계 데이터를 최초 1회만 호출하는 useEffect
    useEffect(() => {
        fetchStats();
        // 사용자 목록(fetchUsers)은 아래의 useEffect에서 처리
    }, [fetchStats]);

    useEffect(() => {
        if (!loading) {
            fetchUsers(currentPage, usersPerPage, showAllUsers, searchTerm);
        }
    }, [currentPage, showAllUsers, searchTerm, fetchUsers, loading]);

    // ## Filter & Pagination ##
    const filteredUsers = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        let usersToFilter = users;

        if (!showAllUsers) {
            usersToFilter = users.filter(user => user.useFlag === '1');
        }

        return usersToFilter.filter(user => {
            if (!lowerCaseSearchTerm) return true;
            return (
                user.userId.toLowerCase().includes(lowerCaseSearchTerm) ||
                user.userName.toLowerCase().includes(lowerCaseSearchTerm) ||
                user.deptCode.toLowerCase().includes(lowerCaseSearchTerm)
            );
        });
    }, [users, searchTerm, showAllUsers]);

    const totalPages = Math.ceil(totalItems / usersPerPage); // 💡 totalItems 기반 계산
    const paginatedUsers = users;

    const handlePageChange = (page: number) => {
        if (page >= 0 && page < totalPages && !isPageChanging) {
            setIsPageChanging(true);
            setCurrentPage(page);
            setPageGroup(Math.floor(page / pagesPerGroup));
        }
    };

    // ## Drawer & Selection Logic ##
    const handleOpenDrawer = (user: User) => {
        setSelectedUser(user);
        setNewJobLevel(user.jobLevel);
        setIsDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        setShowPasswordSection(false);
        setNewPassword('');
        setTimeout(() => setSelectedUser(null), 300);
    };

    // ## Action Handlers ##

    // 1. Job Level Update
    const handleUpdateJobLevel = async () => {
        if (!selectedUser || !newJobLevel) return;
        try {
            const res = await fetch('/api/v1/admin/update-job-level', {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({targetUserId: selectedUser.userId, newJobLevel}),
            });
            if (!res.ok) throw new Error('Failed to update job level');

            // Update local state to reflect change immediately
            setUsers(prev => prev.map(u => u.userId === selectedUser.userId ? {...u, jobLevel: newJobLevel} : u));
            setSelectedUser(prev => prev ? {...prev, jobLevel: newJobLevel} : null);
            alert('직급이 수정되었습니다.');
        } catch (e: any) {
            alert(e.message);
        }
    };

    // 2. Admin Role Toggle
    const handleToggleAdminRole = async () => {
        if (!selectedUser) return;
        const isCurrentlyAdmin = selectedUser.role === 'ADMIN';
        const endpoint = isCurrentlyAdmin ? 'revoke-admin-role' : 'grant-admin-role';

        try {
            const res = await fetch(`/api/v1/admin/${endpoint}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({targetUserId: selectedUser.userId}),
            });
            if (!res.ok) throw new Error(`Failed to ${isCurrentlyAdmin ? 'revoke' : 'grant'} admin role.`);

            const newRole = isCurrentlyAdmin ? 'USER' : 'ADMIN';
            setUsers(prev => prev.map(u => u.userId === selectedUser.userId ? {...u, role: newRole} : u));
            setSelectedUser(prev => prev ? {...prev, role: newRole} : null);
        } catch (e: any) {
            alert(e.message);
        }
    };

    // 3. HR Permission Toggle
    const handleTogglePermission = async (permType: string, isGranted: boolean) => {
        if (!selectedUser) return;
        const action = isGranted ? 'revoke' : 'grant';

        try {
            const res = await fetch(`/api/v1/admin/permissions/user/${action}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    targetUserId: selectedUser.userId,
                    permissionType: permType
                }),
            });
            if (!res.ok) throw new Error(`Failed to ${action} permission.`);

            // Refresh permissions to update UI
            await fetchUserPermissions();
        } catch (e: any) {
            alert(e.message);
        }
    };

    // 4. Department Permission Handlers
    const handleGrantDeptPermission = async () => {
        if (!selectedTargetDept || !selectedDeptPermission) {
            alert('부서와 권한 타입을 모두 선택해주세요.');
            return;
        }
        try {
            const res = await fetch('/api/v1/admin/permissions/department/grant', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ deptCode: selectedTargetDept, permissionType: selectedDeptPermission }),
            });
            if (!res.ok) throw new Error('Failed to grant department permission');

            await fetchDeptPermissions();
            setSelectedDeptPermission('');
            alert('부서 권한이 부여되었습니다.');
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleRevokeDeptPermission = async (deptCode: string, permTypesString: string) => {
        if (!window.confirm('정말 이 부서의 권한을 제거하시겠습니까?')) return;
        const types = permTypesString.split(',').map(t => t.trim()).filter(Boolean);

        try {
            for (const type of types) {
                await fetch('/api/v1/admin/permissions/department/revoke', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ deptCode, permissionType: type }),
                });
            }
            await fetchDeptPermissions();
        } catch (e: any) {
            alert(e.message);
        }
    };

    // Helper: Get active permissions list for selected user
    const selectedUserCurrentPermissions = useMemo(() => {
        if (!selectedUser) return [];
        const userPermObj = userPermissions.find(p => p.userId === selectedUser.userId);
        if (!userPermObj) return [];
        return userPermObj.permissionType.split(',').map(t => t.trim());
    }, [selectedUser, userPermissions]);


    // ## Render Components ##

    const StatCard: React.FC<StatCardProps> = ({title, value, icon, color, change}) => (
        <div className="admin-stat-card">
            <div className="admin-stat-header">
                <span className="admin-stat-title">{title}</span>
                <div className="admin-stat-icon" style={{background: `${color}20`, color: color}}>
                    {icon}
                </div>
            </div>
            <div className="admin-stat-value">{value.toLocaleString()}</div>
            {change && (
                <div className={`admin-stat-change ${change.type}`}>
                    {change.type === 'positive' ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                    <span>{Math.abs(change.value)}%</span>
                </div>
            )}
        </div>
    );

    if (loading) {
        return <Layout><div className="admin-loading-text"><div className="loading-shimmer"></div>Loading Admin Dashboard...</div></Layout>;
    }

    if (!currentUser) {
        return <Layout><div className="admin-error-display-initial">{error || 'Access Denied'}</div></Layout>;
    }

    return (
        <Layout>
            <div className="admin-dashboard-container">
                {/* Header Section */}
                <div className="admin-header-row" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    marginBottom: '2rem'
                }}>
                    <div>
                        <h1 className="admin-dashboard-title">Admin Dashboard</h1>
                        <p className="admin-welcome-message">
                            관리자: {currentUser.userName} (Level: {currentUser.jobLevel})
                        </p>
                    </div>
                    <div style={{display: 'flex', gap: '0.75rem'}}>
                        <button
                            className="admin-secondary-button"
                            onClick={handleOpenTestDataModal}
                            style={{background: '#FEF2F2', borderColor: '#FCA5A5', color: '#DC2626'}}
                        >
                            <AlertTriangle size={16}/> 테스트 데이터 관리
                        </button>
                        <button
                            className="admin-secondary-button"
                            onClick={() => setIsDeptModalOpen(true)}
                        >
                            <Building2 size={16}/> 부서 권한 관리
                        </button>
                    </div>
                </div>

                {/* Stats Section */}
                <div className="admin-stats-container">
                    <StatCard title="총 사용자 수" value={stats.totalUsers} icon={<Users className="w-6 h-6"/>}
                              color="var(--primary-600)"/>
                    <StatCard title="활성 사용자 수" value={stats.activeUsers} icon={<UserCheck className="w-6 h-6"/>}
                              color="var(--success-500)"/>
                    <StatCard title="비활성 사용자 수" value={stats.inactiveUsers} icon={<TrendingDown className="w-6 h-6"/>}
                              color="var(--warning-500)"/>
                    <StatCard title="총 부서 수" value={stats.totalDepartments} icon={<Building2 className="w-6 h-6"/>}
                              color="var(--secondary-600)"/>
                </div>

                {/* Main Content (Table & Controls) */}
                <div className="admin-content-wrapper">
                    {/* Controls */}
                    <div className="admin-controls-section">
                        <div className="admin-search-section" style={{flex: 1, marginBottom: 0}}>
                            <div style={{position: 'relative', width: '100%', maxWidth: '400px'}}>
                                <Search size={18} style={{
                                    position: 'absolute',
                                    left: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#9CA3AF'
                                }}/>
                                <input
                                    type="text"
                                    placeholder="Search user, ID, or department..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="admin-search-input"
                                    style={{paddingLeft: '40px'}}
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAllUsers(!showAllUsers)}
                            className={`admin-toggle-button ${showAllUsers ? 'active' : ''}`}
                        >
                            {showAllUsers ? '재직자만 보기' : '전체 보기 (퇴사자 포함)'}
                        </button>
                    </div>

                    {/* Users Table */}
                    <div className="admin-table-container">
                        <table className="admin-user-table">
                            <thead className="admin-table-header">
                            <tr>
                                <th>User Info</th>
                                <th>Department</th>
                                <th>Level</th>
                                <th>Status</th>
                                <th>Role</th>
                                <th>Action</th>
                            </tr>
                            </thead>
                            <tbody className="admin-table-body">
                            {paginatedUsers.length > 0 ? (
                                paginatedUsers.map(user => (
                                    <tr
                                        key={user.userId}
                                        className="admin-table-row clickable-row"
                                        onClick={() => handleOpenDrawer(user)}
                                    >
                                        <td className="admin-table-cell" style={{textAlign: 'left'}}>
                                            <div className="user-info-cell">
                                                <span className="user-name">{user.userName}</span>
                                                <span className="user-id">{user.userId}</span>
                                            </div>
                                        </td>
                                        <td className="admin-table-cell">{user.deptCode.replace(/\d+$/, '')}</td>
                                        <td className="admin-table-cell">
                                            <span className="badge-level">Lv.{user.jobLevel}</span>
                                        </td>
                                        <td className="admin-table-cell">
                                            <span
                                                className={`status-dot ${user.useFlag === '1' ? 'active' : 'inactive'}`}></span>
                                            {user.useFlag === '1' ? 'Active' : 'Left'}
                                        </td>
                                        <td className="admin-table-cell">
                                            {user.role === 'ADMIN' ?
                                                <span className="badge-admin">ADMIN</span> :
                                                <span className="badge-user">USER</span>
                                            }
                                        </td>
                                        <td className="admin-table-cell">
                                            <button className="btn-manage">관리 <ChevronRight size={14}/></button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="admin-table-cell admin-no-results">검색 결과가 없습니다.</td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="admin-pagination-controls">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 0 || isPageChanging}
                                className="admin-pagination-button"
                            >
                                Prev
                            </button>

                            {(() => {
                                const startPage = pageGroup * pagesPerGroup;
                                const endPage = Math.min(startPage + pagesPerGroup, totalPages);
                                const pages = [];

                                for (let i = startPage; i < endPage; i++) {
                                    pages.push(
                                        <button
                                            key={i}
                                            onClick={() => handlePageChange(i)}
                                            disabled={isPageChanging}
                                            className={`admin-pagination-button ${currentPage === i ? 'active' : ''}`}
                                        >
                                            {i + 1}
                                        </button>
                                    );
                                }

                                return pages;
                            })()}

                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages - 1 || isPageChanging}
                                className="admin-pagination-button"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>

                {/* ==========================================
                   RIGHT SIDE DRAWER (User Details)
                   ========================================== */}
                <div
                    className={`admin-drawer-overlay ${isDrawerOpen ? 'open' : ''}`}
                    onClick={handleCloseDrawer}
                ></div>

                <div className={`admin-drawer ${isDrawerOpen ? 'open' : ''}`}>
                    {selectedUser && (
                        <div className="drawer-content"
                             style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                            {/* Drawer Header */}
                            <div className="drawer-header">
                                <h2>사용자 상세 관리</h2>
                                <button onClick={handleCloseDrawer} className="btn-close"><X size={20}/></button>
                            </div>

                            {/* Drawer Body */}
                            <div className="drawer-body">
                                {/* Profile Section */}
                                <div className="drawer-section ad-profile-section">
                                    <div className="profile-avatar-placeholder">
                                        {selectedUser.userName.charAt(0)}
                                    </div>
                                    <div className="profile-details">
                                        <h3>{selectedUser.userName}</h3>
                                        <p>{selectedUser.userId}</p>
                                        <p style={{fontSize: '0.8rem', color: '#6B7280'}}>
                                            {selectedUser.deptCode} • {selectedUser.useFlag === '1' ? '재직중' : '퇴사'}
                                        </p>
                                    </div>
                                </div>

                                {/* ✅ 퇴사/복직 처리 버튼 추가 */}
                                <div className="retire-section" style={{marginTop: '1.5rem'}}>
                                    <button
                                        onClick={handleToggleUserStatus}
                                        className={`btn-retire ${selectedUser.useFlag === '1' ? 'retire' : 'reactivate'}`}
                                    >
                                        {selectedUser.useFlag === '1' ? '🚪 퇴사 처리' : '✅ 복직 처리'}
                                    </button>
                                    <p style={{
                                        fontSize: '0.75rem',
                                        color: '#6b7280',
                                        marginTop: '0.5rem',
                                        lineHeight: '1.4'
                                    }}>
                                        {selectedUser.useFlag === '1'
                                            ? '퇴사 처리 시 시스템 접근이 차단됩니다.'
                                            : '복직 처리 시 시스템 접근이 복구됩니다.'}
                                    </p>
                                </div>

                                {/* ✅ 시스템 관리자는 권한 관리 UI 숨김 */}
                                {selectedUser.deptCode === '000' ? (
                                    <div className="drawer-section">
                                        <div style={{
                                            padding: '2rem',
                                            textAlign: 'center',
                                            background: '#f0f9ff',
                                            borderRadius: '8px',
                                            border: '1px solid #3b82f6'
                                        }}>
                                            <Shield size={48} style={{color: '#3b82f6', marginBottom: '1rem'}}/>
                                            <h4 style={{color: '#1e40af', marginBottom: '0.5rem'}}>시스템 관리자 계정</h4>
                                            <p style={{color: '#6b7280', fontSize: '0.875rem'}}>
                                                이 계정은 모든 권한을 자동으로 보유하며,<br/>
                                                권한 수정이 불가능합니다.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* 기본 설정 */}
                                        <div className="drawer-section">
                                            <h4 className="section-title">기본 설정</h4>

                                            {/* Job Level */}
                                            <div className="form-group" style={{marginBottom: '1rem'}}>
                                                <label style={{
                                                    display: 'block',
                                                    marginBottom: '4px',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 600
                                                }}>
                                                    직급 (Job Level)
                                                </label>
                                                <div className="input-with-button">
                                                    <input
                                                        type="number"
                                                        min="0" max="6"
                                                        value={newJobLevel}
                                                        onChange={(e) => setNewJobLevel(e.target.value)}
                                                    />
                                                    <button onClick={handleUpdateJobLevel}
                                                            className="btn-save-mini">저장
                                                    </button>
                                                </div>
                                            </div>

                                            {currentUser?.jobLevel === '6' && (
                                                <div
                                                    className={`password-reset-zone ${showPasswordSection ? 'active' : ''}`}>
                                                    {/* 헤더 영역 */}
                                                    <div className="password-header">
                                                        <div className="password-label">
                                                            <Lock size={16}/>
                                                            <span>비밀번호 재설정 (최고관리자)</span>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setShowPasswordSection(!showPasswordSection);
                                                                setNewPassword(''); // 닫을 때 입력값 초기화
                                                            }}
                                                            className={`btn-toggle-danger ${showPasswordSection ? 'cancel' : ''}`}
                                                        >
                                                            {showPasswordSection ? '취소' : '변경하기'}
                                                        </button>
                                                    </div>

                                                    {/* 폼 영역 (토글 시 표시) */}
                                                    {showPasswordSection && (
                                                        <div className="password-form-container">
                                                            <input
                                                                type="text" // 비밀번호 확인을 위해 text로 두거나 password로 변경 가능
                                                                placeholder="새 비밀번호 입력 (4자 이상)"
                                                                value={newPassword}
                                                                onChange={(e) => setNewPassword(e.target.value)}
                                                                className="password-input"
                                                                autoFocus
                                                            />

                                                            <button
                                                                onClick={handleResetPassword}
                                                                className="btn-submit-danger"
                                                            >
                                                                비밀번호 변경 실행
                                                            </button>

                                                            <div className="password-warning">
                                                                <AlertTriangle size={14} style={{
                                                                    minWidth: '14px',
                                                                    marginTop: '2px'
                                                                }}/>
                                                                <span>
                                                                비밀번호 변경 시 해당 사용자는 다음 로그인 직후<br/>
                                                                반드시 비밀번호를 다시 변경해야 합니다.
                                                            </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Admin Role */}
                                            <div className="permission-item" style={{marginTop: '1rem'}}>
                                                <div className="perm-info">
                                                    <span className="perm-name">시스템 관리자 (Admin)</span>
                                                    <span className="perm-code">전체 시스템 접근 권한</span>
                                                </div>
                                                <label className="toggle-switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUser.role === 'ADMIN'}
                                                        onChange={handleToggleAdminRole}
                                                    />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="drawer-divider"></div>

                                        {/* HR Permissions */}
                                        <div className="drawer-section">
                                            <h4 className="section-title">HR 접근 권한</h4>
                                            <p className="section-desc">
                                                해당 사용자에게 부여할 개별 HR 시스템 권한을 설정하세요.
                                            </p>

                                            <div className="permission-list">
                                                {permissionTypes.map(perm => {
                                                    const isGranted = selectedUserCurrentPermissions.includes(perm.name);
                                                    return (
                                                        <div key={perm.name} className="permission-item">
                                                            <div className="perm-info">
                                                                <span className="perm-name">{perm.displayName}</span>
                                                                <span className="perm-code">{perm.name}</span>
                                                            </div>
                                                            <label className="toggle-switch">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isGranted}
                                                                    onChange={() => handleTogglePermission(perm.name, isGranted)}
                                                                />
                                                                <span className="slider round"></span>
                                                            </label>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ==========================================
                   DEPARTMENT PERMISSION MODAL
                   ========================================== */}
                {isDeptModalOpen && (
                    <div className="admin-modal-overlay">
                        <div className="admin-modal-content" style={{maxWidth: '600px', width: '95%'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem'}}>
                                <h2 className="admin-modal-title" style={{margin: 0, fontSize: '1.25rem'}}>부서 권한 관리</h2>
                                <button onClick={() => setIsDeptModalOpen(false)}
                                        style={{background: 'none', border: 'none', cursor: 'pointer'}}>
                                    <X size={24}/>
                                </button>
                            </div>

                            {/* Add Permission Form */}
                            <div className="hr-permission-form-section"
                                 style={{padding: '1rem', marginBottom: '1.5rem'}}>
                                <h3 style={{fontSize: '1rem', marginBottom: '1rem'}}>새 권한 추가</h3>
                                <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                                    <select
                                        className="form-select" style={{flex: 1}}
                                        value={selectedTargetDept}
                                        onChange={(e) => setSelectedTargetDept(e.target.value)}
                                    >
                                        <option value="">부서 선택</option>
                                        {departments.map(d => (
                                            <option key={d.deptCode} value={d.deptCode}>{d.deptName}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="form-select" style={{flex: 1}}
                                        value={selectedDeptPermission}
                                        onChange={(e) => setSelectedDeptPermission(e.target.value)}
                                    >
                                        <option value="">권한 선택</option>
                                        {permissionTypes.map(p => (
                                            <option key={p.name} value={p.name}>{p.displayName}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleGrantDeptPermission}
                                        className="submit-button"
                                        style={{height: '42px'}}
                                    >
                                        추가
                                    </button>
                                </div>
                            </div>

                            {/* Existing Permissions List */}
                            <div className="permissions-table-container"
                                 style={{maxHeight: '300px', overflowY: 'auto'}}>
                                <table className="permissions-table">
                                    <thead>
                                    <tr>
                                        <th>부서</th>
                                        <th>보유 권한</th>
                                        <th>관리</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {deptPermissions.length > 0 ? (
                                        deptPermissions.map((dp, idx) => (
                                            <tr key={idx}>
                                                <td>{dp.deptCode.replace(/\d+$/, '')}</td>
                                                <td style={{fontSize: '0.8rem'}}>
                                                    {dp.permissionType.split(',').map(t => PERMISSION_DISPLAY_MAP[t.trim()] || t).join(', ')}
                                                </td>
                                                <td>
                                                    <button
                                                        className="remove-permission-button"
                                                        onClick={() => handleRevokeDeptPermission(dp.deptCode, dp.permissionType)}
                                                    >
                                                        전체 삭제
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="no-data">등록된 부서 권한이 없습니다.</td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==========================================
                   TEST DATA MANAGEMENT MODAL
                   ========================================== */}
                {showTestDataModal && (
                    <div className="admin-modal-overlay">
                        <div className="admin-modal-content" style={{maxWidth: '700px', width: '95%'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem'}}>
                                <h2 className="admin-modal-title" style={{margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                    <AlertTriangle size={24} color="#DC2626" />
                                    테스트 데이터 관리
                                </h2>
                                <button onClick={() => setShowTestDataModal(false)}
                                        style={{background: 'none', border: 'none', cursor: 'pointer'}}>
                                    <X size={24}/>
                                </button>
                            </div>

                            {/* 테스트 계정 정보 */}
                            <div style={{
                                padding: '1rem',
                                background: '#FFF7ED',
                                borderRadius: '8px',
                                marginBottom: '1.5rem',
                                border: '1px solid #FED7AA'
                            }}>
                                <p style={{margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#9A3412', fontWeight: 600}}>
                                    현재 테스트 계정: {testAccounts.length}개
                                </p>
                                {testAccounts.length > 0 && (
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: '#78350F',
                                        fontFamily: 'monospace',
                                        padding: '0.5rem',
                                        background: '#FFFBEB',
                                        borderRadius: '4px',
                                        maxHeight: '100px',
                                        overflowY: 'auto'
                                    }}>
                                        {testAccounts.join(', ')}
                                    </div>
                                )}
                            </div>

                            {/* 경고 메시지 */}
                            <div style={{
                                padding: '1rem',
                                background: '#FEF2F2',
                                borderRadius: '8px',
                                marginBottom: '1.5rem',
                                border: '1px solid #FECACA'
                            }}>
                                <h4 style={{margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#991B1B', fontWeight: 700}}>
                                    ⚠️ 다음 데이터가 삭제됩니다:
                                </h4>
                                <ul style={{margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#7F1D1D', lineHeight: '1.6'}}>
                                    <li>사용자 정보 및 권한</li>
                                    <li>근로계약서</li>
                                    <li>휴가신청서 및 첨부파일</li>
                                    <li>근무현황표 및 상세 데이터</li>
                                    <li>연차 이력</li>
                                    <li>동의서</li>
                                    <li>결재라인, 결재 프로세스 및 이력</li>
                                    <li>직책 및 기타 관련 데이터</li>
                                </ul>
                            </div>

                            {/* 삭제 버튼 */}
                            <button
                                onClick={handleDeleteTestData}
                                disabled={testDataLoading || testAccounts.length === 0}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    background: testDataLoading || testAccounts.length === 0 ? '#D1D5DB' : 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.9375rem',
                                    fontWeight: 700,
                                    cursor: testDataLoading || testAccounts.length === 0 ? 'not-allowed' : 'pointer',
                                    marginBottom: '1rem'
                                }}
                            >
                                {testDataLoading ? '삭제 중...' : `🗑️ 테스트 데이터 삭제 (${testAccounts.length}개)`}
                            </button>

                            {/* 삭제 결과 */}
                            {testDataResult && (
                                <div style={{
                                    padding: '1rem',
                                    background: testDataResult.success ? '#F0FDF4' : '#FEF2F2',
                                    border: `1px solid ${testDataResult.success ? '#BBF7D0' : '#FECACA'}`,
                                    borderRadius: '8px',
                                    marginTop: '1rem'
                                }}>
                                    <h4 style={{
                                        margin: '0 0 0.75rem 0',
                                        fontSize: '0.9rem',
                                        color: testDataResult.success ? '#15803D' : '#991B1B',
                                        fontWeight: 700
                                    }}>
                                        {testDataResult.success ? '✅ ' : '❌ '}{testDataResult.message}
                                    </h4>
                                    {testDataResult.success && (
                                        <div style={{fontSize: '0.75rem', color: '#166534', lineHeight: '1.5'}}>
                                            <p style={{margin: '0 0 0.5rem 0', fontWeight: 600}}>
                                                총 삭제: {
                                                testDataResult.userCount +
                                                testDataResult.employmentContractCount +
                                                testDataResult.leaveApplicationCount +
                                                testDataResult.leaveApplicationDayCount +
                                                testDataResult.leaveApplicationAttachmentCount +
                                                testDataResult.workScheduleCount +
                                                testDataResult.workScheduleEntryCount +
                                                testDataResult.vacationHistoryCount +
                                                testDataResult.consentAgreementCount +
                                                testDataResult.contractMemoCount +
                                                testDataResult.approvalProcessCount +
                                                testDataResult.approvalHistoryCount +
                                                testDataResult.deptDutyConfigCount +
                                                testDataResult.approvalLineCount +
                                                testDataResult.approvalStepCount +
                                                testDataResult.positionCount +
                                                testDataResult.userPermissionCount
                                            }건
                                            </p>
                                            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem'}}>
                                                <span>• 사용자: {testDataResult.userCount}개</span>
                                                <span>• 권한: {testDataResult.userPermissionCount}개</span>
                                                <span>• 근로계약서: {testDataResult.employmentContractCount}개</span>
                                                <span>• 휴가신청서: {testDataResult.leaveApplicationCount}개</span>
                                                <span>• 휴가 상세: {testDataResult.leaveApplicationDayCount}개</span>
                                                <span>• 첨부파일: {testDataResult.leaveApplicationAttachmentCount}개</span>
                                                <span>• 근무현황표: {testDataResult.workScheduleCount}개</span>
                                                <span>• 근무 상세: {testDataResult.workScheduleEntryCount}개</span>
                                                <span>• 연차 이력: {testDataResult.vacationHistoryCount}개</span>
                                                <span>• 동의서: {testDataResult.consentAgreementCount}개</span>
                                                <span>• 메모: {testDataResult.contractMemoCount}개</span>
                                                <span>• 결재라인: {testDataResult.approvalLineCount}개</span>
                                                <span>• 결재 단계: {testDataResult.approvalStepCount}개</span>
                                                <span>• 결재 프로세스: {testDataResult.approvalProcessCount}개</span>
                                                <span>• 결재 이력: {testDataResult.approvalHistoryCount}개</span>
                                                <span>• 당직 설정: {testDataResult.deptDutyConfigCount}개</span>
                                                <span>• 직책: {testDataResult.positionCount}개</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default AdminDashboard;