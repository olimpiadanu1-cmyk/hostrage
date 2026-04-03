import { useState, useRef, useCallback } from "react";
import { useUploadFile } from "@workspace/api-client-react";
import {
  Upload, X, AlertTriangle, CheckCircle2, Copy, FileVideo,
  FileImage, ArrowLeft, Clock, ShieldAlert, ChevronRight, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Requirements } from "@/components/requirements";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

type AppState = "upload" | "too_large" | "success";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [appState, setAppState] = useState<AppState>("upload");
  const [uploadResult, setUploadResult] = useState<{ url: string; expiresAt: string } | null>(null);
  const [successPreviewUrl, setSuccessPreviewUrl] = useState<string | null>(null);
  const [successFileType, setSuccessFileType] = useState<"image" | "video" | null>(null);
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadFile();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const validateAndSetFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/") && !selectedFile.type.startsWith("video/")) {
      toast({ title: "Неверный формат", description: "Поддерживаются только фото и видео", variant: "destructive" });
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setAppState("too_large");
      setFile(null);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      return;
    }
    setAppState("upload");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    setFile(selectedFile);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const handleUpload = () => {
    if (!file) return;
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 85) { clearInterval(interval); return 85; }
        return prev + Math.random() * 12;
      });
    }, 250);

    const savedPreview = previewUrl;
    const savedFile = file;

    uploadMutation.mutate({ data: { file } }, {
      onSuccess: (data) => {
        clearInterval(interval);
        setUploadProgress(100);
        setTimeout(() => {
          setUploadResult({ url: data.url, expiresAt: data.expiresAt });
          if (savedPreview && savedFile) {
            setSuccessPreviewUrl(savedPreview);
            setSuccessFileType(savedFile.type.startsWith("video/") ? "video" : "image");
          }
          setAppState("success");
          setFile(null);
          setPreviewUrl(null);
          setUploadProgress(0);
        }, 600);
      },
      onError: () => {
        clearInterval(interval);
        setUploadProgress(0);
        toast({ title: "Ошибка загрузки", description: "Не удалось загрузить файл. Попробуйте снова.", variant: "destructive" });
      }
    });
  };

  const resetToUpload = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (successPreviewUrl) URL.revokeObjectURL(successPreviewUrl);
    setFile(null);
    setPreviewUrl(null);
    setSuccessPreviewUrl(null);
    setSuccessFileType(null);
    setAppState("upload");
    setUploadResult(null);
    setUploadProgress(0);
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copyLink = () => {
    if (!uploadResult) return;
    navigator.clipboard.writeText(`[site=${uploadResult.url}][/site]`);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-screen text-foreground flex flex-col">
      {/* Grid bg layer */}
      <div className="fixed inset-0 grid-bg pointer-events-none opacity-40" />

      <div className="relative flex flex-col items-center py-12 px-4 sm:px-6 flex-1">
        <div className="w-full max-w-2xl">

          {/* Logo header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="w-8 h-0.5 bg-primary" />
              <span className="text-primary text-xs font-bold uppercase tracking-[0.3em]">Evidence Portal</span>
              <div className="w-8 h-0.5 bg-primary" />
            </div>
            <h1
              className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-glow"
              style={{ color: "hsl(var(--primary))" }}
              data-testid="text-logo"
            >
              RAGE RUSSIA
            </h1>
            <p className="mt-2 text-muted-foreground text-sm tracking-widest uppercase font-medium">
              Хостинг доказательств для жалоб
            </p>
          </div>

          {/* ── UPLOAD STATE ── */}
          {appState === "upload" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-400">
              {/* Drop zone */}
              <div
                className={`relative rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
                  ${dragActive
                    ? "border-primary bg-primary/8 glow-red-sm scale-[1.01]"
                    : "border-border hover:border-primary/50 bg-card/60 hover:bg-card/80"}
                  ${uploadMutation.isPending ? "pointer-events-none" : ""}
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !file && !uploadMutation.isPending && fileInputRef.current?.click()}
                data-testid="upload-dropzone"
              >
                {/* Decorative corner accent */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-primary/40 rounded-tl-xl" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-primary/40 rounded-br-xl" />

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={handleChange}
                  disabled={uploadMutation.isPending}
                />

                <div className="p-10 flex flex-col items-center">
                  {!file ? (
                    <>
                      <div className={`relative mb-5 p-5 rounded-full bg-secondary border border-border transition-all duration-300 ${dragActive ? "glow-red border-primary/50" : ""}`}>
                        <Upload className="w-10 h-10 text-primary" />
                        {dragActive && (
                          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                        )}
                      </div>
                      <h2 className="text-xl font-bold mb-1">
                        {dragActive ? "Отпустите файл" : "Перетащите файл сюда"}
                      </h2>
                      <p className="text-muted-foreground text-sm mb-6">или нажмите для выбора с устройства</p>
                      <div className="flex gap-2 flex-wrap justify-center">
                        {["Фото", "Видео", "Макс. 100 MB"].map((tag) => (
                          <span key={tag} className="px-3 py-1 bg-secondary border border-border rounded-full text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div
                      className="w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Image/video preview */}
                      {previewUrl && (
                        <div className="relative mb-3 rounded-lg overflow-hidden border border-border bg-black" style={{ maxHeight: 220 }}>
                          {file.type.startsWith("video/") ? (
                            <video
                              src={previewUrl}
                              className="w-full object-contain"
                              style={{ maxHeight: 220 }}
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={previewUrl}
                              alt="Предпросмотр"
                              className="w-full object-contain"
                              style={{ maxHeight: 220 }}
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                          {file.type.startsWith("video/") && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="p-3 bg-black/50 rounded-full border border-white/20">
                                <Play className="w-6 h-6 text-white fill-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* File card */}
                      <div className="bg-secondary/80 border border-border rounded-lg p-4 mb-4 flex items-center gap-3">
                        <div className="flex-shrink-0 p-2.5 bg-primary/15 border border-primary/30 rounded-lg">
                          {file.type.startsWith("video/")
                            ? <FileVideo className="w-6 h-6 text-primary" />
                            : <FileImage className="w-6 h-6 text-primary" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate text-sm" title={file.name}>{file.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatSize(file.size)}</p>
                        </div>
                        {!uploadMutation.isPending && (
                          <button
                            onClick={resetToUpload}
                            className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            data-testid="button-remove-file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {uploadMutation.isPending ? (
                        <div className="space-y-2.5">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-primary animate-pulse">Загружается...</span>
                            <span className="text-muted-foreground">{Math.round(uploadProgress)}%</span>
                          </div>
                          <Progress value={uploadProgress} className="h-2" />
                        </div>
                      ) : (
                        <Button
                          onClick={handleUpload}
                          className="w-full font-bold uppercase tracking-widest h-11 glow-red-sm"
                          data-testid="button-upload"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Загрузить доказательство
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <Requirements />
              </div>
            </div>
          )}

          {/* ── TOO LARGE STATE ── */}
          {appState === "too_large" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-400">
              <button
                onClick={resetToUpload}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
                data-testid="button-back-from-error"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Выбрать другой файл
              </button>

              <div className="bg-card border border-destructive/40 rounded-xl overflow-hidden">
                <div className="bg-destructive/10 border-b border-destructive/30 px-6 py-5 flex items-center gap-3">
                  <div className="p-2 bg-destructive/20 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-destructive">Файл слишком большой</h2>
                    <p className="text-sm text-muted-foreground">Превышен лимит 100 MB</p>
                  </div>
                </div>

                <div className="p-6">
                  <p className="text-sm font-medium text-foreground/90 mb-4">Попробуйте одно из следующих:</p>
                  <ul className="space-y-3">
                    {[
                      "Сожмите видео в HandBrake, Adobe Premiere или онлайн-сервисах",
                      "Снизьте качество видео (достаточно 480p–720p, главное — читаемость)",
                      "Обрежьте видео до нужного момента, чтобы уменьшить размер",
                    ].map((tip, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                <Requirements />
              </div>
            </div>
          )}

          {/* ── SUCCESS STATE ── */}
          {appState === "success" && uploadResult && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-400">
              <button
                onClick={resetToUpload}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
                data-testid="button-back-from-success"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Загрузить другой файл
              </button>

              {/* Success card */}
              <div className="bg-card border border-border rounded-xl overflow-hidden glow-red-sm">
                {/* Header with preview */}
                <div className="relative border-b border-primary/20 overflow-hidden">
                  {/* Preview behind header */}
                  {successPreviewUrl ? (
                    <div className="relative">
                      <div className="w-full bg-black" style={{ maxHeight: 260 }}>
                        {successFileType === "video" ? (
                          <video
                            src={successPreviewUrl}
                            className="w-full object-contain"
                            style={{ maxHeight: 260 }}
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={successPreviewUrl}
                            alt="Загруженный файл"
                            className="w-full object-contain"
                            style={{ maxHeight: 260 }}
                          />
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 flex flex-col items-center text-center">
                        <div className="inline-flex p-3 bg-primary/20 border border-primary/40 rounded-full mb-3 backdrop-blur-sm">
                          <CheckCircle2 className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Файл загружен!</h2>
                        <p className="text-muted-foreground text-sm mt-1">Доказательство успешно сохранено</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative bg-primary/10 px-6 py-8 flex flex-col items-center text-center">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(348_90%_52%/0.12),transparent_70%)]" />
                      <div className="relative z-10">
                        <div className="inline-flex p-4 bg-primary/15 border border-primary/30 rounded-full mb-4">
                          <CheckCircle2 className="w-10 h-10 text-primary" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Файл загружен!</h2>
                        <p className="text-muted-foreground text-sm mt-1">Доказательство успешно сохранено</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-6">
                  {/* Instructions */}
                  <div className="flex items-start gap-3 p-4 bg-secondary/60 border border-border rounded-lg">
                    <ShieldAlert className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm leading-relaxed">
                      Вставьте эту ссылку в раздел <span className="text-primary font-bold">"Доказательства"</span> вашей жалобы. Используйте ссылку в том виде, в котором она показана ниже.
                    </p>
                  </div>

                  {/* Link block */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Ваша ссылка</p>
                    <div className="bg-background border border-border rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 bg-secondary/30">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-muted" />
                          <div className="w-3 h-3 rounded-full bg-muted" />
                          <div className="w-3 h-3 rounded-full bg-muted" />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">доказательство</span>
                      </div>
                      <div className="p-4 flex items-start gap-3">
                        <code className="flex-1 text-sm font-mono text-primary break-all leading-relaxed" data-testid="text-upload-link">
                          <span className="text-muted-foreground/60">[site=</span>{uploadResult.url}<span className="text-muted-foreground/60">][/site]</span>
                        </code>
                        <button
                          onClick={copyLink}
                          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-semibold transition-all duration-200
                            ${copied
                              ? "bg-primary/20 border-primary/50 text-primary"
                              : "bg-secondary border-border text-foreground hover:bg-secondary/80 hover:border-primary/40"
                            }`}
                          data-testid="button-copy-link"
                        >
                          <Copy className="w-4 h-4" />
                          {copied ? "Скопировано!" : "Копировать"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expiry notice */}
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-secondary/40 border border-border rounded-lg text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span>Файл будет автоматически удалён через <strong className="text-foreground">7 дней</strong></span>
                  </div>

                  {/* Upload another */}
                  <Button
                    onClick={resetToUpload}
                    variant="outline"
                    className="w-full border-border hover:border-primary/40 font-semibold uppercase tracking-wide text-sm"
                    data-testid="button-upload-another"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Загрузить ещё одно доказательство
                  </Button>
                </div>
              </div>

              {/* Requirements below */}
              <div className="mt-6">
                <Requirements />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
