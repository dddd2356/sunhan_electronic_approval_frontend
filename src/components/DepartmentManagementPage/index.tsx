import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import axios from 'axios';
import Layout from '../Layout';
import './style.css';
// ✅ 필요한 아이콘 추가 Import
import { X, Plus, Trash2, Users, AlertCircle, CheckCircle, Briefcase } from 'lucide-react';

interface Department {
    deptCode: string;
    deptName: string;
    useFlag: string;
}

interface User {
    userId: string;
    userName: string;
    jobLevel: string;
    jobType: string;
    deptCode: string;
}

export const DepartmentManagementPage: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;
    const API_BASE_URL = process.env.REACT_APP_API_URL;
    const [showInactive, setShowInactive] = useState<boolean>(false);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    const [isMembersModalOpen, setIsMembersModalOpen] = useState<boolean>(false);
    const [selectedDept, setSelectedDept] = useState<Department | null>(null);
    const [deptUsers, setDeptUsers] = useState<User[]>([]);

    const [newDeptCode, setNewDeptCode] = useState('');
    const [newDeptName, setNewDeptName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDepartments();
        fetchAllUsers();
    }, [showInactive]);

    const fetchDepartments = async () => {
        try {
            // ✅ showInactive에 따라 다른 API 호출
            const endpoint = showInactive
                ? `${API_BASE_URL}/departments/all`
                : `${API_BASE_URL}/departments`;

            const response = await axios.get(endpoint, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDepartments(response.data);
        } catch (err) {
            console.error('부서 목록 조회 실패', err);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/user/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllUsers(response.data);
        } catch (err) {
            console.error('사용자 목록 조회 실패', err);
        }
    };

    const fetchDepartmentUsers = async (deptCode: string) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/departments/${deptCode}/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDeptUsers(response.data);
        } catch (err) {
            console.error('부서 사용자 조회 실패', err);
        }
    };

    const handleOpenMembersModal = (dept: Department) => {
        setSelectedDept(dept);
        setIsMembersModalOpen(true);
        fetchDepartmentUsers(dept.deptCode);
    };

    const handleCloseMembersModal = () => {
        setIsMembersModalOpen(false);
        setSelectedDept(null);
        setDeptUsers([]);
    };

    const handleCreateDept = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            await axios.post(
                `${API_BASE_URL}/departments`,
                { deptCode: newDeptCode, deptName: newDeptName },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSuccess('성공적으로 부서가 생성되었습니다.');
            setNewDeptCode('');
            setNewDeptName('');
            fetchDepartments();
        } catch (err: any) {
            setError(err.response?.data?.error || '부서 생성 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // ✅ 삭제 함수 제거 후 토글 함수로 교체
    const handleToggleDeptStatus = async (dept: Department) => {
        const isActive = dept.useFlag === '1';
        const action = isActive ? '비활성화' : '활성화';

        if (!window.confirm(`'${dept.deptName}' 부서를 ${action}하시겠습니까?`)) return;

        try {
            await axios.put(
                `${API_BASE_URL}/departments/${dept.deptCode}/toggle`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSuccess(`부서가 ${action}되었습니다.`);
            fetchDepartments();

            if (selectedDept?.deptCode === dept.deptCode) {
                handleCloseMembersModal();
            }
        } catch (err: any) {
            setError(err.response?.data?.error || `부서 ${action}에 실패했습니다.`);
        }
    };

    const handleMoveUser = async (userId: string, targetDeptCode: string) => {
        if (!targetDeptCode) return; // 선택 취소나 빈 값인 경우

        const user = allUsers.find(u => u.userId === userId);
        if (!user) return;

        const targetDeptName = departments.find(d => d.deptCode === targetDeptCode)?.deptName;

        if (!window.confirm(`${user.userName}님을 [${targetDeptName}] 부서로 이동하시겠습니까?`)) {
            return;
        }

        try {
            await axios.put(
                `${API_BASE_URL}/admin/users/${userId}/department`,
                { deptCode: targetDeptCode },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert(`${user.userName}님이 이동되었습니다.`);
            fetchAllUsers();

            // 모달 데이터 갱신
            if (selectedDept) {
                fetchDepartmentUsers(selectedDept.deptCode);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || '부서 이동에 실패했습니다.');
        }
    };

    return (
        <Layout>
            <div className="dm-container">
                {/* Header */}
                <div className="dm-header">
                    <div>
                        <h1 className="dm-title">부서 관리</h1>
                        <p className="dm-subtitle">조직 구조를 관리하고 부서별 구성원을 배치합니다.</p>
                    </div>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="dm-alert error">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="dm-alert success">
                        <CheckCircle size={20} />
                        <span>{success}</span>
                    </div>
                )}

                {/* Main Card */}
                <div className="dm-card">
                    {/* Toolbar / Create Form */}
                    <div className="dm-toolbar">
                        <h2 className="dm-toolbar-title">부서 목록 ({departments.length})</h2>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <button
                                onClick={() => setShowInactive(!showInactive)}
                                className={`dm-toggle-btn ${showInactive ? 'active' : ''}`}
                            >
                                {showInactive ? '활성 부서만' : '전체 보기'}
                            </button>
                            <form onSubmit={handleCreateDept} className="dm-form-inline">
                                <input
                                    className="dm-input"
                                    type="text"
                                    placeholder="부서 코드 (예: DEV)"
                                    value={newDeptCode}
                                    onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
                                    required
                                    disabled={loading}
                                />
                                <input
                                    className="dm-input"
                                    type="text"
                                    placeholder="부서명 (예: 개발팀)"
                                    value={newDeptName}
                                    onChange={(e) => setNewDeptName(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                                <button type="submit" className="dm-btn dm-btn-primary" disabled={loading}>
                                    <Plus size={18}/>
                                    {loading ? '생성 중' : '신규 생성'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Department Table */}
                    <div className="dm-table-wrapper">
                        <table className="dm-table">
                            <thead>
                            <tr>
                                <th style={{width: '150px'}}>부서 코드</th>
                                <th>부서 이름</th>
                                <th style={{width: '80px'}}>상태</th>
                                <th style={{width: '200px', textAlign: 'right'}}>관리</th>
                            </tr>
                            </thead>
                            <tbody>
                            {departments.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="dm-empty-state">
                                        등록된 부서가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                departments.map((dept) => (
                                    <tr key={dept.deptCode} className={dept.useFlag === '0' ? 'dm-inactive-row' : ''}>
                                        <td data-label="부서 코드">
                                            <span className="dm-badge">{dept.deptCode}</span>
                                        </td>
                                        <td data-label="부서 이름" style={{fontWeight: 500}}>{dept.deptName}</td>
                                        <td data-label="상태">
            <span className={`dm-status-badge ${dept.useFlag === '1' ? 'active' : 'inactive'}`}>
                {dept.useFlag === '1' ? '활성' : '비활성'}
            </span>
                                        </td>
                                        <td>
                                            <div className="dm-action-group" style={{justifyContent: 'flex-end'}}>
                                                <button
                                                    onClick={() => handleOpenMembersModal(dept)}
                                                    className="dm-btn-icon"
                                                    title="구성원 관리"
                                                    disabled={dept.useFlag === '0'}
                                                >
                                                    <Users size={18}/>
                                                    <span style={{marginLeft: 6, fontSize: 13}}>구성원</span>
                                                </button>
                                                <button
                                                    onClick={() => handleToggleDeptStatus(dept)}
                                                    className={`dm-btn-icon ${dept.useFlag === '1' ? 'danger' : 'success'}`}
                                                    title={dept.useFlag === '1' ? '비활성화' : '활성화'}
                                                >
                                                    {dept.useFlag === '1' ? <Trash2 size={18}/> : <CheckCircle size={18}/>}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Members Modal */}
                {isMembersModalOpen && selectedDept && (
                    <div className="dm-modal-overlay" onClick={handleCloseMembersModal}>
                        <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="dm-modal-header">
                                <h2 className="dm-modal-title">
                                    <Briefcase size={20} className="text-gray-500"/>
                                    <span>{selectedDept.deptName}</span>
                                    <span className="dm-badge" style={{marginLeft: 8}}>{selectedDept.deptCode}</span>
                                </h2>
                                <button onClick={handleCloseMembersModal} className="dm-modal-close">
                                    <X size={24}/>
                                </button>
                            </div>

                            <div className="dm-modal-body">
                                <table className="dm-table dm-modal-table">
                                    <thead>
                                    <tr>
                                        <th>사원정보</th>
                                        <th>현재 직급</th>
                                        <th>부서 이동</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {deptUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="dm-empty-state">
                                                소속된 구성원이 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        deptUsers.map((user) => (
                                            <tr key={user.userId}>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>{user.userName}</div>
                                                    <div style={{ fontSize: 12, color: '#64748b' }}>{user.userId}</div>
                                                </td>
                                                <td>
                                                        <span style={{ fontSize: 13, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                                                            Lv.{user.jobLevel}
                                                        </span>
                                                </td>
                                                <td>
                                                    <select
                                                        className="dm-select-sm"
                                                        onChange={(e) => handleMoveUser(user.userId, e.target.value)}
                                                        defaultValue=""
                                                    >
                                                        <option value="" disabled>이동할 부서 선택</option>
                                                        {departments
                                                            .filter(d => d.deptCode !== selectedDept.deptCode && d.useFlag === '1')
                                                            .map(dept => (
                                                                <option key={dept.deptCode} value={dept.deptCode}>
                                                                    {dept.deptName}
                                                                </option>
                                                            ))
                                                        }
                                                    </select>
                                                </td>
                                            </tr>
                                        ))
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

export default DepartmentManagementPage;