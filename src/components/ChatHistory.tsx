import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Clock, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatSession {
  id: string;
  courseName: string;
  courseField: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
}

interface Props {
  currentChatId: string | null;
  onChatSelect: (chatId: string) => void;
  academicSelection: {
    year: string;
    field: string;
    course: string;
  } | null;
}

// Mock chat history data
const mockChatHistory: ChatSession[] = [
  {
    id: "chat-1",
    courseName: "Algorithmes et Programmation",
    courseField: "Informatique",
    lastMessage: "Merci pour l'explication des algorithmes de tri !",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
    messageCount: 12,
  },
  {
    id: "chat-2",
    courseName: "Bases de Données", 
    courseField: "Informatique",
    lastMessage: "Qu'est-ce qu'une clé primaire ?",
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    messageCount: 8,
  },
  {
    id: "chat-3",
    courseName: "Développement Web",
    courseField: "Informatique",
    lastMessage: "Comment créer un formulaire HTML ?",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    messageCount: 15,
  },
  {
    id: "chat-4",
    courseName: "Analyse Mathématique",
    courseField: "Mathématiques", 
    lastMessage: "Limites et dérivées",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    messageCount: 6,
  },
];

export const ChatHistory = ({ currentChatId, onChatSelect, academicSelection }: Props) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(mockChatHistory);

  useEffect(() => {
    // Add current session to history when a new chat starts
    if (academicSelection && currentChatId && !chatSessions.find(chat => chat.id === currentChatId)) {
      const newSession: ChatSession = {
        id: currentChatId,
        courseName: academicSelection.course,
        courseField: academicSelection.field,
        lastMessage: "Nouvelle conversation",
        timestamp: new Date(),
        messageCount: 0,
      };
      setChatSessions(prev => [newSession, ...prev]);
    }
  }, [currentChatId, academicSelection]);

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return "Maintenant";
    if (hours < 24) return `${hours}h`;
    if (days === 1) return "Hier";
    if (days < 7) return `${days}j`;
    return timestamp.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
  };

  const groupedSessions = chatSessions.reduce((groups, session) => {
    const today = new Date();
    const sessionDate = session.timestamp;
    const diffDays = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let group;
    if (diffDays === 0) group = "Aujourd'hui";
    else if (diffDays === 1) group = "Hier";
    else if (diffDays < 7) group = "7 derniers jours";
    else group = "Plus ancien";
    
    if (!groups[group]) groups[group] = [];
    groups[group].push(session);
    return groups;
  }, {} as Record<string, ChatSession[]>);

  if (chatSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Aucune conversation
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        {Object.entries(groupedSessions).map(([group, sessions]) => (
          <div key={group} className="mb-4">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
              {group}
            </div>
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => onChatSelect(session.id)}
                  className={`group relative p-2 rounded-lg cursor-pointer transition-all hover:bg-secondary/50 ${
                    currentChatId === session.id 
                      ? 'bg-secondary text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate mb-1">
                        {session.courseName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {session.lastMessage}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(session.timestamp)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-secondary"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};