import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Book, ChevronLeft, ChevronRight, Download, Calendar, Cloud, CloudOff, Loader, Users, Send } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, writeBatch, query, where, orderBy, limit } from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- THEME & PROMPT GENERATION SYSTEM ---
const MONTHLY_THEMES = [
  { title: "The Pivot", description: "Recognizing the gap between who you are and who you want to be." },
  { title: "Detachment", description: "Letting go of the old self, the past, and what no longer serves." },
  { title: "Identity", description: "Discovering the person you are becoming underneath the layers." },
  { title: "Uncertainty", description: "Learning to trust the void and the unknown." },
  { title: "Action", description: "Making microshifts and taking small, consistent steps." },
  { title: "Boundaries", description: "Protecting your energy and choosing your environment." },
  { title: "Healing", description: "Addressing the shadows and the roots of your fears." },
  { title: "Worthiness", description: "Accepting abundance, love, and the good you deserve." },
  { title: "Purpose", description: "Finding what lights you up and aligning with your truth." },
  { title: "Presence", description: "Living in the eternal now; mindfulness as a tool." },
  { title: "Resilience", description: "Overcoming setbacks and trusting your inner mountain." },
  { title: "The Arrival", description: "Integration, reflection, and stepping into your new reality." }
];

const PROMPT_TEMPLATES = [
  "What is one microshift you can make today to align with this theme?",
  "If you were not afraid of the outcome, what choice would you make right now?",
  "Describe the version of you that has already mastered this.",
  "What old narrative is trying to keep you small today?",
  "Where do you feel resistance in your body when you think about this?",
  "Who in your life represents this quality to you? What can you learn from them?",
  "What would you tell your younger self about this struggle?",
  "If today was the only day that mattered, how would you spend it?",
  "What are you waiting for permission to do?",
  "Write a letter to the future you who has made it through this phase.",
  "What is the most compassionate thing you can do for yourself today?",
  "How does staying in your comfort zone actually hurt you?",
  "What does your intuition whisper when the noise of the world gets quiet?",
  "Identify one thing you are holding onto that is too heavy.",
  "If your life was a story, what would the chapter title be right now?",
  "What is the gap between your actions and your desires today?",
  "How can you validate your own feelings without needing others to understand?",
  "What feels like a 'failure' that might actually be a redirection?",
  "Imagine your energy is currency. What did you spend it on today?",
  "What is one truth you are avoiding?",
  "How can you be the person you want to be, just for the next hour?",
  "What expectation can you drop today to feel lighter?",
  "Reflect on a time you pivoted before. What strength did you gain?",
  "What does 'enough' look like to you right now?",
  "If you stripped away your job and relationships, who are you?",
  "What is the most honest thing you can say to yourself today?",
  "How are you self-sabotaging? Be gentle but honest.",
  "What would it look like to trust the timing of your life completely?",
  "What is one small promise you can keep to yourself today?",
  "Breathe deeply. What does your heart need you to know?"
];

// Generate 365 prompts
const generatePrompts = () => {
  const prompts = [];
  let dayCount = 1;

  MONTHLY_THEMES.forEach((theme, monthIndex) => {
    const daysInMonth = monthIndex === 11 ? 35 : 30; // 365 days total
    for (let i = 0; i < daysInMonth; i++) {
      const template = PROMPT_TEMPLATES[i % PROMPT_TEMPLATES.length];
      prompts.push({
        day: dayCount,
        theme: theme.title,
        themeDesc: theme.description,
        text: `Day ${dayCount}: ${theme.title}. ${template}`
      });
      dayCount++;
    }
  });
  
  prompts[0].text = "Day 1: The Pivot. Identify the gap. Where are you now, and where do you desperately want to be?";
  prompts[182].text = "Day 183: The Halfway Point. Look back at who you were on Day 1. What has shifted?";
  prompts[364].text = "Day 365: The Completion. You have lived a lifetime in a year. Who are you now?";

  return prompts;
};

const ALL_PROMPTS = generatePrompts();
const SHARED_COLLECTION_NAME = 'day_reflections'; // Public path collection

export default function JournalApp() {
  const [user, setUser] = useState(null);
  const [currentDay, setCurrentDay] = useState(1);
  const [entries, setEntries] = useState({}); // Private entries
  const [saveStatus, setSaveStatus] = useState('idle'); // Status for private entry
  
  const [sharedEntryText, setSharedEntryText] = useState(''); // Current user's shared reflection input
  const [communityReflections, setCommunityReflections] = useState([]); // All shared reflections for the day
  const [sharedSaveStatus, setSharedSaveStatus] = useState('idle'); // Status for shared entry
  
  // FIX: Add state for sidebar visibility, which was missing and causing ReferenceErrors
  const [showSidebar, setShowSidebar] = useState(false); 

  // Ref for debouncing private journal writes
  const privateTimeoutRef = useRef(null);
  
  const userId = user?.uid || 'Authenticating...';

  // 1. Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
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
        // Migration check logic (same as before)
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
  
  // 3. Load Public Shared Reflections
  useEffect(() => {
    if (!user) return;
    
    // --- Public Shared Reflections Listener ---
    const sharedPath = collection(db, 'artifacts', appId, 'public', 'data', SHARED_COLLECTION_NAME);
    // Query for reflections matching the current day, ordered by creation time
    const q = query(
      sharedPath,
      where('day', '==', currentDay),
      // Sort by creation time (or update time) - sorting in-memory to avoid index issues
      // orderBy('createdAt', 'desc') // Removed to avoid mandatory index errors
    );

    const unsubscribePublic = onSnapshot(q, (snapshot) => {
      const reflections = [];
      let currentUserReflection = '';

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.text) {
          const reflection = {
            id: doc.id,
            ...data,
            // Convert Firestore timestamp to JS Date if it exists
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          };
          
          if (data.userId === user.uid) {
            currentUserReflection = data.text;
          }
          reflections.push(reflection);
        }
      });
      
      // Sort reflections by creation time in memory (Newest first)
      reflections.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setCommunityReflections(reflections);
      setSharedEntryText(currentUserReflection); // Pre-fill input with user's existing shared entry
      
    }, (error) => {
       console.error("Error fetching shared reflections:", error);
    });

    return () => unsubscribePublic();
  }, [user, currentDay]);


  // 4. Migration Logic (Runs once if local data is found)
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

  // 6. Handle Shared Reflection Submission
  const saveSharedEntry = async (e) => {
    e.preventDefault();
    if (!user || sharedEntryText.trim() === '') return;

    setSharedSaveStatus('saving');
    
    try {
      // Use the combination of day and userId as the document ID to ensure only one reflection per user per day
      const docId = `${currentDay}_${user.uid}`; 
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', SHARED_COLLECTION_NAME, docId);
      
      await setDoc(docRef, {
        day: currentDay,
        userId: user.uid,
        text: sharedEntryText.trim(),
        createdAt: new Date()
      }, { merge: true }); // Use merge to update existing or create new

      setSharedSaveStatus('saved');
      // The onSnapshot listener will update the communityReflections state automatically
    } catch (err) {
      console.error("Shared Entry Save error", err);
      setSharedSaveStatus('error');
    } finally {
      setTimeout(() => setSharedSaveStatus('idle'), 3000);
    }
  };

  // Navigate
  const changeDay = (newDay) => {
    if (newDay >= 1 && newDay <= 365) {
      setCurrentDay(newDay);
      localStorage.setItem('pivotYearLastDay', newDay.toString()); // Keep generic UI state local
      window.scrollTo(0, 0);
      setSharedEntryText(''); // Clear input when changing day
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
  
  // Helper to format timestamps
  const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });


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
          
          
          {/* SHARED REFLECTIONS SECTION */}
          <div className="mt-16 pt-10 border-t border-stone-200">
             <h2 className="text-xl font-bold mb-6 text-stone-900 flex items-center gap-2">
                <Users size={18} className="text-stone-500"/> Shared Reflections (Day {currentDay})
              </h2>
              
              {/* Submission Form */}
              <form onSubmit={saveSharedEntry} className="mb-8 bg-white p-4 rounded-lg shadow-sm border border-stone-100">
                <p className="text-sm font-bold text-stone-700 mb-2">Post Your Shared Reflection:</p>
                <textarea
                  value={sharedEntryText}
                  onChange={(e) => setSharedEntryText(e.target.value)}
                  placeholder="Share a thought, a quote, or a key takeaway for today's theme (visible to your friends)..."
                  maxLength={500}
                  className="w-full h-24 p-3 bg-stone-50 border border-stone-200 focus:border-stone-400 focus:ring-0 text-sm resize-none placeholder-stone-400 font-serif outline-none rounded-md transition-colors"
                />
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-stone-400">
                    {sharedEntryText.length}/500 characters
                  </span>
                  <button
                    type="submit"
                    disabled={sharedEntryText.trim() === '' || sharedSaveStatus === 'saving'}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full text-white bg-stone-800 hover:bg-stone-900 disabled:bg-stone-400 transition-colors"
                  >
                    {sharedSaveStatus === 'saving' ? (
                      <>
                        <Loader size={16} className="animate-spin" /> Sharing...
                      </>
                    ) : sharedSaveStatus === 'saved' ? (
                       <>
                        <Cloud size={16} /> Shared!
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Share Reflection
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Community Feed */}
              <div className="space-y-4">
                <h3 className="text-md font-bold text-stone-700 mb-4 border-b border-stone-200 pb-2">Community Feed ({communityReflections.length} Reflections)</h3>
                {communityReflections.length === 0 ? (
                  <p className="text-sm text-stone-500 italic p-4 bg-stone-100 rounded-lg">No shared reflections yet for Day {currentDay}. Be the first!</p>
                ) : (
                  communityReflections.map((reflection) => (
                    <div key={reflection.id} className={`p-4 rounded-lg shadow-sm transition-all ${reflection.userId === user.uid ? 'bg-indigo-50 border-indigo-200' : 'bg-white border border-stone-200'}`}>
                      <p className="text-stone-800 text-base leading-relaxed mb-2 font-serif">{reflection.text}</p>
                      <div className="text-xs text-stone-500 mt-2 pt-2 border-t border-dashed border-stone-200 flex justify-between">
                         <span className="font-mono break-all">
                            {reflection.userId === user.uid ? 'You' : `User ID: ${reflection.userId}`}
                         </span>
                         <span>
                            {reflection.createdAt && formatTime(reflection.createdAt)}
                         </span>
                      </div>
                    </div>
                  ))
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