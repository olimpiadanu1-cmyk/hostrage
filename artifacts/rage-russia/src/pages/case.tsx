import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import {
  Clock, ArrowLeft, FileVideo, FileImage, 
  Maximize2, Download, ExternalLink, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface UploadedFile {
  token: string;
  url: string;
  expiresAt: string;
  originalName: string;
  mimeType: string;
}

export default function Case() {
  const [, params] = useRoute("/case/:token");
  const token = params?.token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedImage, setSelectedImage] = useState<UploadedFile | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchCase = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || "";
        const res = await fetch(`${apiUrl}/api/cases/${token}`);
        if (!res.ok) {
          throw new Error("Улики не найдены или срок хранения истёк");
        }
        const data = await res.json();
        setFiles(data.uploads);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Произошла ошибка");
      } finally {
        setLoading(false);
      }
    };

    fetchCase();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col p-6 animate-pulse">
        <div className="max-w-4xl mx-auto w-full space-y-8">
           <Skeleton className="h-12 w-64 mx-auto" />
           <div className="grid gap-6">
             <Skeleton className="h-64 w-full rounded-xl" />
             <Skeleton className="h-64 w-full rounded-xl" />
           </div>
        </div>
      </div>
    );
  }

  if (error || files.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-full mb-6">
          <ArrowLeft className="w-12 h-12 text-destructive" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Ошибка 404</h1>
        <p className="text-muted-foreground mb-8 max-w-xs">{error || "Улики не найдены"}</p>
        <Button asChild variant="outline">
          <a href="/">Вернуться на главную</a>
        </Button>
      </div>
    );
  }

  const expiresAt = new Date(files[0]?.expiresAt || Date.now());

  return (
    <div className="min-h-screen flex flex-col py-12 px-4 sm:px-6">
      <div className="fixed inset-0 grid-bg pointer-events-none opacity-40" />

      <div className="relative w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-0.5 bg-primary" />
            <span className="text-primary text-xs font-bold uppercase tracking-[0.3em]">Evidence Case</span>
            <div className="w-8 h-0.5 bg-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-glow mb-4" style={{ color: "hsl(var(--primary))" }}>
            Материалы дела
          </h1>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground bg-secondary/50 border border-border px-4 py-2 rounded-full">
             <div className="flex items-center gap-1.5">
               <Calendar className="w-3.5 h-3.5 text-primary" />
               Доступно до: {format(expiresAt, "d MMMM, HH:mm", { locale: ru })}
             </div>
             <div className="w-px h-3 bg-border hidden sm:block" />
             <div className="flex items-center gap-1.5">
               <Maximize2 className="w-3.5 h-3.5 text-primary" />
               Всего файлов: {files.length}
             </div>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="flex flex-col gap-8">
          {files.map((file, index) => (
            <div key={file.token} className="group relative bg-card border border-border rounded-2xl overflow-hidden shadow-2xl transition-all hover:border-primary/40">
              {/* Media Container */}
              <div className="relative w-full bg-black shadow-inner">
                {file.mimeType.startsWith("video/") ? (
                  <video 
                    src={file.url} 
                    className="w-full h-auto max-h-[70vh] object-contain"
                    controls
                    playsInline
                  />
                ) : (
                  <div 
                    className="cursor-zoom-in relative"
                    onClick={() => setSelectedImage(file)}
                  >
                    <img 
                      src={file.url} 
                      alt={file.originalName} 
                      className="w-full h-auto max-h-[70vh] object-contain transition-transform duration-500 group-hover:scale-[1.01]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                       <div className="p-3 bg-primary/90 text-white rounded-full shadow-lg scale-90 group-hover:scale-100 transition-transform">
                         <Maximize2 className="w-6 h-6" />
                       </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Overlay Info bar */}
              <div className="px-6 py-4 flex items-center justify-between border-t border-border bg-card/80 backdrop-blur-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-primary/15 border border-primary/30 rounded-lg">
                    {file.mimeType.startsWith("video/") ? <FileVideo className="w-4 h-4 text-primary" /> : <FileImage className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate uppercase tracking-tight">{file.originalName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">{file.mimeType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild className="h-8 text-[10px] font-bold uppercase tracking-widest border-border hover:border-primary/50">
                    <a href={file.url} download={file.originalName} target="_blank" rel="noreferrer">
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Скачать
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-[0.4em] mb-4">RAGE RUSSIA EVIDENCE HUB</p>
            <Button asChild variant="ghost" className="text-muted-foreground hover:text-primary transition-colors">
              <a href="/" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Вернуться для загрузки
              </a>
            </Button>
        </div>
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none overflow-hidden cursor-zoom-out" onClick={() => setSelectedImage(null)}>
          <DialogHeader className="sr-only">
             <DialogTitle>{selectedImage?.originalName}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img 
              src={selectedImage.url} 
              alt={selectedImage.originalName} 
              className="w-full h-full object-contain pointer-events-none"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
