import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoadingBlock } from './components/ui';
import Dashboard from './pages/Dashboard';

const Library = lazy(() => import('./pages/Library'));
const MethodDetail = lazy(() => import('./pages/MethodDetail'));
const Research = lazy(() => import('./pages/Research'));
const SearchPage = lazy(() => import('./pages/Search'));
const Graph = lazy(() => import('./pages/Graph'));
const Practice = lazy(() => import('./pages/Practice'));
const Learning = lazy(() => import('./pages/Learning'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<LoadingBlock />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/library" element={<Library />} />
          <Route path="/method/:id" element={<MethodDetail />} />
          <Route path="/research" element={<Research />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/graph" element={<Graph />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/practice/:id" element={<Practice />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
