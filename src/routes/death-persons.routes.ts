import { Router } from "express";
import multer from "multer";
import {
  getDeathPersonSummary,
  importDeathPersonsFromExcel,
  listDeathPersonImports
} from "../services/death-person.service.js";

export const deathPersonsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024
  }
});

deathPersonsRouter.get("/summary", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await getDeathPersonSummary() });
  } catch (error) {
    next(error);
  }
});

deathPersonsRouter.get("/imports", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await listDeathPersonImports() });
  } catch (error) {
    next(error);
  }
});

deathPersonsRouter.post("/import", upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ ok: false, error: "กรุณาเลือกไฟล์ Excel ก่อนนำเข้า" });
    }

    res.json({
      ok: true,
      data: await importDeathPersonsFromExcel(file, req.user?.username || null)
    });
  } catch (error) {
    next(error);
  }
});
