import React, { useState, useEffect } from 'react';
import { ViewState, UserProfile, UserRole, AdItem } from './types';
import Navigation from './components/Navigation';
import NewsView from './views/NewsView';
import ForumView from './views/ForumView';
import ServicesView from './views/ServicesView';
import ProfileView from './views/ProfileView';
import AdminView from './views/AdminView';
import AdCreateView from './views/AdCreateView';
import AdDetailView from './views/AdDetailView';
import LoginView from './views/LoginView';
import RegisterView from './views/RegisterView';
import { NewsCrawler, getCityNameFromCoordinates } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { AlertTriangle } from 'lucide-react';

const LOCATION_CACHE_KEY = 'urbanhub_location_cache';
const LOCATION_CACHE_DURATION = 3600 * 1000; // 1 Hour

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    const saved = localStorage.getItem('urbanhub_current_view');
    return (saved as ViewState) || ViewState.NEWS;
  });

  // Use ref to track currentView for event listeners
  const currentViewRef = React.useRef(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
    localStorage.setItem('urbanhub_current_view', currentView);
  }, [currentView]);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [city, setCity] = useState<string>('本地');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedAd, setSelectedAd] = useState<AdItem | null>(() => {
    const saved = localStorage.getItem('urbanhub_selected_ad');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (selectedAd) {
      localStorage.setItem('urbanhub_selected_ad', JSON.stringify(selectedAd));
    } else {
      localStorage.removeItem('urbanhub_selected_ad');
    }
  }, [selectedAd]);

  useEffect(() => {
    if (!process.env.API_KEY) {
      setApiKeyMissing(true);
    }

    // Verify Supabase Connection
    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        console.error('❌ Supabase connection error:', error);
      } else {
        console.log('✅ Supabase connected successfully');
      }
    });

    NewsCrawler.init();

    // Auth Listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Construct UserProfile
        const userProfile: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata.name || 'User',
          role: (session.user.user_metadata.role as UserRole) || UserRole.ORDINARY,
          avatar: session.user.user_metadata.avatar,
          joinedDate: new Date(session.user.created_at).toLocaleDateString(),
        };
        setUser(userProfile);

        // If on login/register page, redirect to Profile
        if (currentViewRef.current === ViewState.LOGIN || currentViewRef.current === ViewState.REGISTER) {
          setCurrentView(ViewState.PROFILE);
        }
      } else {
        setUser(null);
      }
    });

    // Optimized Geolocation Logic with Cache
    const loadLocation = async () => {
      // 1. Try Cache
      const cached = localStorage.getItem(LOCATION_CACHE_KEY);
      if (cached) {
        try {
          const { city: cachedCity, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < LOCATION_CACHE_DURATION) {
            console.log("Using cached location:", cachedCity);
            setCity(cachedCity);
            return;
          }
        } catch (e) {
          localStorage.removeItem(LOCATION_CACHE_KEY);
        }
      }

      // 2. Fallback to API
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const cityName = await getCityNameFromCoordinates(latitude, longitude);
            updateCity(cityName);
          },
          () => updateCity('本地')
        );
      }
    };

    loadLocation();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []); // Remove currentView dependency to avoid loops, handle redirect inside listener carefully

  const updateCity = (newCity: string) => {
    setCity(newCity);
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
      city: newCity,
      timestamp: Date.now()
    }));
  };

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const renderContent = () => {
    switch (currentView) {
      case ViewState.NEWS:
        return <NewsView
          city={city}
          onCityUpdate={updateCity}
          user={user}
          onNavigate={(view, data) => {
            if (view === ViewState.AD_DETAIL && data) {
              setSelectedAd(data as AdItem);
            }
            setCurrentView(view);
          }}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
        />;
      case ViewState.FORUM:
        return <ForumView city={city} onNavigate={setCurrentView} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
      case ViewState.SERVICES:
        return <ServicesView />;
      case ViewState.PROFILE:
        return <ProfileView onNavigate={setCurrentView} city={city} user={user} />;
      case ViewState.ADMIN:
        return <AdminView onBack={() => setCurrentView(ViewState.PROFILE)} />;
      case ViewState.CREATE_AD:
        return <AdCreateView onBack={() => setCurrentView(ViewState.PROFILE)} />;
      case ViewState.AD_DETAIL:
        if (!selectedAd) {
          setCurrentView(ViewState.NEWS);
          return null;
        }
        return <AdDetailView ad={selectedAd} onBack={() => setCurrentView(ViewState.NEWS)} />;
      case ViewState.LOGIN:
        return <LoginView onNavigate={setCurrentView} />;
      case ViewState.REGISTER:
        return <RegisterView onNavigate={setCurrentView} />;
      default:
        return <NewsView city={city} onCityUpdate={updateCity} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
    }
  };

  const shouldShowNav =
    currentView !== ViewState.ADMIN &&
    currentView !== ViewState.CREATE_AD &&
    currentView !== ViewState.LOGIN &&
    currentView !== ViewState.REGISTER &&
    currentView !== ViewState.AD_DETAIL;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {apiKeyMissing && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 sticky top-0 z-50 shadow-sm" role="alert">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="text-sm font-bold">缺少 API Key</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-grow ${shouldShowNav ? 'pb-24' : ''}`}>
        {renderContent()}
      </main>

      {/* Navigation - Hide on Admin, Ad Create, Login, Register View */}
      {shouldShowNav && (
        <Navigation currentView={currentView} onNavigate={setCurrentView} />
      )}
    </div>
  );
};

export default App;
