import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { PricesPage } from './pages/PricesPage';
import { ProjectPage } from './pages/ProjectPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/p/:id" element={<ProjectPage />} />
      <Route path="/prices" element={<PricesPage />} />
      <Route path="/admin/*" element={<Navigate to="/prices" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
