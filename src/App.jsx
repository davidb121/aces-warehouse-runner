import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import StandWorkerHome from './pages/StandWorkerHome'
import RunnerHome from './pages/RunnerHome'
import SurveyEntry from './pages/SurveyEntry'
import PickList from './pages/PickList'
import Manager from './pages/Manager'
import NotFound from './pages/NotFound'

// Lazy-load the QR scanner — html5-qrcode is large and only needed on /scan
const QRScanner = lazy(() => import('./pages/QRScanner'))

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-full bg-black">
      <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stand" element={<StandWorkerHome />} />
          <Route path="/runner" element={<RunnerHome />} />
          <Route path="/runner/queue" element={<RunnerHome />} />
          <Route path="/runner/survey/:standId" element={<SurveyEntry />} />
          <Route path="/runner/picklist" element={<PickList />} />
          <Route path="/manager" element={<Manager />} />
          <Route
            path="/scan"
            element={
              <Suspense fallback={<Spinner />}>
                <QRScanner />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
