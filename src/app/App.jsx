import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProgressProvider } from './ProgressContext.jsx';
import Layout from './Layout.jsx';
import { usePwa } from './usePwa.js';
import { Spinner } from '../components/ui.jsx';
import Home from '../pages/Home.jsx';
import Gate from '../features/sync/SignInGate.jsx';

const Courses = lazy(() => import('../pages/Courses.jsx'));
const LessonPage = lazy(() => import('../pages/LessonPage.jsx'));
const Review = lazy(() => import('../pages/Review.jsx'));
const Vocabulary = lazy(() => import('../pages/Vocabulary.jsx'));
const Progress = lazy(() => import('../pages/Progress.jsx'));
const Settings = lazy(() => import('../pages/Settings.jsx'));
const Profile = lazy(() => import('../pages/Profile.jsx'));
const Classes = lazy(() => import('../pages/Classes.jsx'));
const Teach = lazy(() => import('../pages/Teach.jsx'));
const Admin = lazy(() => import('../pages/Admin.jsx'));
const Chat = lazy(() => import('../pages/Chat.jsx'));
const Notifications = lazy(() => import('../pages/Notifications.jsx'));
const About = lazy(() => import('../pages/About.jsx'));
const NotFound = lazy(() => import('../pages/NotFound.jsx'));

export default function App() {
  const { t } = useTranslation();
  const pwa = usePwa();
  return (
    <ProgressProvider>
      <BrowserRouter>
        <Gate>
        <Suspense fallback={<Spinner label={t('app.loading')} />}>
          <Routes>
            <Route element={<Layout pwa={pwa} />}>
              <Route index element={<Home />} />
              <Route path="learn" element={<Courses />} />
              <Route path="lesson/:id" element={<LessonPage />} />
              <Route path="review" element={<Review />} />
              <Route path="words" element={<Vocabulary />} />
              <Route path="progress" element={<Progress />} />
              <Route path="profile" element={<Profile />} />
              <Route path="classes" element={<Classes />} />
              <Route path="teach" element={<Teach />} />
              <Route path="admin" element={<Admin />} />
              <Route path="chat" element={<Chat />} />
              <Route path="chat/:id" element={<Chat />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="about" element={<About />} />
              <Route path="settings" element={<Settings pwa={pwa} />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
        </Gate>
      </BrowserRouter>
    </ProgressProvider>
  );
}
