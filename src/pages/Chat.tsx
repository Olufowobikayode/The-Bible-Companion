import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { askBibleQuestionStream, generateSpeech, transcribeAudio } from '../lib/gemini';
import { Send, User, Sparkles, Loader2, Mic, Volume2, MoreVertical, Phone, Video, ArrowLeft, Check, CheckCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLocation, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

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
      const stream = askBibleQuestionStream(textToSend, 'devotional');
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
      {/* WhatsApp Chat Background Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.06] pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '120px'
        }}
      />

      {/* WhatsApp Header */}
      <div className="bg-[#008069] text-white px-4 py-3 flex items-center justify-between z-10 shadow-md">
        <div className="flex items-center gap-3">
          <Link to="/" className="md:hidden -ml-2 p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-medium text-[17px] leading-tight">Bible Companion</h1>
            <p className="text-[13px] text-white/80 leading-tight">
              {loading ? 'typing...' : 'online'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-white">
          <button className="hover:bg-white/10 p-2 rounded-full transition-colors hidden sm:block"><Video size={20} /></button>
          <button className="hover:bg-white/10 p-2 rounded-full transition-colors hidden sm:block"><Phone size={20} /></button>
          <button className="hover:bg-white/10 p-2 rounded-full transition-colors"><MoreVertical size={20} /></button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-3 z-10">
        <div className="flex justify-center mb-6">
          <div className="bg-[#FFEECD] text-[#54656f] text-xs px-3 py-1.5 rounded-lg shadow-sm text-center max-w-[80%]">
            Messages are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Click to learn more.
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
                  "max-w-[85%] sm:max-w-[75%] rounded-lg px-3 pt-2 pb-1.5 relative shadow-sm",
                  isUser ? "bg-[#d9fdd3] rounded-tr-none" : "bg-white rounded-tl-none"
                )}
              >
                {/* Chat Bubble Tail */}
                <div className={cn(
                  "absolute top-0 w-3 h-3",
                  isUser 
                    ? "-right-2 bg-[#d9fdd3] [clip-path:polygon(0_0,0%_100%,100%_0)]" 
                    : "-left-2 bg-white [clip-path:polygon(100%_0,0_0,100%_100%)]"
                )} />

                <div className="markdown-body text-[15px] leading-[22px] text-[#111b21]">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                
                <div className="flex items-center justify-end gap-1 mt-1 -mb-1">
                  {!isUser && (
                    <button 
                      onClick={() => handleTTS(msg.content)}
                      className="text-gray-400 hover:text-[#008069] transition-colors mr-1"
                      title="Read aloud"
                    >
                      <Volume2 size={14} />
                    </button>
                  )}
                  <span className="text-[11px] text-[#667781] leading-none">
                    {format(msg.timestamp, 'HH:mm')}
                  </span>
                  {isUser && (
                    <span className="text-[#53bdeb] ml-0.5">
                      {msg.status === 'read' ? <CheckCheck size={14} /> : <Check size={14} className="text-[#667781]" />}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg rounded-tl-none px-4 py-3 shadow-sm relative">
              <div className="absolute top-0 -left-2 w-3 h-3 bg-white [clip-path:polygon(100%_0,0_0,100%_100%)]" />
              <div className="flex gap-1.5 items-center h-5">
                <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* WhatsApp Input Area */}
      <div className="bg-[#f0f2f5] px-4 py-3 flex items-end gap-2 z-10">
        <div className="flex-grow bg-white rounded-2xl flex items-end px-2 py-1 shadow-sm border border-transparent focus-within:border-gray-300 transition-colors">
          <button className="p-2 text-[#54656f] hover:bg-gray-100 rounded-full transition-colors mb-0.5">
            <Sparkles size={22} />
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
            placeholder="Type a message"
            className="flex-grow bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[40px] py-2.5 px-2 text-[15px] leading-5 text-[#111b21]"
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
            className="bg-[#00a884] text-white p-3 rounded-full hover:bg-[#008f6f] transition-colors shadow-sm flex-shrink-0 mb-0.5"
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
              isRecording ? "bg-red-500 text-white animate-pulse" : "bg-[#00a884] text-white hover:bg-[#008f6f]"
            )}
          >
            <Mic size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
