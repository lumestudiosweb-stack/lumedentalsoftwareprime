import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/common/Layout';
import Dashboard from './components/dashboard/Dashboard';
import PatientList from './components/dashboard/PatientList';
import PatientProfile from './components/dashboard/PatientProfile';
import SimulationView from './components/viewer/SimulationView';
import CrmDashboard from './components/crm/CrmDashboard';
import AlignerTracker from './components/crm/AlignerTracker';
import Scheduler from './components/schedule/Scheduler';
import Analytics from './components/analytics/Analytics';
import AiInsights from './components/insights/AiInsights';
import Login from './components/common/Login';
import { useAuthStore } from './contexts/authStore';

export default function App() {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<PatientList />} />
        <Route path="/patients/:id" element={<PatientProfile />} />
        <Route path="/simulation/:id" element={<SimulationView />} />
        <Route path="/schedule" element={<Scheduler />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/insights" element={<AiInsights />} />
        <Route path="/crm" element={<CrmDashboard />} />
        <Route path="/aligners/:patientId" element={<AlignerTracker />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
