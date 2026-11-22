import { useTranslation } from 'react-i18next';
import { GraduationCap, Mic, Brain, Users, Languages, Github, Heart } from 'lucide-react';
import { PageHeading, Logo } from '../components/ui.jsx';

const POINTS = [
  ['lessons', GraduationCap],
  ['speak', Mic],
  ['review', Brain],
  ['classes', Users],
  ['languages', Languages],
];

/** About page: who made the app and what it offers. The creator's name is shown in both scripts. */
export default function About() {
  const { t } = useTranslation();
  return (
    <div className="page narrow about" data-testid="about-page">
      <PageHeading title={t('about.title')} subtitle={t('about.subtitle')} />
      <section className="card creator-card" aria-labelledby="creator-h">
        <Logo compact size={72} />
        <div>
          <h2 id="creator-h" className="sr-only">{t('about.builtBy')}</h2>
          <p className="muted small">{t('about.builtBy')}</p>
          <p className="creator-name"><bdi lang="en" dir="ltr">Mohamed Ebrahim</bdi><span aria-hidden="true"> · </span><bdi lang="ar" dir="rtl">محمد إبراهيم</bdi></p>
          <p className="muted">{t('about.creatorRole')}</p>
        </div>
      </section>
      <section className="card stack-sm" aria-labelledby="story-h">
        <h2 id="story-h" className="h-md">{t('about.storyTitle')}</h2>
        <p>{t('about.story')}</p>
        <p className="motto"><Heart size={18} aria-hidden="true" />{t('about.motto')}</p>
      </section>
      <section aria-labelledby="what-h">
        <h2 id="what-h" className="h-md">{t('about.whatTitle')}</h2>
        <ul className="about-points">
          {POINTS.map(([k, Icon]) => (
            <li key={k}><span className="about-ico" aria-hidden="true"><Icon size={20} /></span><span>{t(`about.points.${k}`)}</span></li>
          ))}
        </ul>
      </section>
      <p className="about-foot">
        <a className="link-strong" href="https://github.com/moibel/MohLeyla" target="_blank" rel="noopener noreferrer"><Github size={18} aria-hidden="true" /> {t('about.project')}</a>
        <span className="muted">{t('about.thanks')}</span>
      </p>
    </div>
  );
}
