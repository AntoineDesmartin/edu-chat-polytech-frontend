import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
// import { ScrollArea } from "@/components/ui/scroll-area"; // plus utilisé
import { ArrowLeft, Send, BookOpen, ExternalLink, Copy, Check, Bot, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import ReactMarkdown from "react-markdown";      // v8
import remarkGfm from "remark-gfm";               // v4

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: Array<{
    title: string;
    page: number;
    document: string;
  }>;
}

interface Props {
  academicSelection: {
    year: string;   // ex: "Année 3"
    field: string;  // ex: "SI" (major)
    course: string; // ex: "programation_systeme"
  };
  chatId: string | null;
  onBack: () => void;
}

const API_BASE = "http://localhost:8010";

// === Utils ===
function extractYearId(display: string): string {
  if (!display) return display;
  const m = display.match(/(\d+)/);
  return m ? m[1] : display;
}

function toBackendParams(sel: Props["academicSelection"]) {
  const major = sel.field;
  const year = extractYearId(sel.year);
  const course = sel.course;
  return { major, year, course };
}

// === Markdown (rendu propre) ===
function MarkdownMessage({ text }: { text: string }) {
  const safe = String(text ?? "");
  return (
    <div className="prose prose-invert prose-sm max-w-none leading-relaxed
                    prose-headings:mt-3 prose-headings:mb-2
                    prose-p:my-2 prose-li:my-1
                    prose-pre:my-3 prose-code:before:content-[''] prose-code:after:content-['']">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            if (inline) {
              return (
                <code className="px-1 py-0.5 rounded bg-muted/40 font-mono text-[0.85em]" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="rounded-lg border border-border/50 bg-background/60 p-3 overflow-x-auto">
                <code className={className}>{children}</code>
              </pre>
            );
          },
          a({ children, ...props }) {
            return (
              <a className="underline underline-offset-2 hover:opacity-80" target="_blank" rel="noreferrer" {...props}>
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="min-w-[520px]">{children}</table>
              </div>
            );
          },
        }}
      >
        {safe}
      </ReactMarkdown>
    </div>
  );
}

export const ChatInterface = ({ academicSelection, chatId, onBack }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingBotId, setPendingBotId] = useState<string | null>(null); // ← un seul robot “en cours”
  const [copiedSource, setCopiedSource] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // cleanup SSE à l'unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const appendBotMessage = (content = "", sources?: Message["sources"]) => {
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      content,
      isUser: false,
      timestamp: new Date(),
      sources,
    };
    setMessages((prev) => [...prev, newMsg]);
    return newMsg.id;
  };

  const updateMessageContent = (
    id: string,
    updater: (prev: string) => string,
    sources?: Message["sources"]
  ) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              content: updater(String(m.content ?? "")), // always string
              ...(sources ? { sources } : {}),
            }
          : m
      )
    );
  };

  const copySourceReference = (source: any) => {
    const reference = `${source.document} - ${source.title}, page ${source.page}`;
    navigator.clipboard.writeText(reference);
    setCopiedSource(source.document);
    toast({
      title: "Référence copiée",
      description: "La référence de la source a été copiée dans le presse-papier",
    });
    setTimeout(() => setCopiedSource(null), 2000);
  };

  // === SSE (stream) avec fallback POST ===
  const sendViaSSE = (text: string) =>
    new Promise<void>((resolve, reject) => {
      const { major, year, course } = toBackendParams(academicSelection);
      const url =
        `${API_BASE}/chat/stream` +
        `?query=${encodeURIComponent(text)}` +
        `&major=${encodeURIComponent(major)}` +
        `&year=${encodeURIComponent(year)}` +
        `&course=${encodeURIComponent(course)}`;

      try {
        // évite deux streams en même temps
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        const es = new EventSource(url);
        eventSourceRef.current = es;

        // crée un seul message bot “placeholder”
        const botMsgId = appendBotMessage("");
        setPendingBotId(botMsgId);

        es.onmessage = (evt) => {
          try {
            const data = evt.data;
            if (!data) return;

            let parsed: any = null;
            try {
              parsed = JSON.parse(data);
            } catch {
              /* texte brut */
            }

            if (parsed && typeof parsed === "object" && ("content" in parsed || "done" in parsed)) {
              if (parsed.content) {
                updateMessageContent(botMsgId, (prev) => prev + String(parsed.content));
              }
              if (parsed.sources) {
                updateMessageContent(botMsgId, (prev) => prev, parsed.sources);
              }
              if (parsed.done) {
                setIsTyping(false);
                setPendingBotId(null);
                es.close();
                eventSourceRef.current = null;
                resolve();
              }
            } else {
              // flux texte brut
              updateMessageContent(botMsgId, (prev) => prev + String(data));
            }
          } catch (e) {
            console.error("SSE onmessage parse error:", e);
          }
        };

        es.onerror = (err) => {
          console.error("SSE error:", err);
          setIsTyping(false);
          setPendingBotId(null);
          es.close();
          eventSourceRef.current = null;
          reject(new Error("SSE failed"));
        };
      } catch (e) {
        setIsTyping(false);
        setPendingBotId(null);
        reject(e);
      }
    });

  const sendViaPOST = async (text: string) => {
    const { major, year, course } = toBackendParams(academicSelection);
    const res = await fetch(`${API_BASE}/chat/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: text, major, year, course }),
    });

    if (!res.ok) throw new Error(`POST /chat/question failed with status ${res.status}`);

    const json = await res.json();
    const answer: string = String(json?.answer ?? "");

    setMessages((prev) => [
      ...prev,
      { id: `msg-${Date.now()}`, content: answer, isUser: false, timestamp: new Date() },
    ]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      content: inputMessage,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const text = inputMessage;
    setInputMessage("");
    setIsTyping(true);

    try {
      await sendViaSSE(text);
    } catch {
      try {
        await sendViaPOST(text);
      } catch (e) {
        toast({
          title: "Erreur",
          description: "Impossible de contacter le serveur. Réessaie plus tard.",
          variant: "destructive",
        });
      } finally {
        setIsTyping(false);
        setPendingBotId(null);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-3 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>

          <div className="flex-1 text-center">
            <h1 className="font-medium text-foreground text-lg">{academicSelection.course}</h1>
            <div className="flex justify-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs bg-secondary text-secondary-foreground font-normal">
                {academicSelection.year}
              </Badge>
              <Badge variant="secondary" className="text-xs bg-secondary text-secondary-foreground font-normal">
                {academicSelection.field}
              </Badge>
            </div>
          </div>

          <div className="w-[72px]" />
        </div>
      </div>

      {/* Messages — conteneur scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-3xl mx-auto px-4">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mb-4 mx-auto">
                <BookOpen className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-medium text-foreground mb-2">
                Comment puis-je vous aider aujourd'hui ?
              </h3>
              <p className="text-muted-foreground">Posez vos questions sur {academicSelection.course}</p>
            </div>
          )}

          <div className="py-4 space-y-8">
            {messages.map((message) => (
              <div key={message.id} className="animate-fade-in">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.isUser
                          ? "bg-accent text-accent-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {message.isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="flex-1 min-w-0">
                    {message.isUser ? (
                      <div className="whitespace-pre-wrap leading-relaxed text-foreground">
                        {String(message.content)}
                      </div>
                    ) : (
                      <MarkdownMessage text={String(message.content)} />
                    )}

                    {/* Sources */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-4 p-3 bg-muted/30 backdrop-blur-sm rounded-lg border border-border/50">
                        <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Sources consultées
                        </p>
                        <div className="space-y-2">
                          {message.sources.map((source, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between text-sm bg-background/50 backdrop-blur-sm rounded-md p-2 border border-border/50"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <ExternalLink className="h-3 w-3 text-accent flex-shrink-0" />
                                <span className="font-medium text-foreground truncate">{source.title}</span>
                                <span className="text-muted-foreground">
                                  • {source.document} • Page {source.page}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copySourceReference(source)}
                                className="h-6 w-6 p-0 hover:bg-secondary flex-shrink-0"
                              >
                                {copiedSource === source.document ? (
                                  <Check className="h-3 w-3 text-accent" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator — seulement si pas de message bot en cours */}
            {isTyping && !pendingBotId && (
              <div className="animate-fade-in">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-secondary-foreground">
                      <Bot className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full animate-pulse bg-accent"></div>
                        <div className="w-2 h-2 rounded-full animate-pulse [animation-delay:0.2s] bg-accent"></div>
                        <div className="w-2 h-2 rounded-full animate-pulse [animation-delay:0.4s] bg-accent"></div>
                      </div>
                      <span className="text-sm">Recherche dans les supports de cours...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="relative">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Envoyer un message..."
              className="min-h-12 max-h-32 resize-none bg-background/50 backdrop-blur-sm border border-border/50 rounded-lg pr-12 text-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-1 focus:ring-accent"
              disabled={isTyping}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              size="sm"
              className="absolute right-2 bottom-2 h-8 w-8 p-0 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-2 text-center">
            EduChat peut faire des erreurs. Vérifiez les informations importantes.
          </p>
        </div>
      </div>
    </div>
  );
};
