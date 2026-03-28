import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { PenLine, Trash2, Sparkles, Save, Plus, ChevronRight, Loader2, BookOpen, Share2, MessageCircle } from 'lucide-react';
import { analyzeNote } from '../lib/gemini';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { moderateContent } from '../lib/moderation';
import NoteChat from '../components/notepad/NoteChat';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: any;
  updatedAt: any;
  aiAnalysis?: {
    summary: string;
    verses: { reference: string; text: string }[];
    insights: string;
    tags: string[];
    actionSteps: string[];
    tone: string;
  };
}

export default function Notepad() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const data = await api.get('/api/notes');
        setNotes(data);
      } catch (error) {
        console.error("Error fetching notes:", error);
      } finally {
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
      if (session?.user) fetchNotes();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
      if (session?.user) fetchNotes();
      else {
        setNotes([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync selectedNote with the latest data from the notes list
  useEffect(() => {
    if (selectedNote) {
      const updatedNote = notes.find(n => n.id === selectedNote.id);
      if (updatedNote && !isEditing) {
        // Only update if data actually changed to avoid unnecessary re-renders
        if (JSON.stringify(updatedNote) !== JSON.stringify(selectedNote)) {
          setSelectedNote(updatedNote);
          setTitle(updatedNote.title);
          setContent(updatedNote.content);
        }
      }
    }
  }, [notes, isEditing]);

  const handleSave = async () => {
    if (!user || !content.trim()) return;

    const noteData = {
      title: title.trim() || 'Untitled Note',
      content: content.trim(),
    };

    try {
      // Moderate note content
      const moderationResult = await moderateContent(content);
      if (!moderationResult.isApproved) {
        toast.error(`Note rejected: ${moderationResult.reason}`);
        return;
      }

      if (selectedNote) {
        const updatedNote = await api.put(`/api/notes/${selectedNote.id}`, noteData);
        setNotes(prev => prev.map(n => n.id === selectedNote.id ? updatedNote : n));
        toast.success('Note updated successfully.');
      } else {
        const newNote = await api.post('/api/notes', noteData);
        setNotes(prev => [newNote, ...prev]);
        setSelectedNote(newNote);
        toast.success('Note created successfully.');
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save note", error);
      toast.error('Failed to save note.');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.delete(`/api/notes/${id}`);
      setNotes(prev => prev.filter(n => n.id !== id));
      if (selectedNote?.id === id) {
        setSelectedNote(null);
        setIsEditing(false);
      }
      toast.success('Note deleted successfully.');
    } catch (error) {
      console.error("Failed to delete note", error);
      toast.error('Failed to delete note.');
    }
  };

  const handleSmartAssist = async () => {
    if (!content.trim() || !selectedNote) return;
    
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeNote(content);
      if (analysis) {
        const updatedNote = await api.put(`/api/notes/${selectedNote.id}`, {
          aiAnalysis: analysis
        });
        setNotes(prev => prev.map(n => n.id === selectedNote.id ? updatedNote : n));
        toast.success('Smart Assist analysis complete.');
      }
    } catch (error) {
      console.error("AI Analysis failed", error);
      toast.error('AI Analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startNewNote = () => {
    setSelectedNote(null);
    setTitle('');
    setContent('');
    setIsEditing(true);
  };

  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setIsEditing(false);
  };

  if (isAuthLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-sage animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <PenLine className="w-16 h-16 text-sage/20 mx-auto mb-6" />
        <h2 className="serif text-3xl font-bold text-sage-dark mb-4">Your Spiritual Journal</h2>
        <p className="text-ink/60 mb-8">Sign in to start keeping track of your insights and study notes.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-80 shrink-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="serif text-2xl font-bold text-sage-dark">My Notes</h2>
            <button 
              onClick={startNewNote}
              className="p-2 bg-sage text-white rounded-xl hover:bg-sage-dark transition-all shadow-lg shadow-sage/20"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-sage animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-sage/10 rounded-[2rem]">
                <p className="text-sm text-ink/40 italic">No notes yet. Start your first one!</p>
              </div>
            ) : (
              notes.map(note => (
                <button
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all group relative ${
                    selectedNote?.id === note.id 
                      ? 'bg-sage text-white border-sage shadow-lg shadow-sage/20' 
                      : 'bg-white border-sage/10 hover:border-sage/30'
                  }`}
                >
                  <h3 className="font-bold truncate pr-8">{note.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <p className={`text-xs truncate flex-1 ${selectedNote?.id === note.id ? 'text-white/70' : 'text-ink/40'}`}>
                      {note.content}
                    </p>
                    <span className={`text-[10px] font-medium ml-2 shrink-0 ${selectedNote?.id === note.id ? 'text-white/40' : 'text-ink/20'}`}>
                      {note.updatedAt?.toDate?.() ? note.updatedAt.toDate().toLocaleDateString() : new Date(note.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => handleDelete(note.id, e)}
                    className={`absolute top-4 right-4 p-1 rounded-lg transition-colors ${
                      selectedNote?.id === note.id 
                        ? 'text-white/40 hover:text-white hover:bg-white/10' 
                        : 'text-ink/10 hover:text-destructive hover:bg-destructive/5'
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Editor/Viewer */}
        <div className="flex-grow">
          <AnimatePresence mode="wait">
            {isEditing || !selectedNote ? (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-[2.5rem] border border-sage/10 p-6 sm:p-10 shadow-sm"
              >
                <div className="flex items-center justify-between mb-8">
                  <input 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Note Title"
                    className="serif text-2xl sm:text-3xl font-bold text-sage-dark bg-transparent border-none focus:outline-none w-full"
                  />
                  <div className="flex gap-2">
                    {selectedNote && (
                      <button 
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-ink/40 hover:text-sage transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                    )}
                    {!selectedNote && content.trim() && (
                      <button 
                        onClick={() => {
                          setTitle('');
                          setContent('');
                          setIsEditing(false);
                        }}
                        className="px-4 py-2 text-ink/40 hover:text-destructive transition-colors text-sm font-medium"
                      >
                        Discard
                      </button>
                    )}
                    <button 
                      onClick={handleSave}
                      disabled={!content.trim()}
                      className="flex items-center gap-2 bg-sage text-white px-6 py-2.5 rounded-xl font-bold hover:bg-sage-dark transition-all disabled:opacity-50"
                    >
                      <Save size={18} />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Start writing your thoughts, reflections, or study notes..."
                  className="w-full h-[400px] bg-transparent border-none focus:outline-none resize-none text-ink/80 leading-relaxed text-lg"
                />
              </motion.div>
            ) : (
              <motion.div
                key="viewer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-[2.5rem] border border-sage/10 p-6 sm:p-10 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="serif text-3xl font-bold text-sage-dark">{selectedNote.title}</h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleSmartAssist}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 bg-sage-light text-sage px-6 py-2.5 rounded-xl font-bold hover:bg-sage hover:text-white transition-all disabled:opacity-50"
                      >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles size={18} />}
                        <span>Smart Assist</span>
                      </button>
                      <button 
                        onClick={async () => {
                          if (!selectedNote) return;
                          const shareText = `Note: ${selectedNote.title}\n\n${selectedNote.content}`;
                          try {
                            if (navigator.share) {
                              await navigator.share({
                                title: selectedNote.title,
                                text: shareText,
                                url: window.location.href
                              });
                            } else {
                              await navigator.clipboard.writeText(shareText);
                              toast.success('Note copied to clipboard!');
                            }
                          } catch (err) {
                            console.error('Share failed:', err);
                          }
                        }}
                        className="p-2.5 text-ink/40 hover:text-sage transition-colors"
                        title="Share Note"
                      >
                        <Share2 size={20} />
                      </button>
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="p-2.5 text-ink/40 hover:text-sage transition-colors"
                      >
                        <PenLine size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="prose prose-sage max-w-none">
                    <p className="text-ink/80 whitespace-pre-wrap leading-relaxed text-lg">
                      {selectedNote.content}
                    </p>
                  </div>
                </div>

                {/* AI Analysis Section */}
                {selectedNote.aiAnalysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Summary & Tone */}
                      <div className="lg:col-span-2 bg-sage-light/20 rounded-[2.5rem] p-8 border border-sage/10">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <Sparkles className="text-sage w-5 h-5" />
                            <h3 className="serif text-xl font-bold text-sage-dark">AI Summary & Insights</h3>
                          </div>
                          <span className="text-[10px] font-bold text-sage uppercase tracking-widest bg-white/50 px-3 py-1 rounded-full border border-sage/10">
                            Tone: {selectedNote.aiAnalysis.tone}
                          </span>
                        </div>
                        
                        <p className="text-ink/70 text-sm leading-relaxed mb-8">
                          {selectedNote.aiAnalysis.summary}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-8">
                          {selectedNote.aiAnalysis.tags.map((tag, i) => (
                            <span key={i} className="text-[10px] font-bold text-sage-dark bg-sage-light px-3 py-1 rounded-full">
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div className="p-6 bg-white/50 rounded-2xl border border-sage/5">
                          <h4 className="text-xs font-bold text-sage uppercase tracking-widest mb-3">Theological Context</h4>
                          <p className="text-sm text-ink/80 italic leading-relaxed">
                            {selectedNote.aiAnalysis.insights}
                          </p>
                        </div>
                      </div>

                      {/* Action Steps */}
                      <div className="bg-white rounded-[2.5rem] p-8 border border-sage/10">
                        <div className="flex items-center gap-3 mb-6">
                          <PenLine className="text-sage w-5 h-5" />
                          <h3 className="serif text-xl font-bold text-sage-dark">Action Steps</h3>
                        </div>
                        <div className="space-y-4">
                          {selectedNote.aiAnalysis.actionSteps.map((step, i) => (
                            <div key={i} className="flex gap-3 items-start">
                              <div className="w-5 h-5 rounded-full bg-sage-light flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-[10px] font-bold text-sage">{i + 1}</span>
                              </div>
                              <p className="text-sm text-ink/70 leading-relaxed">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Related Verses */}
                    <div className="bg-white rounded-[2.5rem] p-8 border border-sage/10">
                      <div className="flex items-center gap-3 mb-6">
                        <BookOpen className="text-sage w-5 h-5" />
                        <h3 className="serif text-xl font-bold text-sage-dark">Related Verses</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedNote.aiAnalysis.verses.map((v, i) => (
                          <div 
                            key={i} 
                            className="p-4 rounded-2xl bg-sage-light/10 border border-sage/5 hover:border-sage/20 transition-all cursor-pointer group"
                            onClick={() => {
                              const parts = v.reference.split(' ');
                              const versePart = parts.pop() || '';
                              const bookPart = parts.join(' ');
                              const [chapterPart] = versePart.split(':');
                              navigate('/bible', { state: { book: bookPart, chapter: parseInt(chapterPart) } });
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-sage uppercase tracking-widest">{v.reference}</span>
                              <ChevronRight size={14} className="text-sage/30 group-hover:translate-x-1 transition-transform" />
                            </div>
                            <p className="text-sm text-ink/70 line-clamp-3 italic leading-relaxed">"{v.text}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Chat with Notes */}
                <NoteChat notes={[selectedNote]} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl"
          >
            <h3 className="serif text-2xl font-semibold text-sage-dark mb-4">Confirm Deletion</h3>
            <p className="text-ink/70 mb-8 leading-relaxed">Are you sure you want to delete this note? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-6 py-3 rounded-xl border border-sage/20 font-medium hover:bg-sage-light transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 px-6 py-3 bg-destructive text-white rounded-xl font-medium hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
