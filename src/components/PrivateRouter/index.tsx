import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const PrivateRouter: React.FC = () => {
    const userCache = localStorage.getItem('userCache');

    if (!userCache) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default PrivateRouter;