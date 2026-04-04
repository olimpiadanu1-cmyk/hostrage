import { useState, useRef, useCallback, useEffect } from "react";
import { useBatchUploadFiles } from "@workspace/api-client-react";
import {
  Upload, X, AlertTriangle, CheckCircle2, Copy, FileVideo,
  FileImage, ArrowLeft, Clock, ShieldAlert, ChevronRight,
  Play, Plus, Check, HelpCircle, Maximize2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_IMAGES = 5;
const MAX_VIDEOS = 3;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
  "video/mpeg",
  "video/3gpp",
]);

const ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.bmp,.mp4,.mov,.avi,.mkv,.webm,.mpeg,.3gp";
const FORMAT_LABEL = "JPG, PNG, GIF, WEBP, BMP, MP4, MOV, AVI, MKV, WEBM";

function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

interface SelectedFile {
  file: File;
  previewUrl: string;
  id: string;
}

interface UploadedFile {
  token: string;
  url: string;
  expiresAt: string;
  originalName: string;
  mimeType: string;
  previewUrl: string;
  copied: boolean;
}

type AppState = "upload" | "success";

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [appState, setAppState] = useState<AppState>("upload");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [caseToken, setCaseToken] = useState<string | null>(null);
  const [caseUrl, setCaseUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchMutation = useBatchUploadFiles();

  useEffect(() => {
    return () => {
      selectedFiles.forEach((sf) => URL.revokeObjectURL(sf.previewUrl));
    };
  }, []);

  const imageCount = selectedFiles.filter((sf) => sf.file.type.startsWith("image/")).length;
  const videoCount = selectedFiles.filter((sf) => sf.file.type.startsWith("video/")).length;

  const addFiles = useCallback((newFiles: File[]) => {
    const newErrors: string[] = [];
    const toAdd: SelectedFile[] = [];

    let curImages = imageCount;
    let curVideos = videoCount;

    for (const file of newFiles) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        newErrors.push(`${file.name}: недопустимый формат. Разрешены: ${FORMAT_LABEL}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        newErrors.push(`${file.name}: превышает 100 MB`);
        continue;
      }
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (isImage && curImages >= MAX_IMAGES) {
        newErrors.push(`Максимум ${MAX_IMAGES} фото`);
        continue;
      }
      if (isVideo && curVideos >= MAX_VIDEOS) {
        newErrors.push(`Максимум ${MAX_VIDEOS} видео`);
        continue;
      }
      if (isImage) curImages++;
      if (isVideo) curVideos++;
      toAdd.push({
        file,
        previewUrl: URL.createObjectURL(file),
        id: Math.random().toString(36).slice(2),
      });
    }

    setErrors(newErrors);
    if (toAdd.length > 0) setSelectedFiles((prev) => [...prev, ...toAdd]);
  }, [imageCount, videoCount]);

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => {
      const sf = prev.find((f) => f.id === id);
      if (sf) URL.revokeObjectURL(sf.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) { clearInterval(interval); return 85; }
        return prev + Math.random() * 8;
      });
    }, 300);

    const previews = selectedFiles.map((sf) => ({ previewUrl: sf.previewUrl, mimeType: sf.file.type, name: sf.file.name }));

    batchMutation.mutate(
      { data: { files: selectedFiles.map((sf) => sf.file) } },
      {
        onSuccess: (data) => {
          clearInterval(interval);
          setUploadProgress(100);
          setTimeout(() => {
            const uploaded: UploadedFile[] = data.uploads.map((u, i) => ({
              token: u.token,
              url: u.url,
              expiresAt: u.expiresAt,
              originalName: previews[i]?.name ?? `Файл ${i + 1}`,
              mimeType: previews[i]?.mimeType ?? "image/jpeg",
              previewUrl: previews[i]?.previewUrl ?? "",
              copied: false,
            }));
            setUploadedFiles(uploaded);
            const resData = data as any;
            if (resData.batchToken && resData.caseUrl) {
              setCaseToken(resData.batchToken);
              const frontendCaseUrl = `${window.location.origin}/case/${resData.batchToken}`;
              setCaseUrl(frontendCaseUrl);
              
              // NEW: If we are in a popup, tell the opener!
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'RAGE_EVIDENCE_SUCCESS', 
                  url: `[site=${frontendCaseUrl}]800[/site]` 
                }, "*");
              }
            }
            setAppState("success");
            setSelectedFiles([]);
            setUploadProgress(0);
          }, 600);
        },
        onError: (err: unknown) => {
          clearInterval(interval);
          setUploadProgress(0);
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          if (msg?.includes("Слишком много")) {
            toast({ title: "Лимит загрузок", description: msg, variant: "destructive" });
          } else {
            toast({ title: "Ошибка загрузки", description: "Не удалось загрузить файлы. Попробуйте снова.", variant: "destructive" });
          }
        },
      }
    );
  };

  const copyLink = (index: number) => {
    const f = uploadedFiles[index];
    if (!f) return;
    navigator.clipboard.writeText(`[site=${f.url}]800[/site]`);
    setUploadedFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, copied: true } : item))
    );
    setTimeout(() => {
      setUploadedFiles((prev) =>
        prev.map((item, i) => (i === index ? { ...item, copied: false } : item))
      );
    }, 3000);
  };

  const resetToUpload = () => {
    uploadedFiles.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setSelectedFiles([]);
    setUploadedFiles([]);
    setCaseToken(null);
    setCaseUrl(null);
    setAppState("upload");
    setUploadProgress(0);
    setErrors([]);
  };

  const canAddMore = imageCount < MAX_IMAGES || videoCount < MAX_VIDEOS;
  const hasFiles = selectedFiles.length > 0;

  return (
    <div className="min-h-screen text-foreground flex flex-col">
      <div className="fixed inset-0 grid-bg pointer-events-none opacity-40" />

      <div className="relative flex flex-col items-center py-12 px-4 sm:px-6 flex-1">
        <div className="w-full max-w-2xl">

          {/* Header */}
          <div className="text-center mb-10 relative">
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-glow" style={{ color: "hsl(var(--primary))" }}>
              RAGE RUSSIA
            </h1>
            <div className="mt-2 flex items-center justify-center gap-2">
              <p className="text-muted-foreground text-sm tracking-widest uppercase font-medium">
                Хостинг доказательств для жалоб
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <button className="p-1 rounded-md bg-secondary/30 border border-border hover:border-primary/50 text-muted-foreground hover:text-primary transition-all duration-300 group">
                    <HelpCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] border-primary/20">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight text-primary">Инструкция</DialogTitle>
                    <DialogDescription className="text-muted-foreground font-medium">
                      Как пользоваться хостингом доказательств
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">1</div>
                      <div>
                        <h4 className="font-bold text-sm uppercase tracking-wide">Выбор файлов</h4>
                        <p className="text-xs text-muted-foreground mt-1">Выберите до 5 фото и до 3 видео (макс. 100 МБ на файл).</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">2</div>
                      <div>
                        <h4 className="font-bold text-sm uppercase tracking-wide">Загрузка</h4>
                        <p className="text-xs text-muted-foreground mt-1">Нажмите кнопку «Загрузить». Файлы сохранятся в нашем облаке.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">3</div>
                      <div>
                        <h4 className="font-bold text-sm uppercase tracking-wide">Копирование</h4>
                        <p className="text-xs text-muted-foreground mt-1">Нажмите «Копировать» под нужным файлом. Ссылка уже готова для форума (BB-код).</p>
                      </div>
                    </div>
                    <div className="p-3 bg-secondary/50 border border-border rounded-lg">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-1">
                        <Clock className="w-3 h-3" />
                        Срок хранения
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Все файлы автоматически удаляются через 7 дней после загрузки.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* ── UPLOAD STATE ── */}
          {appState === "upload" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-400 space-y-4">

              {/* Drop zone */}
              <div
                className={`relative rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
                  ${dragActive ? "border-primary bg-primary/8 glow-red-sm scale-[1.01]" : "border-border hover:border-primary/50 bg-card/60 hover:bg-card/80"}
                  ${batchMutation.isPending ? "pointer-events-none" : ""}
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => canAddMore && !batchMutation.isPending && fileInputRef.current?.click()}
                data-testid="upload-dropzone"
              >
                <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-primary/40 rounded-tl-xl" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-primary/40 rounded-br-xl" />

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={ACCEPT}
                  multiple
                  onChange={handleChange}
                  disabled={batchMutation.isPending}
                />

                <div className="p-8 flex flex-col items-center">
                  <div className={`relative mb-4 p-4 rounded-full bg-secondary border border-border transition-all duration-300 ${dragActive ? "glow-red border-primary/50" : ""}`}>
                    <Upload className="w-8 h-8 text-primary" />
                    {dragActive && <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />}
                  </div>
                  <h2 className="text-lg font-bold mb-1">
                    {dragActive ? "Отпустите файлы" : hasFiles ? "Добавить ещё файлы" : "Перетащите файлы сюда"}
                  </h2>
                  <p className="text-muted-foreground text-sm mb-4">или нажмите для выбора</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${imageCount >= MAX_IMAGES ? "border-primary/50 text-primary bg-primary/10" : "border-border text-muted-foreground bg-secondary"}`}>
                      Фото {imageCount}/{MAX_IMAGES}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${videoCount >= MAX_VIDEOS ? "border-primary/50 text-primary bg-primary/10" : "border-border text-muted-foreground bg-secondary"}`}>
                      Видео {videoCount}/{MAX_VIDEOS}
                    </span>
                    <span className="px-3 py-1 bg-secondary border border-border rounded-full text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Макс. 100 MB
                    </span>
                    <span className="px-3 py-1 bg-secondary border border-border rounded-full text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      JPG PNG GIF MP4 MOV AVI MKV
                    </span>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3">
                  {errors.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {e}
                    </div>
                  ))}
                </div>
              )}

              {/* File list */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((sf) => (
                    <div key={sf.id} className="bg-card border border-border rounded-xl overflow-hidden">
                      {/* Preview */}
                      <div className="relative bg-black" style={{ maxHeight: 180 }}>
                        {sf.file.type.startsWith("video/") ? (
                          <>
                            <video src={sf.previewUrl} className="w-full object-contain" style={{ maxHeight: 180 }} muted playsInline />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="p-2.5 bg-black/50 rounded-full border border-white/20">
                                <Play className="w-5 h-5 text-white fill-white" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img src={sf.previewUrl} alt={sf.file.name} className="w-full object-contain" style={{ maxHeight: 180 }} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent pointer-events-none" />
                      </div>
                      {/* File info row */}
                      <div className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-shrink-0 p-2 bg-primary/15 border border-primary/30 rounded-lg">
                          {sf.file.type.startsWith("video/")
                            ? <FileVideo className="w-4 h-4 text-primary" />
                            : <FileImage className="w-4 h-4 text-primary" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate" title={sf.file.name}>{sf.file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatSize(sf.file.size)}</p>
                        </div>
                        {!batchMutation.isPending && (
                          <button
                            onClick={() => removeFile(sf.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            data-testid={`button-remove-${sf.id}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button / progress */}
              {hasFiles && (
                batchMutation.isPending ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-primary animate-pulse">Загружается {selectedFiles.length} {selectedFiles.length === 1 ? "файл" : "файла"}...</span>
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
                    Загрузить {selectedFiles.length} {selectedFiles.length === 1 ? "файл" : selectedFiles.length < 5 ? "файла" : "файлов"}
                  </Button>
                )
              )}

              {/* Add more button when already have files and can add more */}
              {hasFiles && canAddMore && !batchMutation.isPending && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-border hover:border-primary/40 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-add-more"
                >
                  <Plus className="w-4 h-4" />
                  Добавить ещё файл
                </button>
              )}

            </div>
          )}

          {/* ── SUCCESS STATE ── */}
          {appState === "success" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-400 space-y-4">
              <button
                onClick={resetToUpload}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                data-testid="button-back-from-success"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Загрузить другие файлы
              </button>

              {/* Summary banner */}
              <div className="bg-card border border-primary/30 rounded-xl p-5 flex items-center gap-4 glow-red-sm">
                <div className="flex-shrink-0 p-3 bg-primary/15 border border-primary/30 rounded-full">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black uppercase tracking-tight">
                    {uploadedFiles.length} {uploadedFiles.length === 1 ? "файл загружен" : uploadedFiles.length < 5 ? "файла загружено" : "файлов загружено"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Доказательства сохранены · удалятся через <strong className="text-foreground">7 дней</strong>
                  </p>
                </div>
              </div>

              {/* Instruction */}
              <div className="flex items-start gap-3 p-4 bg-secondary/60 border border-border rounded-lg">
                <ShieldAlert className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm leading-relaxed">
                  Вставьте {caseUrl ? "ссылку на кейс" : "каждую ссылку"} в раздел <span className="text-primary font-bold">"Доказательства"</span> вашей жалобы.
                </p>
              </div>

              {/* Case Link (Single link for the whole batch) */}
              {caseUrl && (
                <div className="bg-card border-2 border-primary/40 rounded-xl overflow-hidden glow-red-sm animate-in zoom-in-95 duration-500">
                   <div className="px-4 py-2 bg-primary/20 border-b border-primary/20 flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">Общая ссылка на улики</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-primary/70 font-bold uppercase">
                        <Maximize2 className="w-3 h-3" />
                        Галерея активна
                      </div>
                   </div>
                   <div className="p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                         <code className="text-sm font-mono text-primary break-all block leading-tight">
                            <span className="text-muted-foreground/40">[site=</span>{caseUrl}<span className="text-muted-foreground/40">]800[/site]</span>
                         </code>
                      </div>
                      <Button 
                        onClick={() => {
                          navigator.clipboard.writeText(`[site=${caseUrl}]800[/site]`);
                          toast({ title: "Скопировано", description: "Общая ссылка готова для форума" });
                        }}
                        className="flex-shrink-0 h-10 px-6 font-bold uppercase tracking-widest text-xs"
                      >
                         <Copy className="w-4 h-4 mr-2" />
                         Копировать всё
                      </Button>
                   </div>
                </div>
              )}

              {/* Divider if showing case + individual (optional, we usually want either or) */}
              {caseUrl && <div className="py-2 flex items-center gap-4">
                 <div className="h-px flex-1 bg-border/20" />
                 <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Состав кейса</span>
                 <div className="h-px flex-1 bg-border/20" />
              </div>}

              {/* File cards */}
              <div className="space-y-4">
                {uploadedFiles.map((f, index) => (
                  <div key={f.token} className="bg-card border border-border rounded-xl overflow-hidden">
                    {/* Preview */}
                    {f.previewUrl && (
                      <div className="relative bg-black" style={{ maxHeight: 280 }}>
                        {f.mimeType.startsWith("video/") ? (
                          <>
                            <video
                              src={f.previewUrl}
                              className="w-full object-contain"
                              style={{ maxHeight: 280 }}
                              controls
                              playsInline
                            />
                          </>
                        ) : (
                          <img
                            src={f.previewUrl}
                            alt={f.originalName}
                            className="w-full object-contain"
                            style={{ maxHeight: 280 }}
                          />
                        )}
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      {/* File name + number */}
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-6 h-6 rounded-sm bg-primary/15 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary font-mono">
                          {index + 1}
                        </span>
                        <div className="flex items-center gap-2 min-w-0">
                          {f.mimeType.startsWith("video/")
                            ? <FileVideo className="w-4 h-4 text-primary flex-shrink-0" />
                            : <FileImage className="w-4 h-4 text-primary flex-shrink-0" />
                          }
                          <span className="text-sm font-semibold truncate">{f.originalName}</span>
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>

              {/* Upload another */}
              <Button
                onClick={resetToUpload}
                variant="outline"
                className="w-full border-border hover:border-primary/40 font-semibold uppercase tracking-wide text-sm"
                data-testid="button-upload-another"
              >
                <Upload className="w-4 h-4 mr-2" />
                Загрузить новые доказательства
              </Button>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
