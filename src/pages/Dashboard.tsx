import { useState } from "react";
import { AcademicSelector } from "@/components/AcademicSelector";
import { ChatInterface } from "@/components/ChatInterface";
import { ChatHistory } from "@/components/ChatHistory";
import { Button } from "@/components/ui/button";
import { LogOut, MessageSquarePlus, BookOpen, Menu } from "lucide-react";

interface AcademicSelection {
  year: string;
  field: string;
  course: string;
}

const Dashboard = () => {
  const [academicSelection, setAcademicSelection] = useState<AcademicSelection | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const handleSelectionComplete = (selection: AcademicSelection) => {
    setAcademicSelection(selection);
    // Start a new chat session when selection is complete
    const newChatId = `chat-${Date.now()}`;
    setCurrentChatId(newChatId);
  };

  const handleNewChat = () => {
    const newChatId = `chat-${Date.now()}`;
    setCurrentChatId(newChatId);
  };

  const handleChatSelect = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar - ChatGPT style */}
      <div className="w-64 bg-muted/80 backdrop-blur-sm border-r border-border/50 flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-accent rounded flex items-center justify-center">
              <BookOpen className="h-3 w-3 text-accent-foreground" />
            </div>
            <span className="font-medium text-foreground text-sm">Polytech AI</span>
          </div>
          
          {academicSelection && (
            <Button 
              onClick={handleNewChat} 
              size="sm"
              className="w-full justify-start gap-2 bg-background/50 backdrop-blur-sm border border-border/50 hover:bg-secondary/80 text-foreground font-normal"
              variant="outline"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Nouveau chat
            </Button>
          )}
        </div>

        {/* History */}
        <div className="flex-1 overflow-hidden">
          <ChatHistory 
            currentChatId={currentChatId}
            onChatSelect={handleChatSelect}
            academicSelection={academicSelection}
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border/50">
          <Button 
            variant="ghost" 
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary font-normal"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!academicSelection ? (
          <AcademicSelector onSelectionComplete={handleSelectionComplete} />
        ) : (
          <ChatInterface 
            academicSelection={academicSelection}
            chatId={currentChatId}
            onBack={() => setAcademicSelection(null)}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;