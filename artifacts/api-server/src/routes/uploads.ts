import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { db, uploadsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"));
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

router.post("/uploads", (req, res, next) => {
  upload.single("file")(req, res, async (err) => {
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

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(uploadsTable).values({
        token,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        filePath: req.file.filename,
        expiresAt,
      });

      const base = getBaseUrl(req as never);
      const url = `${base}/api/uploads/${token}/file`;

      req.log.info({ token, size: req.file.size }, "File uploaded");

      res.status(201).json({
        token,
        url,
        expiresAt: expiresAt.toISOString(),
      });
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
    const filePath = path.join(UPLOADS_DIR, row.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
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
    const filePath = path.join(UPLOADS_DIR, row.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
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
      const filePath = path.join(UPLOADS_DIR, row.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
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
