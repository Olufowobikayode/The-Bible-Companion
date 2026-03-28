import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { askBibleQuestionStream, generateSpeech, transcribeAudio } from '../lib/gemini';
import { Send, User, Sparkles, Loader2, Mic, Volume2, MoreVertical, Phone, Video, ArrowLeft, Check, CheckCheck, Save, Bookmark } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLocation, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
}

export default function Chat() {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Hello! I'm your Bible Companion. How can I help you research the Word or find peace today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userContext, setUserContext] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const processedInitialQuery = useRef(false);

  useEffect(() => {
    if (location.state?.initialQuery && !processedInitialQuery.current) {
      processedInitialQuery.current = true;
      handleSend(location.state.initialQuery);
      // Clear location state to prevent re-triggering on back/forward
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Failed to get session:", error);
        return;
      }
      setUser(session?.user ?? null);
      if (session?.user) fetchUserContext();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserContext();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserContext = async () => {
    try {
      console.log("Fetching user context...");
      const bookmarks = await api.get('/api/bookmarks');
      console.log("Bookmarks fetched:", bookmarks);
      const notes = await api.get('/api/notes');
      console.log("Notes fetched:", notes);

      const bookmarkText = bookmarks.map((b: any) => `Bookmark: ${b.verseRef} - ${b.text}`).join('\n');
      const noteText = notes.map((n: any) => `Note: ${n.title}\n${n.content}`).join('\n---\n');
      
      setUserContext(`${bookmarkText}\n\n${noteText}`);
    } catch (error) {
      console.error("Failed to fetch user context:", error);
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { 
      role: 'user', 
      content: textToSend,
      timestamp: new Date(),
      status: 'sent'
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Simulate message delivered/read status
    setTimeout(() => {
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastUserMsg = newMsgs.filter(m => m.role === 'user').pop();
        if (lastUserMsg) lastUserMsg.status = 'read';
        return newMsgs;
      });
    }, 1000);

    let assistantContent = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date() }]);

    try {
      const stream = askBibleQuestionStream(textToSend, 'devotional', userContext);
      for await (const chunk of stream) {
        assistantContent += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = assistantContent;
          return newMessages;
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to get response.');
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: "I'm sorry, I encountered an error. Please try again.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToNotepad = async (content: string) => {
    if (!user) {
      toast.error('Please sign in to save notes.');
      return;
    }

    try {
      await api.post('/api/notes', {
        title: `Study: ${content.slice(0, 30)}...`,
        content: content
      });
      toast.success('Saved to Notepad!');
    } catch (error) {
      console.error('Failed to save to notepad:', error);
      toast.error('Failed to save to notepad.');
    }
  };

  const handleTTS = async (text: string) => {
    try {
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        audio.play();
      } else {
        toast.error('Could not generate speech.');
      }
    } catch (error) {
      console.error('TTS failed:', error);
      toast.error('Text-to-speech failed.');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setLoading(true);
          try {
            const transcription = await transcribeAudio(base64Audio);
            handleSend(transcription);
          } catch (error) {
            console.error('Transcription failed:', error);
            toast.error('Failed to transcribe audio.');
          } finally {
            setLoading(false);
          }
        };
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access denied:', error);
      toast.error('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  return (
    <div className="max-w-3xl mx-auto h-[100dvh] md:h-[90vh] md:mt-8 flex flex-col bg-[#efeae2] md:rounded-3xl shadow-2xl overflow-hidden relative border border-gray-200">
      {/* Header */}
      <div className="bg-cream border-b border-sage/10 px-4 py-3 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/" className="md:hidden -ml-2 p-2 hover:bg-sage/10 rounded-full transition-colors text-ink/60">
            <ArrowLeft size={20} />
          </Link>
          <div className="w-10 h-10 bg-sage-light rounded-full flex items-center justify-center text-sage-dark relative overflow-hidden">
            <Sparkles size={20} className="absolute opacity-20" />
            <span className="serif text-xl font-bold z-10">V</span>
          </div>
          <div>
            <h1 className="font-semibold text-sage-dark text-[16px] leading-tight">Vision Companion</h1>
            <p className="text-[13px] text-ink/50 leading-tight">
              {loading ? 'typing...' : 'online'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-ink/60">
          <button className="hover:text-sage p-2 rounded-full transition-colors hidden sm:block"><Video size={20} /></button>
          <button className="hover:text-sage p-2 rounded-full transition-colors hidden sm:block"><Phone size={20} /></button>
          <button className="hover:text-sage p-2 rounded-full transition-colors"><MoreVertical size={20} /></button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 z-10 bg-[#FAF9F6]">
        <div className="flex justify-center mb-6">
          <div className="bg-sage-light/30 text-ink/60 text-xs px-4 py-2 rounded-full shadow-sm text-center max-w-[80%] border border-sage/10">
            A quiet place for reflection and guidance.
          </div>
        </div>

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={cn(
                  "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 relative shadow-sm border border-sage/10",
                  isUser ? "bg-sage text-white rounded-br-sm" : "bg-white text-ink/80 rounded-bl-sm"
                )}
              >
                <div className={cn("markdown-body text-[15px] leading-relaxed", isUser ? "text-white" : "text-ink/80")}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                
                <div className="flex items-center justify-end gap-2 mt-2 -mb-1">
                  {!isUser && (
                    <>
                      <button 
                        onClick={() => handleSaveToNotepad(msg.content)}
                        className="text-ink/40 hover:text-sage transition-colors"
                        title="Save to Notepad"
                      >
                        <Save size={14} />
                      </button>
                      <button 
                        onClick={() => handleTTS(msg.content)}
                        className="text-ink/40 hover:text-sage transition-colors"
                        title="Read aloud"
                      >
                        <Volume2 size={14} />
                      </button>
                    </>
                  )}
                  <span className={cn("text-[11px] leading-none", isUser ? "text-white/70" : "text-ink/40")}>
                    {format(msg.timestamp, 'HH:mm')}
                  </span>
                  {isUser && (
                    <span className="text-white/90 ml-0.5">
                      {msg.status === 'read' ? <CheckCheck size={14} /> : <Check size={14} className="opacity-70" />}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-sage/10">
              <div className="flex gap-1.5 items-center h-5">
                <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-sage/40 rounded-full" />
                <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-sage/40 rounded-full" />
                <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-sage/40 rounded-full" />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="bg-cream border-t border-sage/10 px-4 py-3 flex items-end gap-2 z-10">
        <div className="flex-grow bg-white rounded-2xl flex items-end px-3 py-1 shadow-sm border border-sage/20 focus-within:border-sage transition-colors">
          <button className="p-2 text-ink/40 hover:bg-sage-light hover:text-sage-dark rounded-full transition-colors mb-0.5">
            <Sparkles size={20} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-grow bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[40px] py-2.5 px-2 text-[15px] leading-5 text-ink/80"
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
        </div>
        
        {input.trim() ? (
          <button
            onClick={() => handleSend()}
            disabled={loading}
            className="bg-sage text-white p-3 rounded-full hover:bg-sage-dark transition-colors shadow-sm flex-shrink-0 mb-0.5"
          >
            <Send size={20} className="ml-0.5" />
          </button>
        ) : (
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={cn(
              "p-3 rounded-full transition-colors shadow-sm flex-shrink-0 mb-0.5",
              isRecording ? "bg-red-500 text-white animate-pulse" : "bg-sage text-white hover:bg-sage-dark"
            )}
          >
            <Mic size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
