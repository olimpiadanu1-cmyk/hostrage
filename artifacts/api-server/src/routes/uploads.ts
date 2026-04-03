import { Router, type IRouter } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { db, uploadsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.socket.remoteAddress ?? "unknown");
    return ip.split(",")[0].trim();
  },
  handler: (_req, res) => {
    res.status(429).json({ error: "Слишком много загрузок. Попробуйте снова через час." });
  },
});

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

function isAllowed(mimetype: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimetype);
}

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, _file, cb) => {
    const unique = randomBytes(16).toString("hex");
    cb(null, unique);
  },
});

const singleUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowed(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Недопустимый формат файла. Разрешены: JPG, PNG, GIF, WEBP, BMP, MP4, MOV, AVI, MKV, WEBM."));
    }
  },
});

const batchUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowed(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Недопустимый формат файла. Разрешены: JPG, PNG, GIF, WEBP, BMP, MP4, MOV, AVI, MKV, WEBM."));
    }
  },
});

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

function getBaseUrl(req: Parameters<typeof router.get>[1] extends (req: infer R, ...args: unknown[]) => unknown ? R : never): string {
  const host = req.get("host") ?? "localhost";
  const protocol = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
  return `${protocol}://${host}`;
}

async function saveUpload(file: Express.Multer.File, base: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(uploadsTable).values({
    token,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    filePath: file.filename,
    expiresAt,
  });

  return {
    token,
    url: `${base}/api/uploads/${token}/file`,
    expiresAt: expiresAt.toISOString(),
  };
}

router.post("/uploads", uploadRateLimit, (req, res, next) => {
  singleUpload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File too large. Maximum size is 100MB." });
      return;
    }
    if (err) {
      req.log.warn({ err: err.message }, "Upload error");
      res.status(400).json({ error: err.message });
      return;
    }
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      const base = getBaseUrl(req as never);
      const result = await saveUpload(req.file, base);
      req.log.info({ token: result.token, size: req.file.size }, "File uploaded");
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });
});

router.post("/uploads/batch", uploadRateLimit, (req, res, next) => {
  batchUpload.array("files", 8)(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File too large. Maximum size per file is 100MB." });
      return;
    }
    if (err) {
      req.log.warn({ err: err.message }, "Batch upload error");
      res.status(400).json({ error: err.message });
      return;
    }
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        res.status(400).json({ error: "No files provided" });
        return;
      }

      const images = files.filter((f) => f.mimetype.startsWith("image/"));
      const videos = files.filter((f) => f.mimetype.startsWith("video/"));

      if (images.length > 5) {
        res.status(400).json({ error: "Maximum 5 images allowed" });
        return;
      }
      if (videos.length > 3) {
        res.status(400).json({ error: "Maximum 3 videos allowed" });
        return;
      }

      const base = getBaseUrl(req as never);
      const uploads = await Promise.all(files.map((f) => saveUpload(f, base)));

      req.log.info({ count: files.length }, "Batch uploaded");
      res.status(201).json({ uploads });
    } catch (error) {
      next(error);
    }
  });
});

router.get("/uploads/:token", async (req, res): Promise<void> => {
  const rawToken = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const [row] = await db.select().from(uploadsTable).where(eq(uploadsTable.token, rawToken));

  if (!row) {
    res.status(404).json({ error: "Upload not found or expired" });
    return;
  }

  if (new Date() > row.expiresAt) {
    const fp = path.join(UPLOADS_DIR, row.filePath);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await db.delete(uploadsTable).where(eq(uploadsTable.token, rawToken));
    res.status(404).json({ error: "Upload not found or expired" });
    return;
  }

  const base = getBaseUrl(req as never);
  res.json({
    token: row.token,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    expiresAt: row.expiresAt.toISOString(),
    url: `${base}/api/uploads/${row.token}/file`,
  });
});

router.get("/uploads/:token/file", async (req, res): Promise<void> => {
  const rawToken = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const [row] = await db.select().from(uploadsTable).where(eq(uploadsTable.token, rawToken));

  if (!row) {
    res.status(404).json({ error: "Upload not found or expired" });
    return;
  }

  if (new Date() > row.expiresAt) {
    const fp = path.join(UPLOADS_DIR, row.filePath);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await db.delete(uploadsTable).where(eq(uploadsTable.token, rawToken));
    res.status(404).json({ error: "Upload not found or expired" });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, row.filePath);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.setHeader("Content-Type", row.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(row.originalName)}"`);
  res.sendFile(filePath);
});

export async function cleanupExpiredUploads(): Promise<void> {
  try {
    const now = new Date();
    const expired = await db.select().from(uploadsTable).where(lt(uploadsTable.expiresAt, now));
    for (const row of expired) {
      const fp = path.join(UPLOADS_DIR, row.filePath);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    if (expired.length > 0) {
      await db.delete(uploadsTable).where(lt(uploadsTable.expiresAt, now));
      logger.info({ count: expired.length }, "Cleaned up expired uploads");
    }
  } catch (error) {
    logger.error({ error }, "Error cleaning up expired uploads");
  }
}

export default router;
