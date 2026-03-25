import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Send, Users, MessageSquare, List } from 'lucide-react';
import { toast } from 'sonner';

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'threads' | 'chat'>('chat');

  const [threads, setThreads] = useState<any[]>([]);
  const [newThread, setNewThread] = useState({ title: '', content: '' });

  useEffect(() => {
    if (groupId) {
      fetchGroup();
      fetchMessages();
      fetchThreads();
    }
  }, [groupId]);

  const fetchThreads = async () => {
    try {
      const ts = await api.get(`/api/groups/${groupId}/threads`);
      setThreads(ts);
    } catch (error) {
      console.error("Error fetching threads:", error);
    }
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThread.title || !newThread.content || !user) return;
    try {
      await api.post(`/api/groups/${groupId}/threads`, newThread);
      setNewThread({ title: '', content: '' });
      fetchThreads();
      toast.success("Thread created!");
    } catch (error) {
      console.error("Error creating thread:", error);
      toast.error("Failed to create thread");
    }
  };

  const fetchGroup = async () => {
    try {
      const groups = await api.get('/api/groups');
      setGroup(groups.find((g: any) => g.id === groupId));
    } catch (error) {
      console.error("Error fetching group:", error);
    }
  };

  const fetchMessages = async () => {
    try {
      const msgs = await api.get(`/api/groups/${groupId}/messages`);
      setMessages(msgs);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    try {
      await api.post(`/api/groups/${groupId}/messages`, { text: newMessage });
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  if (!group) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="serif text-3xl font-bold text-sage-dark mb-2">{group.name}</h1>
      <p className="text-ink/70 mb-6">{group.description}</p>

      <div className="flex gap-4 mb-6 border-b border-sage/10">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`py-2 px-4 ${activeTab === 'chat' ? 'border-b-2 border-sage text-sage' : ''}`}
        >
          <MessageSquare className="inline w-4 h-4 mr-2" /> Live Chat
        </button>
        <button 
          onClick={() => setActiveTab('threads')}
          className={`py-2 px-4 ${activeTab === 'threads' ? 'border-b-2 border-sage text-sage' : ''}`}
        >
          <List className="inline w-4 h-4 mr-2" /> Forum Threads
        </button>
      </div>

      {activeTab === 'chat' && (
        <div className="bg-white p-6 rounded-2xl border border-sage/10 shadow-sm">
          <div className="h-96 overflow-y-auto mb-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`p-3 rounded-lg ${msg.senderId === user?.id ? 'bg-sage/10 ml-auto max-w-[80%]' : 'bg-gray-100 mr-auto max-w-[80%]'}`}>
                <p className="text-xs text-ink/50">{msg.senderName}</p>
                <p>{msg.text}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-grow p-3 border border-sage/20 rounded-xl"
            />
            <button type="submit" className="bg-sage text-white p-3 rounded-xl"><Send size={20} /></button>
          </form>
        </div>
      )}

      {activeTab === 'threads' && (
        <div className="bg-white p-6 rounded-2xl border border-sage/10 shadow-sm">
          <form onSubmit={handleCreateThread} className="mb-6 space-y-2">
            <input
              type="text"
              value={newThread.title}
              onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
              placeholder="Thread Title"
              className="w-full p-3 border border-sage/20 rounded-xl"
            />
            <textarea
              value={newThread.content}
              onChange={(e) => setNewThread({ ...newThread, content: e.target.value })}
              placeholder="What's on your mind?"
              className="w-full p-3 border border-sage/20 rounded-xl"
            />
            <button type="submit" className="bg-sage text-white px-4 py-2 rounded-xl">Create Thread</button>
          </form>
          <div className="space-y-4">
            {threads.map((thread, i) => (
              <div key={i} className="p-4 border border-sage/10 rounded-xl">
                <h3 className="font-bold text-lg">{thread.title}</h3>
                <p className="text-ink/70">{thread.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
