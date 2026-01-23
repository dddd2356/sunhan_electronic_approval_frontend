import React, { useState, useEffect, useMemo } from 'react';
import { useCookies } from 'react-cookie';
import Layout from '../../components/Layout';
import { getUserMemos, createMemo, updateMemo, deleteMemo, ContractMemo } from '../../apis/contractMemo';
import './style.css';
import { fetchCurrentUser } from "../../apis/contract";
import OrganizationChart from "../OrganizationChart";
import {
    Search, User as UserIcon, Save, Edit2, Trash2,
    X, FolderOpen, ArrowUpDown, Calendar, CheckCircle2
} from 'lucide-react';

interface User {
    userId: string;
    userName: string;
    deptCode?: string;
    jobLevel?: string;
}

// 스켈레톤 로더 컴포넌트 (CSS cm-skeleton 활용)
const MemoSkeleton = () => (
    <div className="cm-skeleton cm-skeleton-memo">
        <div className="cm-skeleton-line short"></div>
        <div className="cm-skeleton-line medium"></div>
    </div>
);

const AdminMemoManagement: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;

    // 상태 관리
    const [isHR, setIsHR] = useState(false);
    const [users, setUsers] = useState<User[]>([]); // 전체 유저 (검색용)
    const [loadingUsers, setLoadingUsers] = useState(false);

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [memos, setMemos] = useState<ContractMemo[]>([]);
    const [loadingMemos, setLoadingMemos] = useState(false);

    // 입력 및 수정 상태
    const [newMemoText, setNewMemoText] = useState('');
    const [editingMemoId, setEditingMemoId] = useState<number | null>(null);
    const [editingMemoText, setEditingMemoText] = useState('');
    const [updating, setUpdating] = useState(false);

    // UI 상태
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [searchResults, setSearchResults] = useState<User[]>([]);

    useEffect(() => {
        checkPermissions();
        fetchUsers();
    }, [token]);

    // 검색 로직
    useEffect(() => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }
        const filtered = users.filter(user =>
            user.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.userId.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setSearchResults(filtered);
    }, [searchTerm, users]);

    const checkPermissions = async () => {
        try {
            const user = await fetchCurrentUser(token);
            // 실제 권한 로직에 맞춰 수정 (예: 'HR_ADMIN' 등)
            setIsHR(user.permissions?.includes('HR_CONTRACT') || false);
        } catch (err) {
            console.error('권한 확인 실패');
        }
    };

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const response = await fetch('/api/v1/admin/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (err) {
            console.error('사용자 목록 로드 실패', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleUserSelect = async (userId: string, userName: string, jobLevel: string) => {
        const userObj: User = { userId, userName, jobLevel };
        setSelectedUser(userObj);
        setSearchTerm(''); // 검색창 초기화
        setSearchResults([]); // 검색결과 닫기
        fetchMemos(userId);
    };

    const fetchMemos = async (userId: string) => {
        setLoadingMemos(true);
        try {
            const data = await getUserMemos(userId, token);
            setMemos(data);
        } catch (err) {
            console.error("메모 로드 실패", err);
            setMemos([]);
        } finally {
            setLoadingMemos(false);
        }
    };

    // 메모 정렬 (최신순/오래된순)
    const sortedMemos = useMemo(() => {
        return [...memos].sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
    }, [memos, sortOrder]);

    const handleCreateMemo = async () => {
        if (!selectedUser || !newMemoText.trim()) return;
        try {
            await createMemo(selectedUser.userId, newMemoText, token);
            setNewMemoText('');
            fetchMemos(selectedUser.userId);
        } catch (err) {
            alert("메모 저장 실패");
        }
    };

    const handleUpdateMemo = async (memoId: number) => {
        if (!selectedUser) return;
        setUpdating(true);
        try {
            await updateMemo(memoId, editingMemoText, token);
            setEditingMemoId(null);
            setEditingMemoText('');
            fetchMemos(selectedUser.userId);
        } catch (err) {
            alert('메모 업데이트 실패');
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteMemo = async (memoId: number) => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;
        try {
            await deleteMemo(memoId, token);
            if (selectedUser) fetchMemos(selectedUser.userId);
        } catch (err) {
            alert("삭제 실패");
        }
    };

    if (!isHR) return <Layout><div className="cm-container">접근 권한이 없습니다.</div></Layout>;

    return (
        <Layout>
            <div className="cm-container">
                {/* 헤더 영역 */}
                <header className="cm-header">
                    <h1 className="cm-title-text">계약 관리 메모 시스템</h1>
                    <div className="cm-stats-badge">
                        <div className="cm-stat-item">
                            <UserIcon size={14} />
                            전체 직원 <span className="value">{users.length}</span>
                        </div>
                        {selectedUser && (
                            <div className="cm-stat-item" style={{ borderColor: '#0ea5e9', color: '#0ea5e9', background: '#f0f9ff' }}>
                                <CheckCircle2 size={14} />
                                선택됨: {selectedUser.userName}
                            </div>
                        )}
                    </div>
                </header>

                <div className="cm-main-layout">
                    {/* 좌측: 조직도 및 검색 */}
                    <aside className="cm-sidebar-card">
                        <div className="cm-sidebar-header">
                            <h3>직원 검색 및 조직도</h3>
                        </div>

                        {/* 검색창 */}
                        <div className="cm-search-box">
                            <Search className="cm-search-icon" size={16} />
                            <input
                                type="text"
                                className="cm-search-input"
                                placeholder="이름 또는 사번 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {/* 검색 결과 드롭다운 (간이 구현) */}
                            {searchResults.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                    background: 'white', border: '1px solid #e2e8f0',
                                    borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                }}>
                                    {searchResults.map(u => (
                                        <div
                                            key={u.userId}
                                            onClick={() => handleUserSelect(u.userId, u.userName, u.jobLevel || '')}
                                            style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}
                                        >
                                            <span style={{ fontWeight: 'bold' }}>{u.userName}</span>
                                            <span style={{ color: '#94a3b8', marginLeft: '4px' }}>({u.userId})</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 조직도 영역 */}
                        <div className="cm-org-wrapper">
                            <OrganizationChart
                                onUserSelect={handleUserSelect}
                                selectedUserId={selectedUser?.userId}
                                allDepartments={true}
                            />
                        </div>
                    </aside>

                    {/* 우측: 메모 상세 */}
                    <main className="cm-detail-card">
                        {selectedUser ? (
                            <>
                                {/* 유저 헤더 */}
                                <div className="cm-detail-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div className="cm-memo-author-avatar" style={{ width: '42px', height: '42px', fontSize: '18px' }}>
                                            {selectedUser.userName.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                                                {selectedUser.userName}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                {selectedUser.jobLevel} · {selectedUser.userId}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 컨트롤 바 (정렬 등) */}
                                <div className="cm-controls">
                                    <div className="cm-sort-buttons">
                                        <button
                                            className={`cm-sort-btn ${sortOrder === 'desc' ? 'active' : ''}`}
                                            onClick={() => setSortOrder('desc')}
                                        >
                                            최신순
                                        </button>
                                        <button
                                            className={`cm-sort-btn ${sortOrder === 'asc' ? 'active' : ''}`}
                                            onClick={() => setSortOrder('asc')}
                                        >
                                            과거순
                                        </button>
                                    </div>
                                    <div className="cm-memo-count">
                                        총 <span className="count">{memos.length}</span>개의 기록
                                    </div>
                                </div>

                                {/* 메모 리스트 영역 */}
                                <div className="cm-memo-list">
                                    {loadingMemos ? (
                                        <>
                                            <MemoSkeleton />
                                            <MemoSkeleton />
                                            <MemoSkeleton />
                                        </>
                                    ) : sortedMemos.length > 0 ? (
                                        sortedMemos.map(memo => (
                                            <div key={memo.id} className={`cm-memo-bubble priority-normal`}>
                                                {/* 수정 모드 */}
                                                {editingMemoId === memo.id ? (
                                                    <div className="cm-edit-mode">
                                                        <textarea
                                                            className="cm-memo-textarea"
                                                            value={editingMemoText}
                                                            onChange={e => setEditingMemoText(e.target.value)}
                                                            style={{ height: '120px' }}
                                                        />
                                                        <div className="cm-edit-actions">
                                                            <button className="cm-edit-cancel-btn" onClick={() => {
                                                                setEditingMemoId(null);
                                                                setEditingMemoText('');
                                                            }}>
                                                                취소
                                                            </button>
                                                            <button
                                                                className="cm-edit-save-btn"
                                                                onClick={() => handleUpdateMemo(memo.id)}
                                                                disabled={!editingMemoText.trim()}
                                                            >
                                                                {updating ? '저장 중...' : '수정 완료'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* 조회 모드 */
                                                    <>
                                                        <div className="cm-memo-header">
                                                            <div className="cm-memo-author-info">
                                                                <div className="cm-memo-author-avatar">HR</div>
                                                                <div className="cm-memo-author-details">
                                                                    <span className="cm-memo-author-name">{memo.createdBy}</span>
                                                                    <span className="cm-memo-author-id">관리자</span>
                                                                </div>
                                                            </div>
                                                            {/* 우선순위 배지 (필요 시 API 연동, 현재는 기본값) */}
                                                            <span className="cm-memo-priority normal">일반</span>
                                                        </div>

                                                        <div className="cm-memo-content">
                                                            {memo.memoText}
                                                        </div>

                                                        <div className="cm-memo-footer">
                                                            <div className="cm-memo-info">
                                                                <span className="cm-memo-date">
                                                                    <Calendar size={12} />
                                                                    {new Date(memo.createdAt).toLocaleDateString('ko-KR', {
                                                                        year: 'numeric', month: 'long', day: 'numeric',
                                                                        hour: '2-digit', minute: '2-digit'
                                                                    })}
                                                                </span>
                                                                {memo.updatedAt !== memo.createdAt && (
                                                                    <span className="cm-memo-edited">수정됨</span>
                                                                )}
                                                            </div>
                                                            <div className="cm-memo-actions">
                                                                <button
                                                                    className="cm-memo-action-btn edit"
                                                                    onClick={() => {
                                                                        setEditingMemoId(memo.id);
                                                                        setEditingMemoText(memo.memoText);
                                                                    }}
                                                                >
                                                                    <Edit2 size={14} /> 수정
                                                                </button>
                                                                <button
                                                                    className="cm-memo-action-btn delete"
                                                                    onClick={() => handleDeleteMemo(memo.id)}
                                                                >
                                                                    <Trash2 size={14} /> 삭제
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="cm-empty-placeholder">
                                            <div className="cm-empty-icon"><FolderOpen size={64} /></div>
                                            <div className="cm-empty-title">기록된 메모가 없습니다</div>
                                            <p className="cm-empty-desc">아래 입력창을 통해 이 직원에 대한 첫 번째 업무 기록을 남겨보세요.</p>
                                        </div>
                                    )}
                                </div>

                                {/* 입력 풋터 */}
                                <div className="cm-input-footer">
                                    <div className="cm-input-header">
                                        <span className="cm-input-title">새 메모 작성</span>
                                        <span className={`cm-char-count ${newMemoText.length > 1000 ? 'error' : ''}`}>
                                            {newMemoText.length} / 1000자
                                        </span>
                                    </div>
                                    <textarea
                                        className="cm-memo-textarea"
                                        placeholder="계약 관련 특이사항, 면담 내용 등 업무 기록을 작성하세요..."
                                        value={newMemoText}
                                        onChange={e => setNewMemoText(e.target.value)}
                                        maxLength={1000}
                                    />
                                    <div className="cm-input-actions">
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                            * 내용은 관리자 권한이 있는 사용자에게만 표시됩니다.
                                        </div>
                                        <button
                                            className="cm-save-btn"
                                            onClick={handleCreateMemo}
                                            disabled={!newMemoText.trim()}
                                        >
                                            <Save size={16} /> 기록 저장
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* 사용자 미선택 시 빈 화면 */
                            <div className="cm-empty-placeholder">
                                <div className="cm-empty-icon"><UserIcon size={64} /></div>
                                <div className="cm-empty-title">직원을 선택해주세요</div>
                                <p className="cm-empty-desc">
                                    좌측 조직도에서 부서를 클릭하거나 검색을 통해<br/>
                                    메모를 관리할 직원을 선택할 수 있습니다.
                                </p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </Layout>
    );
};

export default AdminMemoManagement;