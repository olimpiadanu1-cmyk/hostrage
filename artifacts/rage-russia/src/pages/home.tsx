import { useState, useRef, useCallback } from "react";
import { useUploadFile } from "@workspace/api-client-react";
import { Upload, X, AlertTriangle, CheckCircle, Copy, FileVideo, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Requirements } from "@/components/requirements";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorState, setErrorState] = useState<"too_large" | null>(null);
  const [uploadResult, setUploadResult] = useState<{ url: string } | null>(null);
  
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const uploadMutation = useUploadFile();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateAndSetFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/") && !selectedFile.type.startsWith("video/")) {
      toast({
        title: "Неверный формат",
        description: "Поддерживаются только фото и видео",
        variant: "destructive"
      });
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorState("too_large");
      setFile(null);
      return;
    }

    setErrorState(null);
    setFile(selectedFile);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) return;

    // Simulate progress since useUploadFile wraps fetch
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    uploadMutation.mutate({
      data: { file }
    }, {
      onSuccess: (data) => {
        clearInterval(interval);
        setUploadProgress(100);
        setTimeout(() => {
          setUploadResult({ url: data.url });
          setFile(null);
          setUploadProgress(0);
        }, 500);
      },
      onError: () => {
        clearInterval(interval);
        setUploadProgress(0);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить файл",
          variant: "destructive"
        });
      }
    });
  };

  const resetState = () => {
    setFile(null);
    setErrorState(null);
    setUploadResult(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copyLink = () => {
    if (uploadResult) {
      const linkText = `[site]${uploadResult.url}[/site]`;
      navigator.clipboard.writeText(linkText);
      toast({
        title: "Скопировано",
        description: "Ссылка скопирована в буфер обмена"
      });
    }
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl flex flex-col items-center">
        
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black text-primary uppercase tracking-tighter mb-2" style={{ textShadow: "0 0 20px rgba(220,38,38,0.3)" }}>
            RAGE RUSSIA
          </h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-bold border-b border-primary/30 pb-2 inline-block">
            Evidence Hosting Portal
          </p>
        </div>

        {/* Error State */}
        {errorState === "too_large" && (
          <div className="w-full animate-in fade-in zoom-in duration-300">
            <div className="bg-destructive/10 border-l-4 border-destructive p-6 rounded-r-md mb-8">
              <div className="flex items-start">
                <AlertTriangle className="w-6 h-6 text-destructive mr-3 flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-xl font-bold text-destructive mb-2 uppercase">Файл слишком большой</h2>
                  <ul className="list-disc pl-5 space-y-1 text-foreground/90 font-medium">
                    <li>Максимальный размер файла: 100 MB</li>
                    <li>Попробуйте сжать видео или ухудшить качество, но чтобы видео оставалось читаемым</li>
                    <li>Рекомендуемые приложения: HandBrake, Adobe Premiere, или онлайн-сервисы сжатия</li>
                  </ul>
                  <Button variant="outline" className="mt-6 border-destructive/50 hover:bg-destructive/20" onClick={resetState}>
                    Выбрать другой файл
                  </Button>
                </div>
              </div>
            </div>
            <Requirements />
          </div>
        )}

        {/* Upload Area */}
        {!errorState && !uploadResult && (
          <div className="w-full animate-in fade-in duration-500">
            <div 
              className={`relative border-2 border-dashed rounded-xl p-12 transition-all duration-200 flex flex-col items-center justify-center min-h-[300px] cursor-pointer
                ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'}
                ${uploadMutation.isPending ? 'pointer-events-none opacity-80' : ''}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !file && !uploadMutation.isPending && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*"
                onChange={handleChange}
                disabled={uploadMutation.isPending}
              />

              {!file ? (
                <>
                  <div className="bg-background/80 p-4 rounded-full mb-4 shadow-lg ring-1 ring-white/10">
                    <Upload className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Перетащите файл сюда</h3>
                  <p className="text-muted-foreground mb-6">или нажмите для выбора</p>
                  <div className="flex gap-4 text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
                    <span className="bg-background/50 px-3 py-1 rounded">Фото</span>
                    <span className="bg-background/50 px-3 py-1 rounded">Видео</span>
                    <span className="bg-background/50 px-3 py-1 rounded">Max 100MB</span>
                  </div>
                </>
              ) : (
                <div className="w-full max-w-md bg-background rounded-lg border border-border p-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center truncate mr-4">
                      {file.type.startsWith('video/') ? (
                        <FileVideo className="w-8 h-8 text-primary mr-3 flex-shrink-0" />
                      ) : (
                        <FileImage className="w-8 h-8 text-primary mr-3 flex-shrink-0" />
                      )}
                      <div className="truncate">
                        <p className="font-semibold truncate text-sm" title={file.name}>{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                      </div>
                    </div>
                    {!uploadMutation.isPending && (
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); resetState(); }} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {uploadMutation.isPending ? (
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between text-xs font-bold text-primary">
                        <span>Загрузка...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  ) : (
                    <Button onClick={handleUpload} className="w-full font-bold uppercase tracking-wide">
                      Загрузить доказательства
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8">
              <Requirements />
            </div>
          </div>
        )}

        {/* Success Modal */}
        <Dialog open={!!uploadResult} onOpenChange={(open) => !open && resetState()}>
          <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden">
            <div className="bg-primary/10 border-b border-border p-6 flex flex-col items-center justify-center">
              <CheckCircle className="w-16 h-16 text-primary mb-4" />
              <DialogTitle className="text-2xl font-black uppercase text-center">Файл успешно загружен!</DialogTitle>
            </div>
            
            <div className="p-6">
              <p className="text-center font-medium text-foreground/90 mb-6">
                Данную ссылку вы должны вставить в раздел 'Доказательства' в вашей жалобе
              </p>
              
              <div className="bg-background border border-border rounded-md p-4 mb-3 flex items-center justify-between">
                <code className="text-primary font-mono text-sm break-all mr-4">
                  [site]{uploadResult?.url}[/site]
                </code>
                <Button onClick={copyLink} variant="secondary" className="flex-shrink-0">
                  <Copy className="w-4 h-4 mr-2" /> Копировать
                </Button>
              </div>
              
              <p className="text-center text-xs text-muted-foreground mb-8">
                Файл будет удалён автоматически через 7 дней
              </p>

              <div className="border-t border-border pt-6">
                <Requirements />
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
