import React, { useState, useEffect, useRef } from 'react';
import { Send, User as UserIcon, MessageCircle, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { moderateContent } from '../lib/moderation';
import { Link, useLocation } from 'react-router-dom';

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
  const queryParams = new URLSearchParams(location.search);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(location.state?.userId || queryParams.get('userId') || null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async (currentUserId: string) => {
    try {
      setIsLoading(true);
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
        return new Date(lastB.createdAt).getTime() - new Date(lastA.createdAt).getTime();
      });

      // Fetch profiles
      const profilesPromises = convosArray.map(async (c) => {
        try {
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
      setIsLoading(false);
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

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      
      // Mark as read (optimistic)
      setConversations(prev => prev.map(c => {
        if (c.otherUserId === activeConversationId && c.unreadCount > 0) {
          // In a real app, we'd call an API to mark as read here
          return { ...c, unreadCount: 0 };
        }
        return c;
      }));
    }
  }, [activeConversationId, conversations.find(c => c.otherUserId === activeConversationId)?.messages.length]);

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

  const activeConvo = conversations.find(c => c.otherUserId === activeConversationId);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage"></div></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 h-[calc(100vh-80px)] flex flex-col">
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <div className="w-12 h-12 bg-sage rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sage/20">
          <Send className="w-6 h-6" />
        </div>
        <div>
          <h1 className="serif text-3xl font-bold text-sage-dark">Word for Someone</h1>
          <p className="text-ink/60">Your private sanctuary for encouraging the brethren.</p>
        </div>
      </div>

      <div className="flex-grow bg-white rounded-3xl border border-sage/20 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-0">
        
        {/* Conversations List */}
        <div className={`w-full md:w-1/3 border-r border-sage/10 flex flex-col ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-sage/10 bg-sage/5 shrink-0">
            <h2 className="font-bold text-sage-dark">Conversations</h2>
          </div>
          <div className="overflow-y-auto flex-grow">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-ink/40">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No messages yet.</p>
                <p className="text-xs mt-2">Visit a user's profile to send them a word.</p>
              </div>
            ) : (
              conversations.map(convo => (
                <button
                  key={convo.otherUserId}
                  onClick={() => setActiveConversationId(convo.otherUserId)}
                  className={`w-full text-left p-4 border-b border-sage/5 hover:bg-sage/5 transition-colors flex items-center gap-3 ${activeConversationId === convo.otherUserId ? 'bg-sage/10' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-sage-light flex items-center justify-center text-sage font-bold shrink-0 overflow-hidden">
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
                </button>
              ))
            )}
          </div>
        </div>

        {/* Active Conversation */}
        <div className={`w-full md:w-2/3 flex flex-col ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
          {activeConvo ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-sage/10 bg-sage/5 flex items-center gap-3 shrink-0">
                <button 
                  onClick={() => setActiveConversationId(null)}
                  className="md:hidden p-2 -ml-2 text-sage-dark hover:bg-sage/10 rounded-full"
                >
                  <ChevronLeft size={20} />
                </button>
                <Link to={`/profile/${activeConvo.profile?.username || ''}`} className="flex items-center gap-3 hover:opacity-80">
                  <div className="w-10 h-10 rounded-full bg-sage-light flex items-center justify-center text-sage font-bold shrink-0 overflow-hidden">
                    {activeConvo.profile?.photoURL ? (
                      <img src={activeConvo.profile.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (activeConvo.profile?.displayName || 'U')[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-sage-dark">{activeConvo.profile?.displayName || 'Unknown User'}</h2>
                    {activeConvo.profile?.username && <p className="text-xs text-ink/40">@{activeConvo.profile.username}</p>}
                  </div>
                </Link>
              </div>

              {/* Messages Area */}
              <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-cream/10">
                {activeConvo.messages.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;
                  const showDate = idx === 0 || new Date(msg.createdAt).toDateString() !== new Date(activeConvo.messages[idx - 1].createdAt).toDateString();
                  
                  return (
                    <React.Fragment key={msg._id || idx}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="text-[10px] font-bold text-ink/30 uppercase tracking-widest bg-sage/5 px-3 py-1 rounded-full">
                            {new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl p-3 ${
                          isMe 
                            ? 'bg-sage text-white rounded-tr-sm' 
                            : 'bg-white border border-sage/20 text-ink/80 rounded-tl-sm'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                          <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/70' : 'text-ink/40'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-sage/10 bg-white shrink-0">
                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type an encouraging word..."
                    className="flex-grow p-3 rounded-xl border border-sage/20 bg-cream/30 focus:bg-white focus:ring-2 focus:ring-sage/30 transition-all outline-none"
                    disabled={isSending}
                  />
                  <button
                    type="submit"
                    disabled={isSending || !newMessage.trim()}
                    className="bg-sage text-white p-3 rounded-xl hover:bg-sage-dark transition-colors disabled:opacity-50 flex items-center justify-center shrink-0"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-ink/40 p-8 text-center">
              <div className="w-20 h-20 bg-sage/5 rounded-full flex items-center justify-center mb-4">
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
