import React, { useState, useEffect } from 'react';
import { Send, User as UserIcon, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { moderateContent } from '../lib/moderation';

interface Message {
  id: string;
  from: string;
  text: string;
  createdAt: any;
  recipientId?: string;
}

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Query for messages sent to the current user OR global messages
    const q = query(
      collection(db, 'messages'),
      where('recipientId', 'in', ['global', auth.currentUser.uid]),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) {
      if (!auth.currentUser) toast.error("Please sign in to send a message.");
      return;
    }
    
    setIsSending(true);
    try {
      const moderationResult = await moderateContent(newMessage);
      
      if (!moderationResult.isApproved) {
        toast.error(`Message rejected: ${moderationResult.reason}`);
        setIsSending(false);
        return;
      }

      // In the main Messages page, we might want to select a recipient.
      // For now, if no recipient is selected, we'll show an error or default to a specific flow.
      // The user wants messages to be strictly between users.
      toast.info("To send a private message, please visit a user's profile and click 'Send a Word'.");
      
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-sage rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sage/20">
          <Send className="w-6 h-6" />
        </div>
        <div>
          <h1 className="serif text-3xl font-bold text-sage-dark">Word for Someone</h1>
          <p className="text-ink/60">Your private sanctuary for encouraging the brethren.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-3xl border border-sage/20 shadow-sm sticky top-24">
            <h2 className="serif text-xl font-bold text-sage-dark mb-4 text-center">Spiritual Guidance</h2>
            <div className="space-y-4 text-sm text-ink/60 leading-relaxed">
              <p>
                "Therefore encourage one another and build each other up, just as in fact you are doing."
              </p>
              <p className="font-bold text-sage">— 1 Thessalonians 5:11</p>
              <hr className="border-sage/10" />
              <p>
                To send a private message to a specific person, visit their profile and look for the <strong>"Send a Word"</strong> button.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h2 className="serif text-2xl font-bold text-sage-dark mb-6 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-sage" />
            Your Private Inbox
          </h2>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="bg-white p-6 rounded-3xl border border-sage/20 shadow-sm hover:shadow-md transition-all group">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center shrink-0 text-sage group-hover:bg-sage group-hover:text-white transition-colors">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-grow">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                      <span className="font-bold text-ink text-lg">
                        From {msg.from}
                      </span>
                      <span className="text-xs font-bold text-sage bg-sage/5 px-3 py-1 rounded-full uppercase tracking-widest">
                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : 'Just now'}
                      </span>
                    </div>
                    <p className="text-ink/80 leading-relaxed italic">"{msg.text}"</p>
                  </div>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-sage/20 border-dashed">
                <div className="w-16 h-16 bg-sage/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-sage/30" />
                </div>
                <h3 className="serif text-xl font-bold text-sage-dark mb-2">Your Inbox is Quiet</h3>
                <p className="text-ink/40 max-w-xs mx-auto">Wait upon the Lord, for He speaks in the silence. Encouragements from the brethren will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
