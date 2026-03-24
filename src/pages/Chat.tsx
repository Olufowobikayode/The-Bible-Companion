import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { askBibleQuestionStream, generateSpeech, transcribeAudio } from '../lib/gemini';
import { Send, User, Sparkles, Loader2, Mic, Volume2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'image' | 'video' | 'audio';
  mediaUrl?: string;
}

export default function Chat() {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm your Bible Companion. How can I help you research the Word or find peace today? You can ask me questions about any book, including non-canonical ones like Enoch." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [scholarMode, setScholarMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (location.state?.initialQuery) {
      handleSend(location.state.initialQuery);
    }
  }, [location.state]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    let assistantContent = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const stream = askBibleQuestionStream(textToSend, scholarMode ? 'scholarly' : 'devotional');
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
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleTTS = async (text: string) => {
    try {
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        audio.play();
      }
    } catch (error) {
      console.error('TTS failed:', error);
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
          } finally {
            setLoading(false);
          }
        };
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access denied:', error);
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 h-[80vh] flex flex-col">
      <div className="text-center mb-8">
        <h1 className="serif text-3xl font-semibold text-sage-dark">Interactive Companion</h1>
        <div className="flex items-center justify-center gap-4 mt-2">
          <p className="text-ink/40 text-sm">Research, ask, and find guidance with AI intelligence.</p>
          <button
            onClick={() => setScholarMode(!scholarMode)}
            className={cn(
              "text-[10px] uppercase tracking-widest px-3 py-1 rounded-full transition-all border",
              scholarMode 
                ? "bg-sage text-white border-sage" 
                : "bg-white text-sage border-sage/20 hover:bg-sage-light"
            )}
          >
            {scholarMode ? 'Scholar Mode Active' : 'Scholar Mode Off'}
          </button>
        </div>
      </div>

      <div className="flex-grow bg-white rounded-[2rem] border border-sage/10 shadow-xl shadow-sage/5 overflow-hidden flex flex-col">
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-sage text-white' : 'bg-sage-light text-sage-dark'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
                </div>
                <div className={`p-4 rounded-2xl relative group ${
                  msg.role === 'user' 
                    ? 'bg-sage text-white rounded-tr-none' 
                    : 'bg-cream text-ink/80 rounded-tl-none border border-sage/5'
                }`}>
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.role === 'assistant' && (
                    <button 
                      onClick={() => handleTTS(msg.content)}
                      className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity text-sage hover:text-sage-dark"
                    >
                      <Volume2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-cream p-4 rounded-2xl rounded-tl-none border border-sage/5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-sage" />
                <span className="text-sm text-ink/40 italic">Companion is thinking...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="p-6 border-t border-sage/10 bg-sage-light/30">
          <div className="flex gap-3">
            <div className="flex-grow relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Ask a question or research a book..."
                className="w-full bg-white border border-sage/20 rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:border-sage resize-none h-14"
              />
              <div className="absolute right-3 bottom-3 flex gap-2">
                <button 
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  className={`transition-colors ${isRecording ? 'text-red-500' : 'text-ink/30 hover:text-sage'}`}
                >
                  <Mic size={18} />
                </button>
              </div>
            </div>
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-sage text-white p-4 rounded-2xl hover:bg-sage-dark transition-all disabled:opacity-50 shadow-lg shadow-sage/20"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
