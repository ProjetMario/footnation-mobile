import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  available: vi.fn(),
  share: vi.fn(),
  print: vi.fn(),
  pdf: vi.fn(),
  write: vi.fn(),
  move: vi.fn(),
  create: vi.fn(),
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: mocks.available,
  shareAsync: mocks.share,
}));
vi.mock("expo-print", () => ({
  printAsync: mocks.print,
  printToFileAsync: mocks.pdf,
}));
vi.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  Directory: class {
    uri: string;
    constructor(...paths: any[]) {
      this.uri = paths.map((p) => p.uri || p).join("/");
    }
    create = mocks.create;
  },
  File: class {
    uri: string;
    constructor(...paths: any[]) {
      this.uri = paths.map((p) => p.uri || p).join("/");
    }
    create = mocks.create;
    write = mocks.write;
    move = mocks.move;
  },
}));
import { exportCV } from "../src/lib/cvExport.native";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.available.mockResolvedValue(true);
  mocks.share.mockResolvedValue(undefined);
  mocks.print.mockResolvedValue(undefined);
  mocks.pdf.mockResolvedValue({ uri: "file:///cache/generated.pdf" });
});
describe("native CV export", () => {
  it("creates a Word document with a named file and matching MIME type", async () => {
    await exportCV(
      { full_name: "Alex Démo", bio: "<script>unsafe</script>" },
      "word",
    );
    expect(mocks.write.mock.calls[0][0]).toContain(
      "&lt;script&gt;unsafe&lt;/script&gt;",
    );
    expect(mocks.share).toHaveBeenCalledWith(
      expect.stringMatching(/CV_Football_Alex_Démo\.doc$/),
      expect.objectContaining({ mimeType: "application/msword" }),
    );
  });
  it("exports A4 PDF and shares the named PDF only after it has been moved", async () => {
    await exportCV({ full_name: "Alex Démo" }, "pdf");
    expect(mocks.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ width: 595, height: 842 }),
    );
    expect(mocks.move.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.share.mock.invocationCallOrder[0],
    );
    expect(mocks.share).toHaveBeenCalledWith(
      expect.stringMatching(/\.pdf$/),
      expect.objectContaining({ mimeType: "application/pdf" }),
    );
  });
  it("never opens sharing if the account changes while the PDF is generated", async () => {
    let current = true;
    mocks.pdf.mockImplementation(async () => {
      current = false;
      return { uri: "file:///cache/generated.pdf" };
    });
    await expect(
      exportCV({ full_name: "Alex" }, "pdf", () => {
        if (!current) throw new Error("Compte modifié");
      }),
    ).rejects.toThrow("Compte modifié");
    expect(mocks.share).not.toHaveBeenCalled();
  });
  it("prints a document without requiring a sharing application", async () => {
    mocks.available.mockResolvedValue(false);
    await exportCV({ full_name: "Alex" }, "print");
    expect(mocks.print).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining("Alex") }),
    );
    expect(mocks.available).not.toHaveBeenCalled();
    await expect(exportCV({ full_name: "Alex" }, "pdf")).rejects.toThrow(
      "partage de fichiers",
    );
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
});
