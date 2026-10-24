import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { trTR } from '@clerk/localizations';
import { QueryClient, QueryClientProvider, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  useCreateClass, useCreateClassPost, useCreateComment, useGetClass,
  useGetClassMembers, useGetClassPosts, useGetDashboard, useGetInstitutionClasses,
  useGetInstitutions, useGetMyProfile, useHealthCheck, useJoinClass,
  useSearchUsers, useSetPostReaction, useUpdateMyProfile,
  getGetClassMembersQueryKey, getGetClassPostsQueryKey, getGetClassQueryKey,
  getGetDashboardQueryKey, getGetInstitutionClassesQueryKey, getGetMyProfileQueryKey,
  getGetInstitutionsQueryKey, getSearchUsersQueryKey,
} from '@workspace/api-client-react';
import type { ClassGroupInput, Post, PostInput, ProfileUpdate } from '@workspace/api-client-react';
import { BookOpen, Check, ChevronRight, CircleUserRound, Clock3, GraduationCap, Heart, Landmark, LockKeyhole, LogOut, MapPin, MessageCircle, Plus, Search, ShieldCheck, Sparkles, Users, Wifi, WifiOff, X } from 'lucide-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 20_000 } },
});
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#2259d4',
    colorForeground: '#22252b',
    colorMutedForeground: '#6c6a64',
    colorDanger: '#b53c35',
    colorBackground: '#fbf8f0',
    colorInput: '#f7f3e9',
    colorInputForeground: '#22252b',
    colorNeutral: '#d6d0c3',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf8f0] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#22252b] font-serif',
    headerSubtitle: 'text-[#6c6a64]',
    socialButtonsBlockButtonText: 'text-[#22252b]',
    formFieldLabel: 'text-[#34363b]',
    footerActionLink: 'text-[#2259d4] font-semibold',
    footerActionText: 'text-[#6c6a64]',
    dividerText: 'text-[#77736b]',
    identityPreviewEditButton: 'text-[#2259d4]',
    formFieldSuccessText: 'text-[#287456]',
    alertText: 'text-[#85312d]',
    logoBox: 'mb-2',
    logoImage: 'h-10',
    socialButtonsBlockButton: 'border-[#d6d0c3] bg-[#f7f3e9] hover:bg-[#f0eadc]',
    formButtonPrimary: 'bg-[#2259d4] hover:bg-[#1949b6] text-white',
    formFieldInput: 'bg-[#f7f3e9] border-[#d6d0c3] text-[#22252b]',
    footerAction: 'border-t border-[#e3ddcf]',
    dividerLine: 'bg-[#d6d0c3]',
    alert: 'bg-[#fff0ed] border-[#edc3bb]',
    otpCodeFieldInput: 'bg-[#f7f3e9] border-[#d6d0c3] text-[#22252b]',
    formFieldRow: 'gap-1.5',
    main: 'gap-5',
  },
};

function Mark({ small = false }: { small?: boolean }) {
  return <Link href="/" data-testid="link-home" className="brand-mark">
    <span className="brand-seal" aria-hidden="true"><BookOpen size={small ? 17 : 19} strokeWidth={1.8} /></span>
    <span className="brand-word">sınıfım<span className="brand-dot">.</span></span>
  </Link>;
}

function ConnectionState() {
  const health = useHealthCheck({ query: { refetchInterval: 60_000 } });
  return <span className="connection-state" data-testid="status-connection">
    {health.isLoading ? <span className="pulse-dot" /> : health.isError ? <WifiOff size={13} /> : <Wifi size={13} />}
    {health.isLoading ? 'Bağlantı denetleniyor' : health.isError ? 'Bağlantı kurulamadı' : 'Bağlantı açık'}
  </span>;
}

function SiteHeader({ portal = false }: { portal?: boolean }) {
  const { signOut } = useClerk();
  const { user } = useUser();
  return <header className="site-header">
    <div className="header-inner">
      <Mark />
      <nav className="desktop-nav" aria-label="Ana menü">
        <Link href="/search" data-testid="link-search">Okul ve sınıf bul</Link>
        {portal && <Link href="/profile" data-testid="link-profile">Profilim</Link>}
      </nav>
      <div className="header-actions">
        <ConnectionState />
        {portal ? <>
          <Link href="/profile" className="header-avatar" aria-label="Profilim" data-testid="link-profile-avatar">{user?.firstName?.slice(0, 1) ?? 'S'}</Link>
          <button className="icon-button logout-button" type="button" aria-label="Oturumu kapat" title="Oturumu kapat" data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut size={17} /></button>
        </> : <div className="auth-links">
          <Link href="/sign-in" className="text-link" data-testid="link-sign-in">Giriş yap</Link>
          <Link href="/sign-up" className="button button-primary button-small" data-testid="link-sign-up">Arşive katıl</Link>
        </div>}
      </div>
    </div>
  </header>;
}

function PageShell({ children, portal = false }: { children: ReactNode; portal?: boolean }) {
  return <div className="app-frame paper-grain"><SiteHeader portal={portal} />{children}<footer className="site-footer"><Mark small /><span>Eski sınıf arkadaşlarınla, kendi sınırların içinde.</span><span className="mono">SINIFIM · 2025</span></footer></div>;
}

function PublicHome() {
  return <PageShell>
    <main>
      <section className="landing-hero">
        <div className="hero-copy fade-up">
          <div className="eyebrow"><span className="eyebrow-line" /> BİR ZAMANLAR AYNI SIRADAYDIK</div>
          <h1>Yıllar geçer.<br /><em>İsimler</em> kalır.</h1>
          <p className="hero-lede">Okuldan, kurstan, aynı sınıftan… Hayatın dağıttığı yolları yeniden birbirine yaklaştıran güvenli bir anı arşivi.</p>
          <div className="hero-actions">
            <Link href="/sign-up" className="button button-primary" data-testid="link-hero-sign-up">Kendi sınıfını bul <ChevronRight size={17} /></Link>
            <Link href="/search" className="quiet-link" data-testid="link-hero-search">Okullara göz at</Link>
          </div>
          <div className="privacy-note"><ShieldCheck size={16} /> Sınıf paylaşımları yalnızca onaylı sınıf üyelerine görünür.</div>
        </div>
        <div className="yearbook-art fade-up stagger-1" aria-label="Eski sınıf yıllığı estetiğinde anı kartı">
          <div className="art-index">ARŞİV NO. 024 / 98</div>
          <div className="photo-window">
            <div className="photo-sun" />
            <div className="school-silhouette"><span /><span /><span /><i /></div>
            <div className="photo-grain" />
            <div className="photo-caption">bahar dönemi · 1998</div>
          </div>
          <div className="handwritten">“Teneffüste<br />görüşürüz.”</div>
          <div className="yearbook-bottom"><span>9-B / 1998</span><span className="blue-stamp">BİZİM SINIF</span></div>
          <div className="paper-tab">YILLAR SONRA</div>
        </div>
        <div className="hero-side-note">GEÇMİŞTEN<br />BİR MERHABA <span>↘</span></div>
      </section>
      <section className="landing-proof">
        <p className="proof-label">BİR ARŞİV, BİRÇOK YENİDEN BULUŞMA</p>
        <div className="proof-figures"><div><strong>01</strong><span>Okulunu bul</span></div><div><strong>02</strong><span>Mezuniyet yılını seç</span></div><div><strong>03</strong><span>Sınıf arkadaşlarınla buluş</span></div></div>
      </section>
      <section className="story-section">
        <div className="story-side"><span className="section-number">01 — NASIL ÇALIŞIR?</span><div className="side-rule" /><span className="side-caption">Her şey<br />bir sınıfla başlar.</span></div>
        <div className="story-main"><h2>Bir isim aramak<br />değil, <em>bir döneme</em><br />geri dönmek.</h2><p>Sınıfım, rastgele karşılaşmaların değil; birlikte okuduğunuz yılların buluşma noktası. Önce okulunu, sonra sınıfını seç. Sınıfına ait anılar ve sohbetler, yalnızca sınıf üyelerine açık kalır.</p><Link href="/search" className="arrow-link" data-testid="link-story-search">Arşivi keşfet <ChevronRight size={16} /></Link></div>
        <div className="story-aside"><div className="archive-stamp">TANIŞIK<br />YÜZLER<br /><span>YENİDEN</span></div><p>Bağlantıların, üyeliğin ve görünürlüğün senin kontrolünde.</p></div>
      </section>
      <section className="landing-bottom">
        <div className="bottom-card"><span className="mono">GİZLİLİK · ÖNCELİĞİMİZ</span><h2>Kapalı sınıflar.<br /><em>İçten paylaşımlar.</em></h2><p>Bir sınıfa ait paylaşımlar, onaylı üyelik olmadan görünmez. Profilinin aranabilir olup olmayacağına da sen karar verirsin.</p><Link href="/sign-up" className="button button-outline" data-testid="link-bottom-sign-up">Hikâyene yer aç <ChevronRight size={16} /></Link></div>
        <div className="bottom-ornament"><div className="ornament-circle"><GraduationCap size={44} strokeWidth={1.2} /></div><div className="ornament-lines" /><span>ESKİ DEFTERLER<br />YENİDEN AÇILIR</span></div>
      </section>
    </main>
  </PageShell>;
}

function LoadingBlock({ label = 'Arşivden bilgiler getiriliyor' }: { label?: string }) {
  return <div className="loading-block" role="status" data-testid="status-loading"><span className="skeleton skeleton-wide" /><span className="skeleton skeleton-medium" /><span className="skeleton skeleton-short" /><span className="loading-caption">{label}</span></div>;
}

function ErrorBlock({ message = 'Bilgiler şu anda yüklenemedi.', retry }: { message?: string; retry: () => void }) {
  return <div className="error-block" role="alert" data-testid="status-error"><span className="error-mark">!</span><div><strong>Bir aksilik oldu.</strong><p>{message}</p><button className="text-link" type="button" onClick={retry} data-testid="button-retry">Yeniden dene</button></div></div>;
}

function EmptyBlock({ title, body, icon = <BookOpen size={20} /> }: { title: string; body: string; icon?: ReactNode }) {
  return <div className="empty-block" data-testid="state-empty"><span className="empty-icon">{icon}</span><strong>{title}</strong><p>{body}</p></div>;
}

function Portal() {
  const dashboard = useGetDashboard();
  const { user } = useUser();
  const greetingName = user?.firstName || 'yeniden';
  return <PageShell portal>
    <main className="portal-main content-width">
      <div className="portal-heading fade-up"><div><span className="eyebrow"><span className="eyebrow-line" /> KİŞİSEL ARŞİVİN</span><h1>Merhaba, {greetingName}.</h1><p>Sınıfından yeni bir haber var mı?</p></div><Link className="button button-primary" href="/search" data-testid="link-find-class"><Search size={16} /> Sınıfını bul</Link></div>
      {dashboard.isLoading ? <LoadingBlock /> : dashboard.isError ? <ErrorBlock retry={() => void dashboard.refetch()} /> : <>
        <section className="portal-section"><div className="section-heading"><div><span className="section-number">01 — TOPLULUKLARIN</span><h2>Sınıflarım</h2></div><Link href="/search" className="arrow-link" data-testid="link-add-class"><Plus size={16} /> Sınıf ekle</Link></div>
          {dashboard.data?.classes?.length ? <div className="class-grid">{dashboard.data.classes.map((group) => <Link href={`/classes/${group.id}`} key={group.id} className="class-card" data-testid={`card-class-${group.id}`}><span className="class-card-index">SINIF KAYDI / {String(group.graduationYear).slice(-2)}</span><strong>{group.className}</strong><span className="class-card-school">{group.institutionName}</span><span className="card-meta"><MapPin size={13} /> {group.city} <span className="meta-divider" /> <Users size={13} /> {group.memberCount} kişi</span><span className="class-card-arrow"><ChevronRight size={17} /></span></Link>)}</div> : <EmptyBlock title="Henüz bir sınıfın yok" body="Okulunu ve mezuniyet yılını seçerek eski sınıfını bul." icon={<GraduationCap size={21} />} />}
        </section>
        <section className="portal-section recent-section"><div className="section-heading"><div><span className="section-number">02 — SON NOTLAR</span><h2>Arşivden</h2></div></div>
          {dashboard.data?.recentPosts?.length ? <div className="recent-list">{dashboard.data.recentPosts.map((post) => <article className="recent-row" key={post.id} data-testid={`post-recent-${post.id}`}><span className="recent-date">{new Date(post.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}</span><div><span className="post-kind">{kindLabel(post.kind)}</span><p>{post.content}</p><span className="recent-author">{post.authorName}</span></div><Link href={`/classes/${post.classId}`} className="recent-go" aria-label="Sınıf gönderisine git" data-testid={`link-recent-post-${post.id}`}><ChevronRight size={18} /></Link></article>)}</div> : <EmptyBlock title="Şimdilik sessiz" body="Sınıfına katıldığında arkadaşlarının paylaşımları burada görünür." />}
        </section>
        <section className="suggestion-strip"><div><span className="section-number">ARŞİVİ GENİŞLET</span><h3>Başka bir sınıf daha mı var?</h3><p>Okulunu arayıp diğer sınıf arkadaşlarını da bulabilirsin.</p></div><Link href="/search" className="button button-outline" data-testid="link-browse-institutions">Okul ara <ChevronRight size={16} /></Link></section>
      </>}
    </main>
  </PageShell>;
}

function kindLabel(kind: string) {
  if (kind === 'ani') return 'ANI';
  if (kind === 'duyuru') return 'DUYURU';
  return 'NOT';
}

function SearchPage() {
  const { isSignedIn } = useUser();
  const [institutionTerm, setInstitutionTerm] = useState('');
  const [peopleTerm, setPeopleTerm] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<'schools' | 'people'>('schools');
  const [showCreate, setShowCreate] = useState(false);
  const params = useMemo(() => institutionTerm.trim() ? { q: institutionTerm.trim() } : {}, [institutionTerm]);
  const institutions = useGetInstitutions(params, { query: { queryKey: getGetInstitutionsQueryKey(params) } });
  const groups = useGetInstitutionClasses(selectedId ?? 0, { query: { enabled: Boolean(selectedId), queryKey: getGetInstitutionClassesQueryKey(selectedId ?? 0) } });
  const peopleParams = { q: peopleTerm.trim() || '  ' };
  const users = useSearchUsers(peopleParams, { query: { enabled: Boolean(isSignedIn) && peopleTerm.trim().length >= 2, queryKey: getSearchUsersQueryKey(peopleParams) } });
  return <PageShell portal={Boolean(isSignedIn)}>
    <main className="content-width search-page">
      <div className="page-intro fade-up"><span className="eyebrow"><span className="eyebrow-line" /> YENİDEN BULUŞMANIN İLK ADIMI</span><h1>Arşivde <em>ara.</em></h1><p>Okulunu bul, sınıfını seç; aynı dönemi paylaşan insanlara yeniden ulaş.</p></div>
      <div className="search-tabs" role="tablist" aria-label="Arama türü"><button type="button" role="tab" aria-selected={tab === 'schools'} className={tab === 'schools' ? 'selected' : ''} onClick={() => setTab('schools')} data-testid="tab-institutions"><Landmark size={16} /> Okul ve sınıf</button><button type="button" role="tab" aria-selected={tab === 'people'} className={tab === 'people' ? 'selected' : ''} onClick={() => setTab('people')} data-testid="tab-people"><Users size={16} /> Kişi ara</button></div>
      {tab === 'schools' ? <div className="search-layout">
        <section className="search-panel"><label className="field-label" htmlFor="institution-search">Okul, kurs veya şehir</label><div className="search-field"><Search size={17} /><input id="institution-search" type="search" value={institutionTerm} onChange={(e) => setInstitutionTerm(e.target.value)} placeholder="Örn. Kadıköy Anadolu Lisesi" data-testid="input-institution-search" /><button type="button" aria-label="Aramayı temizle" className="clear-search" onClick={() => setInstitutionTerm('')} data-testid="button-clear-institution-search"><X size={15} /></button></div>
          <div className="result-caption">{institutionTerm ? 'ARAMA SONUÇLARI' : 'KURUMLAR'}</div>
          {institutions.isLoading ? <LoadingBlock label="Kurumlar aranıyor" /> : institutions.isError ? <ErrorBlock retry={() => void institutions.refetch()} /> : institutions.data?.length ? <div className="institution-list">{institutions.data.map((inst) => <button className={`institution-row ${selectedId === inst.id ? 'active' : ''}`} type="button" key={inst.id} onClick={() => setSelectedId(inst.id)} data-testid={`button-institution-${inst.id}`}><span className="institution-icon"><Landmark size={17} /></span><span className="institution-info"><strong>{inst.name}</strong><small>{inst.city}{inst.campus ? ` · ${inst.campus}` : ''}</small></span><span className="institution-count">{inst.classCount} sınıf</span><ChevronRight size={16} /></button>)}</div> : <EmptyBlock title="Kurum bulunamadı" body={institutionTerm ? 'Farklı bir okul adı ya da şehir deneyebilirsin.' : 'Arşivde henüz listelenecek kurum yok.'} icon={<Search size={19} />} />}
        </section>
        <section className="cohort-panel">
          {selectedId ? <>
            <div className="cohort-head"><div><span className="section-number">SEÇİLİ KURUM</span><h2>{institutions.data?.find((i) => i.id === selectedId)?.name ?? 'Sınıf toplulukları'}</h2></div><button className="button button-outline button-small" type="button" onClick={() => setShowCreate((v) => !v)} data-testid="button-create-class"><Plus size={15} /> Sınıf oluştur</button></div>
            {groups.isLoading ? <LoadingBlock label="Sınıflar listeleniyor" /> : groups.isError ? <ErrorBlock retry={() => void groups.refetch()} /> : groups.data?.length ? <div className="cohort-list">{groups.data.map((group) => <Link href={`/classes/${group.id}`} className="cohort-row" key={group.id} data-testid={`link-cohort-${group.id}`}><span className="cohort-year">{group.graduationYear}</span><span className="cohort-info"><strong>{group.className}</strong><small>{group.memberCount} sınıf arkadaşı</small></span>{group.isMember ? <span className="member-label"><Check size={13} /> Üyesisin</span> : <span className="cohort-open">İncele <ChevronRight size={15} /></span>}</Link>)}</div> : <EmptyBlock title="Bu kurumda sınıf kaydı yok" body="Mezuniyet yılını ve sınıf adını ekleyerek sınıf topluluğunu başlatabilirsin." icon={<BookOpen size={20} />} />}
            {showCreate && <CreateClassForm institutionId={selectedId} onClose={() => setShowCreate(false)} />}
          </> : <div className="cohort-empty"><div className="cohort-mark"><Landmark size={28} /></div><span className="section-number">ÖNCE BİR KURUM SEÇ</span><h2>Sınıfını<br />bulmaya başlayalım.</h2><p>Sol taraftaki arşivde okulunu ya da kursunu seç. O kuruma ait sınıf kayıtları burada açılacak.</p><div className="dotted-line" /></div>}
        </section>
      </div> : <section className="people-search-panel">
        <div className="search-field people-field"><Search size={17} /><input type="search" value={peopleTerm} onChange={(e) => setPeopleTerm(e.target.value)} placeholder="Bir isim yaz (en az 2 harf)" aria-label="Kişi ara" data-testid="input-people-search" /></div>
        <div className="privacy-callout"><LockKeyhole size={16} /><span>Kişi arama sonuçları yalnızca profilini bulunabilir yapan kişileri gösterir. Sınıf içerikleri üyelik olmadan açılmaz.</span></div>
        {!isSignedIn ? <div className="auth-prompt"><EmptyBlock title="Kişi aramak için giriş yap" body="Arama sonuçlarında yalnızca bulunabilirliğe izin veren profiller gösterilir." icon={<CircleUserRound size={20} />} /><Link href="/sign-in" className="button button-outline" data-testid="link-sign-in-to-search">Giriş yap</Link></div> : peopleTerm.trim().length < 2 ? <EmptyBlock title="Tanıdık bir isim yaz" body="En az iki harfle aramaya başlayabilirsin." icon={<CircleUserRound size={20} />} /> : users.isLoading ? <LoadingBlock label="Kişiler aranıyor" /> : users.isError ? <ErrorBlock retry={() => void users.refetch()} /> : users.data?.length ? <div className="people-list">{users.data.map((person) => <article className="person-row" key={person.id} data-testid={`person-${person.id}`}><span className="person-avatar">{person.displayName.slice(0, 1)}</span><div><strong>{person.displayName}</strong><p>{[person.classLabel, person.city, person.occupation].filter(Boolean).join(' · ') || person.bio || 'Sınıfım üyesi'}</p></div><span className="discoverable-tag"><ShieldCheck size={13} /> Bulunabilir</span></article>)}</div> : <EmptyBlock title="Bu isimle eşleşen kimse yok" body="Yazımı kontrol et veya farklı bir adla tekrar dene." icon={<Search size={20} />} />}
      </section>}
    </main>
  </PageShell>;
}

function CreateClassForm({ institutionId, onClose }: { institutionId: number; onClose: () => void }) {
  const [graduationYear, setGraduationYear] = useState('');
  const [className, setClassName] = useState('');
  const [error, setError] = useState('');
  const client = useQueryClient();
  const createClass = useCreateClass({ mutation: { onSuccess: async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: getGetInstitutionClassesQueryKey(institutionId) }),
      client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
      client.invalidateQueries({ queryKey: getGetInstitutionsQueryKey() }),
    ]);
    onClose();
  } } });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!Number(graduationYear) || !className.trim()) { setError('Mezuniyet yılını ve sınıf adını gir.'); return; }
    if (Number(graduationYear) < 1950 || Number(graduationYear) > 2100) { setError('Yıl 1950 ile 2100 arasında olmalı.'); return; }
    setError('');
    const payload: ClassGroupInput = { institutionId, graduationYear: Number(graduationYear), className: className.trim() };
    createClass.mutate({ data: payload }, { onError: () => setError('Sınıf kaydı oluşturulamadı. Lütfen tekrar dene.') });
  };
  return <form className="create-class-form" onSubmit={submit} data-testid="form-create-class"><div className="form-heading"><strong>Yeni sınıf kaydı</strong><button type="button" className="icon-button" aria-label="Formu kapat" onClick={onClose} data-testid="button-close-create-class"><X size={17} /></button></div><label className="field-label" htmlFor="graduation-year">Mezuniyet yılı</label><input className="text-input" id="graduation-year" type="number" min="1950" max="2100" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} placeholder="Örn. 2002" required data-testid="input-graduation-year" /><label className="field-label" htmlFor="class-name">Sınıf adı</label><input className="text-input" id="class-name" value={className} onChange={(e) => setClassName(e.target.value)} maxLength={40} placeholder="Örn. 12-A" required data-testid="input-class-name" />{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" type="submit" disabled={createClass.isPending} data-testid="button-submit-create-class">{createClass.isPending ? 'Kaydediliyor…' : 'Sınıfı oluştur'}</button></form>;
}

function ClassPage() {
  const { isSignedIn } = useUser();
  const params = useParams<{ classId: string }>();
  const classId = Number(params.classId) || 0;
  const detail = useGetClass(classId, { query: { enabled: Boolean(classId), queryKey: getGetClassQueryKey(classId) } });
  const isMember = Boolean(detail.data?.isMember);
  const members = useGetClassMembers(classId, { query: { enabled: Boolean(classId && isMember), queryKey: getGetClassMembersQueryKey(classId) } });
  const posts = useGetClassPosts(classId, { query: { enabled: Boolean(classId && isMember), queryKey: getGetClassPostsQueryKey(classId) } });
  const client = useQueryClient();
  const joinClass = useJoinClass({ mutation: { onSuccess: async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: getGetClassQueryKey(classId) }),
      client.invalidateQueries({ queryKey: getGetClassMembersQueryKey(classId) }),
      client.invalidateQueries({ queryKey: getGetClassPostsQueryKey(classId) }),
      client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
    ]);
  } } });
  if (detail.isLoading) return <PageShell portal={Boolean(isSignedIn)}><main className="content-width"><LoadingBlock label="Sınıf kaydı açılıyor" /></main></PageShell>;
  if (detail.isError || !detail.data) return <PageShell portal={Boolean(isSignedIn)}><main className="content-width"><ErrorBlock retry={() => void detail.refetch()} /></main></PageShell>;
  const group = detail.data;
  return <PageShell portal={Boolean(isSignedIn)}>
    <main className="content-width class-page">
      <div className="breadcrumb"><Link href="/search" data-testid="link-back-search">Arşiv</Link><ChevronRight size={13} /><span>{group.institutionName}</span></div>
      <section className="class-hero">
        <div className="class-hero-top"><span className="archive-code">SINIF DEFTERİ · {group.graduationYear}</span><span className={group.isMember ? 'private-badge member' : 'private-badge'}><LockKeyhole size={13} /> {group.isMember ? 'Üyelere özel alan' : 'Üyelikle açılır'}</span></div>
        <div className="class-title-layout"><div><h1>{group.className}</h1><p className="class-school"><Landmark size={15} /> {group.institutionName} <span>·</span> {group.city}</p></div><div className="class-count"><strong>{group.memberCount}</strong><span>eski sınıf arkadaşı</span></div></div>
        <p className="class-description">{group.description || 'Aynı sınıfı, aynı koridorları paylaşanların buluşma yeri. Yeniden merhaba demek için doğru yerdesin.'}</p>
        {!group.isMember && <div className="join-strip"><div><ShieldCheck size={17} /><span>Sınıfa katıldığında akış ve arkadaş listesi açılır. Profilinin aranabilir olması ayrı bir tercihtir.</span></div>{isSignedIn ? <button className="button button-primary" type="button" disabled={joinClass.isPending} onClick={() => joinClass.mutate({ classId })} data-testid="button-join-class">{joinClass.isPending ? 'Katılınıyor…' : 'Sınıfa katıl'} <ChevronRight size={16} /></button> : <Link href="/sign-in" className="button button-primary" data-testid="link-sign-in-to-join">Giriş yapıp katıl <ChevronRight size={16} /></Link>}</div>}
        {joinClass.isError && <p className="form-error" role="alert">İstek gönderilemedi. Biraz sonra tekrar deneyebilirsin.</p>}
        {joinClass.isSuccess && joinClass.data.status === 'active' && <div className="pending-note" role="status" data-testid="status-membership-active"><Check size={15} /> Sınıfa katıldın. Sınıf arşivi açılıyor.</div>}
      </section>
      {group.isMember ? <div className="class-content-grid">
        <section className="feed-column"><ClassFeed classId={classId} posts={posts} /></section>
        <aside className="members-column"><div className="section-heading compact"><div><span className="section-number">SINIF KAYDI</span><h2>Arkadaşların</h2></div><span className="member-total">{group.memberCount}</span></div>
          {members.isLoading ? <LoadingBlock label="Üyeler getiriliyor" /> : members.isError ? <ErrorBlock retry={() => void members.refetch()} /> : members.data?.length ? <div className="member-list">{members.data.map((person) => <div className="member-item" key={person.id} data-testid={`member-${person.id}`}><span className="member-avatar">{person.displayName.slice(0, 1)}</span><div><strong>{person.displayName}</strong><small>{person.occupation || person.city || person.classLabel || 'Sınıf arkadaşı'}</small></div></div>)}</div> : <EmptyBlock title="Üye listesi boş" body="İlk sınıf arkadaşları burada görünecek." icon={<Users size={20} />} />}
          <div className="member-boundary"><LockKeyhole size={14} /><p>Bu liste yalnızca sınıf üyelerine görünür.</p></div>
        </aside>
      </div> : <section className="locked-feed"><div className="locked-icon"><LockKeyhole size={22} /></div><span className="section-number">SINIFIN ÖZEL ALANI</span><h2>Anılar burada<br />güvende.</h2><p>Bu sınıfa ait gönderiler ve üye listesi yalnızca sınıf üyelerine görünür.</p><div className="locked-line" /></section>}
    </main>
  </PageShell>;
}

function ClassFeed({ classId, posts }: { classId: number; posts: UseQueryResult<Post[], Error> }) {
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<PostInput['kind']>('not');
  const postKinds: Array<{ key: PostInput['kind']; label: string }> = [
    { key: 'not', label: 'Not' },
    { key: 'ani', label: 'Anı' },
    { key: 'duyuru', label: 'Duyuru' },
  ];
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const client = useQueryClient();
  const createPost = useCreateClassPost({ mutation: { onSuccess: async () => {
    setContent('');
    await Promise.all([
      client.invalidateQueries({ queryKey: getGetClassPostsQueryKey(classId) }),
      client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
    ]);
  } } });
  const createComment = useCreateComment({ mutation: { onSuccess: async (_data, variables) => {
    setCommentDrafts((prev) => ({ ...prev, [variables.postId]: '' }));
    await client.invalidateQueries({ queryKey: getGetClassPostsQueryKey(classId) });
  } } });
  const setReaction = useSetPostReaction({ mutation: { onSuccess: async () => {
    await client.invalidateQueries({ queryKey: getGetClassPostsQueryKey(classId) });
  } } });
  const submitPost = (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    createPost.mutate({ classId, data: { content: content.trim(), kind } }, { onError: () => undefined });
  };
  return <div className="feed-wrap">
    <div className="section-heading"><div><span className="section-number">SINIFIN İÇİNDEN</span><h2>Not defteri</h2></div></div>
    <form className="compose-card" onSubmit={submitPost} data-testid="form-create-post">
      <label htmlFor="new-post" className="field-label">Sınıfına bir not bırak</label>
      <textarea id="new-post" rows={3} maxLength={2000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Aklında kalan bir anı, küçük bir haber…" data-testid="input-post-content" />
      <div className="compose-footer"><div className="kind-select" role="group" aria-label="Gönderi türü">{postKinds.map(({ key, label }) => <button type="button" key={key} className={kind === key ? 'active' : ''} onClick={() => setKind(key)} data-testid={`button-post-kind-${key}`}>{label}</button>)}</div><button className="button button-primary button-small" type="submit" disabled={!content.trim() || createPost.isPending} data-testid="button-submit-post">{createPost.isPending ? 'Paylaşılıyor…' : 'Paylaş'} <ChevronRight size={15} /></button></div>
      {createPost.isError && <p className="form-error" role="alert">Notun paylaşılırken bir sorun oldu. Tekrar deneyebilirsin.</p>}
    </form>
    {posts.isLoading ? <LoadingBlock label="Sınıf notları yükleniyor" /> : posts.isError ? <ErrorBlock retry={() => void posts.refetch()} /> : posts.data?.length ? <div className="post-list">{posts.data.map((post) => <article className="post-card" key={post.id} data-testid={`post-card-${post.id}`}><div className="post-topline"><span className={`post-kind kind-${post.kind}`}>{kindLabel(post.kind)}</span><time>{new Date(post.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</time></div><p className="post-content">{post.content}</p><div className="post-author"><span className="person-avatar tiny">{post.authorName.slice(0, 1)}</span><strong>{post.authorName}</strong></div>
      <div className="post-actions"><button type="button" className={`post-action ${post.reactedByMe ? 'reacted' : ''}`} disabled={setReaction.isPending} onClick={() => setReaction.mutate({ postId: post.id, data: { liked: !post.reactedByMe } })} data-testid={`button-react-${post.id}`} aria-pressed={post.reactedByMe}><Heart size={15} fill={post.reactedByMe ? 'currentColor' : 'none'} /> {post.reactionCount} beğeni</button><span className="post-action-static"><MessageCircle size={15} /> {post.commentCount} yorum</span></div>
      <div className="comments-list">{post.comments?.map((comment) => <div className="comment-row" key={comment.id} data-testid={`comment-${comment.id}`}><strong>{comment.authorName}</strong><span>{comment.content}</span></div>)}</div>
      <form className="comment-form" onSubmit={(e) => { e.preventDefault(); const draft = commentDrafts[post.id]?.trim(); if (draft) createComment.mutate({ postId: post.id, data: { content: draft } }); }}><input aria-label={`${post.authorName} gönderisine yorum yaz`} value={commentDrafts[post.id] ?? ''} onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))} placeholder="Bir yorum ekle…" maxLength={1000} data-testid={`input-comment-${post.id}`} /><button type="submit" disabled={!commentDrafts[post.id]?.trim() || createComment.isPending} data-testid={`button-comment-${post.id}`}>Gönder</button></form>
    </article>)}</div> : <EmptyBlock title="Defter henüz boş" body="Sınıfına ilk notu sen bırak. Belki bir anı, belki bir merhaba." icon={<Sparkles size={20} />} />}
  </div>;
}

function ProfilePage() {
  const profile = useGetMyProfile();
  const client = useQueryClient();
  const [form, setForm] = useState({ displayName: '', bio: '', city: '', occupation: '', discoverable: false });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (profile.data) setForm({ displayName: profile.data.displayName, bio: profile.data.bio ?? '', city: profile.data.city ?? '', occupation: profile.data.occupation ?? '', discoverable: profile.data.discoverable });
  }, [profile.data?.id]);
  const update = useUpdateMyProfile({ mutation: { onSuccess: async (data) => {
    client.setQueryData(getGetMyProfileQueryKey(), data);
    await Promise.all([
      client.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
      client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
    ]);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
  } } });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload: ProfileUpdate = {
      displayName: form.displayName.trim(),
      bio: form.bio.trim() || null,
      city: form.city.trim() || null,
      occupation: form.occupation.trim() || null,
      discoverable: form.discoverable,
    };
    update.mutate({ data: payload });
  };
  return <PageShell portal><main className="content-width profile-page">
    <div className="page-intro fade-up"><span className="eyebrow"><span className="eyebrow-line" /> KENDİ SAYFAN</span><h1>Profil <em>kartım.</em></h1><p>Eski arkadaşlarının seni tanımasına yardımcı olacak bilgileri düzenle.</p></div>
    {profile.isLoading ? <LoadingBlock label="Profilin yükleniyor" /> : profile.isError || !profile.data ? <ErrorBlock retry={() => void profile.refetch()} /> : <div className="profile-layout">
      <section className="profile-preview"><div className="profile-card-paper"><span className="archive-code">SINIFIM ÜYE KARTI</span><div className="large-avatar">{form.displayName.slice(0, 1) || 'S'}</div><h2>{form.displayName || 'Adın soyadın'}</h2><p>{form.occupation || 'Mesleğin'}</p><div className="profile-card-rule" /><div className="profile-card-detail"><MapPin size={14} /> {form.city || 'Şehrin'}</div><div className="card-footnote">BİR ZAMANLAR AYNI SINIFTA</div></div>
        <div className="privacy-card"><ShieldCheck size={18} /><div><strong>Görünürlüğün sende</strong><p>Aranabilirlik ayarını kapatırsan profilin kişi aramalarında listelenmez.</p></div></div>
      </section>
      <form className="profile-form" onSubmit={submit} data-testid="form-profile">
        <div className="section-heading compact"><div><span className="section-number">BİLGİLERİN</span><h2>Profilini düzenle</h2></div></div>
        <label className="field-label" htmlFor="profile-name">Görünen ad</label><input className="text-input" id="profile-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} maxLength={80} required data-testid="input-profile-name" />
        <label className="field-label" htmlFor="profile-bio">Kısaca kendinden bahset</label><textarea className="text-input textarea-input" id="profile-bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={300} rows={4} placeholder="Eski sınıf arkadaşlarına kendini hatırlat…" data-testid="input-profile-bio" /><span className="character-count">{form.bio.length}/300</span>
        <div className="form-two-col"><div><label className="field-label" htmlFor="profile-city">Şehir</label><input className="text-input" id="profile-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={100} placeholder="Örn. İzmir" data-testid="input-profile-city" /></div><div><label className="field-label" htmlFor="profile-occupation">Meslek</label><input className="text-input" id="profile-occupation" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} maxLength={100} placeholder="Örn. Öğretmen" data-testid="input-profile-occupation" /></div></div>
        <label className="discoverability-toggle"><input type="checkbox" checked={form.discoverable} onChange={(e) => setForm({ ...form, discoverable: e.target.checked })} data-testid="input-profile-discoverable" /><span className="toggle-visual" /><span><strong>Profilim kişi aramalarında bulunabilir</strong><small>Bu ayar yalnızca profilinin arama sonuçlarında görünmesini etkiler. Sınıf içeriğine erişim sağlamaz.</small></span></label>
        {update.isError && <p className="form-error" role="alert">Profilin kaydedilemedi. Bilgilerini kontrol edip tekrar deneyebilirsin.</p>}
        <div className="profile-save-row">{saved && <span className="saved-message" role="status" data-testid="status-profile-saved"><Check size={15} /> Değişikliklerin kaydedildi</span>}<button className="button button-primary" type="submit" disabled={update.isPending || !form.displayName.trim()} data-testid="button-save-profile">{update.isPending ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}</button></div>
      </form>
    </div>}
  </main></PageShell>;
}

function SignInPage() {
  return <div className="auth-screen paper-grain"><div className="auth-context"><Mark /><span className="section-number">ESKİ SINIFINA DÖNÜŞ</span><h1>Bir merhaba<br /><em>kadar yakın.</em></h1><p>Sınıf arkadaşlarınla yeniden buluşmak için arşivine giriş yap.</p><div className="auth-privacy"><ShieldCheck size={16} /> Kişisel bilgilerin senin kontrolünde.</div></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}
function SignUpPage() {
  return <div className="auth-screen paper-grain"><div className="auth-context"><Mark /><span className="section-number">SEN DE ARŞİVE KATIL</span><h1>Yıllar sonra<br /><em>yeniden merhaba.</em></h1><p>Bir okul, bir sınıf, bir sürü ortak anı. Başlamak için yerin hazır.</p><div className="auth-privacy"><ShieldCheck size={16} /> Sınıf paylaşımları yalnızca üyelere açık.</div></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/portal" /></Show><Show when="signed-out"><PublicHome /></Show></>;
}
function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function CacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  useEffect(() => {
    let previous: string | null | undefined;
    const remove = addListener(({ user }) => {
      const next = user?.id ?? null;
      if (previous !== undefined && previous !== next) client.clear();
      previous = next;
    });
    return remove;
  }, [addListener, client]);
  return null;
}
function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/portal">{() => <Protected><Portal /></Protected>}</Route>
    <Route path="/search" component={SearchPage} />
    <Route path="/classes/:classId" component={ClassPage} />
    <Route path="/profile">{() => <Protected><ProfilePage /></Protected>}</Route>
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route>{() => <PageShell portal><main className="content-width not-found"><span className="section-number">SAYFA BULUNAMADI</span><h1>Bu sayfa arşivde<br /><em>yok.</em></h1><Link className="button button-primary" href="/" data-testid="link-not-found-home">Ana sayfaya dön</Link></main></PageShell>}</Route>
  </Switch></RoutedErrorBoundary>;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      ...trTR,
      signIn: { ...(trTR.signIn ?? {}), start: { ...(trTR.signIn?.start ?? {}), title: 'Yeniden hoş geldin', subtitle: 'Sınıfım arşivine giriş yap.' } },
      signUp: { ...(trTR.signUp ?? {}), start: { ...(trTR.signUp?.start ?? {}), title: 'Arşive katıl', subtitle: 'Sınıf arkadaşlarınla yeniden buluş.' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <CacheInvalidator />
      <Router />
      <Toaster />
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) throw new Error('VITE_CLERK_PUBLISHABLE_KEY tanımlı değil.');
  return <TooltipProvider><WouterRouter base={basePath}><ClerkRoutes /></WouterRouter></TooltipProvider>;
}

export default App;
