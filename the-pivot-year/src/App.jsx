import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Book, ChevronLeft, ChevronRight, Download, Calendar, Cloud, CloudOff, Loader, Users } from 'lucide-react';
import { signInAnonymously, onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db, appId } from './firebase';
import { ALL_PROMPTS, MONTHLY_THEMES } from './data/prompts';
import AuthScreen from './components/AuthScreen';

export default function JournalApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentDay, setCurrentDay] = useState(1);
  const [entries, setEntries] = useState({}); // Private entries
  const [saveStatus, setSaveStatus] = useState('idle'); // Status for private entry
  
  const [showSidebar, setShowSidebar] = useState(false); 

  // Ref for debouncing private journal writes
  const privateTimeoutRef = useRef(null);
  
  const userId = user?.uid || 'Authenticating...';

  // 1. Initialize Auth
  useEffect(() => {
    // Just listen for auth state changes. Login is handled by AuthScreen.
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load Private Data from Firestore & Migrate LocalStorage if needed
  useEffect(() => {
    if (!user) return;

    // --- Private Journal Data Listener ---
    const privateCollectionRef = collection(db, 'artifacts', appId, 'users', user.uid, 'journal_entries');
    const unsubscribePrivate = onSnapshot(privateCollectionRef, (snapshot) => {
      const loadedEntries = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.day && data.text) {
          loadedEntries[data.day] = data.text;
        }
      });
      
      setEntries((prev) => {
        // Migration check logic
        const localData = localStorage.getItem('pivotYearEntries');
        if (localData && Object.keys(loadedEntries).length === 0) {
           return JSON.parse(localData);
        }
        return { ...prev, ...loadedEntries };
      });
    }, (error) => {
      console.error("Error fetching private entries:", error);
      setSaveStatus('error');
    });

    // Restore last visited day
    const lastActiveDay = localStorage.getItem('pivotYearLastDay');
    if (lastActiveDay) {
      setCurrentDay(parseInt(lastActiveDay));
    }

    return () => unsubscribePrivate();
  }, [user]);
  

  // 3. Migration Logic (Runs once if local data is found)
  useEffect(() => {
    if (!user) return;
    
    const migrateData = async () => {
      const localDataStr = localStorage.getItem('pivotYearEntries');
      if (localDataStr) {
        const localData = JSON.parse(localDataStr);
        try {
          const batch = writeBatch(db);
          let hasMigration = false;
          
          Object.keys(localData).forEach(day => {
             const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'journal_entries', `day_${day}`);
             batch.set(ref, { day: parseInt(day), text: localData[day], updatedAt: new Date() });
             hasMigration = true;
          });

          if (hasMigration) {
            await batch.commit();
            console.log("Migration complete. Clearing local storage.");
            localStorage.removeItem('pivotYearEntries');
          }
        } catch (e) {
          console.error("Migration failed", e);
        }
      }
    };
    
    if (localStorage.getItem('pivotYearEntries') && Object.keys(entries).length > 0) {
      migrateData();
    }
  }, [user, entries]);


  // 5. Handle Private Journal Text Change & Debounced Save
  const handleEntryChange = (text) => {
    const day = currentDay;
    
    setEntries(prev => ({ ...prev, [day]: text }));
    setSaveStatus('saving');

    if (privateTimeoutRef.current) clearTimeout(privateTimeoutRef.current);

    privateTimeoutRef.current = setTimeout(async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'journal_entries', `day_${day}`);
        await setDoc(docRef, {
          day: day,
          text: text,
          updatedAt: new Date()
        }, { merge: true });
        setSaveStatus('saved');
      } catch (err) {
        console.error("Private Journal Save error", err);
        setSaveStatus('error');
      }
    }, 1500); // Wait 1.5s after typing stops to save
  };

  // Navigate
  const changeDay = (newDay) => {
    if (newDay >= 1 && newDay <= 365) {
      setCurrentDay(newDay);
      localStorage.setItem('pivotYearLastDay', newDay.toString()); // Keep generic UI state local
      window.scrollTo(0, 0);
    }
  };


  const downloadJournal = () => {
    let content = "MY PIVOT YEAR JOURNAL\n\n";
    ALL_PROMPTS.forEach(p => {
      content += `--- DAY ${p.day}: ${p.theme.toUpperCase()} ---\n`;
      content += `Prompt: ${p.text}\n\n`;
      content += `My Entry:\n${entries[p.day] || "(No entry)"}\n\n`;
      content += "====================================\n\n";
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-pivot-year-journal.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentPrompt = ALL_PROMPTS[currentDay - 1];
  const progress = (Object.keys(entries).length / 365) * 100;



  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader size={24} className="animate-spin text-stone-400" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-serif flex flex-col md:flex-row">
      
      {/* Mobile Header */}
      <div className="md:hidden p-4 bg-white border-b border-stone-200 flex justify-between items-center sticky top-0 z-20">
        <span className="font-bold text-xl tracking-tight text-stone-900">The Pivot Year</span>
        <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 bg-stone-100 rounded">
          <Calendar size={20} />
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`fixed md:relative z-10 w-64 h-full bg-white border-r border-stone-200 transform transition-transform duration-300 ease-in-out ${showSidebar ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 overflow-y-auto`}>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-2 hidden md:block">The Pivot Year</h1>
          <p className="text-xs text-stone-500 mb-6 uppercase tracking-widest">Companion Journal</p>
          
          {/* User ID Section */}
          <div className="mt-4 p-3 bg-stone-100 rounded-lg mb-6">
            <h3 className="text-xs font-bold text-stone-700 uppercase mb-1 flex items-center gap-2">
              <Users size={12} /> Your ID (Share with Friends)
            </h3>
            <p className="text-[10px] text-stone-600 break-all select-all">{userId}</p>
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between text-xs mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-stone-200 rounded-full h-1.5">
              <div className="bg-stone-800 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Jump to Month</h3>
            {MONTHLY_THEMES.map((theme, idx) => {
              const startDay = idx * 30 + 1; // Approx
              return (
                <button 
                  key={idx}
                  onClick={() => { changeDay(startDay); setShowSidebar(false); }}
                  className="block w-full text-left px-3 py-2 text-sm rounded hover:bg-stone-100 text-stone-600 truncate"
                >
                  {idx + 1}. {theme.title}
                </button>
              )
            })}
          </div>
          
          <div className="mt-8 pt-8 border-t border-stone-100">
             <button 
               onClick={downloadJournal}
               className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500 hover:text-stone-900 transition-colors"
             >
               <Download size={14} /> Export Journal
             </button>
             
             <button 
               onClick={() => signOut(auth)}
               className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500 hover:text-red-700 transition-colors mt-4"
             >
               <Users size={14} /> Sign Out
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 lg:p-20 overflow-y-auto h-screen bg-stone-50">
        <div className="max-w-2xl mx-auto">
          
          {/* Navigation Controls */}
          <div className="flex justify-between items-center mb-12">
            <button 
              onClick={() => changeDay(currentDay - 1)}
              disabled={currentDay === 1}
              className="flex items-center gap-2 text-stone-500 hover:text-stone-900 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={20} /> <span className="hidden sm:inline">Prev Day</span>
            </button>
            
            <div className="text-center">
              <span className="text-xs font-bold tracking-[0.2em] text-stone-400 uppercase block mb-1">
                {currentPrompt.theme} Phase
              </span>
              <span className="text-3xl font-serif italic text-stone-900">
                Day {currentDay}
              </span>
            </div>

            <button 
              onClick={() => changeDay(currentDay + 1)}
              disabled={currentDay === 365}
              className="flex items-center gap-2 text-stone-500 hover:text-stone-900 disabled:opacity-30 transition-colors"
            >
              <span className="hidden sm:inline">Next Day</span> <ChevronRight size={20} />
            </button>
          </div>

          {/* Prompt Card */}
          <div className="bg-white p-8 md:p-12 shadow-sm border border-stone-100 rounded-sm mb-8 transition-all duration-500">
            <div className="flex justify-center mb-6 text-stone-300">
              <Book size={24} strokeWidth={1} />
            </div>
            
            <p className="text-center text-lg md:text-xl leading-relaxed text-stone-800 mb-6 font-medium">
              {currentPrompt.text.split('. ')[1] || currentPrompt.text}
            </p>
            
            <p className="text-center text-xs text-stone-400 italic font-serif">
              Theme: {currentPrompt.themeDesc}
            </p>
          </div>

          {/* PRIVATE JOURNAL EDITOR AREA */}
          <div className="relative mb-12">
             <h2 className="text-xl font-bold mb-3 text-stone-900 flex items-center gap-2">
                <Book size={18} className="text-stone-500"/> Private Journal Entry
              </h2>
            <textarea
              value={entries[currentDay] || ''}
              onChange={(e) => handleEntryChange(e.target.value)}
              placeholder="Start writing your pivot... This entry is private and stored only for your user ID."
              className="w-full h-96 p-6 bg-white border border-stone-200 focus:border-stone-400 focus:ring-0 text-stone-700 text-lg leading-loose resize-none placeholder-stone-300 font-serif outline-none rounded-md transition-colors"
              spellCheck="false"
            />
            
            {/* Sync Status Indicator */}
            <div className="absolute top-2 right-2 flex items-center gap-2 text-xs transition-colors duration-300 bg-white p-2 rounded-full shadow-sm">
              {saveStatus === 'saving' && (
                <span className="text-stone-400 flex items-center gap-1">
                  <Loader size={12} className="animate-spin" /> Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-green-600 flex items-center gap-1">
                  <Cloud size={12} /> Saved to Cloud
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-400 flex items-center gap-1">
                  <CloudOff size={12} /> Sync Error
                </span>
              )}
              {saveStatus === 'idle' && (
                 <span className="text-stone-300 flex items-center gap-1">
                  <Cloud size={12} /> Cloud Ready
                </span>
              )}
            </div>
          </div>
          
          {/* Footer Quote */}
          <div className="mt-20 pt-10 border-t border-stone-200 text-center">
             <p className="text-stone-400 text-sm italic">
               "The person you are becoming is already within you."
             </p>
          </div>

        </div>
      </main>
      
      {/* Background decoration */}
      <div className="fixed top-0 right-0 p-20 opacity-5 pointer-events-none z-0">
         <div className="w-64 h-64 rounded-full border border-stone-900"></div>
      </div>
      <div className="fixed bottom-0 left-0 p-10 opacity-5 pointer-events-none z-0">
         <div className="w-96 h-96 rounded-full border border-stone-900"></div>
      </div>

    </div>
  );
}
