import React, { useState, useEffect, useRef } from 'react';
import { Send, User as UserIcon, MessageCircle, ChevronLeft, X, Trash2, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { moderateContent } from '../lib/moderation';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  _id: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: any;
  read?: boolean;
}

interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
}

interface Conversation {
  otherUserId: string;
  profile?: UserProfile;
  messages: Message[];
  unreadCount: number;
}

export default function Messages() {
  const location = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);
  
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  const { conversationId } = useParams();
  const queryParams = new URLSearchParams(location.search);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId || location.state?.userId || queryParams.get('userId') || null);

  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
    } else {
      setActiveConversationId(location.state?.userId || queryParams.get('userId') || null);
    }
  }, [conversationId, location.state?.userId, queryParams]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async (currentUserId: string, silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const data: Message[] = await api.get('/api/messages');
      
      // Group messages by other user
      const convosMap = new Map<string, Conversation>();
      
      // If we came from a profile or notification, ensure that conversation exists even if empty
      const initialUserId = location.state?.userId || queryParams.get('userId');
      if (initialUserId && initialUserId !== currentUserId) {
        convosMap.set(initialUserId, {
          otherUserId: initialUserId,
          messages: [],
          unreadCount: 0
        });
      }
      
      data.forEach(msg => {
        // Skip global messages for private chat
        if (msg.recipientId === 'global') return;
        
        const otherUserId = msg.senderId === currentUserId ? msg.recipientId : msg.senderId;
        
        if (!convosMap.has(otherUserId)) {
          convosMap.set(otherUserId, {
            otherUserId,
            messages: [],
            unreadCount: 0
          });
        }
        
        const convo = convosMap.get(otherUserId)!;
        convo.messages.push(msg);
        
        // Count unread if we are the recipient
        if (msg.recipientId === currentUserId && !msg.read) {
          convo.unreadCount++;
        }
      });

      // Fetch profiles for all other users
      const convosArray = Array.from(convosMap.values());
      
      // Sort messages in each convo
      convosArray.forEach(c => c.messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      
      // Sort convos by latest message
      convosArray.sort((a, b) => {
        const lastA = a.messages[a.messages.length - 1];
        const lastB = b.messages[b.messages.length - 1];
        if (!lastA) return 1;
        if (!lastB) return -1;
        return new Date(lastB.createdAt).getTime() - new Date(lastA.createdAt).getTime();
      });

      // Fetch profiles
      const profilesPromises = convosArray.map(async (c) => {
        try {
          // If we already have the profile in state, reuse it to avoid unnecessary API calls
          const existing = conversationsRef.current.find(p => p.otherUserId === c.otherUserId);
          if (existing?.profile) return { ...c, profile: existing.profile };
          
          const profile = await api.get(`/api/user-profiles/${c.otherUserId}`);
          return { ...c, profile };
        } catch (e) {
          return c;
        }
      });

      const convosWithProfiles = await Promise.all(profilesPromises);
      setConversations(convosWithProfiles);
      
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchMessages(session.user.id);
      else setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchMessages(session.user.id);
      else {
        setConversations([]);
        setIsLoading(false);
      }
    });

    // Add polling for new messages
    const interval = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          fetchMessages(session.user.id, true);
        }
      });
    }, 10000); // Poll every 10 seconds

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  const activeConvo = conversations.find(c => c.otherUserId === activeConversationId);

  useEffect(() => {
    scrollToBottom(isSending ? 'auto' : 'smooth');
  }, [activeConvo?.messages, isSending]);

  useEffect(() => {
    if (activeConversationId) {
      scrollToBottom();
      
      // Mark as read (optimistic)
      setConversations(prev => prev.map(c => {
        if (c.otherUserId === activeConversationId && c.unreadCount > 0) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      }));

      // Mark as read (server)
      api.put(`/api/messages/read/${activeConversationId}`, {}).catch(err => {
        console.error("Error marking as read:", err);
      });
    }
  }, [activeConversationId, activeConvo?.messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeConversationId) return;
    
    setIsSending(true);
    try {
      const moderationResult = await moderateContent(newMessage);
      
      if (!moderationResult.isApproved) {
        toast.error(`Message rejected: ${moderationResult.reason}`);
        setIsSending(false);
        return;
      }

      const newMsg = await api.post('/api/messages', {
        text: newMessage,
        recipientId: activeConversationId
      });

      // Optimistically add message
      setConversations(prev => prev.map(c => {
        if (c.otherUserId === activeConversationId) {
          return {
            ...c,
            messages: [...c.messages, newMsg]
          };
        }
        return c;
      }));
      
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await api.delete(`/api/messages/${messageId}`);
      setConversations(prev => prev.map(c => {
        if (c.otherUserId === activeConversationId) {
          return {
            ...c,
            messages: c.messages.filter(m => m._id !== messageId)
          };
        }
        return c;
      }));
      toast.success("Message deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message.");
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage"></div></div>;
  }

  return (
    <div className="w-full h-[100dvh] md:h-[calc(100vh-20px)] flex flex-col bg-white md:bg-cream md:p-4 overflow-hidden">
      {/* Header - Dynamic Title */}
      <div className="flex items-center justify-between px-4 py-3 bg-white md:bg-transparent border-b md:border-none border-sage/10 shrink-0 z-20">
        <div className="flex items-center gap-3">
          {activeConversationId && (
            <Link 
              to="/messages"
              className="p-2 -ml-2 text-sage-dark hover:bg-sage/10 rounded-full transition-colors"
            >
              <ChevronLeft size={24} />
            </Link>
          )}
          <div className="flex items-center gap-3">
            {!activeConversationId ? (
              <>
                <div className="w-10 h-10 bg-sage rounded-xl flex items-center justify-center text-white shadow-lg shadow-sage/20">
                  <Send className="w-5 h-5" />
                </div>
                <h1 className="serif text-2xl font-bold text-sage-dark">Word for Someone</h1>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sage-light flex items-center justify-center text-sage font-bold shrink-0 overflow-hidden">
                  {activeConvo?.profile?.photoURL ? (
                    <img src={activeConvo.profile.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (activeConvo?.profile?.displayName || 'U')[0].toUpperCase()
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-sage-dark leading-tight">{activeConvo?.profile?.displayName || 'Unknown User'}</h2>
                  <p className="text-[11px] text-ink/40 leading-tight">
                    {activeConvo?.profile?.username ? `@${activeConvo.profile.username}` : 'online'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow flex flex-col md:flex-row min-h-0 bg-white md:rounded-3xl md:border md:border-sage/20 md:shadow-xl overflow-hidden">
        
        {/* Conversations List */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-sage/10 flex flex-col min-h-0 ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-sage/10 bg-sage/5 shrink-0">
            <h2 className="font-bold text-sage-dark text-sm uppercase tracking-wider">Conversations</h2>
          </div>
          <div className="overflow-y-auto flex-grow overscroll-contain scroll-smooth bg-white">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-ink/40">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No messages yet.</p>
                <p className="text-xs mt-2">Visit a user's profile to send them a word.</p>
              </div>
            ) : (
              conversations.map(convo => (
                <Link
                  key={convo.otherUserId}
                  to={`/messages/${convo.otherUserId}`}
                  className={`w-full text-left p-4 border-b border-sage/5 hover:bg-sage/5 transition-colors flex items-center gap-3 ${activeConversationId === convo.otherUserId ? 'bg-sage/10' : ''}`}
                >
                  <div className="w-12 h-12 rounded-full bg-sage-light flex items-center justify-center text-sage font-bold shrink-0 overflow-hidden">
                    {convo.profile?.photoURL ? (
                      <img src={convo.profile.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (convo.profile?.displayName || 'U')[0].toUpperCase()
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-bold text-sage-dark truncate">{convo.profile?.displayName || 'Unknown User'}</span>
                      {convo.messages.length > 0 && (
                        <span className="text-[10px] text-ink/40 shrink-0 ml-2">
                          {new Date(convo.messages[convo.messages.length - 1].createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-ink/60 truncate">
                        {convo.messages.length > 0 ? convo.messages[convo.messages.length - 1].text : ''}
                      </p>
                      {convo.unreadCount > 0 && (
                        <span className="bg-sage text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Active Conversation */}
        <div key={activeConversationId || 'none'} className={`w-full md:flex-grow flex flex-col min-h-0 ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
          {activeConvo ? (
            <>
              {/* Messages Area */}
              <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-[#efeae2] overscroll-contain min-h-0 scroll-smooth relative">
                {/* Background pattern like Telegram */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                
                <div className="relative z-10 space-y-4">
                  {activeConvo.messages.map((msg, idx) => {
                    const isMe = msg.senderId === user?.id;
                    const showDate = idx === 0 || new Date(msg.createdAt).toDateString() !== new Date(activeConvo.messages[idx - 1].createdAt).toDateString();
                    
                    return (
                      <React.Fragment key={msg._id || idx}>
                        {showDate && (
                          <div className="flex justify-center my-6">
                            <div className="bg-black/20 backdrop-blur-md text-white text-[11px] font-medium px-4 py-1 rounded-full">
                              {new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                            </div>
                          </div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                        >
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
                            <div 
                              className={cn(
                                "px-3 py-2 rounded-2xl relative shadow-sm text-[15px] leading-relaxed",
                                isMe ? "bg-[#dcf8c6] text-ink rounded-tr-none" : "bg-white text-ink rounded-tl-none"
                              )}
                            >
                              <p className="whitespace-pre-wrap pr-12">{msg.text}</p>
                              
                              <div className="absolute bottom-1 right-2 flex items-center gap-1">
                                <span className="text-[10px] text-ink/40 font-medium">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {isMe && (
                                  <span className="text-sage">
                                    {msg.read ? <CheckCheck size={14} /> : <Check size={14} />}
                                  </span>
                                )}
                              </div>

                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMessage(msg._id);
                                }}
                                className="absolute -top-2 -right-2 bg-white shadow-md p-1 rounded-full text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete message"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </React.Fragment>
                    );
                  })}
                </div>
                <div ref={messagesEndRef} className="h-px w-full shrink-0 overflow-anchor-none" />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-sage/10 shrink-0">
                <form onSubmit={handleSend} className="flex gap-2 items-end max-w-4xl mx-auto">
                  <div className="flex-grow relative bg-sage/5 rounded-2xl border border-sage/10 focus-within:border-sage transition-colors">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(e);
                        }
                      }}
                      placeholder="Message..."
                      className="w-full p-3 pr-10 bg-transparent focus:ring-0 transition-all outline-none resize-none max-h-32 min-h-[48px] text-[15px]"
                      rows={1}
                      disabled={isSending}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSending || !newMessage.trim()}
                    className="bg-sage text-white p-3.5 rounded-full hover:bg-sage-dark transition-all disabled:opacity-50 shadow-lg shadow-sage/20 active:scale-95 shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-ink/40 p-8 text-center bg-[#efeae2]">
              <div className="w-20 h-20 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center mb-4 shadow-sm">
                <MessageCircle className="w-10 h-10 text-sage/30" />
              </div>
              <h3 className="serif text-2xl font-bold text-sage-dark mb-2">Select a Conversation</h3>
              <p className="max-w-xs">Choose a conversation from the list or visit a user's profile to start a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
