import React, { useState, useEffect } from 'react';
import Layout from '../Layout';
import './style.css';
import axiosInstance from '../../views/Authentication/axiosInstance';

interface Department {
    deptCode: string;
    deptName: string;
}

export const UserRegistrationPage: React.FC = () => {
    const API_BASE_URL = process.env.REACT_APP_API_URL;

    const [formData, setFormData] = useState({
        usrId: '',
        usrKorName: '',
        deptCode: '',
        jobType: '',
        startDate: ''
    });

    const [departments, setDepartments] = useState<Department[]>([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const response = await axiosInstance.get(`/departments`);
            setDepartments(response.data);
        } catch (err) {
            console.error('부서 목록 조회 실패', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            await axiosInstance.post(`/admin/users/register`, formData);

            setSuccess(`회원 등록이 완료되었습니다. (사원번호: ${formData.usrId})`);

            setFormData({
                usrId: '',
                usrKorName: '',
                deptCode: '',
                jobType: '0',
                startDate: ''
            });
        } catch (err: any) {
            setError(err.response?.data?.error || '회원 등록에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="ur-container">
                {/* Header Section */}
                <div className="ur-header">
                    <h1 className="ur-title">신규 구성원 등록</h1>
                    <p className="ur-subtitle">시스템 접근 권한을 부여하기 위해 신규 사용자의 기본 정보를 입력해주세요.</p>
                </div>

                <div className="ur-content-grid">
                    {/* Left Column: Form Area */}
                    <div className="ur-card">
                        {error && <div className="ur-alert ur-error">⚠️ {error}</div>}
                        {success && <div className="ur-alert ur-success">✅ {success}</div>}

                        <form onSubmit={handleSubmit} className="ur-form">
                            {/* Row 1: ID & Name */}
                            <div className="ur-form-row">
                                <div className="ur-form-group">
                                    <label className="ur-label">사원번호 <span>*</span></label>
                                    <input
                                        className="ur-input"
                                        type="text"
                                        value={formData.usrId}
                                        onChange={(e) => setFormData({...formData, usrId: e.target.value})}
                                        placeholder="00000"
                                        required
                                        disabled={loading}
                                    />
                                </div>

                                <div className="ur-form-group">
                                    <label className="ur-label">이름 <span>*</span></label>
                                    <input
                                        className="ur-input"
                                        type="text"
                                        value={formData.usrKorName}
                                        onChange={(e) => setFormData({...formData, usrKorName: e.target.value})}
                                        placeholder="홍길동"
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {/* Row 2: Dept & JobType */}
                            <div className="ur-form-row">
                                <div className="ur-form-group">
                                    <label className="ur-label">소속 부서 <span>*</span></label>
                                    <select
                                        className="ur-select"
                                        value={formData.deptCode}
                                        onChange={(e) => setFormData({...formData, deptCode: e.target.value})}
                                        required
                                        disabled={loading}
                                    >
                                        <option value="">부서를 선택해주세요</option>
                                        {departments.map(dept => (
                                            <option key={dept.deptCode} value={dept.deptCode}>
                                                {dept.deptName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="ur-form-group">
                                    <label className="ur-label">직종 코드 (Job Type) <span>*</span></label>
                                    <input
                                        className="ur-input"
                                        type="text"
                                        value={formData.jobType}
                                        onChange={(e) => setFormData({...formData, jobType: e.target.value})}
                                        maxLength={4}
                                        placeholder="예: 1001"
                                        required
                                        disabled={loading}
                                    />
                                    <small className="ur-helper-text">
                                        최대 4자리 숫자 또는 코드를 입력하세요.
                                    </small>
                                </div>
                            </div>

                            {/* Row 3: Date */}
                            <div className="ur-form-group">
                                <label className="ur-label">입사일 <span>*</span></label>
                                <input
                                    className="ur-input"
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <button type="submit" className="ur-submit-btn" disabled={loading}>
                                {loading ? '처리 중...' : '구성원 등록 완료'}
                            </button>
                        </form>
                    </div>

                    {/* Right Column: Info Area */}
                    <div className="ur-card ur-info-card">
                        <div className="ur-info-header">
                            <h3 className="ur-info-title">📌 관리자 가이드</h3>
                        </div>
                        <ul className="ur-info-list">
                            <li>초기 비밀번호는 보안을 위해 <strong>사원번호와 동일</strong>하게 자동 설정됩니다.</li>
                            <li>사용자는 최초 로그인 시 <strong>반드시 비밀번호를 변경</strong>해야 합니다.</li>
                            <li>직급(Job Level) 설정은 회원 등록 후 <strong>[권한 관리]</strong> 메뉴에서 수정 가능합니다.</li>
                            <li>개인 연락처, 주소 등의 정보는 사용자가 <strong>마이페이지</strong>에서 직접 등록합니다.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default UserRegistrationPage;