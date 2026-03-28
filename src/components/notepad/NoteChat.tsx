import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, Sparkles, Loader2, Bot, User } from 'lucide-react';
import { chatWithNotesStream } from '../../lib/gemini';
import ReactMarkdown from 'react-markdown';

interface Note {
  title: string;
  content: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface NoteChatProps {
  notes: Note[];
}

export default function NoteChat({ notes }: NoteChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const aiMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: aiMessageId, role: 'assistant', content: '' }]);

    try {
      const stream = chatWithNotesStream(userMessage.content, notes);
      let fullContent = '';
      
      for await (const chunk of stream) {
        fullContent += chunk;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === aiMessageId ? { ...msg, content: fullContent } : msg
          )
        );
      }
    } catch (error) {
      console.error('Error chatting with notes:', error);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, content: 'I apologize, but I encountered an error while reflecting on your notes. Please try again.' } : msg
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-sage/10 p-6 sm:p-10 shadow-sm flex flex-col h-[600px]">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <Sparkles className="text-sage w-5 h-5" />
        <h3 className="serif text-xl font-bold text-sage-dark">Theological Dialogue</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-6 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 bg-sage-light/30 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-sage" />
            </div>
            <p className="text-ink/60 max-w-sm leading-relaxed">
              Ask questions about your notes, seek theological clarity, or explore actionable growth steps based on your reflections.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-sage text-white' : 'bg-sage-light text-sage-dark'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`max-w-[80%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-sage text-white rounded-tr-none' 
                  : 'bg-sage-light/20 border border-sage/10 rounded-tl-none text-ink/80'
              }`}>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm prose-sage max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
        
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4"
          >
            <div className="w-8 h-8 rounded-full bg-sage-light text-sage-dark flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-sage-light/20 border border-sage/10 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-sage animate-spin" />
              <span className="text-sm text-ink/60">Reflecting...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about your notes..."
          className="w-full bg-sage-light/20 border border-sage/20 rounded-2xl pl-4 pr-12 py-4 focus:outline-none focus:border-sage/40 resize-none h-[60px] custom-scrollbar"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="absolute right-2 top-2 p-2 bg-sage text-white rounded-xl hover:bg-sage-dark transition-colors disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
