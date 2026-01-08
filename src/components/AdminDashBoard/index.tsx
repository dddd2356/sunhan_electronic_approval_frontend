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
    Briefcase
} from "lucide-react";

// --- Interfaces ---
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
    'HR_LEAVE_APPLICATION': '휴가원 관리',
    'HR_CONTRACT': '근로계약서 관리',
    'WORK_SCHEDULE_CREATE': '근무현황표 생성/작성',
    'WORK_SCHEDULE_MANAGE': '근무현황표 완료 문서 관리',
    'FINAL_APPROVAL_LEAVE_APPLICATION': '휴가원 전결 승인',
    'FINAL_APPROVAL_WORK_SCHEDULE': '근무현황표 전결 승인',
    'FINAL_APPROVAL_ALL': '모든 문서 전결 승인',
};

const HR_PERMISSION_TYPES_LIST = [
    'HR_CONTRACT',
    'HR_LEAVE_APPLICATION',
    'WORK_SCHEDULE_CREATE',
    'WORK_SCHEDULE_MANAGE',
    'FINAL_APPROVAL_LEAVE_APPLICATION',
    'FINAL_APPROVAL_WORK_SCHEDULE',
    'FINAL_APPROVAL_ALL'
];

export const AdminDashboard: React.FC = () => {
    // ## State Management ##
    const [cookies] = useCookies(['accessToken']);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

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

    // ## API Helpers ##
    const getAuthHeaders = useCallback(() => {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cookies.accessToken}`,
        };
    }, [cookies.accessToken]);

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
        if (!cookies.accessToken) return;
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
    }, [getAuthHeaders, cookies.accessToken]);

    const fetchDeptPermissions = useCallback(async () => {
        if (!cookies.accessToken) return;
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
    }, [getAuthHeaders, cookies.accessToken]);

    const fetchDepartments = useCallback(async () => {
        try {
            const uniqueDeptsSet = new Set(users.map(user => user.deptCode.replace(/\d+$/, '')));
            const uniqueDepts = Array.from(uniqueDeptsSet);
            const depts: Department[] = uniqueDepts.map(base => ({
                deptCode: base,
                deptName: base
            }));
            setDepartments(depts);
        } catch (e: any) {
            console.error('Departments fetch error:', e.message);
        }
    }, [users]);

    // ## Initialization Effect ##
    useEffect(() => {
        const initialize = async () => {
            if (!cookies.accessToken) {
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
                    fetchDeptPermissions()
                ]);

            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        initialize();
    }, [getAuthHeaders, cookies.accessToken]);

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

    // Load departments once users are loaded
    useEffect(() => {
        if (users.length > 0) {
            fetchDepartments();
        }
    }, [users, fetchDepartments]);


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
        if (page >= 0 && page < totalPages) {
            setCurrentPage(page);
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
        setTimeout(() => setSelectedUser(null), 300); // Wait for animation
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
                <div className="admin-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                    <div>
                        <h1 className="admin-dashboard-title">Admin Dashboard</h1>
                        <p className="admin-welcome-message">
                            관리자: {currentUser.userName} (Level: {currentUser.jobLevel})
                        </p>
                    </div>
                    <button
                        className="admin-secondary-button"
                        onClick={() => setIsDeptModalOpen(true)}
                    >
                        <Building2 size={16} /> 부서 권한 관리
                    </button>
                </div>

                {/* Stats Section */}
                <div className="admin-stats-container">
                    <StatCard title="총 사용자 수" value={stats.totalUsers} icon={<Users className="w-6 h-6"/>} color="var(--primary-600)"/>
                    <StatCard title="활성 사용자 수" value={stats.activeUsers} icon={<UserCheck className="w-6 h-6"/>} color="var(--success-500)"/>
                    <StatCard title="비활성 사용자 수" value={stats.inactiveUsers} icon={<TrendingDown className="w-6 h-6"/>} color="var(--warning-500)"/>
                    <StatCard title="총 부서 수" value={stats.totalDepartments} icon={<Building2 className="w-6 h-6"/>} color="var(--secondary-600)"/>
                </div>

                {/* Main Content (Table & Controls) */}
                <div className="admin-content-wrapper">
                    {/* Controls */}
                    <div className="admin-controls-section">
                        <div className="admin-search-section" style={{ flex: 1, marginBottom: 0 }}>
                            <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                <input
                                    type="text"
                                    placeholder="Search user, ID, or department..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="admin-search-input"
                                    style={{ paddingLeft: '40px' }}
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
                                        <td className="admin-table-cell" style={{ textAlign: 'left' }}>
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
                                            <span className={`status-dot ${user.useFlag === '1' ? 'active' : 'inactive'}`}></span>
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

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="admin-pagination-controls">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 0}
                                className="admin-pagination-button"
                            >
                                Prev
                            </button>
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i} // 💡 key를 0부터 시작하는 인덱스로 사용
                                    onClick={() => handlePageChange(i)}
                                    className={`admin-pagination-button ${currentPage === i ? 'active' : ''}`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages - 1}
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
            </div>
        </Layout>
    );
};

export default AdminDashboard;